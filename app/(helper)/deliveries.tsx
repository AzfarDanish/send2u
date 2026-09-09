import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StageLegend } from '@/components/ui/StageLegend';

export default function HelperDeliveriesScreen() {
  return (
    <Screen>
      <SectionHeader eyebrow="Deliveries" title="Your active jobs" />
      <EmptyState
        icon="delivery-dining"
        title="No active deliveries"
        message="Accepted jobs show here with pickup instructions and handover steps."
      />
      <Card>
        <StageLegend caption="Each delivery follows these five stages to payout." />
      </Card>
      <SectionHeader title="Past deliveries" badge="Coming soon" />
      <EmptyState
        icon="history"
        title="Nothing delivered yet"
        message="Completed trips, handover confirmations, and ratings will be listed here."
      />
    </Screen>
  );
}
