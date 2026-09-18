import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

/**
 * Retired: the helper-QR + receipt flow is gone. Online payments live on
 * `pay-online`, COD needs no receipt. Kept as a redirect so old links land
 * somewhere honest instead of a dead screen.
 */
export default function OrderPaymentRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof id === 'string' ? id : null;

  useEffect(() => {
    if (orderId) {
      router.replace({ pathname: '/(requester)/orders/[id]/pay-online', params: { id: orderId } });
    } else {
      router.replace('/(requester)/orders');
    }
  }, [orderId]);

  return null;
}
