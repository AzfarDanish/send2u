import type { Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';
import type { Profile, ProfileRole, UserRole } from '@/types/domain';

/**
 * Authentication + profile service layer.
 * UI must call these (or `useAuth`) instead of touching Supabase directly.
 *
 * Identity comes from Supabase Auth; the Send2U role lives in the
 * `send2u_profiles` row keyed by `auth.uid()`. Nothing here is mocked:
 * every function hits the configured Supabase project and throws the real
 * error when something is unavailable (e.g. anonymous sign-ins disabled).
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

function toProfile(row: {
  id: string;
  role: string;
  payment_qr_path: string | null;
  is_available: boolean | null;
  availability_updated_at: string | null;
  created_at: string;
  updated_at: string;
}): Profile {
  return {
    id: row.id,
    role: row.role as ProfileRole,
    paymentQrPath: row.payment_qr_path,
    isAvailable: row.is_available ?? false,
    availabilityUpdatedAt: row.availability_updated_at ?? null,
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

/** Real Supabase anonymous sign-in. Throws if the provider is disabled. */
export async function signInAnonymously(): Promise<ActiveSession> {
  const supabase = requireClient();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.session) throw new Error('Anonymous sign-in returned no session.');
  return { session: data.session, user: data.session.user };
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_profiles')
    .select('id, role, payment_qr_path, is_available, availability_updated_at, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toProfile(data as any) : null;
}

/**
 * Sets the profile row's role, creating the row when missing (upsert on the
 * auth.uid() primary key). Covered by the insert + update ownership policies.
 */
export async function setProfileRole(userId: string, role: UserRole): Promise<Profile> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_profiles')
    .upsert({ id: userId, role, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select('id, role, payment_qr_path, is_available, availability_updated_at, created_at, updated_at')
    .single();
  if (error) throw error;
  return toProfile(data as any);
}

export interface DevSession {
  user: User;
  profile: Profile;
}

/**
 * Serializes concurrent dev entries: two rapid taps must share one
 * identity lookup instead of minting two anonymous users.
 */
let continueAsInflight: Promise<DevSession> | null = null;

/**
 * Session lookup with retries. A missing session on the first read can be
 * transient (token refresh/storage race); treating it as signed-out would
 * mint a brand-new anonymous user and orphan the previous identity.
 */
async function getActiveSessionWithRetry(attempts = 3): Promise<ActiveSession | null> {
  let last: ActiveSession | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await getActiveSession();
    if (last) return last;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return last;
}

/**
 * Development entry: reuse the existing session when present, otherwise
 * create a real anonymous Supabase session, then ensure the profile row
 * carries the requested role. Never signs in when a session already exists.
 */
export async function continueAsDev(role: UserRole): Promise<DevSession> {
  if (continueAsInflight) return continueAsInflight;
  continueAsInflight = (async () => {
    try {
      const active = await getActiveSessionWithRetry();
      const { user } = active ?? (await signInAnonymously());
      const profile = await setProfileRole(user.id, role);
      return { user, profile };
    } finally {
      continueAsInflight = null;
    }
  })();
  return continueAsInflight;
}

/** Development role switch: updates the signed-in user's profile row. */
export async function switchDevRole(role: UserRole): Promise<Profile> {
  const active = await getActiveSession();
  if (!active) throw new Error('No active session. Enter as a role first.');
  return setProfileRole(active.user.id, role);
}

/**
 * Points the signed-in user's profile at their payment QR object
 * (or clears it with null). Own row only — enforced by RLS.
 */
export async function setPaymentQrPath(path: string | null): Promise<Profile> {
  const supabase = requireClient();
  const active = await getActiveSession();
  if (!active) throw new Error('No active session. Enter as a role first.');
  const { data, error } = await supabase
    .from('send2u_profiles')
    .update({ payment_qr_path: path, updated_at: new Date().toISOString() })
    .eq('id', active.user.id)
    .select('id, role, payment_qr_path, is_available, availability_updated_at, created_at, updated_at')
    .single();
  if (error) throw error;
  return toProfile(data as any);
}

export async function signOut(): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
