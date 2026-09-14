import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { formatMYR } from '@/lib/money';
import { getPaymentContext, submitPaymentEvidence, type PaymentContext } from '@/services/payments';
import { evidencePathFor, pickReceiptFile, removeObject, uploadObject } from '@/services/storage';
import type { PickedReceipt } from '@/services/storage';

interface RequesterPaymentCardProps {
  orderId: string;
  /** Bump to force a reload (e.g. right after confirming receipt on this screen). */
  refreshToken?: number;
}

/**
 * Requester payment section: helper QR, payment instructions, and receipt
 * submission. Receipt submission writes verified and closes the order in one
 * step — no helper review and no rejected/resubmit state. Amounts always come
 * from the order via payment context.
 */
export function RequesterPaymentCard({ orderId, refreshToken = 0 }: RequesterPaymentCardProps) {
  const { user } = useAuth();
  const [context, setContext] = useState<PaymentContext | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  // Background refresh in flight while a context is already visible: the
  // card keeps showing stale content with a small inline spinner instead
  // of flashing back to the full loading card.
  const [reloading, setReloading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasContext = useRef(false);
  // Picked-but-not-submitted receipt awaiting explicit confirmation. Nothing
  // is uploaded or recorded until the user confirms.
  const [staged, setStaged] = useState<PickedReceipt | null>(null);

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      const background = opts?.background ?? false;
      if (background && hasContext.current) {
        setReloading(true);
      } else {
        setStatus('loading');
        setError(null);
      }
      try {
        const next = await getPaymentContext(orderId);
        setContext(next);
        hasContext.current = true;
        setStatus('ready');
      } catch (err) {
        // Background failures keep the stale card; foreground failures
        // (first mount, explicit retry) show the error card.
        if (!background || !hasContext.current) {
          setError(err instanceof Error ? err.message : 'Could not load payment details.');
          setStatus('error');
        }
      } finally {
        setReloading(false);
      }
    },
    [orderId],
  );

  // Timestamp of the last token-driven refetch. The focus effect below
  // skips its own refetch within a short window after one — the token
  // effect already covers it, so returning to the screen doesn't fetch
  // twice for the same update.
  const tokenBumpAt = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - tokenBumpAt.current < 1500) return;
      void load({ background: true });
    }, [load]),
  );

  useEffect(() => {
    if (refreshToken <= 0) return;
    tokenBumpAt.current = Date.now();
    let cancelled = false;
    (async () => {
      try {
        const next = await getPaymentContext(orderId);
        if (!cancelled) {
          setContext(next);
          hasContext.current = true;
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled && !hasContext.current) {
          setError(err instanceof Error ? err.message : 'Could not load payment details.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, refreshToken]);

  const handleChoose = useCallback(async () => {
    if (!user || busy) return;
    setBusy(true);
    setBusyMessage('Choosing receipt…');
    setSubmitError(null);
    try {
      const picked = await pickReceiptFile();
      if (picked) setStaged(picked);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not choose the receipt.');
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  }, [user, busy]);

  const handleConfirm = useCallback(async () => {
    if (!user || busy || !staged) return;
    setBusy(true);
    setBusyMessage('Uploading receipt…');
    setSubmitError(null);
    let uploadedPath: string | null = null;
    try {
      const path = evidencePathFor(user.id, orderId, staged.extension, staged.fileName);
      await uploadObject(path, staged);
      uploadedPath = path;
      setBusyMessage('Submitting…');
      await submitPaymentEvidence(orderId, path);
      setStaged(null);
      // Background reconcile: the RPC returns only amount+status (not the
      // full payment row), so refetch — preserving the visible card with an
      // inline spinner instead of blanking it.
      await load({ background: true });
    } catch (err) {
      if (uploadedPath) {
        try {
          await removeObject(uploadedPath);
        } catch {
          // Orphaned upload is harmless; the payment row was never created.
        }
      }
      setSubmitError(err instanceof Error ? err.message : 'Could not submit payment evidence.');
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  }, [user, busy, staged, orderId, load]);

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
          onRetry={() => void load()}
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
              onConfirm={() => void handleConfirm()}
              onRechoose={() => void handleChoose()}
              onCancel={() => setStaged(null)}
            />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose payment receipt"
                accessibilityState={{ disabled: busy || !context.helperQrPath, busy }}
                onPress={() => void handleChoose()}
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
