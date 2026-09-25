import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';

interface AuthLinkProps {
  title: string;
  onPress: () => void;
  accessibilityLabel?: string;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<ViewStyle>;
}

/**
 * Minimal red text action. Only the red text is interactive; callers keep
 * surrounding gray copy non-pressable.
 */
export function AuthLink({ title, onPress, accessibilityLabel, align = 'center', style }: AuthLinkProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      haptic="selection"
      hitSlop={12}
      style={[
        styles.link,
        align === 'left' && styles.left,
        align === 'right' && styles.right,
        style,
      ]}>
      <Text style={styles.label}>{title}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  link: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  left: { alignItems: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  label: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.primary,
  },
});
