import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { OrderBreakdown } from '@/components/OrderBreakdown';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonKeyValueRows } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useTransaction } from '@/hooks/useTransaction';
import { formatMYR } from '@/lib/money';

/**
 * Online Payment: simulated in-app platform payment (competition prototype —
 * no real money moves, no external banking app). The intent and completion
 * are persisted through RPCs with server-derived amounts; replaying a
 * completion is a safe no-op, so double taps can never double-charge.
 * COD orders never pay here — they show their cash-due state instead.
 */
export default function PayOnlineScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof id === 'string' ? id : null;

  const {
    context,
    status,
    error,
    retry,
    payPhase,
    payBusy,
    pay,
    actionError,
  } = useTransaction(orderId ?? '');

  if (!orderId) {
    return (
      <>
        <GlassHeader title="Online Payment" />
        <Screen beneathHeader>
          <ErrorState
            title="Request not found"
            message="This request isn't available to you."
            retryTitle="Back to requests"
            onRetry={() => router.push('/(requester)/orders')}
          />
        </Screen>
      </>
    );
  }

  const paid = context?.paymentStatus === 'paid';
  const failed = payPhase === 'failed' || context?.paymentStatus === 'failed';
  const processing = payPhase === 'starting' || payPhase === 'processing' || payBusy;

  return (
    <>
      <GlassHeader title="Online Payment" />
      <Screen beneathHeader>
        {status === 'loading' ? (
          <Card>
            <SkeletonBlock lines={2} label="Loading payment" />
            <SkeletonKeyValueRows rows={4} />
          </Card>
        ) : status === 'error' || !context ? (
          <ErrorState
            title="Couldn't load payment"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        ) : context.paymentMethod === 'cod' ? (
          <>
            <Card>
              <Text variant="subtitle">Cash on Delivery</Text>
              <Text color="secondary">
                Pay {formatMYR(context.totalCents)} in cash to your helper when your food
                arrives. Nothing is due now.
              </Text>
            </Card>
            <Button title="Back to Request" onPress={() => router.back()} />
          </>
        ) : context.orderStatus === 'cancelled' || context.orderStatus === 'disputed' ? (
          <EmptyState
            icon="receipt-long"
            title="Payment not available"
            message="This request is no longer payable."
            actionTitle="Back to request"
            onAction={() => router.back()}
          />
        ) : paid || payPhase === 'success' ? (
          <>
            <View style={styles.result}>
              <View style={styles.emblem}>
                <MaterialIcons name="check" size={36} color={colors.success} />
              </View>
              <Text variant="title" style={styles.centered}>
                Payment Successful
              </Text>
              <Text color="secondary" style={styles.centered}>
                {formatMYR(context.totalCents)} recorded by Send2U. Your cafeteria is
                preparing your food.
              </Text>
            </View>
            <Card>
              <OrderBreakdown
                subtotalCents={context.subtotalCents}
                deliveryFeeCents={context.deliveryFeeCents}
              />
            </Card>
            <Button
              title="Track Request"
              onPress={() =>
                router.push({ pathname: '/(requester)/orders/[id]', params: { id: orderId } })
              }
            />
          </>
        ) : (
          <>
            <Card>
              <View style={styles.amountRow}>
                <View style={styles.amountText}>
                  <Text color="secondary">Amount Due</Text>
                  <Text variant="title">{formatMYR(context.totalCents)}</Text>
                </View>
              </View>
              <OrderBreakdown
                subtotalCents={context.subtotalCents}
                deliveryFeeCents={context.deliveryFeeCents}
              />
            </Card>

            {processing ? (
              <Card>
                <View style={styles.processingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text color="secondary">
                    {payPhase === 'starting' ? 'Starting payment…' : 'Processing payment…'}
                  </Text>
                </View>
                <Text variant="caption" color="muted">
                  Do not close this screen. Your payment is being recorded.
                </Text>
              </Card>
            ) : null}

            {failed && !processing ? (
              <ErrorState
                title="Payment failed"
                message={
                  actionError ??
                  context.payment?.lastError ??
                  'You were not charged. Try again.'
                }
                retryTitle="Try again"
                onRetry={() => void pay(false)}
              />
            ) : null}

            {!processing ? (
              <Button
                title={failed ? 'Retry Payment' : `Pay ${formatMYR(context.totalCents)}`}
                onPress={() => void pay(false)}
                disabled={payBusy}
                loading={payBusy}
              />
            ) : null}

            <Text variant="caption" color="muted" style={styles.centered}>
              Simulated payment for this demo — no real money moves and no bank app is needed.
            </Text>
            {__DEV__ && !processing ? (
              <Button
                title="Simulate failure (test)"
                variant="tertiary"
                onPress={() => void pay(true)}
              />
            ) : null}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  amountText: { flex: 1, gap: spacing.xs },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  result: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  emblem: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
});
