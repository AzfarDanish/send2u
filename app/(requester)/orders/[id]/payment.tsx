import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CopyButton } from '@/components/CopyButton';
import { DownloadableQR } from '@/components/DownloadableQR';
import { HelperIdentity } from '@/components/HelperIdentity';
import { OrderBreakdown } from '@/components/OrderBreakdown';
import { ReceiptEvidenceView } from '@/components/ReceiptEvidenceView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { GlassHeader } from '@/components/GlassHeader';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useHelperIdentity } from '@/hooks/useHelperIdentity';
import { usePaymentFlow } from '@/hooks/usePaymentFlow';
import { formatMYR } from '@/lib/money';

const PRE_PAYMENT = new Set([
  'assigned',
  'going_to_vendor',
  'at_vendor',
  'food_available',
  'food_purchased',
  'picked_up',
  'out_for_delivery',
  'delivering',
]);

/**
 * Payment Required: pay the helper externally using their real QR, then
 * continue to the receipt screen. Read-only here — nothing is marked paid
 * or verified; the receipt submission on the next screen is the payment
 * record. Gated to genuinely payable states.
 */
export default function OrderPaymentScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof id === 'string' ? id : null;

  const { context, status, error, reloading, retry } = usePaymentFlow(orderId ?? '');
  const {
    identity,
    status: identityStatus,
    retry: retryIdentity,
  } = useHelperIdentity(orderId ?? '', context?.helperId ?? null);

  if (!orderId) {
    return (
      <>
        <GlassHeader title="Payment Required" />
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

  return (
    <>
      <GlassHeader title="Payment Required" />
      <Screen beneathHeader>
        {status === 'loading' ? (
          <LoadingState message="Loading payment…" />
        ) : status === 'error' || !context ? (
          <ErrorState
            title="Couldn't load payment"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        ) : context.orderStatus === 'cancelled' || context.orderStatus === 'disputed' ? (
          <EmptyState
            icon="receipt-long"
            title="Payment not available"
            message="This request is no longer payable."
            actionTitle="Back to request"
            onAction={() => router.back()}
          />
        ) : !context.helperId || context.orderStatus === 'pending' ? (
          <EmptyState
            icon="person-outline"
            title="Waiting for a helper"
            message="Payment opens once a helper accepts this request."
            actionTitle="Back to request"
            onAction={() => router.back()}
          />
        ) : context.orderStatus === 'delivered' ? (
          <EmptyState
            icon="check-circle-outline"
            title="Confirm delivery first"
            message="Check your food and confirm receipt to open payment."
            actionTitle="Review & confirm"
            onAction={() =>
              router.push({ pathname: '/(requester)/orders/[id]/confirm', params: { id: orderId } })
            }
          />
        ) : PRE_PAYMENT.has(context.orderStatus) ? (
          <EmptyState
            icon="delivery-dining"
            title="Pay after delivery"
            message="You'll pay the helper once your food arrives."
            actionTitle="Back to request"
            onAction={() => router.back()}
          />
        ) : context.payment ? (
          <>
            <Card>
              <View style={styles.header}>
                <Text variant="subtitle">Payment</Text>
                <Badge label="Recorded" tone="success" />
              </View>
              <Text color="secondary">
                Payment of {formatMYR(context.payment.amountCents)} recorded.
              </Text>
              <ReceiptEvidenceView path={context.payment.evidencePath} />
            </Card>
            <Button title="Back to Request" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <View style={styles.infoCard}>
              <MaterialIcons name="info" size={28} color={colors.warning} />
              <View style={styles.infoText}>
                <Text variant="secondary" style={styles.infoTitle}>
                  Please pay the helper directly.
                </Text>
                <Text color="secondary">
                  Send2U does not process payments inside the app — it only records your receipt.
                </Text>
              </View>
            </View>

            <Card>
              <View style={styles.amountRow}>
                <View style={styles.amountText}>
                  <Text color="secondary">Total Amount</Text>
                  <Text variant="title">{formatMYR(context.totalCents)}</Text>
                </View>
                {reloading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    accessibilityLabel="Updating payment…"
                  />
                ) : (
                  <CopyButton
                    value={formatMYR(context.totalCents)}
                    accessibilityLabel={`Copy total amount ${formatMYR(context.totalCents)}`}
                  />
                )}
              </View>
              <OrderBreakdown
                subtotalCents={context.subtotalCents}
                deliveryFeeCents={context.deliveryFeeCents}
              />
            </Card>

            <Text variant="subtitle">Helper Details</Text>
            <Card>
              <HelperIdentity
                identity={identity}
                helperId={context.helperId}
                caption="Your helper receives this payment directly."
                loadFailed={identityStatus === 'error'}
                onRetry={retryIdentity}
              />
            </Card>

            <Text variant="subtitle">Helper Payment QR</Text>
            <Card>
              {context.helperQrPath ? (
                <DownloadableQR
                  path={context.helperQrPath}
                  accessibilityLabel="Helper payment QR code"
                />
              ) : (
                <ErrorState title="Payment unavailable" message="Your helper hasn't added a payment QR yet. Check back soon — don't pay anyone outside this QR." />
              )}
            </Card>

            <Button
              title="I Have Made the Payment"
              disabled={!context.helperQrPath}
              onPress={() =>
                router.push({ pathname: '/(requester)/orders/[id]/receipt', params: { id: orderId } })
              }
            />
            {!context.helperQrPath ? (
              <Text variant="caption" color="secondary" style={styles.centered}>
                Available once your helper adds a payment QR.
              </Text>
            ) : null}
            <Button
              title="Need Help?"
              variant="tertiary"
              onPress={() =>
                router.push({
                  pathname: '/(requester)/help/[id]',
                  params: { id: 'payment-receipts' },
                })
              }
            />
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  infoText: { flex: 1, gap: spacing.xs },
  infoTitle: { fontWeight: '600', color: colors.text },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  amountText: { flex: 1, gap: spacing.xs },
  centered: { textAlign: 'center' },
});
