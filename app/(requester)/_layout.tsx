import { Redirect, Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderBell } from '@/components/HeaderBell';
import { colors, navigation, touchTargets, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

function tabIcon(name: keyof typeof MaterialIcons.glyphMap) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <MaterialIcons name={name} size={size} color={color as string} />;
  }
  return TabIcon;
}

export default function RequesterLayout() {
  const { user, role, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (role === 'helper') return <Redirect href="/(helper)" />;
  if (role === 'vendor') return <Redirect href="/(vendor)" />;

  // The bar floats over scrolled content (which slides behind it) while
  // still clearing the system gesture area: its height absorbs the bottom
  // inset instead of sitting behind it.
  const tabBarBottom = Math.max(insets.bottom, 8);

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
        headerRight: () => <HeaderBell role="requester" />,
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home') }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Requests', tabBarIcon: tabIcon('receipt-long') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline') }}
      />
      {/* The tab bar lives only on Home, Requests, and Profile. Every
        other requester route hides it so content owns the full screen. */}
      <Tabs.Screen
        name="create"
        options={{ href: null, title: 'Review Request', tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null, title: 'Notifications', tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="menu/[id]"
        options={{ href: null, title: 'Item details', tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="vendors/[id]"
        options={{ href: null, title: 'Vendor', tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="orders/[id]"
        options={{ href: null, title: 'Request details', tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="orders/confirmation"
        options={{ href: null, title: 'Request Submitted', tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="locations"
        options={{ href: null, title: 'Drop-off Locations', tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="help"
        options={{ href: null, title: 'Help Center', tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="report"
        options={{ href: null, title: 'Report an Issue', tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="location"
        options={{ href: null, title: 'Drop-off Location', tabBarStyle: { display: 'none' } }}
      />
    </Tabs>
  );
}
