import type { Order } from '@/types/domain';

/**
 * Order service placeholder.
 * Real request → assignment → fulfilment → verification → confirmation →
 * payout logic will be implemented in later tasks once Supabase tables exist.
 */

export async function listRequesterOrders(_requesterId: string): Promise<Order[]> {
  // TODO: query Supabase `orders` table.
  return [];
}

export async function listAvailableDeliveries(): Promise<Order[]> {
  // TODO: query unassigned `requested` orders for helpers.
  return [];
}
