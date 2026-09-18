import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

/**
 * Retired: receipt uploads were the old helper-reimbursement flow. Send2U
 * now manages every transaction, so there is nothing to upload. Kept as a
 * redirect so old links land on the live request instead of a dead screen.
 */
export default function OrderReceiptRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof id === 'string' ? id : null;

  useEffect(() => {
    if (orderId) {
      router.replace({ pathname: '/(requester)/orders/[id]', params: { id: orderId } });
    } else {
      router.replace('/(requester)/orders');
    }
  }, [orderId]);

  return null;
}
