import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  INSTRUCTIONS_MAX_LENGTH,
  LOCATION_CATEGORIES,
  categoryLabelOf,
  formatCoordinate,
  isSavedLocationType,
  isSetLocationValid,
  resolveLocationText,
  resolveSavedLabel,
  resolveSavedSubDetails,
  validateSetLocation,
} from './locationDetails.ts';

test('label prefers the custom name for other, the building otherwise', () => {
  assert.equal(
    resolveSavedLabel({ category: 'other', customLabel: '  Guardhouse drop  ', building: 'KK Block C' }),
    'Guardhouse drop',
  );
  assert.equal(resolveSavedLabel({ category: 'home', building: '  KK Block C ' }), 'KK Block C');
  assert.equal(resolveSavedLabel({ category: 'home', building: '   ' }), '');
  assert.equal(resolveSavedLabel({ category: 'other', customLabel: '   ' }), '');
});

test('sub-details join only the non-empty block/floor/room parts', () => {
  assert.equal(
    resolveSavedSubDetails({ block: 'C', floorLevel: 'Level 3', roomUnit: 'Room 12' }),
    'C · Level 3 · Room 12',
  );
  assert.equal(resolveSavedSubDetails({ block: '', floorLevel: '  ', roomUnit: 'Room 12' }), 'Room 12');
  assert.equal(resolveSavedSubDetails({}), null);
});

test('resolved text combines label and sub-details without hardcoding', () => {
  assert.equal(
    resolveLocationText({ category: 'hostel', building: 'KKB', block: 'B', floorLevel: '2', roomUnit: '210' }),
    'KKB, B · 2 · 210',
  );
  assert.equal(resolveLocationText({ category: 'home', building: 'KKB' }), 'KKB');
  assert.equal(resolveLocationText({}), '');
});

test('category vocabulary covers the required five and guards unknown values', () => {
  const types = LOCATION_CATEGORIES.map((category) => category.type);
  for (const required of ['home', 'class', 'hostel', 'office', 'other']) {
    assert.ok(types.includes(required as never), `missing category ${required}`);
  }
  assert.ok(isSavedLocationType('hostel'));
  assert.ok(!isSavedLocationType('dorm'));
  assert.ok(!isSavedLocationType(null));
  assert.equal(categoryLabelOf('class'), 'Class/Academic');
  assert.equal(categoryLabelOf('other'), 'Other');
});

test('validation requires building, category, custom name for other, and a pin', () => {
  const base = { building: 'KKB', category: 'hostel' as const, customLabel: '', instructions: '', hasPin: true };
  assert.ok(isSetLocationValid(validateSetLocation(base)));
  assert.equal(validateSetLocation({ ...base, building: '   ' }).building, 'Enter the building or facility.');
  assert.equal(validateSetLocation({ ...base, category: null }).category, 'Choose a location label.');
  assert.equal(
    validateSetLocation({ ...base, category: 'other', customLabel: '  ' }).customLabel,
    'Name this location.',
  );
  assert.ok(
    isSetLocationValid(validateSetLocation({ ...base, category: 'other', customLabel: 'Side gate' })),
  );
  assert.equal(validateSetLocation({ ...base, hasPin: false }).pin, 'Pan the map so the centre pin sits on your delivery spot.');
  assert.ok(!isSetLocationValid(validateSetLocation({ ...base, building: '' })));
});

test('validation enforces the instructions ceiling', () => {
  const base = { building: 'KKB', category: 'home' as const, customLabel: '', instructions: '', hasPin: true };
  assert.ok(isSetLocationValid(validateSetLocation({ ...base, instructions: 'x'.repeat(INSTRUCTIONS_MAX_LENGTH) })));
  assert.ok(!isSetLocationValid(validateSetLocation({ ...base, instructions: 'x'.repeat(INSTRUCTIONS_MAX_LENGTH + 1) })));
});

test('coordinates render stably at six decimals', () => {
  assert.equal(formatCoordinate(3.123456789), '3.123457');
  assert.equal(formatCoordinate(-101.5), '-101.500000');
});
