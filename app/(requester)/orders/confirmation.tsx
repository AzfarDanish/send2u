import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import { orderTotalCents } from '@/lib/orders';

/**
 * Post-order confirmation. Stateless summary carried in route params —
 * the cart was already cleared after confirmed database success.
 */
export default function OrderConfirmationScreen() {
  const { orderIds, vendorCount, vendorNames, foodCents, feeCents, locationName } = useLocalSearchParams<{
    orderIds?: string;
    vendorCount?: string;
    vendorNames?: string;
    foodCents?: string;
    feeCents?: string;
    locationName?: string;
  }>();

  const ids = typeof orderIds === 'string' && orderIds.length > 0 ? orderIds.split(',') : [];
  const count = typeof vendorCount === 'string' ? Number.parseInt(vendorCount, 10) : Number.NaN;
  const food = typeof foodCents === 'string' ? Number.parseInt(foodCents, 10) : Number.NaN;
  const fee = typeof feeCents === 'string' ? Number.parseInt(feeCents, 10) : Number.NaN;
  const total = Number.isInteger(food) && Number.isInteger(fee) ? orderTotalCents(food, fee) : Number.NaN;
  const valid =
    ids.length > 0 &&
    Number.isInteger(count) &&
    count === ids.length &&
    Number.isInteger(total) &&
    typeof vendorNames === 'string' &&
    vendorNames.length > 0 &&
    typeof locationName === 'string' &&
    locationName.length > 0;

  if (!valid) {
    return (
      <>
        <Stack.Screen options={{ title: 'Request placed' }} />
        <Screen>
          <ErrorState
            title="Nothing to confirm"
            message="This confirmation link is incomplete. Check My Orders for your requests."
            retryTitle="View My Orders"
            onRetry={() => router.replace('/(requester)/orders')}
          />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Request placed' }} />
      <Screen>
        <View style={styles.visual}>
          <MaterialIcons name="check-circle" size={48} color={colors.success} />
        </View>

        <View style={styles.heading}>
          <Text variant="title">
            {count === 1 ? 'Your request is in!' : `${count} requests are in!`}
          </Text>
          <Text color="secondary">
            {count === 1
              ? `${vendorNames} is preparing your request for ${locationName}.`
              : `${vendorNames} are each preparing a request for ${locationName}.`}
          </Text>
        </View>

        <Card>
          <View style={styles.totalRow}>
            <Text color="secondary">Food subtotal</Text>
            <Text variant="secondary">{formatMYR(food)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text color="secondary">Delivery fee (RM2.00 × {count})</Text>
            <Text variant="secondary">{formatMYR(fee)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text variant="subtitle">Total amount</Text>
            <Text variant="title" color="primary">
              {formatMYR(total)}
            </Text>
          </View>
          <Text variant="caption" color="muted">
            No helper assigned yet and nothing to pay.
          </Text>
        </Card>

        <Button title="View My Orders" onPress={() => router.replace('/(requester)/orders')} />
        <Button
          title="Back to menu"
          variant="secondary"
          onPress={() => router.replace('/(requester)')}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  visual: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radii.xl,
    paddingVertical: spacing.xxxl,
  },
  heading: { gap: spacing.sm },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
});
