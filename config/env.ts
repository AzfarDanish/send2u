/**
 * Environment configuration for Send2U.
 *
 * All Supabase credentials must come from environment variables.
 * Never hard-code keys or secrets in source code.
 *
 * Required variables (prefix `EXPO_PUBLIC_` so they are exposed to the app):
 * - EXPO_PUBLIC_SUPABASE_URL
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;

export function isSupabaseConfigured(): boolean {
  return env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
}
