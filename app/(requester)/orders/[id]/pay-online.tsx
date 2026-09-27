import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { goBackOr } from '@/lib/navigation';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { HeaderBack } from '@/components/HeaderBack';
import { RedScreen } from '@/components/RedScreen';
import { OrderBreakdown } from '@/components/OrderBreakdown';
import { Button } from '@/components/ui/Button';
import { DockedActionBar } from '@/components/ui/DockedActionBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonKeyValueRows } from '@/components/ui/LoadingBlocks';
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
      <RedScreen
        title="Online Payment"
        titleSize="title"
        leading={<HeaderBack fallbackHref="/(requester)/orders" color={colors.onPrimary} />}>
        <ErrorState
          title="Request not found"
          message="This request isn't available to you."
          retryTitle="Back to requests"
          onRetry={() => router.push('/(requester)/orders')}
        />
      </RedScreen>
    );
  }

  const paid = context?.paymentStatus === 'paid';
  const failed = payPhase === 'failed' || context?.paymentStatus === 'failed';
  const processing = payPhase === 'starting' || payPhase === 'processing' || payBusy;
  // The one state with a docked action: a payable online order that has not
  // finished. Every other branch keeps its inline buttons.
  const payable =
    !!context &&
    context.paymentMethod !== 'cod' &&
    context.orderStatus !== 'cancelled' &&
    context.orderStatus !== 'disputed' &&
    !paid &&
    payPhase !== 'success';

  return (
    <RedScreen
      title="Online Payment"
      titleSize="title"
      leading={
        <HeaderBack
          fallbackHref={
            orderId
              ? `/(requester)/orders/${orderId}`
              : '/(requester)/orders'
          }
          color={colors.onPrimary}
        />
      }
      scrollable={false}
      contentStyle={styles.shell}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {status === 'loading' ? (
          <View>
            <SkeletonBlock lines={2} label="Loading payment" />
            <SkeletonKeyValueRows rows={4} />
          </View>
        ) : status === 'error' || !context ? (
          <ErrorState
            title="Couldn't load payment"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        ) : context.paymentMethod === 'cod' ? (
          <>
            <View>
              <Text variant="subtitle">Cash on Delivery</Text>
              <Text color="secondary">
                Pay {formatMYR(context.totalCents)} in cash to your helper when your food
                arrives. Nothing is due now.
              </Text>
            </View>
            <Button
              title="Back to Request"
              onPress={() =>
                goBackOr({ pathname: '/(requester)/orders/[id]', params: { id: orderId } })
              }
            />
          </>
        ) : context.orderStatus === 'cancelled' || context.orderStatus === 'disputed' ? (
          <EmptyState
            icon="receipt-long"
            title="Payment not available"
            message="This request is no longer payable."
            actionTitle="Back to request"
            onAction={() =>
              goBackOr({ pathname: '/(requester)/orders/[id]', params: { id: orderId } })
            }
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
            <OrderBreakdown
              subtotalCents={context.subtotalCents}
              deliveryFeeCents={context.deliveryFeeCents}
            />
            <Button
              title="Continue"
              accessibilityLabel="Continue to your submitted request"
              onPress={() => {
                // Terminal transition like View Request below: step back to
                // the origin first so pay-online leaves history — Back from
                // Request Submitted returns Home, never to Payment successful.
                if (router.canGoBack()) router.back();
                router.push({
                  pathname: '/(requester)/orders/confirmation',
                  params: { orderIds: orderId },
                });
              }}
            />
          </>
        ) : (
          <>
            <View>
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
            </View>

            {processing ? (
              <View>
                <View style={styles.processingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text color="secondary">
                    {payPhase === 'starting' ? 'Starting payment…' : 'Processing payment…'}
                  </Text>
                </View>
                <Text variant="caption" color="muted">
                  Do not close this screen. Your payment is being recorded.
                </Text>
              </View>
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
      </ScrollView>
      {/* Fixed bottom sheet: Pay stays docked while the breakdown scrolls.
          The button stays mounted through processing (disabled + loading)
          instead of hiding, so the action context never jumps. */}
      {payable && context ? (
        <DockedActionBar>
          <Button
            title={failed ? 'Retry Payment' : `Pay ${formatMYR(context.totalCents)}`}
            onPress={() => void pay(false)}
            disabled={processing}
            loading={processing}
          />
        </DockedActionBar>
      ) : null}
    </RedScreen>
  );
}

const styles = StyleSheet.create({
  // Shell drops the scroll container's own padding: the inner scroll view
  // owns horizontal rhythm and the docked bar owns the bottom edge.
  shell: { flex: 1, paddingHorizontal: 0, paddingBottom: 0, gap: 0 },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
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
