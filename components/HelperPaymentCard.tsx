import { useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { PrivateImage } from '@/components/PrivateImage';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import { paymentStatusLabel, paymentStatusTone } from '@/lib/orders';
import { getPaymentContext, type PaymentContext } from '@/services/payments';
import { displayFileName, downloadStorageFile, signedImageUrl } from '@/services/storage';

interface HelperPaymentCardProps {
  orderId: string;
  /** Bump to force a reload (e.g. right after accepting on this screen). */
  refreshToken?: number;
}

/**
 * Helper payment section for an assigned job: live payment state and
 * receipt inspection. There is no helper review step — the requester's
 * submitted receipt closes the order, so this card is read-only.
 * Only the assigned helper ever sees this (enforced by the database, not the UI).
 */
export function HelperPaymentCard({ orderId, refreshToken = 0 }: HelperPaymentCardProps) {
  const [context, setContext] = useState<PaymentContext | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  // Background refresh in flight while content is visible: keep the stale
  // card with an inline spinner instead of flashing the loading card.
  const [reloading, setReloading] = useState(false);
  const hasContext = useRef(false);

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

  if (status === 'loading') {
    return (
      <Section style={styles.stateCard}>
        <LoadingState message="Loading payment…" />
      </Section>
    );
  }
  if (status === 'error' || !context) {
    return (
      <Section style={styles.stateCard}>
        <ErrorState
          title="Couldn't load payment"
          message={error ?? 'Check your connection and try again.'}
          retryTitle="Try again"
          onRetry={() => void load()}
        />
      </Section>
    );
  }

  if (context.orderStatus === 'disputed') {
    return null;
  }

  if (!context.helperId) {
    return (
      <Card>
        <Badge label="No payment yet" tone="neutral" />
      </Section>
    );
  }

  const payment = context.payment;
  if (context.orderStatus === 'delivered' && !payment) {
    return (
      <Card>
        <Badge label="Awaiting confirmation" tone="success" />
        <Text variant="subtitle">Waiting for the requester</Text>
        <Button
          title="Refresh"
          variant="secondary"
          onPress={() => void load({ background: true })}
          loading={reloading}
          disabled={reloading}
        />
      </Section>
    );
  }
  if (!payment) {
    return (
      <Card>
        <Badge label="Awaiting payment" tone="warning" />
        <Text variant="subtitle">Not paid yet</Text>
        <Text color="secondary">
          Set your payment QR in your profile so they can pay you.
        </Text>
        <Button
          title="Refresh"
          variant="secondary"
          onPress={() => void load({ background: true })}
          loading={reloading}
          disabled={reloading}
        />
      </Section>
    );
  }

  return (
    <Card>
      <View style={styles.header}>
        <Text variant="subtitle">Payment</Text>
        {reloading ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            accessibilityLabel="Updating payment…"
          />
        ) : (
          <Badge label={paymentStatusLabel(payment.status)} tone={paymentStatusTone(payment.status)} />
        )}
      </View>
      <Text color="secondary">
        {formatMYR(payment.amountCents)} receipt from the requester:
      </Text>
      <EvidenceView path={payment.evidencePath} />
      {payment.status === 'verified' ? (
        <Text color="secondary">
          Payment recorded. Your {formatMYR(context.deliveryFeeCents)} delivery earning is finalized.
        </Text>
      ) : (
        <>
          <Button
            title="Refresh"
            variant="secondary"
            onPress={() => void load({ background: true })}
            loading={reloading}
            disabled={reloading}
          />
        </>
      )}
    </Section>
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

/**
 * Renders evidence with its full filename: inline image for photos,
 * openable file row for PDFs — plus a download button in both cases so the
 * helper can save the receipt to their device (share sheet on native).
 */
function EvidenceView({ path }: { path: string }) {
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileName = displayFileName(path);
  const handleOpen = async () => {
    if (opening) return;
    setOpening(true);
    setFileError(null);
    try {
      const url = await signedImageUrl(path);
      await Linking.openURL(url);
    } catch {
      setFileError('Could not open the receipt. Try again.');
    } finally {
      setOpening(false);
    }
  };
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadNotice(null);
    setFileError(null);
    try {
      const outcome = await downloadStorageFile(path, setDownloadProgress);
      setDownloadNotice(
        outcome === 'shared'
          ? 'Downloaded — complete saving in the share sheet.'
          : 'Opened in the viewer — save it from there.',
      );
    } catch {
      setFileError('Could not download the receipt. Try again.');
    } finally {
      setDownloading(false);
    }
  };
  const downloadButton = (
    <Button
      title={
        downloading
          ? downloadProgress !== null
            ? `Downloading… ${Math.round(downloadProgress * 100)}%`
            : 'Downloading…'
          : 'Download receipt'
      }
      variant="secondary"
      onPress={() => void handleDownload()}
      disabled={downloading || opening}
      loading={downloading}
    />
  );
  const downloadNoticeText = downloadNotice ? (
    <Text variant="caption" color="secondary">
      {downloadNotice}
    </Text>
  ) : null;
  if (!path.toLowerCase().endsWith('.pdf')) {
    return (
      <View style={{ gap: spacing.sm }}>
        <PrivateImage path={path} accessibilityLabel="Payment receipt from requester" />
        <Text variant="caption" color="muted">
          {fileName}
        </Text>
        {downloadButton}
        {downloadNoticeText}
        {fileError ? (
          <Text variant="caption" color="error">
            {fileError}
          </Text>
        ) : null}
      </View>
    );
  }
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
      {downloadButton}
      {downloadNoticeText}
      {fileError ? (
        <Text variant="caption" color="error">
          {fileError}
        </Text>
      ) : null}
    </View>
  );
}
