import { getSupabaseClient } from '@/lib/supabase';

/**
 * Device push-token storage. One row per (user, token) so multiple devices
 * each receive pushes. Clients may only touch their own rows (RLS); the
 * server fan-out reads tokens with definer rights and never exposes another
 * user's token to any client.
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

async function requireUserId(): Promise<string> {
  const supabase = requireClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Could not register this device: ${error.message}`);
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Your session expired. Sign in again and retry.');
  return userId;
}

/** Inserts or refreshes this device's token for the signed-in user. */
export async function registerPushToken(token: string): Promise<void> {
  const supabase = requireClient();
  const userId = await requireUserId();
  const { error } = await supabase.from('send2u_push_tokens').upsert(
    { user_id: userId, token, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,token' },
  );
  if (error) throw new Error(`Could not register this device: ${error.message}`);
}

/** Removes this device's token. Best-effort at sign-out; stale tokens are
 * harmless (failed push deliveries never break order operations). */
export async function removePushToken(token: string): Promise<void> {
  const supabase = requireClient();
  const userId = await requireUserId();
  const { error } = await supabase
    .from('send2u_push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);
  if (error) throw new Error(`Could not remove this device: ${error.message}`);
}
