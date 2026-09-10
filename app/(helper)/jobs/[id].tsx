import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { HelperPaymentCard } from '@/components/HelperPaymentCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, orderStatusLabel, orderStatusTone } from '@/lib/orders';
import { acceptOrder, getJobDetail } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Helper job detail. Review vendor, items, subtotal, and drop-off, then
 * accept. Acceptance is one atomic server operation — exactly one helper
 * wins; everyone else sees "no longer available".
 */
export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<OrderWithDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [paymentTick, setPaymentTick] = useState(0);

  const reload = useCallback(async () => {
    if (typeof id !== 'string') {
      setJob(null);
      setStatus('missing');
      return;
    }
    try {
      const found = await getJobDetail(id);
      setJob(found);
      setStatus(found ? 'ready' : 'missing');
    } catch {
      setJob(null);
      setStatus('missing');
    }
  }, [id]);

  useEffect(() => {
    setStatus('loading');
    setJob(null);
    setAcceptError(null);
    setAccepted(false);
    setPaymentTick(0);
    void reload();
  }, [id, reload]);

  const handleAccept = useCallback(async () => {
    if (!job || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await acceptOrder(job.id);
      setAccepted(true);
      await reload();
      setPaymentTick((t) => t + 1);
    } catch (err) {
      // Job stays on screen so the helper can pick another one.
      setAcceptError(err instanceof Error ? err.message : 'Could not accept the job.');
    } finally {
      setAccepting(false);
    }
  }, [job, accepting, reload]);

  if (status === 'loading' || !job) {
    return (
      <>
        <Stack.Screen options={{ title: 'Job details' }} />
        <Screen>
          {status === 'loading' ? (
            <LoadingState message="Loading job…" />
          ) : (
            <ErrorState
              title="Job not available"
              message="This request is no longer open. It may have been taken by another helper."
              retryTitle="Back to jobs"
              onRetry={() => router.back()}
            />
          )}
        </Screen>
      </>
    );
  }

  const pending = job.status === 'pending' && !accepted;

  return (
    <>
      <Stack.Screen options={{ title: job.vendor.name }} />
      <Screen>
        <View style={styles.heading}>
          <Text variant="title">{job.vendor.name}</Text>
          <Badge
            label={accepted ? 'Assigned' : orderStatusLabel(job.status)}
            tone={accepted ? 'success' : orderStatusTone(job.status)}
          />
        </View>
        <Text variant="caption" color="secondary">
          Requested {formatOrderDate(job.createdAt)}
        </Text>

        <Card>
          <View style={styles.row}>
            <MaterialIcons name="storefront" size={20} color={colors.primary} />
            <View style={styles.rowText}>
              <Text variant="secondary" style={styles.vendorName}>
                Pick up here
              </Text>
              {job.vendor.locationHint ? (
                <Text variant="caption" color="secondary">
                  {job.vendor.locationHint}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.row}>
            <MaterialIcons name="place" size={20} color={colors.primary} />
            <View style={styles.rowText}>
              <Text variant="secondary" style={styles.vendorName}>
                Drop off at {job.location.name}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.itemsCard}>
          {job.items.map((item) => (
            <View key={item.id} style={styles.line}>
              <View style={styles.lineText}>
                <Text variant="secondary" style={styles.lineName}>
                  {item.quantity} × {item.itemName}
                </Text>
                <Text variant="caption" color="secondary">
                  {formatMYR(item.unitPriceCents)} each
                </Text>
              </View>
              <Text variant="secondary" style={styles.lineTotal}>
                {formatMYR(item.lineTotalCents)}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <View style={styles.subtotalRow}>
            <Text variant="subtitle">Subtotal</Text>
            <Text variant="title" color="primary">
              {formatMYR(job.subtotalCents)}
            </Text>
          </View>
          <Text variant="caption" color="muted">
            What the requester pays the vendor — you never handle this money in the app.
          </Text>
        </Card>

        {accepted ? (
          <Card>
            <View style={styles.confirmRow}>
              <MaterialIcons name="check-circle" size={24} color={colors.success} />
              <Text variant="subtitle">Job accepted — it&apos;s yours</Text>
            </View>
            <Text color="secondary">
              This request left the open queue and is waiting in My Deliveries.
            </Text>
            <Button title="View My Deliveries" onPress={() => router.replace('/(helper)/deliveries')} />
            <Button title="Back to jobs" variant="secondary" onPress={() => router.back()} />
          </Card>
        ) : pending ? (
          <Card>
            {acceptError ? (
              <ErrorState title="Could not accept" message={acceptError} retryTitle="Try again" onRetry={() => void handleAccept()} />
            ) : null}
            <Button
              title={accepting ? 'Accepting…' : 'Accept job'}
              onPress={() => void handleAccept()}
              disabled={accepting}
              loading={accepting}
            />
            <Text variant="caption" color="muted">
              One tap claims the job atomically — if another helper takes it first, you&apos;ll be
              told here and nothing is assigned twice.
            </Text>
          </Card>
        ) : (
          <Card>
            <Text variant="caption" color="muted">
              This job is already assigned and no longer open.
            </Text>
            <Button title="Back to jobs" variant="secondary" onPress={() => router.back()} />
          </Card>
        )}

        <HelperPaymentCard orderId={job.id} onChanged={() => void reload()} refreshToken={paymentTick} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  vendorName: { fontWeight: '600', color: colors.text },
  itemsCard: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  lineText: { flex: 1, gap: 2 },
  lineName: { fontWeight: '600', color: colors.text },
  lineTotal: { fontWeight: '700', color: colors.primary },
  subtotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
