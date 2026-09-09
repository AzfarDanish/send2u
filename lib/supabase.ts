import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { env, isSupabaseConfigured } from '@/config/env';

let client: SupabaseClient | null = null;

// AsyncStorage touches `window` on web, which does not exist while Expo
// statically pre-renders routes (SSR). Fall back to ephemeral memory storage
// there — the pre-render never needs a persisted session; the real storage
// is used at runtime on every platform.
const memoryBucket = new Map<string, string>();
const memoryStorage = {
  getItem: async (key: string): Promise<string | null> =>
    memoryBucket.has(key) ? (memoryBucket.get(key) as string) : null,
  setItem: async (key: string, value: string): Promise<void> => {
    memoryBucket.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    memoryBucket.delete(key);
  },
};

function resolveStorage() {
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return memoryStorage;
  }
  return AsyncStorage;
}

/**
 * Returns a shared Supabase client, or `null` when env config is missing.
 * UI components must never import this directly — use services/hooks instead.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: resolveStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export function isSupabaseReady(): boolean {
  return isSupabaseConfigured();
}
