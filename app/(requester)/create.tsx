import { Card } from '@/components/ui/Card';
import { FeaturePreview } from '@/components/ui/FeaturePreview';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';

const REQUEST_STEPS = [
  { icon: 'restaurant-menu', title: '1 · Choose vendor & items', subtitle: 'Meals, drinks, and snacks around campus.' },
  { icon: 'location-on', title: '2 · Set your drop-off point', subtitle: 'Hostel, faculty, library, or campus gate.' },
  { icon: 'send', title: '3 · Submit for a helper', subtitle: 'Your request goes live to nearby students.' },
] as const;

export default function CreateRequestScreen() {
  return (
    <Screen>
      <SectionHeader eyebrow="New request" title="Get food delivered" />
      <Card>
        {REQUEST_STEPS.map((step) => (
          <ListRow key={step.title} icon={step.icon} title={step.title} subtitle={step.subtitle} />
        ))}
      </Card>
      <FeaturePreview
        icon="add-shopping-cart"
        title="The order builder lives here"
        description="Pick items, set quantities, and choose a drop-off point. Requests go live to nearby helpers the moment you submit."
        bullets={['Vendor menu with live availability', 'Saved campus drop-off points', 'Order summary before you submit']}
      />
      <Text color="muted" variant="caption">
        Ordering opens as soon as the first vendors join Send2U.
      </Text>
    </Screen>
  );
}
