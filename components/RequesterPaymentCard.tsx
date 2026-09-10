import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrivateImage } from '@/components/PrivateImage';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { formatMYR } from '@/lib/money';
import { paymentStatusLabel, paymentStatusTone } from '@/lib/orders';
import { getPaymentContext, submitPaymentEvidence, type PaymentContext } from '@/services/payments';
import {
  evidencePathFor,
  pickReceiptFile,
  removeObject,
  uploadObject,
} from '@/services/storage';

interface RequesterPaymentCardProps {
  orderId: string;
}

/**
 * Requester payment section: helper QR, external-payment instructions,
 * evidence submission, and verification states. Amounts always come from
 * the order via payment context — the requester can never edit them.
 */
export function RequesterPaymentCard({ orderId }: RequesterPaymentCardProps) {
  const { user } = useAuth();
  const [context, setContext] = useState<PaymentContext | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const handleSubmit = useCallback(async () => {
    if (!user || busy) return;
    setBusy(true);
    setBusyMessage('Choosing receipt…');
    setSubmitError(null);
    let uploadedPath: string | null = null;
    try {
      const picked = await pickReceiptFile();
      if (!picked) {
        setBusy(false);
        setBusyMessage(null);
        return;
      }
      const path = evidencePathFor(user.id, orderId, picked.extension);
      setBusyMessage('Uploading receipt…');
      await uploadObject(path, picked);
      uploadedPath = path;
      setBusyMessage('Submitting…');
      await submitPaymentEvidence(orderId, path);
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
  }, [user, busy, orderId, load]);

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
        <Text color="secondary">
          Payment opens here once a helper accepts this order — you&apos;ll pay them externally
          using their QR.
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
    context.orderStatus === 'delivering' ||
    context.orderStatus === 'delivered'
  ) {
    return (
      <Card>
        <Badge label="Pay after delivery" tone="info" />
        <Text variant="subtitle">No payment yet</Text>
        <Text color="secondary">
          You pay {formatMYR(context.totalCents)} ({formatMYR(context.subtotalCents)} food +{' '}
          {formatMYR(context.deliveryFeeCents)} delivery) only after the food is in your hands.
          The helper&apos;s QR appears here on delivery.
        </Text>
      </Card>
    );
  }

  const payment = context.payment;

  return (
    <Card>
      <View style={styles.header}>
        <Text variant="subtitle">Payment</Text>
        {payment ? (
          <Badge label={paymentStatusLabel(payment.status)} tone={paymentStatusTone(payment.status)} />
        ) : (
          <Badge label="Unpaid" tone="warning" />
        )}
      </View>
      <View style={styles.amountRow}>
        <Text color="secondary">Amount due</Text>
        <Text variant="title" color="primary">
          {formatMYR(context.totalCents)}
        </Text>
      </View>
      <Text variant="caption" color="secondary">
        {formatMYR(context.subtotalCents)} food + {formatMYR(context.deliveryFeeCents)} delivery.
        This total comes from your order — it cannot be edited here.
      </Text>

      {!payment || payment.status === 'rejected' ? (
        <>
          {context.helperQrPath ? (
            <>
              <PrivateImage path={context.helperQrPath} accessibilityLabel="Helper payment QR code" />
              <Text color="secondary">
                Pay {formatMYR(context.totalCents)} to your helper externally using this QR, then attach
                your receipt below (PDF or photo, up to 10 MB). No money moves inside Send2U.
              </Text>
            </>
          ) : (
            <ErrorState
              title="Payment unavailable"
              message="Your helper hasn't added a payment QR yet. Check back soon — don't pay anyone outside this QR."
            />
          )}
          {payment?.status === 'rejected' ? (
            <Text color="secondary">
              Your last receipt was rejected. Pay again if needed and attach the new receipt.
            </Text>
          ) : null}
          {submitError ? (
            <ErrorState title="Submission failed" message={submitError} retryTitle="Try again" onRetry={() => void handleSubmit()} />
          ) : null}
          <Button
            title={busy ? (busyMessage ?? 'Working…') : payment ? 'Resubmit receipt' : 'Submit payment receipt'}
            onPress={() => void handleSubmit()}
            disabled={busy || !context.helperQrPath}
            loading={busy}
          />
        </>
      ) : payment.status === 'submitted' ? (
        <>
          <Text color="secondary">
            Receipt submitted for {formatMYR(payment.amountCents)}. Your helper is verifying it —
            nothing more to do right now.
          </Text>
          <Button title="Refresh status" variant="secondary" onPress={() => void load()} />
        </>
      ) : (
        <>
          <Text color="secondary">
            Payment of {formatMYR(payment.amountCents)} verified. Thanks — your helper will proceed
            with the delivery.
          </Text>
          <Button title="Refresh status" variant="secondary" onPress={() => void load()} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 160, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
});
