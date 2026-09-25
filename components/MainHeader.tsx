import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { HeaderBell } from '@/components/HeaderBell';
import { HeaderSettings } from '@/components/HeaderSettings';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';

interface MainHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional mark before the title (e.g. the Home logo tile). */
  leading?: ReactNode;
  /** Settings gear is Profile-only; the bell stays right-aligned everywhere. */
  showSettings?: boolean;
}

/**
 * Shared in-content header for the three main requester tabs (Home,
 * Requests, Profile). One construction everywhere: title on the left,
 * notification bell right-aligned, settings gear only on Profile.
 * Tab screens hide the native header and render this instead.
 */
export function MainHeader({ title, subtitle, leading, showSettings = false }: MainHeaderProps) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel={title}>
      {leading}
      <View style={styles.titles}>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text color="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <HeaderBell role="requester" />
      {showSettings ? <HeaderSettings href="/(requester)/settings" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titles: { flex: 1, gap: 2 },
});
