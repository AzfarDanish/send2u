import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { radii, spacing, touchTargets } from '@/constants/theme';

/**
 * Layout-matched loading placeholders — the shared "load data" treatment.
 *
 * Why these exist: a bare centered spinner tells the user nothing about what
 * is arriving and makes every screen re-flow on load. These blocks mirror the
 * real geometry of the screen they replace (thumb + title + meta lines, key/
 * value rows, form field stacks), so the loaded content lands where the
 * placeholder already was (design.md §6 — states are designed, not decorated).
 *
 * Motion-free by construction (static `Skeleton` fills), so they are
 * reduced-motion safe and cost nothing at runtime. Always wrapped in a single
 * accessible progressbar region so a screen reader announces one loading
 * message instead of one per block.
 */

interface BlockProps {
  /** Screen-reader label for the loading region. */
  label?: string;
}

function Region({ label, style, children }: BlockProps & { style?: ViewStyle; children: React.ReactNode }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading content'} style={style}>
      {children}
    </View>
  );
}

/** Rounded image/avatar placeholder. Square by default, pass `round` for circles. */
export function SkeletonThumb({ size = 56, round = false }: { size?: number; round?: boolean }) {
  return <Skeleton width={size} height={size} radius={round ? radii.full : radii.md} />;
}

/** One list row: leading thumb (optional) + stacked text lines. */
export function SkeletonRow({
  lines = 2,
  thumb = 56,
  round = false,
  trailing = false,
}: {
  lines?: number;
  /** Pass 0 to omit the leading thumb. */
  thumb?: number;
  round?: boolean;
  trailing?: boolean;
}) {
  return (
    <View style={styles.row}>
      {thumb > 0 ? <SkeletonThumb size={thumb} round={round} /> : null}
      <View style={styles.rowText}>
        <Skeleton width="70%" height={18} />
        {lines > 1 ? <Skeleton width="45%" height={14} /> : null}
        {lines > 2 ? <Skeleton width="88%" height={14} /> : null}
      </View>
      {trailing ? (
        <View style={styles.rowTrailing}>
          <Skeleton width={72} height={22} radius={radii.full} />
          <Skeleton width={56} height={16} />
        </View>
      ) : null}
    </View>
  );
}

/** A list of rows — the default placeholder for any scrolling data list. */
export function SkeletonList({
  rows = 3,
  lines = 2,
  thumb = 56,
  round = false,
  trailing = false,
  label,
}: BlockProps & { rows?: number; lines?: number; thumb?: number; round?: boolean; trailing?: boolean }) {
  return (
    <Region label={label} style={styles.list}>
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonRow key={index} lines={lines} thumb={thumb} round={round} trailing={trailing} />
      ))}
    </Region>
  );
}

/** A stack of text lines — stands in for a paragraph/card body. */
export function SkeletonBlock({ lines = 3, label }: BlockProps & { lines?: number }) {
  const widths = ['82%', '95%', '68%', '88%', '74%'];
  return (
    <Region label={label} style={styles.block}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={widths[index % widths.length] as ViewStyle['width']} height={14} />
      ))}
    </Region>
  );
}

/** Key/value rows — the summary tables on detail, payment, and receipt screens. */
export function SkeletonKeyValueRows({ rows = 3, label }: BlockProps & { rows?: number }) {
  return (
    <Region label={label} style={styles.block}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.kvRow}>
          <Skeleton width="34%" height={14} />
          <Skeleton width="22%" height={16} />
        </View>
      ))}
    </Region>
  );
}

/** Label + input pairs — create, edit-profile, change-password, vendor menu forms. */
export function SkeletonForm({ fields = 3, label }: BlockProps & { fields?: number }) {
  return (
    <Region label={label} style={styles.form}>
      {Array.from({ length: fields }, (_, index) => (
        <View key={index} style={styles.field}>
          <Skeleton width="30%" height={14} />
          <Skeleton width="100%" height={touchTargets.button} radius={radii.md} />
        </View>
      ))}
    </Region>
  );
}

/** Centered icon-circle hero + heading + supporting lines (detail/workflow screens). */
export function SkeletonHero({ label }: BlockProps) {
  return (
    <Region label={label} style={styles.hero}>
      <Skeleton width={96} height={96} radius={radii.full} />
      <Skeleton width="62%" height={22} />
      <Skeleton width="84%" height={14} />
    </Region>
  );
}

/**
 * Full screen placeholder for a data-backed detail screen:
 * header row, hero, summary block, key/value rows.
 * Compose with `SkeletonList`/`SkeletonForm` for list- or form-shaped screens.
 */
export function SkeletonDetail({
  hero = true,
  blocks = 2,
  rows = 4,
  label,
}: BlockProps & { hero?: boolean; blocks?: number; rows?: number }) {
  return (
    <View style={styles.detail}>
      {hero ? <SkeletonHero label={label ?? 'Loading content'} /> : null}
      {Array.from({ length: blocks }, (_, index) => (
        <SkeletonBlock key={index} lines={index % 2 === 0 ? 3 : 2} />
      ))}
      <SkeletonKeyValueRows rows={rows} />
    </View>
  );
}

/**
 * Profile-shaped placeholder: avatar, name, account line, then the menu rows.
 * Used by every screen that renders `profile` from the auth session.
 */
export function SkeletonProfile({ rows = 5, label }: BlockProps & { rows?: number }) {
  return (
    <View>
      <Region label={label ?? 'Loading your profile'} style={styles.profileHeader}>
        <Skeleton width={72} height={72} radius={radii.full} />
        <Skeleton width="46%" height={20} />
        <Skeleton width="62%" height={14} />
      </Region>
      <SkeletonList rows={rows} lines={1} thumb={44} label={label ?? 'Loading your profile'} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: spacing.sm },
  rowTrailing: { alignItems: 'flex-end', gap: spacing.sm },
  block: { gap: spacing.sm, paddingVertical: spacing.sm },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  form: { gap: spacing.lg, paddingVertical: spacing.sm },
  field: { gap: spacing.sm },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  detail: { gap: spacing.lg, paddingVertical: spacing.sm },
  profileHeader: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.md },
});
