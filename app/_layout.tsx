import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';

import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';

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
  // Keyed by user so the local cart resets whenever the session changes.
  return (
    <CartProvider key={user?.id ?? 'guest'}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="select-role" />
        <Stack.Screen name="(requester)" />
        <Stack.Screen name="(helper)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </CartProvider>
  );
}
