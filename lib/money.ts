/** Formats integer MYR cents as "RM 6.50". No fees, taxes, or totals here. */
export function formatMYR(priceCents: number): string {
  return `RM ${(priceCents / 100).toFixed(2)}`;
}

/**
 * Parses user-typed Ringgit ("6.50", "6", "6.5", "RM 6.50") into integer
 * cents. Throws a friendly error for anything else. Client-side fast
 * feedback only — the server re-validates every price it stores.
 */
export function parsePriceToCents(raw: string): number {
  const cleaned = raw.trim().toUpperCase().replace(/^RM\s*/, '');
  // Commas are accepted only as well-formed thousands separators
  // ("1,234.56"). Stripping them unconditionally would silently turn a
  // comma-decimal typo like "6,50" into RM 650.00 — a 100x misread on a
  // price field, so a misplaced separator must fail loudly instead.
  if (cleaned.includes(',') && !/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error('Enter a valid price, e.g. 6.50.');
  }
  const normalized = cleaned.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Enter a valid price, e.g. 6.50.');
  }
  const cents = Math.round(Number.parseFloat(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 999999) {
    throw new Error('Enter a price between RM 0.00 and RM 9999.99.');
  }
  return cents;
}

/** Formats cents back for a price input, e.g. 650 → "6.50". */
export function formatPriceInput(priceCents: number): string {
  return (priceCents / 100).toFixed(2);
}
