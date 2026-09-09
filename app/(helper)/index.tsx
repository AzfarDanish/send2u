import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeaturePreview } from '@/components/ui/FeaturePreview';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';

const HOW_HELPING_WORKS = [
  { icon: 'check-circle-outline', title: 'Accept a request', subtitle: 'Pick jobs that fit between your classes.' },
  { icon: 'storefront', title: 'Pick up from the vendor', subtitle: 'Show the order and collect the sealed meal.' },
  { icon: 'handshake', title: 'Hand over & confirm', subtitle: 'Meet the requester and confirm delivery.' },
] as const;

export default function HelperJobsScreen() {
  // Local UI state only — real availability sync arrives with dispatch.
  const [available, setAvailable] = useState(false);

  return (
    <Screen>
      <SectionHeader eyebrow="Helper hub" title="Delivery jobs" />
      <Card>
        <View style={styles.availability}>
          <View style={styles.availabilityText}>
            <Text variant="subtitle">{available ? "You're available" : "You're offline"}</Text>
            <Text color="secondary">
              {available
                ? 'Open requests near you will appear below.'
                : 'Go available to see open requests around campus.'}
            </Text>
          </View>
          <Switch
            value={available}
            onValueChange={setAvailable}
            trackColor={{ false: colors.disabledBackground, true: colors.primarySoft }}
            thumbColor={available ? colors.primary : colors.muted}
            accessibilityLabel="Availability for delivery jobs"
          />
        </View>
      </Card>

      {available ? (
        <EmptyState
          icon="work-outline"
          title="No open requests"
          message="New delivery requests near you will appear here with pickup point, drop-off, and payout."
        />
      ) : (
        <EmptyState
          icon="schedule"
          title="You're offline"
          message="Flip availability on when you're free to deliver between classes."
        />
      )}

      <SectionHeader title="How helping works" />
      <Card>
        {HOW_HELPING_WORKS.map((step) => (
          <ListRow key={step.title} icon={step.icon} title={step.title} subtitle={step.subtitle} />
        ))}
      </Card>

      <SectionHeader title="Open requests" badge="Coming soon" />
      <FeaturePreview
        icon="list-alt"
        title="Job cards will show everything you need"
        description="Each request lists the full route and reward before you commit."
        bullets={['Vendor pickup point and ready time', 'Requester drop-off point', 'Payout for the trip', 'One-tap accept']}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  availability: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  availabilityText: { flex: 1, gap: 2 },
});
