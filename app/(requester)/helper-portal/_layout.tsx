import { Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, navigation, touchTargets } from '@/constants/theme';

function tabIcon(name: keyof typeof MaterialIcons.glyphMap) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <MaterialIcons name={name} size={size} color={color as string} />;
  }
  return TabIcon;
}

/**
 * Helper Portal bottom navigation: Jobs / Deliveries / Profile.
 * Nested inside the main requester Tabs (which hides its own bar for the
 * whole portal subtree), so the portal is one capability surface with
 * its own three destinations. Capability itself is guarded per screen
 * by HelperPortalGuard — this layout only owns the chrome.
 */
export default function HelperPortalLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
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
          options={{ title: 'Deliveries', tabBarIcon: tabIcon('receipt-long') }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline') }}
        />
        {/* Detail screens own the full viewport; the bar stays tab-only. */}
        <Tabs.Screen
          name="jobs/[id]"
          options={{
            href: null,
            title: 'Delivery',
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="payment-qr"
          options={{
            href: null,
            title: 'Payment QR',
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
