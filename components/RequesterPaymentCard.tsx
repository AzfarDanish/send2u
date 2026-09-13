import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrivateImage } from '@/components/PrivateImage';
import { OrderBreakdown } from '@/components/OrderBreakdown';
import { ReceiptEvidenceView } from '@/components/ReceiptEvidenceView';
import { StagedFileCard } from '@/components/StagedFileCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Text } from '@/components/ui/Text';
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
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Picked-but-not-submitted receipt awaiting explicit confirmation. Nothing
  // is uploaded or recorded until the user confirms.
  const [staged, setStaged] = useState<PickedReceipt | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setContext(await getPaymentContext(orderId));
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load payment details.');
      setStatus('error');
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Refresh-token bumps (e.g. right after confirming receipt on this
  // screen) reset to loading during render (the React-endorsed alternative
  // to setState-in-effect); the effect below then refetches with state
  // sets only in its async continuation.
  const [seenToken, setSeenToken] = useState(refreshToken);
  if (seenToken !== refreshToken) {
    setSeenToken(refreshToken);
    if (refreshToken > 0) {
      setStatus('loading');
      setError(null);
    }
  }

  useEffect(() => {
    if (refreshToken <= 0) return;
    let cancelled = false;
    (async () => {
      try {
        const next = await getPaymentContext(orderId);
        if (!cancelled) {
          setContext(next);
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
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
      await load();
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
        {payment ? (
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
          <Text color="secondary">1. Open your banking app.</Text>
          <Text color="secondary">2. Scan the provided QR code.</Text>
          <Text color="secondary">3. Complete the payment.</Text>
          <Text color="secondary">4. Save the payment receipt.</Text>
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
              <Button
                title={busy ? (busyMessage ?? 'Working…') : 'Submit payment receipt'}
                onPress={() => void handleChoose()}
                disabled={busy || !context.helperQrPath}
                loading={busy}
              />
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
});
