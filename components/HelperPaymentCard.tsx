import { useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrivateImage } from '@/components/PrivateImage';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import { paymentStatusLabel, paymentStatusTone } from '@/lib/orders';
import { getPaymentContext, reviewPayment, type PaymentContext } from '@/services/payments';
import { signedImageUrl } from '@/services/storage';

interface HelperPaymentCardProps {
  orderId: string;
  /** Refresh the parent job so badges stay truthful after a review. */
  onChanged: () => void;
  /** Bump to force a reload (e.g. right after accepting on this screen). */
  refreshToken?: number;
}

/**
 * Helper payment section for an assigned job: live payment state,
 * evidence inspection, and verify/reject. Only the assigned helper ever
 * sees this — enforced by the database, not the UI.
 */
export function HelperPaymentCard({ orderId, onChanged, refreshToken = 0 }: HelperPaymentCardProps) {
  const [context, setContext] = useState<PaymentContext | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'verified' | 'rejected' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  useEffect(() => {
    if (refreshToken > 0) void load();
  }, [load, refreshToken]);

  const handleReview = useCallback(
    async (decision: 'verified' | 'rejected') => {
      if (busy) return;
      setBusy(decision);
      setActionError(null);
      try {
        await reviewPayment(orderId, decision);
        await load();
        onChanged();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not review the payment.');
        await load();
      } finally {
        setBusy(null);
      }
    },
    [busy, orderId, load, onChanged],
  );

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

  if (!context.helperId) {
    return (
      <Card>
        <Badge label="No payment yet" tone="neutral" />
        <Text color="secondary">
          Payment opens once this job is accepted — the requester pays you externally using your
          QR.
        </Text>
      </Card>
    );
  }

  const payment = context.payment;
  if (context.orderStatus === 'delivered' && !payment) {
    return (
      <Card>
        <Badge label="Awaiting confirmation" tone="success" />
        <Text variant="subtitle">Waiting for the requester</Text>
        <Text color="secondary">
          They confirm receipt first, then pay you {formatMYR(context.totalCents)} externally.
          Make sure your payment QR is set in your profile so they can pay you.
        </Text>
        <Button title="Refresh" variant="secondary" onPress={() => void load()} />
      </Card>
    );
  }
  if (!payment) {
    return (
      <Card>
        <Badge label="Awaiting payment" tone="warning" />
        <Text variant="subtitle">Not paid yet</Text>
        <Text color="secondary">
          The requester hasn&apos;t submitted a receipt for {formatMYR(context.subtotalCents)}.
          Make sure your payment QR is set in your profile so they can pay you.
        </Text>
        <Button title="Refresh" variant="secondary" onPress={() => void load()} />
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.header}>
        <Text variant="subtitle">Payment</Text>
        <Badge label={paymentStatusLabel(payment.status)} tone={paymentStatusTone(payment.status)} />
      </View>
      <Text color="secondary">
        {formatMYR(payment.amountCents)} receipt from the requester:
      </Text>
      <EvidenceView path={payment.evidencePath} />
      {payment.status === 'submitted' ? (
        <>
          {actionError ? (
            <ErrorState
              title="Review failed"
              message={actionError}
              retryTitle="Reload"
              onRetry={() => void load()}
            />
          ) : null}
          <Button
            title={busy === 'verified' ? 'Confirming…' : 'Confirm payment'}
            onPress={() => void handleReview('verified')}
            disabled={busy !== null}
            loading={busy === 'verified'}
          />
          <Button
            title={busy === 'rejected' ? 'Rejecting…' : 'Reject receipt'}
            variant="danger"
            onPress={() => void handleReview('rejected')}
            disabled={busy !== null}
            loading={busy === 'rejected'}
          />
          <Text variant="caption" color="muted">
            Confirm only if the money actually arrived. Rejecting lets the requester resubmit.
          </Text>
        </>
      ) : payment.status === 'verified' ? (
        <Text color="secondary">You confirmed this payment. Proceed with the delivery.</Text>
      ) : (
        <>
          <Text color="secondary">
            You rejected this receipt. The requester can attach a new one.
          </Text>
          <Button title="Refresh" variant="secondary" onPress={() => void load()} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 160, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    minHeight: 64,
  },
  fileText: { flex: 1, gap: spacing.xs },
  fileName: { fontWeight: '600', color: colors.text },
});

/** Renders evidence inline for images, or an openable file row for documents. */
function EvidenceView({ path }: { path: string }) {
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  if (!path.toLowerCase().endsWith('.pdf')) {
    return <PrivateImage path={path} accessibilityLabel="Payment receipt from requester" />;
  }
  const fileName = path.split('/').pop() ?? 'receipt.pdf';
  const handleOpen = async () => {
    if (opening) return;
    setOpening(true);
    setOpenError(null);
    try {
      const url = await signedImageUrl(path);
      await Linking.openURL(url);
    } catch {
      setOpenError('Could not open the receipt. Try again.');
    } finally {
      setOpening(false);
    }
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open receipt ${fileName}`}
        onPress={() => void handleOpen()}
        style={({ pressed }) => [styles.fileRow, pressed && { opacity: 0.7 }]}>
        <MaterialIcons name="picture-as-pdf" size={28} color={colors.error} />
        <View style={styles.fileText}>
          <Text variant="secondary" style={styles.fileName} numberOfLines={1}>
            {fileName}
          </Text>
          <Text variant="caption" color="secondary">
            {opening ? 'Opening…' : 'Tap to open the PDF receipt'}
          </Text>
        </View>
        <MaterialIcons name="open-in-new" size={22} color={colors.primary} />
      </Pressable>
      {openError ? (
        <Text variant="caption" color="error">
          {openError}
        </Text>
      ) : null}
    </View>
  );
}
