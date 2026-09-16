import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import type { OrderWithDetails } from '@/types/domain';

// Short nouns: at 360pt each stage owns ~56pt, so every label must stay
// well under that to keep clear gaps between neighbours.
const STAGE_LABELS = ['Placed', 'Helper', 'Pickup', 'On the way', 'Delivered', 'Done'] as const;

const DOT_SIZE = 28;

/**
 * Derives the tracker position from the real backend status. Returns the
 * highest fully-completed stage index (-1 when none) and the current stage
 * index (null when the request ended — completed or disputed).
 * Terminal disputes credit only stages with real timestamps,
 * so the tracker never claims progress that did not happen.
 */
export function progressPosition(order: OrderWithDetails): { reached: number; current: number | null } {
  switch (order.status) {
    case 'pending':
    case 'preparing':
      return { reached: -1, current: 0 };
    case 'assigned':
    case 'accepted':
      return { reached: 0, current: 1 };
    case 'going_to_vendor':
    case 'at_vendor':
    case 'food_available':
    case 'food_purchased':
      return { reached: 1, current: 2 };
    case 'picked_up':
    case 'ready_for_pickup':
    case 'out_for_delivery':
    case 'delivering':
      return { reached: 2, current: 3 };
    case 'delivered':
      return { reached: 3, current: 4 };
    case 'confirmed':
    case 'awaiting_requester_payment':
      return { reached: 4, current: 5 };
    case 'completed':
      return { reached: 5, current: null };
    case 'disputed': {
      // Credit only what the timestamps prove happened.
      let reached = -1;
      if (order.acceptedAt) reached = 0;
      if (order.goingToVendorAt || order.arrivedAt || order.foodAvailableAt || order.purchasedAt) reached = 1;
      if (order.pickedUpAt || order.outForDeliveryAt) reached = 2;
      if (order.deliveredAt) reached = 3;
      if (order.confirmedAt) reached = 4;
      return { reached, current: null };
    }
    default:
      return { reached: -1, current: 0 };
  }
}

/**
 * Horizontal 6-stage progress tracker for the real fulfilment lifecycle:
 * requested → helper accepted → collecting → on the way → delivered →
 * completed. Done stages show a filled check, the current stage a numbered
 * chip, upcoming stages muted numbers. Labels wrap to two lines so narrow
 * screens never overlap. Terminal requests highlight nothing as current.
 */
export function RequestProgress({ order }: { order: OrderWithDetails }) {
  const { reached, current } = progressPosition(order);
  const gapCount = STAGE_LABELS.length - 1;
  // Track spans from the first dot centre to the last; fill the done gaps.
  const filledWidthPct = Math.min(Math.max(reached, 0), gapCount) / STAGE_LABELS.length;
  const summary =
    current === null
      ? `Request ended at stage ${reached + 1} of ${STAGE_LABELS.length}`
      : `Stage ${current + 1} of ${STAGE_LABELS.length}: ${STAGE_LABELS[current]}`;

  return (
    <View
      style={styles.bleed}
      accessibilityRole="summary"
      accessibilityLabel={`Request progress: ${summary}`}>
      <View style={styles.trackWrap}>
        <View style={styles.track} />
        {reached >= 0 ? <View style={[styles.filled, { width: `${filledWidthPct * 100}%` }]} /> : null}
        <View style={styles.dots}>
          {STAGE_LABELS.map((label, index) => {
            const done = index <= reached;
            const isCurrent = index === current;
            return (
              <View key={label} style={styles.dotCell}>
                <View
                  style={[styles.dot, done && styles.dotDone, isCurrent && styles.dotCurrent]}
                  accessibilityLabel={`${label}, ${done ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}>
                  {done ? (
                    <MaterialIcons name="check" size={16} color={colors.onPrimary} />
                  ) : (
                    <Text variant="caption" color={isCurrent ? 'primary' : 'muted'} style={styles.dotNumber}>
                      {index + 1}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.labels}>
        {STAGE_LABELS.map((label, index) => {
          const done = index <= reached;
          const isCurrent = index === current;
          return (
            <Text
              key={label}
              variant="caption"
              color={done || isCurrent ? 'primary' : 'muted'}
              style={[styles.label, (done || isCurrent) && styles.labelActive]}
              numberOfLines={2}>
              {label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bleed into the screen's side padding so six labels fit on narrow
  // screens. Still inside the scroll content bounds — never clipped.
  bleed: { marginHorizontal: -spacing.sm },
  trackWrap: { position: 'relative' },
  track: {
    position: 'absolute',
    top: DOT_SIZE / 2 - 1,
    left: `${100 / (STAGE_LABELS.length * 2)}%`,
    right: `${100 / (STAGE_LABELS.length * 2)}%`,
    height: 2,
    backgroundColor: colors.divider,
    borderRadius: radii.full,
  },
  filled: {
    position: 'absolute',
    top: DOT_SIZE / 2 - 1,
    left: `${100 / (STAGE_LABELS.length * 2)}%`,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
  },
  dots: { flexDirection: 'row' },
  dotCell: { flex: 1, alignItems: 'center' },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.disabledBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.primary },
  dotCurrent: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dotNumber: { fontWeight: '700' },
  labels: { flexDirection: 'row', marginTop: spacing.xs },
  // 11px keeps the widest labels ("Requested", "Delivered") inside their
  // sixth-of-row cell so neighbours never overlap on narrow screens.
  label: { flex: 1, textAlign: 'center', minHeight: 30, fontSize: 11, lineHeight: 15 },
  labelActive: { fontWeight: '600' },
});
