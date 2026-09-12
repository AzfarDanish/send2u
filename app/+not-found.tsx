import { Link, Stack } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <EmptyState
          icon="search-off"
          title="This screen doesn't exist"
        />
        <Link href="/" asChild>
          <Button title="Back to Send2U home" variant="secondary" />
        </Link>
      </Screen>
    </>
  );
}
