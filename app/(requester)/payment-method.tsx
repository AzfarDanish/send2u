import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { paymentBrandIcon } from '@/components/payment/brandIcons';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { PAYMENT_BRANDS, type PaymentBrand } from '@/lib/orders';
import { goBackOr } from '@/lib/navigation';

/**
 * Payment method picker for the request draft. One brand per row; the
 * brand's rail (`online` simulated in-app, `cod` cash) is what gets
 * submitted, so tapping only stores the choice — the requester returns via
 * back when ready and Review Request submits. Nothing here moves money.
 */
export default function PaymentMethodScreen() {
  const { paymentBrandId, setPayment } = useCart();

  const choose = (brand: PaymentBrand) => {
    setPayment(brand.id, brand.method);
    goBackOr('/(requester)/carts');
  };

  return (
    <>
      <GlassHeader title="Payment Method" fallbackHref="/(requester)/carts" />
      <Screen beneathHeader>
        <Text color="secondary">Choose how you want to pay for this request.</Text>
        <Card style={styles.listCard}>
          {PAYMENT_BRANDS.map((brand) => {
            const selected = brand.id === paymentBrandId;
            return (
              <PressableScale
                key={brand.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${brand.label}${selected ? ', selected' : ''}`}
                onPress={() => choose(brand)}
                haptic="selection"
                style={[styles.row, selected && styles.rowSelected]}>
                <View style={styles.iconWrap}>
                  <MaterialIcons
                    name={paymentBrandIcon(brand.id)}
                    size={22}
                    color={selected ? colors.primary : colors.muted}
                  />
                </View>
                <View style={styles.textBlock}>
                  <Text variant="secondary" style={styles.title}>
                    {brand.label}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {brand.hint}
                  </Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </Card>
        <Text variant="caption" color="muted">
          Online brands pay in Send2U right after you submit (simulated for this demo).
          Cash is handed to the helper on delivery.
        </Text>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  listCard: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radii.md,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: 2 },
  title: { fontWeight: '600', color: colors.text },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
