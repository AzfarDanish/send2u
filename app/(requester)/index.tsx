import { router } from 'expo-router';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeaturePreview } from '@/components/ui/FeaturePreview';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';

const HOW_IT_WORKS = [
  { icon: 'receipt-long', title: 'Request in seconds', subtitle: 'Pick your meal and drop-off point on campus.' },
  { icon: 'delivery-dining', title: 'A helper picks it up', subtitle: 'A verified student collects it from the vendor.' },
  { icon: 'check-circle-outline', title: 'Delivered & confirmed', subtitle: 'Handed to you and confirmed in the app.' },
] as const;

export default function RequesterHomeScreen() {
  return (
    <Screen>
      <SectionHeader eyebrow="Today on campus" title="Good food, carried by students" />

      <Card>
        <Badge label="No active order" tone="neutral" />
        <Text variant="subtitle">Nothing on the way</Text>
        <Text color="secondary">Your current delivery will show up here with live status.</Text>
        <ListRow
          icon="add-circle-outline"
          title="Start a request"
          subtitle="Browse the menu and order in under a minute"
          onPress={() => router.push('/(requester)/create')}
        />
      </Card>

      <SectionHeader title="How Send2U works" />
      <Card>
        {HOW_IT_WORKS.map((step) => (
          <ListRow key={step.title} icon={step.icon} title={step.title} subtitle={step.subtitle} />
        ))}
      </Card>

      <SectionHeader title="Today's menu" badge="Coming soon" />
      <FeaturePreview
        icon="restaurant-menu"
        title="Campus vendors are being onboarded"
        description="Menus, prices, and pickup points will appear here once vendors join Send2U."
        bullets={['Browse vendors near your faculty', 'See live preparation times', 'Start a request from any dish']}
      />
      <EmptyState
        icon="storefront"
        title="No vendors yet"
        message="Check back soon — the first campus kitchens are joining now."
      />
    </Screen>
  );
}
