import * as Clipboard from 'expo-clipboard';
import { Alert, Linking } from 'react-native';

/**
 * External-maps handoff (no in-app map SDK by product direction).
 * Builds a universal Google Maps search URL from a plain-text label so the
 * OS opens the Google Maps app when installed, with browser fallback.
 * Coordinates are never fabricated: a text-only label becomes the query.
 */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
}

/**
 * Opens the label in the external maps app. Falls back to copying the
 * location text when the URL cannot be opened, so the helper is never
 * stranded without the destination.
 */
export async function openMapsLocation(label: string): Promise<'opened' | 'copied' | 'failed'> {
  const trimmed = label.trim();
  if (!trimmed) return 'failed';
  try {
    const url = mapsSearchUrl(trimmed);
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return 'opened';
    }
  } catch {
    // Fall through to the clipboard fallback below.
  }
  try {
    await Clipboard.setStringAsync(trimmed);
    Alert.alert('Location copied', trimmed);
    return 'copied';
  } catch {
    Alert.alert('Location', trimmed);
    return 'failed';
  }
}
