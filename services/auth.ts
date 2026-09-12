import type { Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';
import type { Profile, ProfileRole, UserRole } from '@/types/domain';

/**
 * Authentication + profile service layer.
 * UI must call these (or `useAuth`) instead of touching Supabase directly.
 *
 * Production-style email/password accounts. Identity comes from Supabase
 * Auth; the Send2U role lives in the `send2u_profiles` row keyed by
 * `auth.uid()` and is written exactly once — at signup, by the
 * `send2u_handle_new_auth_user` database trigger from the signup metadata.
 * The role is permanent: no service here updates it, and the
 * `send2u_profiles_guard_immutable` trigger rejects role changes server-side.
 * Nothing here is mocked: every function hits the configured Supabase
 * project and throws the real (friendlified) error on failure.
 */

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

const PROFILE_SELECT =
  'id, role, payment_qr_path, is_available, availability_updated_at, is_dev_account, display_name, created_at, updated_at';

function toProfile(row: {
  id: string;
  role: string;
  payment_qr_path: string | null;
  is_available: boolean | null;
  availability_updated_at: string | null;
  is_dev_account: boolean | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}): Profile {
  return {
    id: row.id,
    role: row.role as ProfileRole,
    paymentQrPath: row.payment_qr_path,
    isAvailable: row.is_available ?? false,
    availabilityUpdatedAt: row.availability_updated_at ?? null,
    isDevAccount: row.is_dev_account ?? false,
    displayName: row.display_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ActiveSession {
  session: Session;
  user: User;
}

export async function getActiveSession(): Promise<ActiveSession | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;
  return { session: data.session, user: data.session.user };
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const supabase = requireClient();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => {
    data.subscription.unsubscribe();
  };
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toProfile(data as any) : null;
}

/** Email shape check for fast client-side feedback (server validates too). */
function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }
  return email;
}

function requirePassword(password: string): void {
  if (password.length < 6) {
    throw new Error('Use a password with at least 6 characters.');
  }
}

/** Maps Supabase auth failures to copy a user can act on. */
export function friendlyAuthError(message: string): string {
  if (/user already registered/i.test(message)) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Incorrect email or password. Check both and try again.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Check your inbox to confirm your email, then sign in.';
  }
  if (/email rate limit|rate limit exceeded|too many requests/i.test(message)) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  if (/network|fetch failed|failed to fetch/i.test(message)) {
    return 'Network error. Check your connection and try again.';
  }
  return message ? `Authentication failed: ${message}` : 'Authentication failed.';
}

export type SignUpResult =
  | { status: 'active'; user: User; session: Session; profile: Profile }
  | { status: 'confirmation-required'; user: User };

/**
 * Creates a real email/password account with exactly one permanent role.
 * The profile row is created atomically by the database signup trigger from
 * the same metadata — the client never writes the role, so it cannot be
 * forged or duplicated. In this development project email confirmation is
 * off, so signup returns a session and the caller enters the app immediately.
 * When confirmation is on (production default), no session is returned and
 * the caller must confirm via inbox first — this path never bypasses that.
 */
export async function signUpAccount(
  rawEmail: string,
  password: string,
  role: UserRole,
): Promise<SignUpResult> {
  const supabase = requireClient();
  const email = normalizeEmail(rawEmail);
  requirePassword(password);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role } },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
  if (!data.user) throw new Error('Signup came back in an unexpected shape.');
  if (!data.session) {
    return { status: 'confirmation-required', user: data.user };
  }
  const profile = await fetchProfile(data.user.id);
  if (!profile) {
    throw new Error('Your account was created but the profile is not ready yet. Sign in to retry.');
  }
  return { status: 'active', user: data.user, session: data.session, profile };
}

/** Signs an existing account in with email + password. */
export async function signInWithPassword(
  rawEmail: string,
  password: string,
): Promise<{ user: User; session: Session; profile: Profile | null }> {
  const supabase = requireClient();
  const email = normalizeEmail(rawEmail);
  if (password.length === 0) throw new Error('Enter your password.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyAuthError(error.message));
  if (!data.session) throw new Error('Sign-in came back in an unexpected shape.');
  const profile = await fetchProfile(data.session.user.id);
  return { user: data.session.user, session: data.session, profile };
}

/**
 * One-time repair for accounts that predate automatic profile creation and
 * therefore have NO profile row. INSERT-only: when a row already exists this
 * throws and never touches it, so an existing (permanent) role can never be
 * changed through here. New signups never need this — the trigger creates
 * their row atomically.
 */
export async function claimMissingProfile(role: UserRole): Promise<Profile> {
  const supabase = requireClient();
  const active = await getActiveSession();
  if (!active) throw new Error('No active session. Sign in first.');
  if (active.user.is_anonymous) {
    throw new Error('Anonymous sessions cannot claim a profile. Sign up instead.');
  }
  const existing = await fetchProfile(active.user.id);
  if (existing) {
    throw new Error('This account already has a profile and a permanent role.');
  }
  const { data, error } = await supabase
    .from('send2u_profiles')
    .insert({ id: active.user.id, role })
    .select(PROFILE_SELECT)
    .single();
  if (error) {
    if (/duplicate|already exists|unique/i.test(error.message)) {
      throw new Error('This account already has a profile and a permanent role.');
    }
    throw error;
  }
  return toProfile(data as any);
}

/**
 * Points the signed-in user's profile at their payment QR object
 * (or clears it with null). Own row only — enforced by RLS. Role and
 * dev-flag columns are untouched (and trigger-guarded regardless).
 */
export async function setPaymentQrPath(path: string | null): Promise<Profile> {
  const supabase = requireClient();
  const active = await getActiveSession();
  if (!active) throw new Error('No active session. Sign in first.');
  const { data, error } = await supabase
    .from('send2u_profiles')
    .update({ payment_qr_path: path, updated_at: new Date().toISOString() })
    .eq('id', active.user.id)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return toProfile(data as any);
}

export async function signOut(): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
