import { getSupabaseClient } from '@/lib/supabase';
import type { Rating } from '@/types/domain';

/**
 * Rating service layer.
 *
 * Writes go exclusively through `send2u_submit_rating` (client sends the
 * order id, a 1–5 score, and optional comment; identity, direction,
 * eligibility, and validation are derived server-side). Ratings never touch
 * the order lifecycle or payment rows. Reads are RLS-scoped to the order's
 * two parties. Errors are thrown explicitly; nothing is swallowed.
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface RatingRow {
  id: string;
  order_id: string;
  from_user_id: string;
  to_user_id: string;
  score: number;
  comment: string | null;
  created_at: string;
}

function toRating(row: RatingRow): Rating {
  return {
    id: row.id,
    orderId: row.order_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    score: row.score,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

/** Ratings for one order visible to the caller (at most one per party). */
export async function listOrderRatings(orderId: string): Promise<Rating[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_ratings')
    .select('id, order_id, from_user_id, to_user_id, score, comment, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Could not load ratings: ${error.message}`);
  return (data as unknown as RatingRow[]).map(toRating);
}

/**
 * Submits the caller's rating for a completed order. One per party per
 * order — resubmission is rejected server-side (the row is immutable once
 * written). Throws a friendly message naming the actual problem.
 */
export async function submitRating(
  orderId: string,
  score: number,
  comment: string | null,
): Promise<Rating> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_submit_rating', {
    p_order_id: orderId,
    p_score: score,
    p_comment: comment,
  });
  if (error) throw new Error(friendlyRatingError(error.message));
  if (!isRecord(data) || typeof data.id !== 'string') {
    throw new Error('The rating came back in an unexpected shape.');
  }
  const { id, order_id, from_user_id, to_user_id, score: gotScore, comment: gotComment, created_at } = data;
  if (
    typeof order_id !== 'string' ||
    typeof from_user_id !== 'string' ||
    typeof to_user_id !== 'string' ||
    typeof gotScore !== 'number' ||
    (gotComment !== null && typeof gotComment !== 'string') ||
    typeof created_at !== 'string'
  ) {
    throw new Error('The rating came back in an unexpected shape.');
  }
  return {
    id,
    orderId: order_id,
    fromUserId: from_user_id,
    toUserId: to_user_id,
    score: gotScore,
    comment: gotComment,
    createdAt: created_at,
  };
}

function friendlyRatingError(message: string): string {
  if (/not authenticated|session expired/i.test(message))
    return 'Your session expired. Sign in again and retry.';
  if (/order not found/i.test(message)) return 'That order is not available to you.';
  if (/only completed orders/i.test(message))
    return 'You can rate once the order is completed and paid.';
  if (/score must be between 1 and 5/i.test(message))
    return 'Pick a rating from 1 to 5 stars.';
  if (/comment too long/i.test(message))
    return 'Keep the feedback under 500 characters.';
  if (/already rated/i.test(message))
    return 'You already rated this order. Ratings cannot be changed.';
  return message ? `Could not submit the rating: ${message}` : 'Could not submit the rating.';
}
