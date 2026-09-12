import { Redirect, Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ColorValue } from 'react-native';

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

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (role === 'helper') return <Redirect href="/(helper)" />;

  return (
    <Tabs
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
        headerRight: () => <HeaderBell role="requester" />,
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home') }}
      />
      <Tabs.Screen
        name="create"
        options={{ title: 'New Request', tabBarIcon: tabIcon('add-circle-outline') }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'My Orders', tabBarIcon: tabIcon('receipt-long') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline') }}
      />
      <Tabs.Screen name="menu/[id]" options={{ href: null, title: 'Item details' }} />
      <Tabs.Screen name="orders/[id]" options={{ href: null, title: 'Order details' }} />
      <Tabs.Screen name="orders/confirmation" options={{ href: null, title: 'Request placed' }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
    </Tabs>
  );
}
