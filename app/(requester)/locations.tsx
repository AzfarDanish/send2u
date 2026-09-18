import { StyleSheet } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useDeliveryLocations } from '@/hooks/useDeliveryLocations';

/**
 * Read-only browser for the predefined campus drop-off points — the same
 * list Review Request selects from. No saving, no custom addresses: the
 * backend supports exactly this fixed set.
 */
export default function DropOffLocationsScreen() {
  const { locations, status, error, retry } = useDeliveryLocations();

  return (
    <>
      <GlassHeader title="Drop-off Locations" />
      <Screen beneathHeader>
        <Text color="secondary">
          {status === 'ready'
            ? `${locations.length} campus points — pick one as your delivery location when you submit a request.`
            : 'Pick one of these points as your delivery location when you submit a request.'}
        </Text>
        {/* Rows land in the same card the loaded list uses; ListRow geometry
            is a 44px icon chip plus title and subtitle. */}
        {status === 'loading' ? (
          <Card style={styles.listCard}>
            <SkeletonList rows={3} lines={2} thumb={44} label="Loading drop-off points" />
          </Card>
        ) : null}
        {status === 'error' ? (
          <Card style={styles.stateCard}>
            <ErrorState
              title="Couldn't load locations"
              message={error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={retry}
            />
          </Card>
        ) : null}
        {status === 'empty' ? (
          <EmptyState
            icon="place"
            title="No drop-off points"
            message="None available right now. Try again later."
          />
        ) : null}
        {status === 'ready' ? (
          <Card style={styles.listCard}>
            {locations.map((location) => (
              <ListRow
                key={location.id}
                icon="place"
                title={location.name}
                subtitle={location.description ?? undefined}
                showChevron={false}
              />
            ))}
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  listCard: { gap: 0 },
});
