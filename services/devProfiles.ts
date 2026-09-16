import { dedupeRequest } from '@/lib/dedupe';
import { getSupabaseClient } from '@/lib/supabase';
import type { ProfileRole } from '@/types/domain';

/**
 * Development-only account switching.
 *
 * The list comes from the `send2u_list_dev_profiles` RPC, which only reveals
 * dev-flagged accounts (id, role, label, creation time — no QR paths, no
 * availability, no auth data) and only to callers who are themselves
 * dev-flagged. Switching goes through the `dev-switch-profile` edge function,
 * which mints a single-use sign-in for a dev-flagged target with an email
 * identity; the client redeems it into a real Supabase session. Nothing is
 * stored: no passwords, no tokens, no profile writes. Switching therefore
 * cannot create users, duplicate profiles, or mutate roles — it only changes
 * which existing account the device session belongs to.
 */

export interface DevProfile {
  id: string;
  role: ProfileRole;
  displayName: string | null;
  createdAt: string;
  isVerifiedHelper: boolean;
}

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Lists switchable development accounts. Throws for non-dev callers.
 * In-flight deduped: simultaneous mounts share one RPC call.
 */
export async function listDevProfiles(): Promise<DevProfile[]> {
  return dedupeRequest('send2u:dev-profiles', async () => {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('send2u_list_dev_profiles');
  if (error) {
    if (/not available to this account/i.test(error.message)) {
      throw new Error('Development profiles are not available to this account.');
    }
    if (/not authenticated|session.*expired|jwt/i.test(error.message)) {
      throw new Error('Your session expired. Sign in again and retry.');
    }
    throw new Error(error.message ? `Could not load test accounts: ${error.message}` : 'Could not load test accounts.');
  }
  if (!Array.isArray(data)) throw new Error('Test accounts came back in an unexpected shape.');
  const profiles: DevProfile[] = [];
  for (const row of data) {
    if (!isRecord(row) || typeof row.profile_id !== 'string' || typeof row.role !== 'string') continue;
    profiles.push({
      id: row.profile_id,
      role: row.role as ProfileRole,
      displayName: typeof row.display_name === 'string' ? row.display_name : null,
      createdAt: typeof row.created_at === 'string' ? row.created_at : '',
      isVerifiedHelper: row.is_verified_helper === true,
    });
  }
  return profiles;
  });
}

/**
 * Switches the device session to an existing development account.
 * Returns the assumed user id. Auth state listeners pick the session up;
 * callers must not invent follow-up writes (none are needed).
 */
export async function switchDevProfile(profileId: string): Promise<{ userId: string }> {
  const supabase = requireClient();
  const { data, error } = await supabase.functions.invoke('dev-switch-profile', {
    body: { profile_id: profileId },
  });
  if (error) {
    // functions.invoke surfaces HTTP failures as FunctionsHttpError with the
    // fetch Response on `.context`; fall back to message matching otherwise.
    const context = (error as { context?: unknown }).context;
    const status =
      context && typeof context === 'object' && 'status' in context
        ? (context as { status: unknown }).status
        : null;
    const message = error instanceof Error ? error.message : '';
    // Every authorization/availability failure is a 404 by server design (no
    // oracle between missing, non-dev, and not-yours); 401 means the caller's
    // own session is bad; 400 means the request itself was malformed.
    if (status === 404 || (/404|not found|unavailable/i.test(message) && status !== 401)) {
      throw new Error('That test account is unavailable (missing, removed, or not switchable).');
    }
    if (status === 401 || /unauthorized|session.*expired|jwt/i.test(message)) {
      throw new Error('Your session expired. Sign in again and retry.');
    }
    if (status === 400 || /bad request|profile_id is required/i.test(message)) {
      throw new Error('Invalid test account reference.');
    }
    throw new Error(message ? `Could not switch accounts: ${message}` : 'Could not switch accounts.');
  }
  if (!isRecord(data) || typeof data.token_hash !== 'string' || data.token_hash.length === 0) {
    throw new Error('Account switch came back in an unexpected shape.');
  }
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.token_hash,
    type: 'email',
  });
  if (verifyError || !verified.session) {
    throw new Error('The test sign-in expired. Try again.');
  }
  return { userId: verified.session.user.id };
}
