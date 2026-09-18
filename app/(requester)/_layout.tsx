import { Redirect, Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UnreadSync } from '@/components/UnreadSync';
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

export default function RequesterLayout() {
  const { user, role, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  // Identity is still resolving (session restore + the profile row). Render a
  // designed placeholder rather than a blank frame, so nothing flashes white
  // between the launch screen and the tabs.
  if (isLoading) {
    return (
      <Screen underTabs>
        <SkeletonList rows={3} lines={2} label="Loading Send2U" />
      </Screen>
    );
  }
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  // Verified helpers use this same main app (Helper Portal is nested under
  // Profile). Only vendors leave for their own experience.
  if (role === 'vendor') return <Redirect href="/(vendor)" />;

  // The bar floats over scrolled content (which slides behind it) while
  // still clearing the system gesture area: its height absorbs the bottom
  // inset instead of sitting behind it.
  const tabBarBottom = Math.max(insets.bottom, 8);

  // Home, Requests, and Profile hide the native header and render the
  // shared in-screen MainHeader (title + bell + gear at one geometry).
  // No global headerRight: secondary screens must not show it. UnreadSync
  // feeds the shared count once.
  return (
    <>
      <UnreadSync />
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
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home'), headerShown: false }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Requests', tabBarIcon: tabIcon('receipt-long'), headerShown: false }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person-outline'),
          // In-content MainHeader (title + bell + gear), same as Home/Requests.
          headerShown: false,
        }}
      />
      {/* The tab bar lives only on Home, Requests, and Profile. Every
        other requester route hides it so content owns the full screen. */}
      <Tabs.Screen
        name="create"
        options={{
          href: null,
          title: 'Review Request',
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
          // Custom in-screen nav bar (back + centered title + Mark all read).
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="menu/[id]"
        options={{
          href: null,
          title: 'Item details',
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="vendors/[id]"
        options={{
          href: null,
          title: 'Vendor',
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="orders/[id]"
        options={{
          href: null,
          title: 'Request details',
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="orders/confirmation"
        options={{
          href: null,
          title: 'Request Submitted',
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="orders/[id]/pay-online"
        options={{
          href: null,
          title: 'Online Payment',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="orders/[id]/payment"
        options={{
          href: null,
          title: 'Payment Required',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="orders/[id]/receipt"
        options={{
          href: null,
          title: 'Request details',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="orders/[id]/confirm"
        options={{
          href: null,
          title: 'Confirm Delivery',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="orders/[id]/rate"
        options={{
          href: null,
          title: 'Rate Your Helper',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="locations"
        options={{
          href: null,
          title: 'Drop-off Locations',
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          href: null,
          title: 'Help Center',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="edit-profile"
        options={{
          href: null,
          title: 'Edit Profile',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: 'Settings',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="settings/change-password"
        options={{
          href: null,
          title: 'Change Password',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="help/[id]"
        options={{
          href: null,
          title: 'Help Center',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="terms"
        options={{
          href: null,
          title: 'Terms of Service',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="privacy"
        options={{
          href: null,
          title: 'Privacy Policy',
          tabBarStyle: { display: 'none' },
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          href: null,
          title: 'Report an Issue',
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="location"
        options={{
          href: null,
          title: 'Drop-off Location',
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />
      {/* Helper Portal (verified helpers only; guarded per-screen) owns its
        own Jobs/Deliveries/Profile bottom navigation inside this hidden
        slot, entered from Profile — never a main-app tab. */}
      <Tabs.Screen
        name="helper-portal"
        options={{
          href: null,
          title: 'Helper Portal',
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />
      </Tabs>
    </>
  );
}
