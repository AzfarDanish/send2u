import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Post-signup permissions onboarding flag, device-local per account.
 *
 * `pending` is recorded once at requester signup; `done` is written when
 * the two permission screens are tapped through. Absent means done, so
 * pre-existing accounts (and provisioned vendors, who never sign up) are
 * never prompted. Cross-device enforcement is deliberately out of scope —
 * this gate is about asking on the device in hand, not server-side gating.
 */

function keyFor(userId: string): string {
  return `send2u:onboarding-permissions:${userId}`;
}

/** Records that a fresh account still owes the permissions walkthrough. Best-effort. */
export async function markPermissionsOnboardingPending(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), 'pending');
  } catch {
    // Flag write failed: the user simply skips onboarding. Never block signup.
  }
}

/** Records that the permissions walkthrough was tapped through. Best-effort. */
export async function markPermissionsOnboardingDone(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), 'done');
  } catch {
    // Flag write failed: the gate re-checks next launch and asks again.
  }
}

/** True only when this account was flagged pending at signup and hasn't finished. */
export async function isPermissionsOnboardingPending(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) === 'pending';
  } catch {
    return false;
  }
}
