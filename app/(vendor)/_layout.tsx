import { Redirect, Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ColorValue } from 'react-native';

import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { colors, navigation, touchTargets, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

function tabIcon(name: keyof typeof MaterialIcons.glyphMap) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <MaterialIcons name={name} size={size} color={color as string} />;
  }
  return TabIcon;
}

export default function VendorLayout() {
  const { user, role, isLoading } = useAuth();

  // Identity is still resolving (session restore + the profile row). Render a
  // designed placeholder rather than a blank frame.
  if (isLoading) {
    return (
      <Screen>
        <SkeletonList rows={3} lines={2} label="Loading your stall" />
      </Screen>
    );
  }
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  // Send each account to the application that can actually serve it. A
  // role-less account returns to Sign In; the root entry signs it out.
  if (role !== 'vendor') {
    return <Redirect href={role ? '/(requester)' : '/(auth)/sign-in'} />;
  }

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
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Stall', tabBarIcon: tabIcon('storefront') }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Orders', tabBarIcon: tabIcon('receipt-long') }}
      />
      <Tabs.Screen
        name="orders/[id]"
        options={{
          href: null,
          title: 'Order',
          tabBarStyle: { display: 'none' },
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{ title: 'Menu', tabBarIcon: tabIcon('restaurant-menu') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline') }}
      />
    </Tabs>
  );
}
