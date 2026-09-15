import { dedupeRequest } from '@/lib/dedupe';
import { getSupabaseClient } from '@/lib/supabase';

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

export interface HelperIdentity {
  helperId: string;
  /** Human label (helper's own name) or null when unset — never fabricated. */
  displayLabel: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Public identity of the helper assigned to an order, visible to that
 * order's requester only. Backed by `send2u_helper_public_identity`, which
 * exposes a display label and nothing else (no email, phone, or IDs beyond
 * the helper row itself). Returns null when no helper is assigned, the
 * caller is not the requester, or the helper set no name — callers fall
 * back to a short-id label, never a fabricated name.
 */
export async function getHelperIdentity(orderId: string): Promise<HelperIdentity | null> {
  return dedupeRequest(`send2u:helper-identity:${orderId}`, async () => {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('send2u_helper_public_identity', {
      p_order_id: orderId,
    });
    if (error) throw new Error('Could not load helper details.');
    if (data === null) return null;
    if (!isRecord(data) || typeof data.helper_id !== 'string') {
      throw new Error('Helper data came back in an unexpected shape.');
    }
    const { helper_id, display_label } = data;
    if (display_label !== null && typeof display_label !== 'string') {
      throw new Error('Helper data came back in an unexpected shape.');
    }
    return { helperId: helper_id, displayLabel: display_label };
  });
}

/** Display label with the honest fallback: "Helper #<short-id>". */
export function helperLabel(identity: HelperIdentity | null, helperId: string | null): string {
  if (identity?.displayLabel) return identity.displayLabel;
  if (identity?.helperId) return `Helper #${identity.helperId.slice(0, 8)}`;
  if (helperId) return `Helper #${helperId.slice(0, 8)}`;
  return 'Helper';
}
