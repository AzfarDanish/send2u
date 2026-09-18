import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatMYR, formatPriceInput, parsePriceToCents } from './money.ts';

test('formatMYR renders integer cents as RM with two decimals', () => {
  assert.equal(formatMYR(650), 'RM 6.50');
  assert.equal(formatMYR(200), 'RM 2.00');
  assert.equal(formatMYR(5), 'RM 0.05');
  assert.equal(formatMYR(0), 'RM 0.00');
  assert.equal(formatMYR(999999), 'RM 9999.99');
});

test('parsePriceToCents accepts the documented input shapes', () => {
  assert.equal(parsePriceToCents('6.50'), 650);
  assert.equal(parsePriceToCents('6'), 600);
  assert.equal(parsePriceToCents('6.5'), 650);
  assert.equal(parsePriceToCents('0'), 0);
  assert.equal(parsePriceToCents('0.01'), 1);
  assert.equal(parsePriceToCents('RM 6.50'), 650);
  assert.equal(parsePriceToCents('rm 6.50'), 650);
  assert.equal(parsePriceToCents('RM6.50'), 650);
  assert.equal(parsePriceToCents('1,234.56'), 123456);
  assert.equal(parsePriceToCents('  6.50  '), 650);
  assert.equal(parsePriceToCents('9999.99'), 999999);
});

test('parsePriceToCents rejects malformed and out-of-range input', () => {
  const bad = ['', '   ', 'abc', 'RM', '6.555', '6.50.50', '-1', '-6.50', '1.2.3', '6..5', '1e3'];
  for (const raw of bad) {
    assert.throws(() => parsePriceToCents(raw), `expected throw for ${JSON.stringify(raw)}`);
  }
  // Above the RM 9999.99 ceiling.
  assert.throws(() => parsePriceToCents('10000'));
  assert.throws(() => parsePriceToCents('99999.99'));
});

test('parsePriceToCents accepts commas only as well-formed thousands separators', () => {
  assert.equal(parsePriceToCents('1,234.56'), 123456);
  assert.equal(parsePriceToCents('1,234'), 123400);
});

test('parsePriceToCents rejects a misplaced comma instead of misreading the amount', () => {
  // Regression: stripping commas unconditionally turned a comma-decimal
  // typo into a 100x misread ("6,50" → RM 650.00). It must fail loudly.
  assert.throws(() => parsePriceToCents('6,50'));
  assert.throws(() => parsePriceToCents('6,5,0'));
  assert.throws(() => parsePriceToCents('12,34'));
  assert.throws(() => parsePriceToCents('1,23,456'));
  assert.throws(() => parsePriceToCents(',6.50'));
  assert.throws(() => parsePriceToCents('6.50,'));
  assert.throws(() => parsePriceToCents('1,2345'));
});

test('formatPriceInput round-trips cents into a price-input string', () => {
  assert.equal(formatPriceInput(650), '6.50');
  assert.equal(formatPriceInput(5), '0.05');
  assert.equal(formatPriceInput(0), '0.00');
  assert.equal(formatPriceInput(999999), '9999.99');
});

test('parsePriceToCents and formatPriceInput round-trip', () => {
  for (const cents of [0, 1, 5, 99, 100, 650, 200, 999999]) {
    assert.equal(parsePriceToCents(formatPriceInput(cents)), cents);
  }
});
