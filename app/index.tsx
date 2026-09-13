import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LoadingState } from '@/components/ui/LoadingState';
import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

/**
 * Root gate:
 * loading → loading state
 * unauthenticated → auth screens
 * authenticated without role → role selection
 * authenticated with role → requester, helper, or vendor experience
 */
export default function Index() {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <LoadingState message="Getting Send2U ready…" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!role) {
    return <Redirect href="/select-role" />;
  }

  return (
    <Redirect href={role === 'helper' ? '/(helper)' : role === 'vendor' ? '/(vendor)' : '/(requester)'} />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
});
