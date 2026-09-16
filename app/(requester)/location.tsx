import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useDeliveryLocations } from '@/hooks/useDeliveryLocations';

/**
 * Drop-off picker for the request draft. Shares `locationId` with Review
 * Request through CartContext (same in-memory draft lifecycle). Tapping a
 * point only selects it — the user returns via back when ready, so the
 * selection never auto-redirects anywhere.
 */
export default function LocationPickerScreen() {
  const locations = useDeliveryLocations();
  const { locationId, setLocationId } = useCart();

  return (
    <>
      <GlassHeader title="Drop-off Location" fallbackHref="/(requester)/create" />
      <Screen beneathHeader>
        <Text color="secondary">
          Choose where your helper should deliver this request.
        </Text>
        {locations.status === 'loading' ? (
          <Section style={styles.stateCard}>
            <LoadingState message="Loading drop-off points…" />
          </Section>
        ) : null}
        {locations.status === 'error' ? (
          <Section style={styles.stateCard}>
            <ErrorState
              title="Couldn't load locations"
              message={locations.error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={locations.retry}
            />
          </Section>
        ) : null}
        {locations.status === 'empty' ? (
          <EmptyState
            icon="place"
            title="No drop-off points"
            message="None available right now. Try again later."
          />
        ) : null}
        {locations.status === 'ready' ? (
          <Section style={styles.locationsCard}>
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
          </Section>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 160, justifyContent: 'center' },
  locationsCard: { gap: 0 },
});
