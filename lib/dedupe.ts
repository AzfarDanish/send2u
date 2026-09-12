/**
 * In-flight request dedupe for idempotent reads.
 *
 * Several screens mount hooks that fire the SAME read simultaneously (e.g.
 * the notification center fetches the unread count at the same moment as
 * the header bell). Without dedupe those are two full network roundtrips
 * for one answer. `dedupeRequest` collapses simultaneous identical calls
 * into a single underlying request: every caller awaits the same promise
 * and gets the same result (or the same error).
 *
 * Only in-flight calls are shared — nothing is cached after settlement, so
 * data can never go stale. Do NOT use for writes.
 */
const inflight = new Map<string, Promise<unknown>>();

export function dedupeRequest<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const task = run().finally(() => {
    if (inflight.get(key) === task) inflight.delete(key);
  });
  inflight.set(key, task);
  return task;
}
