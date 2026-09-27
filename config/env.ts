/**
 * Environment configuration for Send2U.
 *
 * All Supabase credentials must come from environment variables.
 * Never hard-code keys or secrets in source code.
 *
 * Required variables (prefix `EXPO_PUBLIC_` so they are exposed to the app):
 * - EXPO_PUBLIC_SUPABASE_URL
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Optional variables:
 * - EXPO_PUBLIC_MAPTILER_KEY: MapTiler API key for the Streets basemap
 *   (building detail). Absent means the map renders OpenStreetMap raster
 *   instead — never pass a placeholder, and URL-restrict the key in the
 *   MapTiler dashboard since it ships inside the app bundle.
 */

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  maptilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '',
} as const;

export function isSupabaseConfigured(): boolean {
  return env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
}

export function isMapTilerConfigured(): boolean {
  return env.maptilerKey.length > 0;
}
