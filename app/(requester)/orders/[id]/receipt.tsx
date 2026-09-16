import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ReceiptEvidenceView } from '@/components/ReceiptEvidenceView';
import { StagedFileCard } from '@/components/StagedFileCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { GlassHeader } from '@/components/GlassHeader';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
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
 * Upload Payment Receipt: stage a receipt, review it, and submit. The
 * validated file uploads to the requester's own evidence path and the RPC
 * records the payment in one step — success is shown only after both
 * succeed, and the just-submitted state offers the way back to the
 * request. Same `usePaymentFlow` pipeline as the inline card.
 */
export default function OrderReceiptScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof id === 'string' ? id : null;
  const [submitted, setSubmitted] = useState(false);

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
  } = usePaymentFlow(orderId ?? '');

  const handleSubmit = async () => {
    const ok = await confirm();
    if (ok) setSubmitted(true);
  };

  if (!orderId) {
    return (
      <>
        <GlassHeader title="Upload Payment Receipt" />
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

  const alreadyRecorded = submitted || !!context?.payment;

  return (
    <>
      <GlassHeader title="Upload Payment Receipt" />
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
        ) : context.orderStatus === 'disputed' ? (
          <EmptyState
            icon="receipt-long"
            title="Receipt not available"
            message="This request is no longer payable."
            actionTitle="Back to request"
            onAction={() => router.back()}
          />
        ) : !context.helperId || context.orderStatus === 'pending' ? (
          <EmptyState
            icon="person-outline"
            title="Waiting for a helper"
            message="Receipt upload opens once a helper accepts this request."
            actionTitle="Back to request"
            onAction={() => router.back()}
          />
        ) : context.orderStatus === 'delivered' ? (
          <EmptyState
            icon="check-circle-outline"
            title="Confirm delivery first"
            message="Check your food and confirm receipt before paying."
            actionTitle="Review & confirm"
            onAction={() =>
              router.push({ pathname: '/(requester)/orders/[id]/confirm', params: { id: orderId } })
            }
          />
        ) : PRE_PAYMENT.has(context.orderStatus) ? (
          <EmptyState
            icon="delivery-dining"
            title="Pay after delivery"
            message="You'll upload the receipt once your food arrives."
            actionTitle="Back to request"
            onAction={() => router.back()}
          />
        ) : alreadyRecorded && context.payment ? (
          <>
            <Card>
              <View style={styles.header}>
                <Text variant="subtitle">Receipt submitted</Text>
                <Badge label="Recorded" tone="success" />
              </View>
              <Text color="secondary">
                Payment of {formatMYR(context.payment.amountCents)} recorded.
              </Text>
              <ReceiptEvidenceView path={context.payment.evidencePath} />
            </Section>
            <Button
              title="View Request"
              onPress={() => {
                // Receipt success is terminal for this flow: leave it behind
                // so Back from detail returns to the workflow, not here.
                if (router.canGoBack()) router.back();
                router.push({ pathname: '/(requester)/orders/[id]', params: { id: orderId } });
              }}
            />
          </>
        ) : (
          <>
            <View style={styles.infoCard}>
              <MaterialIcons name="upload-file" size={28} color={colors.primary} />
              <View style={styles.infoText}>
                <Text variant="secondary" style={styles.infoTitle}>
                  Upload proof of payment
                </Text>
                <Text color="secondary">This helps us verify your payment.</Text>
                <Text variant="caption" color="secondary">
                  Supported formats: JPG, PNG, WEBP, HEIC, PDF (Max 10 MB)
                </Text>
              </View>
            </View>

            {reloading ? (
              <View style={styles.refreshRow}>
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  accessibilityLabel="Updating payment…"
                />
                <Text variant="caption" color="secondary">
                  Updating payment…
                </Text>
              </View>
            ) : null}
            {submitError ? (
              <ErrorState
                title="Submission failed"
                message={submitError}
                retryTitle="Try again"
                onRetry={() => void choose()}
              />
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
                note={`Submitting records your ${formatMYR(context.totalCents)} payment and completes the request.`}
                busy={busy}
                busyMessage={busyMessage}
                confirmTitle="Submit Receipt"
                onConfirm={() => void handleSubmit()}
                onRechoose={() => void choose()}
                onCancel={cancelStaged}
              />
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose payment receipt"
                  accessibilityState={{ disabled: busy || !context.helperQrPath, busy }}
                  onPress={() => void choose()}
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
                  <Text variant="subtitle">{busy ? (busyMessage ?? 'Working…') : 'Choose receipt'}</Text>
                  <Text variant="caption" color="secondary" style={styles.centered}>
                    Tap to pick your payment receipt
                  </Text>
                </Pressable>
                <Text variant="caption" color="muted" style={styles.centered}>
                  PDF or photo (JPG, PNG, WEBP, HEIC), up to 10 MB. Nothing uploads until you
                  confirm.
                </Text>
              </>
            )}
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
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  infoText: { flex: 1, gap: spacing.xs },
  infoTitle: { fontWeight: '600', color: colors.text },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  centered: { textAlign: 'center' },
});
