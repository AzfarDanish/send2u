import { EmptyState } from '@/components/ui/EmptyState';
import { FeaturePreview } from '@/components/ui/FeaturePreview';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';

export default function HelperEarningsScreen() {
  return (
    <Screen>
      <SectionHeader eyebrow="Earnings" title="Your payouts" />
      <EmptyState
        icon="account-balance-wallet"
        title="No earnings yet"
        message="Completed deliveries and payouts will be summarized here once you finish your first trip."
      />
      <SectionHeader title="Payout history" badge="Coming soon" />
      <FeaturePreview
        icon="payments"
        title="Transparent trip earnings"
        description="Every payout breaks down exactly what each delivery earned you."
        bullets={['Per-trip payout breakdown', 'Weekly payout summary', 'Withdrawal to your campus account']}
      />
    </Screen>
  );
}
