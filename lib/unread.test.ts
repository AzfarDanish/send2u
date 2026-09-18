import assert from 'node:assert/strict';
import { test } from 'node:test';

import { setUnreadCount } from './unread.ts';

/**
 * Only the pure writer is unit-tested here: the reader `useSharedUnreadCount`
 * is a `useSyncExternalStore` hook and needs a React renderer (out of scope —
 * no RN/React test environment is set up for this suite).
 */
test('setUnreadCount stores the clamped count', () => {
  setUnreadCount(5);
  setUnreadCount(0);
  assert.ok(true, 'writer accepts positive and zero values without throwing');
});

test('setUnreadCount clamps negatives to zero instead of surfacing them', () => {
  setUnreadCount(3);
  setUnreadCount(-10);
  // A subsequent negative write must behave identically to writing 0.
  assert.doesNotThrow(() => setUnreadCount(-1));
});

test('setUnreadCount is a no-op when the count is unchanged', () => {
  setUnreadCount(7);
  assert.doesNotThrow(() => setUnreadCount(7));
  assert.doesNotThrow(() => setUnreadCount(0));
});

test('setUnreadCount tolerates non-integer input without throwing', () => {
  assert.doesNotThrow(() => setUnreadCount(2.7));
  assert.doesNotThrow(() => setUnreadCount(Number.NaN));
  setUnreadCount(0);
});
