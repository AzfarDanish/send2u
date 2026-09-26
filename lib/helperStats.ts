import type { OrderWithDetails, Rating } from '@/types/domain';

/**
 * Helper-facing figures derived from records the backend already holds.
 *
 * Nothing here queries or estimates: these are pure reductions over the helper's
 * own terminal deliveries and the ratings left on them, shared by the Deliveries
 * tab, the Earnings screen and the Helper Portal profile so the same number can
 * never be computed two different ways.
 */

/**
 * Settled earnings: the delivery fee on completed, settled orders only.
 *
 * Food is covered by Send2U and COD cash collected on delivery belongs to
 * Send2U, so neither counts as helper income.
 */
export function settledEarningsCents(deliveries: OrderWithDetails[]): number {
  return deliveries
    .filter(
      (delivery) => delivery.status === 'completed' && delivery.settlementStatus === 'settled',
    )
    .reduce((sum, delivery) => sum + delivery.deliveryFeeCents, 0);
}

/** Deliveries this helper completed. Cancelled and disputed are excluded. */
export function completedDeliveryCount(deliveries: OrderWithDetails[]): number {
  return deliveries.filter((delivery) => delivery.status === 'completed').length;
}

/**
 * The helper's own rating, from the scores left on their own deliveries.
 *
 * Ratings arrive from a read already scoped to the caller as a party; keeping
 * only scores whose order is in `deliveries` narrows that to jobs this account
 * carried, so a rating received as a requester cannot inflate it. Returns null
 * when nothing has been rated — an unrated helper has no rating, not a perfect
 * one.
 */
export function helperRatingSummary(
  deliveries: OrderWithDetails[],
  ratings: Rating[],
): { average: number; count: number } | null {
  const deliveredOrderIds = new Set(deliveries.map((delivery) => delivery.id));
  const scores = ratings
    .filter((rating) => deliveredOrderIds.has(rating.orderId))
    .map((rating) => rating.score);
  if (scores.length === 0) return null;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return { average: total / scores.length, count: scores.length };
}
