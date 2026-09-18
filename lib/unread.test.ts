import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { setUnreadCount, useSharedUnreadCount } from './unread.ts';

/**
 * Reads the store back through its real public API — the reader hook. Server
 * rendering invokes `useSyncExternalStore`, so this exercises the same
 * snapshot the header bells render, with no RN or DOM environment needed.
 * A `setUnreadCount` that did nothing (or dropped its clamp) leaves the
 * rendered value wrong and fails these assertions, which is the point: an
 * earlier version of this file only asserted that calls did not throw and
 * passed even when the writer was replaced with a total no-op.
 */
function renderCount(): string {
  function Probe(): ReturnType<typeof createElement> {
    return createElement('span', null, String(useSharedUnreadCount()));
  }
  return renderToString(createElement(Probe));
}

test('the reader hook renders the value written by the writer', () => {
  for (const value of [1, 5, 42, 999]) {
    setUnreadCount(value);
    assert.equal(renderCount(), `<span>${value}</span>`);
  }
});

test('a zero count renders as zero', () => {
  setUnreadCount(0);
  assert.equal(renderCount(), '<span>0</span>');
});

test('negative counts are clamped to zero, never rendered negative', () => {
  setUnreadCount(4);
  assert.equal(renderCount(), '<span>4</span>');

  setUnreadCount(-10);
  assert.equal(renderCount(), '<span>0</span>', 'a negative write must clamp, not store');

  setUnreadCount(-1);
  assert.equal(renderCount(), '<span>0</span>');
});

test('the stored count persists across independent renders', () => {
  setUnreadCount(7);
  assert.equal(renderCount(), '<span>7</span>');
  assert.equal(renderCount(), '<span>7</span>', 'reading must not consume the count');
});

test('a later write replaces the previous count', () => {
  setUnreadCount(3);
  assert.equal(renderCount(), '<span>3</span>');

  setUnreadCount(8);
  assert.equal(renderCount(), '<span>8</span>');
});

test('writing the same value twice leaves the count unchanged', () => {
  setUnreadCount(6);
  setUnreadCount(6);
  assert.equal(renderCount(), '<span>6</span>');
});
