import { Redirect, Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UnreadSync } from '@/components/UnreadSync';
import { colors, navigation, touchTargets, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

function tabIcon(name: keyof typeof MaterialIcons.glyphMap) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <MaterialIcons name={name} size={size} color={color as string} />;
  }
  return TabIcon;
}

export default function HelperLayout() {
  const { user, role, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (role === 'requester') return <Redirect href="/(requester)" />;
  if (role === 'vendor') return <Redirect href="/(vendor)" />;

  // Matches the requester shell: the bar floats over scrolled content
  // (which slides behind it), absorbing the system gesture area in its
  // height. One hairline on top is the only separator in the UI.
  const tabBarBottom = Math.max(insets.bottom, 8);

  // Bell on the four main tabs only — never inside job detail or the
  // notification center itself. UnreadSync feeds the shared count once.
  return (
    <>
      <UnreadSync />
      <Tabs
        backBehavior="history"
        screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: navigation.headerBackground },
        headerTitleStyle: { ...typography.subtitle, color: navigation.headerText },
        headerTintColor: navigation.headerText,
        headerShadowVisible: false,
        tabBarActiveTintColor: navigation.tabActive,
        tabBarInactiveTintColor: navigation.tabInactive,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: navigation.tabBarBackground,
          borderTopColor: navigation.tabBarBorder,
          borderTopWidth: 1,
          height: touchTargets.tabBar + tabBarBottom,
          paddingTop: 8,
          paddingBottom: tabBarBottom,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Jobs', tabBarIcon: tabIcon('work-outline') }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{ title: 'My Deliveries', tabBarIcon: tabIcon('delivery-dining') }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: 'Earnings', tabBarIcon: tabIcon('account-balance-wallet') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline') }}
      />
      <Tabs.Screen
        name="jobs/[id]"
        options={{
          href: null,
          title: 'Job details',
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: 'Notifications',
          tabBarStyle: { display: 'none' },
          // Custom glass nav bar in-screen (back + title + Mark all read).
          headerShown: false,
        }}
      />
      </Tabs>
    </>
  );
}
