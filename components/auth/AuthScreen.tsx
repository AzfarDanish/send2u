import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { AuthLogo } from '@/components/auth/AuthLogo';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';

interface AuthScreenProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

/**
 * Minimal Apple-style auth shell: white safe-area screen, narrow centered
 * column, restrained logo/title/description rhythm, and an optional
 * minimal back chevron. No cards, headers, badges, or marketing.
 */
export function AuthScreen({ title, description, children, footer, onBack, backLabel = 'Go back' }: AuthScreenProps) {
  return (
    <Screen scrollable contentStyle={styles.content}>
      <View style={styles.narrow}>
        <View style={styles.topRow}>
          {onBack ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              onPress={onBack}
              haptic="selection"
              hitSlop={8}
              style={styles.back}>
              <MaterialIcons name="chevron-left" size={26} color={colors.text} />
            </PressableScale>
          ) : (
            <View style={styles.backSpacer} />
          )}
        </View>
        <View style={styles.logo}>
          <AuthLogo />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.body}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  narrow: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  topRow: {
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backSpacer: { height: 44 },
  logo: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.text,
  },
  description: {
    marginTop: spacing.sm,
    fontSize: 16,
    lineHeight: 24,
    color: colors.secondary,
  },
  body: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
});
