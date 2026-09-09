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

function toProfile(row: { id: string; role: string; created_at: string; updated_at: string }): Profile {
  return {
    id: row.id,
    role: row.role as ProfileRole,
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
    .select('id, role, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toProfile(data) : null;
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
    .select('id, role, created_at, updated_at')
    .single();
  if (error) throw error;
  return toProfile(data);
}

export interface DevSession {
  user: User;
  profile: Profile;
}

/**
 * Development entry: reuse the existing session when present, otherwise
 * create a real anonymous Supabase session, then ensure the profile row
 * carries the requested role.
 */
export async function continueAsDev(role: UserRole): Promise<DevSession> {
  const active = await getActiveSession();
  const { user } = active ?? (await signInAnonymously());
  const profile = await setProfileRole(user.id, role);
  return { user, profile };
}

/** Development role switch: updates the signed-in user's profile row. */
export async function switchDevRole(role: UserRole): Promise<Profile> {
  const active = await getActiveSession();
  if (!active) throw new Error('No active session. Enter as a role first.');
  return setProfileRole(active.user.id, role);
}

export async function signOut(): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
