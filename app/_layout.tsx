import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';

/**
 * Send2U is LIGHT THEME ONLY. The navigation theme is pinned to the light
 * DefaultTheme and the status bar to dark content — the device color scheme
 * is never consulted, so the app looks identical on light and dark devices.
 */
export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={DefaultTheme}>
        <AuthedProviders />
        <StatusBar style="dark" />
      </ThemeProvider>
    </AuthProvider>
  );
}

function AuthedProviders() {
  const { user } = useAuth();
  // Device push lifecycle (registration, refresh, tap routing). Best-effort:
  // realtime + the notification center remain the baseline when push is
  // unavailable (web, denied permission, no device).
  usePushNotifications();
  // Keyed by account so the local cart resets on real account change —
  // but pinned across transient nulls (e.g. a flaky refresh that briefly
  // clears identity), which must never wipe an in-progress draft. A
  // same-account re-login therefore keeps its cart; a different account
  // still remounts fresh. State sets live in the async continuation only
  // (repo lint rule: no synchronous set-state-in-effect).
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const id = user.id;
    (async () => {
      if (!cancelled) setLastUserId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  const cartKey = user?.id ?? lastUserId ?? 'guest';
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CartProvider key={cartKey}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(requester)" />
          <Stack.Screen name="(vendor)" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </CartProvider>
    </GestureHandlerRootView>
  );
}
