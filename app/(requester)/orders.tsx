import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StageLegend } from '@/components/ui/StageLegend';

export default function RequesterOrdersScreen() {
  return (
    <Screen>
      <SectionHeader eyebrow="Orders" title="Track your deliveries" />
      <EmptyState
        icon="receipt-long"
        title="No orders yet"
        message="When you request a delivery, you'll follow it here from kitchen to doorstep."
      />
      <Card>
        <StageLegend caption="Every order moves through these five stages." />
      </Card>
      <SectionHeader title="Order history" badge="Coming soon" />
      <EmptyState
        icon="history"
        title="Nothing to show"
        message="Past deliveries, receipts, and helper ratings will be listed here."
      />
    </Screen>
  );
}
