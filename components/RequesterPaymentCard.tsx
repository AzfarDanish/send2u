import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { PrivateImage } from '@/components/PrivateImage';
import { OrderBreakdown } from '@/components/OrderBreakdown';
import { ReceiptEvidenceView } from '@/components/ReceiptEvidenceView';
import { StagedFileCard } from '@/components/StagedFileCard';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { usePaymentFlow } from '@/hooks/usePaymentFlow';
import { formatMYR } from '@/lib/money';

interface RequesterPaymentCardProps {
  orderId: string;
  /** Bump to force a reload (e.g. right after confirming receipt on this screen). */
  refreshToken?: number;
}

/**
 * Requester payment section: helper QR, payment instructions, and receipt
 * submission. Receipt submission writes verified and closes the order in one
 * step — no helper review and no rejected/resubmit state. Amounts always come
 * from the order via payment context. State lives in `usePaymentFlow`,
 * shared with the dedicated payment/receipt screens.
 */
export function RequesterPaymentCard({ orderId, refreshToken = 0 }: RequesterPaymentCardProps) {
  const {
    context,
    status,
    error,
    reloading,
    retry,
    busy,
    busyMessage,
    submitError,
    staged,
    cancelStaged,
    choose,
    confirm,
  } = usePaymentFlow(orderId, refreshToken);

  const handleChoose = () => void choose();
  const handleConfirm = () => void confirm();

  if (status === 'loading') {
    return (
      <Card style={styles.stateCard}>
        <LoadingState message="Loading payment…" />
      </Card>
    );
  }
  if (status === 'error' || !context) {
    return (
      <Card style={styles.stateCard}>
        <ErrorState
          title="Couldn't load payment"
          message={error ?? 'Check your connection and try again.'}
          retryTitle="Try again"
          onRetry={retry}
        />
      </Card>
    );
  }

  if (context.orderStatus === 'cancelled' || context.orderStatus === 'disputed') {
    return null;
  }

  if (!context.helperId || context.orderStatus === 'pending') {
    return (
      <Card>
        <Badge label="No payment yet" tone="neutral" />
        <Text variant="subtitle">Waiting for a helper</Text>
      </Card>
    );
  }

  if (context.orderStatus === 'delivered') {
    return (
      <Card>
        <Badge label="Confirm delivery first" tone="success" />
        <Text variant="subtitle">No payment yet</Text>
        <Text color="secondary">
          Confirm delivery above to open payment.
        </Text>
      </Card>
    );
  }

  if (
    context.orderStatus === 'assigned' ||
    context.orderStatus === 'going_to_vendor' ||
    context.orderStatus === 'at_vendor' ||
    context.orderStatus === 'food_available' ||
    context.orderStatus === 'food_purchased' ||
    context.orderStatus === 'picked_up' ||
    context.orderStatus === 'out_for_delivery' ||
    context.orderStatus === 'delivering'
  ) {
    return (
      <Card>
        <Badge label="Pay after delivery" tone="info" />
        <Text variant="subtitle">No payment yet</Text>
      </Card>
    );
  }

  const payment = context.payment;

  return (
    <Card>
      <View style={styles.header}>
        <Text variant="subtitle">{payment ? 'Payment' : 'Payment required'}</Text>
        {reloading ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            accessibilityLabel="Updating payment…"
          />
        ) : payment ? (
          <Badge label="Recorded" tone="success" />
        ) : (
          <Badge label="Unpaid" tone="warning" />
        )}
      </View>
      <OrderBreakdown
        subtotalCents={context.subtotalCents}
        deliveryFeeCents={context.deliveryFeeCents}
      />

      {payment ? (
        <>
          <Text color="secondary">
            Payment of {formatMYR(payment.amountCents)} recorded.
          </Text>
          <ReceiptEvidenceView path={payment.evidencePath} />
          <Text variant="caption" color="muted">
            Nothing left to do — your request is complete.
          </Text>
        </>
      ) : (
        <>
          <Text variant="subtitle">Amount to pay: {formatMYR(context.totalCents)}</Text>
          {context.helperId ? (
            <Text variant="caption" color="secondary">
              Helper {context.helperId.slice(0, 8)}… will receive this payment directly.
            </Text>
          ) : null}
          <View style={styles.stepsCard}>
            <Text variant="subtitle">Pay outside the app</Text>
            <Text color="secondary">1. Open your banking app.</Text>
            <Text color="secondary">2. Scan the provided QR code.</Text>
            <Text color="secondary">3. Complete the payment.</Text>
            <Text color="secondary">4. Save the payment receipt.</Text>
          </View>
          {context.helperQrPath ? (
            <>
              <PrivateImage path={context.helperQrPath} accessibilityLabel="Helper payment QR code" />
              <Text color="secondary">
                Pay {formatMYR(context.totalCents)} externally using this QR, then attach your
                receipt below.
              </Text>
            </>
          ) : (
            <ErrorState
              title="Payment unavailable"
              message="Your helper hasn't added a payment QR yet. Check back soon — don't pay anyone outside this QR."
            />
          )}
          {submitError ? (
            <ErrorState title="Submission failed" message={submitError} retryTitle="Try again" onRetry={() => void handleChoose()} />
          ) : null}
          {staged ? (
            <StagedFileCard
              file={{
                uri: staged.uri,
                name: staged.fileName,
                sizeBytes: staged.sizeBytes,
                mimeType: staged.mimeType,
              }}
              title="Review your receipt"
              note="Confirming records this as your payment."
              busy={busy}
              busyMessage={busyMessage}
              confirmTitle={`Confirm & submit (${formatMYR(context.totalCents)})`}
              onConfirm={handleConfirm}
              onRechoose={handleChoose}
              onCancel={cancelStaged}
            />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose payment receipt"
                accessibilityState={{ disabled: busy || !context.helperQrPath, busy }}
                onPress={handleChoose}
                disabled={busy || !context.helperQrPath}
                style={({ pressed }) => [
                  styles.uploadArea,
                  (busy || !context.helperQrPath) && styles.uploadDisabled,
                  pressed && !(busy || !context.helperQrPath) && styles.pressed,
                ]}>
                {busy ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <MaterialIcons
                    name="upload-file"
                    size={40}
                    color={!context.helperQrPath ? colors.disabled : colors.primary}
                  />
                )}
                <Text variant="subtitle">
                  {busy ? (busyMessage ?? 'Working…') : 'Choose receipt'}
                </Text>
                <Text variant="caption" color="secondary" style={styles.uploadHint}>
                  Tap to pick your payment receipt
                </Text>
              </Pressable>
              <Text variant="caption" color="muted">
                PDF or photo (JPG, PNG, WEBP, HEIC), up to 10 MB. Nothing uploads until you confirm.
              </Text>
            </>
          )}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 160, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepsCard: {
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  uploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 148,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  uploadDisabled: { borderColor: colors.disabledBackground, backgroundColor: colors.surfaceSecondary },
  pressed: { opacity: 0.7 },
  uploadHint: { textAlign: 'center' },
});
