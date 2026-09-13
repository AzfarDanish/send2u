import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useDeliveryLocations } from '@/hooks/useDeliveryLocations';

/**
 * Drop-off picker for the request draft. Shares `locationId` with Review
 * Request through CartContext (same in-memory draft lifecycle). Tapping a
 * point only selects it — the user returns via back when ready, so the
 * selection never auto-redirects anywhere. Native header back is always
 * available.
 */
export default function LocationPickerScreen() {
  const locations = useDeliveryLocations();
  const { locationId, setLocationId } = useCart();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(requester)/create');
            }}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            hitSlop={8}>
            <MaterialIcons name="chevron-left" size={26} color={colors.text} />
          </Pressable>
          <Text variant="subtitle" style={styles.headerTitle}>
            Drop-off Location
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <SectionHeader eyebrow="Review Request" title="Drop-off Location" />
        <Text color="secondary">
          Choose where your helper should deliver this request.
        </Text>
        {locations.status === 'loading' ? (
          <Card style={styles.stateCard}>
            <LoadingState message="Loading drop-off points…" />
          </Card>
        ) : null}
        {locations.status === 'error' ? (
          <Card style={styles.stateCard}>
            <ErrorState
              title="Couldn't load locations"
              message={locations.error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={locations.retry}
            />
          </Card>
        ) : null}
        {locations.status === 'empty' ? (
          <EmptyState
            icon="place"
            title="No drop-off points"
            message="None available right now. Try again later."
          />
        ) : null}
        {locations.status === 'ready' ? (
          <Card style={styles.locationsCard}>
            {locations.locations.map((location) => {
              const selected = location.id === locationId;
              return (
                <ListRow
                  key={location.id}
                  icon="place"
                  title={location.name}
                  subtitle={location.description ?? undefined}
                  showChevron={false}
                  onPress={() => {
                    // Selection only — the user returns via back when
                    // ready. Nothing auto-redirects from this page.
                    setLocationId(location.id);
                  }}
                  right={
                    selected ? (
                      <MaterialIcons name="check-circle" size={24} color={colors.primary} />
                    ) : undefined
                  }
                />
              );
            })}
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: 44 },
  stateCard: { minHeight: 160, justifyContent: 'center' },
  locationsCard: { gap: 0 },
});
