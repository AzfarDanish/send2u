import { Stack } from 'expo-router';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';

/**
 * Static help content describing only real, implemented flows.
 * No support contacts exist in the product, so none are listed.
 */
export default function HelpCenterScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Help Center' }} />
      <Screen>
        <SectionHeader eyebrow="Support" title="Help Center" />
        <Card>
          <Text variant="subtitle">Ordering food</Text>
          <Text color="secondary">
            1. Browse the vendors on Home and open a stall.{'\n'}
            2. Add dishes to your cart from the food pages.{'\n'}
            3. Review your request, pick a campus drop-off point, and submit.
          </Text>
        </Card>
        <Card>
          <Text variant="subtitle">Paying your helper</Text>
          <Text color="secondary">
            Payment happens outside the app. After you confirm delivery, open
            your request, scan the helper QR code with your banking app,
            then attach the payment receipt in the app.
          </Text>
        </Card>
        <Card>
          <Text variant="subtitle">Receiving your food</Text>
          <Text color="secondary">
            When the helper marks your request delivered, open it and confirm
            you received your items. Confirm only food you actually received —
            confirmation opens payment.
          </Text>
        </Card>
        <Card>
          <Text variant="subtitle">Something wrong?</Text>
          <Text color="secondary">
            If a delivered request has a problem, open it and choose Report an
            issue before confirming. Reporting moves the request to dispute
            for manual settlement — there are no automatic refunds.
          </Text>
        </Card>
      </Screen>
    </>
  );
}
