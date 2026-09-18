import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { helperLabel, type HelperIdentity as HelperIdentityData } from '@/services/helperIdentity';

interface HelperIdentityProps {
  /** Result of `useHelperIdentity`; null while loading/unassigned. */
  identity: HelperIdentityData | null;
  helperId: string | null;
  /** Small supporting line under the name (e.g. delivery context). */
  caption?: string;
  onRetry?: () => void;
  loadFailed?: boolean;
  /**
   * Identity fetch still in flight. Must be passed explicitly: a null
   * `identity` alone also means "no label to show" (ready), so the row
   * would otherwise have to guess.
   */
  loading?: boolean;
}

function initialsFor(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const word = parts[0] ?? '';
    return word.startsWith('#') ? word.slice(1, 3).toUpperCase() : word.slice(0, 2).toUpperCase();
  }
  return `${parts[0]?.charAt(0) ?? ''}${parts[parts.length - 1]?.charAt(0) ?? ''}`.toUpperCase();
}

/**
 * Helper identity row: initials avatar + real display name (or the honest
 * short-id fallback — never a fabricated name, never a Verified badge the
 * backend cannot confirm).
 */
export function HelperIdentity({ identity, helperId, caption, onRetry, loadFailed, loading }: HelperIdentityProps) {
  const label = helperLabel(identity, helperId);
  // Row-shaped placeholder while the name is in flight — the avatar and the
  // text column hold their geometry, so the real name lands in place.
  if (loading) {
    return <SkeletonList rows={1} lines={2} thumb={52} round label="Loading helper details" />;
  }
  return (
    <View style={styles.row}>
      <View style={styles.avatar} accessibilityRole="image" accessibilityLabel={`Avatar for ${label}`}>
        <Text variant="subtitle" style={styles.initials}>
          {initialsFor(label)}
        </Text>
      </View>
      <View style={styles.textBlock}>
        <Text variant="secondary" style={styles.name} numberOfLines={2}>
          {label}
        </Text>
        {loadFailed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading helper details"
            onPress={onRetry}
            hitSlop={8}>
            <Text variant="caption" style={styles.retry}>
              Couldn&rsquo;t load name — tap to retry.
            </Text>
          </Pressable>
        ) : caption ? (
          <Text variant="caption" color="secondary" numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </View>
      <MaterialIcons name="delivery-dining" size={22} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.primary },
  textBlock: { flex: 1, gap: spacing.xs },
  name: { fontWeight: '600', color: colors.text },
  retry: { color: colors.primary, fontWeight: '600' },
});
