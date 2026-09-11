import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Switch, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useHelperAvailability } from '@/hooks/useHelperAvailability';
import { useMyOffers } from '@/hooks/useMyOffers';
import { formatMYR } from '@/lib/money';
import { formatOrderDate } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

const HOW_HELPING_WORKS = [
  { icon: 'check-circle-outline', title: 'Accept a request', subtitle: 'Pick jobs that fit between your classes.' },
  { icon: 'storefront', title: 'Pick up from the vendor', subtitle: 'Show the order and collect the sealed meal.' },
  { icon: 'handshake', title: 'Hand over & confirm', subtitle: 'Meet the requester and confirm delivery.' },
] as const;

function jobItemSummary(job: OrderWithDetails): string {
  const count = job.items.reduce((sum, item) => sum + item.quantity, 0);
  const first = job.items[0];
  if (!first) return 'No items';
  const rest = count - first.quantity;
  return rest > 0
    ? `${first.quantity} × ${first.itemName} + ${rest} more`
    : `${first.quantity} × ${first.itemName}`;
}

export default function HelperJobsScreen() {
  const { isAvailable, updating, error: availabilityError, setAvailable } = useHelperAvailability();
  const { offers, status, error, refreshing, retry, refresh, respond } = useMyOffers();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingOffer, setActingOffer] = useState<string | null>(null);
  // Ticks every second to keep offer countdowns live
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;

  // Keep offers fresh when availability flips
  useEffect(() => {
    if (isAvailable) void refresh();
  }, [isAvailable, refresh]);

  const handleToggle = useCallback(
    async (next: boolean) => {
      try {
        await setAvailable(next);
      } catch {
        // error already in hook
      }
    },
    [setAvailable],
  );

  const handleRespond = useCallback(
    async (offerId: string, action: 'accepted' | 'rejected') => {
      setActingOffer(offerId);
      setActionError(null);
      try {
        await respond(offerId, action);
        if (action === 'accepted') {
          // Navigate to deliveries or detail? The order will appear in My Deliveries via trigger
          // Keep helper on hub but refresh
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not update offer');
      } finally {
        setActingOffer(null);
      }
    },
    [respond],
  );

  const openJob = useCallback((job: OrderWithDetails) => {
    router.push({ pathname: '/(helper)/jobs/[id]', params: { id: job.id } });
  }, []);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }>
      <SectionHeader
        eyebrow="Helper hub"
        title="Delivery jobs"
        badge={isAvailable && status === 'ready' ? `${offers.length} offer${offers.length === 1 ? '' : 's'}` : undefined}
      />
      <Card>
        <View style={styles.availability}>
          <View style={styles.availabilityText}>
            <Text variant="subtitle">{isAvailable ? "You're available" : "You're offline"}</Text>
            <Text color="secondary">
              {isAvailable
                ? 'You will receive delivery offers while available.'
                : 'Go available to receive delivery offers.'}
            </Text>
            {availabilityError ? (
              <Text variant="caption" color="secondary">
                {availabilityError}
              </Text>
            ) : null}
          </View>
          <Switch
            value={isAvailable}
            onValueChange={handleToggle}
            disabled={updating}
            trackColor={{ false: colors.disabledBackground, true: colors.primarySoft }}
            thumbColor={isAvailable ? colors.primary : colors.muted}
            accessibilityLabel="Availability for delivery jobs"
          />
        </View>
      </Card>

      {!isAvailable ? (
        <EmptyState
          icon="schedule"
          title="You're offline"
          message="Flip availability on when you're free to deliver between classes."
        />
      ) : status === 'loading' ? (
        <Card style={styles.stateCard}>
          <LoadingState message="Finding offers…" />
        </Card>
      ) : status === 'error' ? (
        <Card style={styles.stateCard}>
          <ErrorState
            title="Couldn't load offers"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        </Card>
      ) : status === 'empty' ? (
        <EmptyState
          icon="work-outline"
          title="No offers right now"
          message="Stay available — new delivery requests will appear here as one-at-a-time offers. You can also pull to refresh."
        />
      ) : (
        <>
          {actionError ? (
            <ErrorState title="Could not update offer" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
          ) : null}
          {offers.map((offer) => {
            const order = offer.order;
            const expiresIn = Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000));
            const isActing = actingOffer === offer.id;
            if (!order) {
              return (
                <Card key={offer.id} style={styles.jobCard}>
                  <Text variant="subtitle">New offer</Text>
                  <Text color="secondary">Expires in {expiresIn}s</Text>
                  <Button title={isActing ? 'Accepting…' : 'Accept offer'} onPress={() => void handleRespond(offer.id, 'accepted')} disabled={isActing} loading={isActing} />
                  <Button title="Reject" variant="secondary" onPress={() => void handleRespond(offer.id, 'rejected')} disabled={isActing} />
                </Card>
              );
            }
            return (
              <Card key={offer.id} style={styles.jobCard}>
                <View style={styles.offerHeader}>
                  <Badge label={`Expires in ${expiresIn}s`} tone={expiresIn < 20 ? 'warning' : 'info'} />
                  <Text variant="caption" color="secondary">
                    Offer {offer.id.slice(0, 8)}
                  </Text>
                </View>
                <ListRow
                  icon="delivery-dining"
                  title={order.vendor.name}
                  subtitle={`${jobItemSummary(order)} · ${order.location.name} · ${formatOrderDate(order.createdAt)}`}
                  onPress={() => openJob(order)}
                  right={
                    <View style={styles.right}>
                      <Text variant="secondary" style={styles.subtotal}>
                        {formatMYR(order.subtotalCents)}
                      </Text>
                      <Badge label="Offer" tone="info" />
                    </View>
                  }
                />
                <View style={styles.offerActions}>
                  <Button
                    title={isActing ? 'Accepting…' : 'Accept offer'}
                    onPress={() => void handleRespond(offer.id, 'accepted')}
                    disabled={isActing}
                    loading={isActing}
                  />
                  <Button
                    title="Reject"
                    variant="secondary"
                    onPress={() => void handleRespond(offer.id, 'rejected')}
                    disabled={isActing}
                  />
                </View>
                <Text variant="caption" color="secondary">
                  Accept to claim this job — only one helper can win. Reject sends it to the next available helper.
                </Text>
              </Card>
            );
          })}
        </>
      )}

      <SectionHeader title="How helping works" />
      <Card>
        {HOW_HELPING_WORKS.map((step) => (
          <ListRow key={step.title} icon={step.icon} title={step.title} subtitle={step.subtitle} />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  availability: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  availabilityText: { flex: 1, gap: spacing.xs },
  stateCard: { minHeight: 200, justifyContent: 'center' },
  jobCard: { gap: spacing.sm },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  subtotal: { fontWeight: '700', color: colors.primary },
  offerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  offerActions: { gap: spacing.sm },
});
