import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * One-time post-signup onboarding state, per account.
 *
 * Send2U shows its walkthrough slides ONCE, immediately after an account is
 * created — never to an account that merely signs in (existing users have
 * already seen the product, and re-showing slides on every fresh install
 * would be noise). The flag is therefore keyed by user id and defaults to
 * "done": only a signup explicitly records "pending".
 *
 * Storage is best-effort. A read failure resolves to "done" (never a
 * blocking or repeating walkthrough) and a write failure only means the
 * slides reappear if the same account signs in on this device again.
 *
 * Mirror of the `lib/unread.ts` pattern: a module store with
 * `useSyncExternalStore`, so state written during signup is visible to the
 * routing screen without a provider or a prop chain.
 */

const KEY_PREFIX = 'send2u.onboarding.v1.';

export type OnboardingState = 'loading' | 'pending' | 'done';

/** Known per-account outcomes for this session ('pending' until completed). */
const known = new Map<string, 'pending' | 'done'>();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function remember(userId: string, entry: 'pending' | 'done'): void {
  if (known.get(userId) === entry) return;
  known.set(userId, entry);
  emit();
}

/**
 * Records that this account was just created, so the walkthrough opens on
 * the way into the app. Called by signup before any navigation happens, so
 * the receiving screen reads "pending" synchronously (no flash of the
 * welcome screen first).
 */
export async function markOnboardingPending(userId: string): Promise<void> {
  remember(userId, 'pending');
  try {
    await AsyncStorage.setItem(KEY_PREFIX + userId, 'pending');
  } catch {
    // In-memory state still drives this session; a re-install just skips it.
  }
}

/** Marks the walkthrough as seen. Idempotent. */
export async function markOnboardingComplete(userId: string): Promise<void> {
  remember(userId, 'done');
  try {
    await AsyncStorage.setItem(KEY_PREFIX + userId, 'done');
  } catch {
    // Nothing to do: the in-memory outcome already stops it re-opening.
  }
}

/**
 * Resolves an account's onboarding state, reading persisted state once per
 * account per session. Returns 'done' for no account so callers can treat
 * every non-'pending' result as "do not open the walkthrough".
 */
export function useOnboardingStatus(userId: string | null): OnboardingState {
  const getSnapshot = useCallback(
    (): OnboardingState => (userId ? known.get(userId) ?? 'loading' : 'done'),
    [userId],
  );
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!userId || known.has(userId)) return;
    let cancelled = false;
    void (async () => {
      let entry: 'pending' | 'done' = 'done';
      try {
        const raw = await AsyncStorage.getItem(KEY_PREFIX + userId);
        if (raw === 'pending') entry = 'pending';
      } catch {
        // Unreadable storage: treat as settled rather than re-showing slides.
        entry = 'done';
      }
      if (!cancelled) remember(userId, entry);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, state]);

  return state;
}
