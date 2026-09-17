import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import {
  formatRelativeTime,
  orderItemsTitle,
  orderTotalCents,
  requesterStatusMessage,
} from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Nudge shown only for statuses where the detail page offers the requester
 * a real action. Every other status surfaces through the badge alone.
 */
function actionHint(status: OrderWithDetails['status']): string | null {
  switch (status) {
    case 'delivered':
      return 'Tap to confirm receipt';
    case 'confirmed':
    case 'awaiting_requester_payment':
      return 'Tap to complete payment';
    default:
      return null;
  }
}

/**
 * Minimalist request row for the Requests tab: thumbnail chip (no food
 * imagery exists in the product), vendor, concise item summary, plain
 * status word, chevron, and recorded total. No badges or pills — plain
 * type hierarchy with a hairline divider. The whole row is one large
 * touch target opening the Request Detail page.
 */
export function RequestCard({
  order,
  isLast = false,
  onPress,
}: {
  order: OrderWithDetails;
  /** Last row in its list: no divider underneath. */
  isLast?: boolean;
  onPress: (order: OrderWithDetails) => void;
}) {
  const statusMessage = requesterStatusMessage(order.status);
  const hint = actionHint(order.status);
  const age = formatRelativeTime(order.createdAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Request #${order.id.slice(0, 8)} from ${order.vendor.name}, ${statusMessage}, ${age}`}
      onPress={() => onPress(order)}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.pressed]}>
      <View style={styles.thumb}>
        <MaterialIcons name="receipt-long" size={26} color={colors.primary} />
      </View>
      <View style={styles.middle}>
        <Text variant="secondary" style={styles.vendor} numberOfLines={1}>
          {order.vendor.name}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={2}>
          {orderItemsTitle(order.items)}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={1}>
          #{order.id.slice(0, 8)} · {age} · {statusMessage}
        </Text>
        {hint ? (
          <Text variant="caption" color="primary">
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
        <Text variant="price" color="primary" style={styles.amount}>
          {formatMYR(orderTotalCents(order.subtotalCents, order.deliveryFeeCents))}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  middle: { flex: 1, minWidth: 0, gap: 2 },
  vendor: { fontWeight: '600', color: colors.text },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    flexShrink: 0,
    paddingVertical: spacing.xs,
  },
  amount: { fontVariant: ['tabular-nums'] as const },
});
