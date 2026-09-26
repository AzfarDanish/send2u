import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { PaymentBrandId } from '@/lib/orders';

/**
 * Shared payment-brand icons (see `PAYMENT_BRANDS` in `lib/orders.ts`).
 * Unknown ids fall back to a generic payment glyph so a new brand never
 * renders blank before its icon lands here.
 */
const PAYMENT_BRAND_ICON: Record<PaymentBrandId, keyof typeof MaterialIcons.glyphMap> = {
  cash: 'payments',
  visa: 'credit-card',
  card: 'payment',
  tng: 'account-balance-wallet',
  fpx: 'account-balance',
  duitnow: 'qr-code',
};

export function paymentBrandIcon(
  id: PaymentBrandId,
): keyof typeof MaterialIcons.glyphMap {
  return PAYMENT_BRAND_ICON[id] ?? 'payment';
}
