import { Redirect, Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ColorValue } from 'react-native';

import { HeaderBack } from '@/components/HeaderBack';
import { HeaderBell } from '@/components/HeaderBell';
import { colors, navigation, touchTargets, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

function tabIcon(name: keyof typeof MaterialIcons.glyphMap) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <MaterialIcons name={name} size={size} color={color as string} />;
  }
  return TabIcon;
}

/** Back chevron for sub-screen headers; falls back to the role root on deep links. */
const HelperHeaderBack = () => <HeaderBack fallbackHref="/(helper)" />;

export default function HelperLayout() {
  const { user, role, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (role === 'requester') return <Redirect href="/(requester)" />;
  if (role === 'vendor') return <Redirect href="/(vendor)" />;

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: navigation.headerBackground },
        headerTitleStyle: { ...typography.subtitle, color: navigation.headerText },
        headerTintColor: navigation.headerText,
        headerShadowVisible: false,
        tabBarActiveTintColor: navigation.tabActive,
        tabBarInactiveTintColor: navigation.tabInactive,
        tabBarStyle: {
          backgroundColor: navigation.tabBarBackground,
          borderTopColor: navigation.tabBarBorder,
          borderTopWidth: 1,
          height: touchTargets.tabBar,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
        headerRight: () => <HeaderBell role="helper" />,
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
          headerLeft: HelperHeaderBack,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: 'Notifications',
          headerLeft: HelperHeaderBack,
        }}
      />
    </Tabs>
  );
}
