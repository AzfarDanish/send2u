import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { RequestProgress, progressPosition } from '@/components/RequestProgress';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, touchTargets } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import {
  formatOrderDate,
  orderItemsTitle,
  orderStatusTone,
  orderTotalCents,
  requesterStatusMessage,
} from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Status tones as a soft wash plus matching text. A tinted label carries the
 * meaning with far less visual weight than a filled badge — the row's own
 * type hierarchy does the emphasis.
 */
const STATUS_TONES: Record<
  ReturnType<typeof orderStatusTone>,
  { background: string; foreground: string }
> = {
  info: { background: colors.infoSoft, foreground: colors.info },
  success: { background: colors.successSoft, foreground: colors.success },
  warning: { background: colors.warningSoft, foreground: colors.warning },
  error: { background: colors.errorSoft, foreground: colors.error },
  neutral: { background: colors.disabledBackground, foreground: colors.secondary },
};

/**
 * Nudge shown only for statuses where the detail page offers the requester
 * a real action. Every other status surfaces through the status label alone.
 */
function actionHint(order: OrderWithDetails): string | null {
  switch (order.status) {
    case 'delivered':
      return 'Tap to confirm receipt';
    case 'confirmed':
      return order.paymentMethod === 'online' &&
        (order.paymentStatus === 'pending' ||
          order.paymentStatus === 'failed' ||
          order.paymentStatus === 'unpaid')
        ? 'Tap to complete payment'
        : null;
    case 'awaiting_requester_payment':
      return 'Tap to finish up';
    default:
      return null;
  }
}

/**
 * The timestamps the backend records for one tracker stage. Stage 0 (placed)
 * has no column of its own — listing it here would mean borrowing `createdAt`
 * and presenting it as a fulfilment time it is not, so it returns nothing.
 */
function stageTimestamps(order: OrderWithDetails, stage: number): (string | null)[] {
  switch (stage) {
    case 1:
      return [order.acceptedAt];
    case 2:
      return [order.goingToVendorAt, order.arrivedAt, order.foodAvailableAt, order.purchasedAt];
    case 3:
      return [order.pickedUpAt, order.outForDeliveryAt];
    case 4:
      return [order.deliveredAt];
    case 5:
      return [order.confirmedAt];
    default:
      return [];
  }
}

/**
 * The real timestamp of the stage the order currently sits at, or null when
 * the backend recorded none. Deduced from the same `progressPosition` the
 * tracker renders from, so the line and the highlighted step can never
 * disagree; a stage with nothing recorded shows nothing.
 */
function currentStageTimestamp(order: OrderWithDetails): string | null {
  const { current } = progressPosition(order);
  // A terminal order has no current stage to timestamp.
  if (current === null) return null;

  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const value of stageTimestamps(order, current)) {
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms) || ms <= latestMs) continue;
    latestMs = ms;
    latest = value;
  }
  return latest;
}

/**
 * One active request, read top to bottom: what it is and where it is going,
 * the status the backend reports, the live progress tracker, and the way in
 * to the full request. Sections separate with whitespace and a hairline, not
 * with a card — six orders on a card each would be six containers competing
 * with the content. The thumbnail is a tinted mark because the product has
 * no food imagery at all; inventing one would promise a photo the app cannot
 * deliver.
 */
export function RequestCard({
  order,
  isLast = false,
  onPress,
}: {
  order: OrderWithDetails;
  /** Last section in the list: no hairline underneath. */
  isLast?: boolean;
  onPress: (order: OrderWithDetails) => void;
}) {
  const title = orderItemsTitle(order.items);
  const statusMessage = requesterStatusMessage(order.status);
  const tone = STATUS_TONES[orderStatusTone(order.status)];
  const hint = actionHint(order);
  const stageTime = currentStageTimestamp(order);
  const total = formatMYR(orderTotalCents(order.subtotalCents, order.deliveryFeeCents));

  return (
    <View style={[styles.section, !isLast && styles.sectionDivider]}>
      <View style={styles.headRow}>
        <View style={styles.thumb}>
          <MaterialIcons name="receipt-long" size={26} color={colors.primary} />
        </View>
        <View style={styles.headText}>
          <Text variant="subtitle" numberOfLines={2}>
            {title}
          </Text>
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {order.vendor.name}
          </Text>
        </View>
        <Text variant="price" color="primary" style={styles.total}>
          {total}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusLabel, { backgroundColor: tone.background }]}>
          <Text variant="status" numberOfLines={1} style={{ color: tone.foreground }}>
            {statusMessage}
          </Text>
        </View>
        {stageTime ? (
          <Text variant="caption" color="muted" numberOfLines={1} style={styles.stageTime}>
            {formatOrderDate(stageTime)}
          </Text>
        ) : null}
      </View>

      <RequestProgress order={order} />

      {hint ? (
        <Text variant="caption" color="primary">
          {hint}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View details for ${title} from ${order.vendor.name}, ${statusMessage}`}
        onPress={() => onPress(order)}
        style={({ pressed }) => [styles.detailsRow, pressed && styles.pressed]}>
        <Text variant="button">View details</Text>
        <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  section: { gap: spacing.md },
  sectionDivider: {
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  total: { fontVariant: ['tabular-nums'] as const },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // The timestamp is short and always rendered in full; the status label
  // yields first when the two meet on a narrow screen.
  stageTime: { flexShrink: 0 },
  statusLabel: {
    flexShrink: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTargets.button,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
  },
});
