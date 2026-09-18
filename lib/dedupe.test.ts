import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dedupeRequest } from './dedupe.ts';

/** A deferred promise plus its resolvers, for driving in-flight timing. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('concurrent identical keys share one underlying run call', async () => {
  const gate = deferred<string>();
  let calls = 0;
  const run = () => {
    calls += 1;
    return gate.promise;
  };

  const first = dedupeRequest('key-1', run);
  const second = dedupeRequest('key-1', run);
  const third = dedupeRequest('key-1', run);

  assert.equal(calls, 1, 'only one underlying request may run');
  gate.resolve('shared');
  assert.deepEqual(await Promise.all([first, second, third]), ['shared', 'shared', 'shared']);
  assert.equal(calls, 1);
});

test('distinct keys are not collapsed together', async () => {
  let calls = 0;
  const run = (value: string) => () => {
    calls += 1;
    return Promise.resolve(value);
  };

  const [a, b] = await Promise.all([dedupeRequest('key-a', run('a')), dedupeRequest('key-b', run('b'))]);
  assert.equal(a, 'a');
  assert.equal(b, 'b');
  assert.equal(calls, 2);
});

test('the key is released after settlement so a later call re-runs', async () => {
  let calls = 0;
  const run = () => {
    calls += 1;
    return Promise.resolve(calls);
  };

  assert.equal(await dedupeRequest('key-reuse', run), 1);
  assert.equal(await dedupeRequest('key-reuse', run), 2, 'nothing is cached after settlement');
  assert.equal(calls, 2);
});

test('a rejected run rejects every awaiter and clears the key for retry', async () => {
  const gate = deferred<string>();
  let calls = 0;
  const failing = () => {
    calls += 1;
    return gate.promise;
  };

  const first = dedupeRequest('key-fail', failing);
  const second = dedupeRequest('key-fail', failing);
  assert.equal(calls, 1);

  const boom = new Error('network down');
  gate.reject(boom);
  await assert.rejects(first, /network down/);
  await assert.rejects(second, /network down/);

  // The failed key must not wedge: a fresh call starts a new request.
  let retried = 0;
  const recovered = await dedupeRequest('key-fail', () => {
    retried += 1;
    return Promise.resolve('recovered');
  });
  assert.equal(recovered, 'recovered');
  assert.equal(retried, 1);
  assert.equal(calls, 1, 'the retry must not reuse the failed in-flight promise');
});

test('a new call after settlement is not blocked by a slow earlier pre-settlement call', async () => {
  const gate = deferred<number>();
  let calls = 0;
  const run = () => {
    calls += 1;
    return gate.promise;
  };

  const inFlight = dedupeRequest('key-slow', run);
  assert.equal(calls, 1);

  gate.resolve(1);
  assert.equal(await inFlight, 1);

  const after = await dedupeRequest('key-slow', () => {
    calls += 1;
    return Promise.resolve(2);
  });
  assert.equal(after, 2);
  assert.equal(calls, 2);
});
