/** Formats integer MYR cents as "RM 6.50". No fees, taxes, or totals here. */
export function formatMYR(priceCents: number): string {
  return `RM ${(priceCents / 100).toFixed(2)}`;
}
