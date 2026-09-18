import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { OrderBreakdown } from '@/components/OrderBreakdown';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useTransaction } from '@/hooks/useTransaction';
import { formatMYR } from '@/lib/money';
import { paymentMethodLabel, paymentStatusLabel } from '@/lib/orders';

interface RequesterPaymentCardProps {
  orderId: string;
  /** Bump to force a reload (e.g. right after confirming receipt on this screen). */
  refreshToken?: number;
}

/**
 * Requester transaction section: payment method, amount, and payment state —
 * all recorded and managed by Send2U. Online orders pay in-app (simulated);
 * COD orders show the cash due on delivery. No helper QR, no receipt upload,
 * no external banking app. State lives in `useTransaction`, shared with the
 * dedicated payment screen.
 */
export function RequesterPaymentCard({ orderId, refreshToken = 0 }: RequesterPaymentCardProps) {
  const { context, status, error, reloading, retry } = useTransaction(orderId, refreshToken);

  if (status === 'loading') {
    return <LoadingState message="Loading payment…" />;
  }
  if (status === 'error' || !context) {
    return (
      <ErrorState
        title="Couldn't load payment"
        message={error ?? 'Check your connection and try again.'}
        retryTitle="Try again"
        onRetry={retry}
      />
    );
  }

  if (context.orderStatus === 'cancelled' || context.orderStatus === 'disputed') {
    return null;
  }

  const needsOnlinePay =
    context.paymentMethod === 'online' &&
    (context.paymentStatus === 'pending' ||
      context.paymentStatus === 'failed' ||
      context.paymentStatus === 'unpaid');

  return (
    <Card style={styles.card}>
      <Text variant="subtitle">{paymentMethodLabel(context.paymentMethod)}</Text>
      {reloading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          accessibilityLabel="Updating payment…"
        />
      ) : (
        <Text variant="caption" color="secondary">
          {paymentStatusLabel(context.paymentStatus)}
        </Text>
      )}
      <OrderBreakdown
        subtotalCents={context.subtotalCents}
        deliveryFeeCents={context.deliveryFeeCents}
      />

      {context.paymentMethod === 'online' ? (
        context.paymentStatus === 'paid' ? (
          <Text color="secondary">
            Payment of {formatMYR(context.totalCents)} recorded by Send2U.
          </Text>
        ) : (
          <>
            <Text color="secondary">
              {context.paymentStatus === 'failed'
                ? 'Your last payment attempt failed — you were not charged.'
                : 'Pay in Send2U now (simulated for this demo).'}
            </Text>
            {needsOnlinePay ? (
              <Button
                title={`Pay ${formatMYR(context.totalCents)}`}
                onPress={() =>
                  router.push({
                    pathname: '/(requester)/orders/[id]/pay-online',
                    params: { id: orderId },
                  })
                }
              />
            ) : null}
          </>
        )
      ) : context.paymentStatus === 'collected' ? (
        <Text color="secondary">
          Cash of {formatMYR(context.codCollectedCents ?? context.totalCents)} collected on
          delivery and recorded by Send2U.
        </Text>
      ) : (
        <Text color="secondary">
          Pay {formatMYR(context.codExpectedCents ?? context.totalCents)} in cash to your
          helper when your food arrives. Nothing is due now.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  // Bordered, explicitly shadow-free card surface.
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
});
