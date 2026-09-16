import { getSupabaseClient } from '@/lib/supabase';

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export async function setHelperAvailability(isAvailable: boolean): Promise<{ isAvailable: boolean }> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_set_helper_availability', { p_is_available: isAvailable });
  if (error) throw new Error(friendlyError(error.message));
  if (!isRecord(data) || typeof data.is_available !== 'boolean') throw new Error('Unexpected availability response');
  return { isAvailable: data.is_available as boolean };
}
function friendlyError(msg: string): string {
  if (/not authenticated/i.test(msg)) return 'Your session expired. Sign in again.';
  if (/only helpers/i.test(msg)) return 'Only verified helpers can change availability.';
  return msg ? `Could not update availability: ${msg}` : 'Could not update availability.';
}
