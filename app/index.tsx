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
 * authenticated with role → requester or helper experience
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

  return <Redirect href={role === 'helper' ? '/(helper)' : '/(requester)'} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background },
});
