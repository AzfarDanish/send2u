import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { OrderWithDetails } from '@/types/domain';

import { applyOrderChange, emitOrderChanged, subscribeOrderChanges } from './orderEvents.ts';

/** Minimal order-shaped fixture — only `id` matters to the list ops. */
function order(id: string): OrderWithDetails {
  return { id } as OrderWithDetails;
}

test('applyOrderChange asks for a refetch when an absent order newly belongs', () => {
  const prev = [order('a'), order('b')];
  const patch = applyOrderChange(prev, order('c'), true);
  assert.equal(patch.next, prev, 'list reference must be preserved');
  assert.equal(patch.needsRefetch, true);
});

test('applyOrderChange is a no-op when an absent order does not belong', () => {
  const prev = [order('a')];
  const patch = applyOrderChange(prev, order('c'), false);
  assert.equal(patch.next, prev);
  assert.equal(patch.needsRefetch, false);
});

test('applyOrderChange drops an order that left this bucket', () => {
  const prev = [order('a'), order('b'), order('c')];
  const patch = applyOrderChange(prev, order('b'), false);
  assert.deepEqual(
    patch.next.map((item) => item.id),
    ['a', 'c'],
  );
  assert.equal(patch.needsRefetch, false);
  assert.notEqual(patch.next, prev, 'a changed list must be a new reference');
});

test('applyOrderChange keeps the same reference for an identical row', () => {
  const row = order('a');
  const prev = [row, order('b')];
  const patch = applyOrderChange(prev, row, true);
  assert.equal(patch.next, prev);
  assert.equal(patch.needsRefetch, false);
});

test('applyOrderChange replaces a changed row in place and leaves others untouched', () => {
  const first = order('a');
  const third = order('c');
  const prev = [first, order('b'), third];
  const updated = order('b');
  const patch = applyOrderChange(prev, updated, true);
  assert.equal(patch.next.length, 3);
  assert.equal(patch.next[0], first, 'untouched rows keep identity');
  assert.equal(patch.next[2], third, 'untouched rows keep identity');
  assert.equal(patch.next[1], updated);
  assert.equal(patch.needsRefetch, false);
  assert.notEqual(patch.next, prev);
});

test('applyOrderChange never blanks or reorders the list', () => {
  const prev = [order('a'), order('b'), order('c')];
  const patch = applyOrderChange(prev, order('b'), false);
  assert.deepEqual(
    patch.next.map((item) => item.id),
    ['a', 'c'],
  );
  assert.ok(patch.next.every((item) => item.id.length > 0));
});

test('emitOrderChanged notifies every subscriber', () => {
  const seen: string[] = [];
  const offA = subscribeOrderChanges((item) => seen.push(`a:${item.id}`));
  const offB = subscribeOrderChanges((item) => seen.push(`b:${item.id}`));
  try {
    emitOrderChanged(order('x'));
    assert.deepEqual(seen, ['a:x', 'b:x']);
  } finally {
    offA();
    offB();
  }
});

test('a throwing subscriber cannot break the others', () => {
  const seen: string[] = [];
  const offBad = subscribeOrderChanges(() => {
    throw new Error('bad listener');
  });
  const offGood = subscribeOrderChanges((item) => seen.push(item.id));
  try {
    assert.doesNotThrow(() => emitOrderChanged(order('x')));
    assert.deepEqual(seen, ['x'], 'the good listener still received the emit');
  } finally {
    offBad();
    offGood();
  }
});

test('unsubscribe actually removes the listener', () => {
  const seen: string[] = [];
  const off = subscribeOrderChanges((item) => seen.push(item.id));
  off();
  emitOrderChanged(order('x'));
  assert.deepEqual(seen, []);

  // Unsubscribing twice must stay harmless.
  assert.doesNotThrow(() => off());
  emitOrderChanged(order('y'));
  assert.deepEqual(seen, []);
});
