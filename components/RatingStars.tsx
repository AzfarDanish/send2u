import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';

const STAR_COUNT = 5;

/** Read-only star display. Always paired with text — never color-only. */
export function RatingStars({ score, size = 20 }: { score: number; size?: number }) {
  return (
    <View
      style={styles.row}
      accessibilityRole="summary"
      accessibilityLabel={`Rated ${score} out of ${STAR_COUNT}`}>
      {Array.from({ length: STAR_COUNT }, (_, index) => (
        <MaterialIcons
          key={index}
          name={index < score ? 'star' : 'star-border'}
          size={size}
          color={index < score ? colors.warning : colors.disabled}
        />
      ))}
    </View>
  );
}

interface RatingInputProps {
  value: number | null;
  onChange: (score: number) => void;
  disabled?: boolean;
}

/** Interactive 1–5 star picker. 48pt targets; selection state per star. */
export function RatingInput({ value, onChange, disabled = false }: RatingInputProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Your rating">
      {Array.from({ length: STAR_COUNT }, (_, index) => {
        const star = index + 1;
        const selected = value !== null && star <= value;
        return (
          <Pressable
            key={star}
            accessibilityRole="radio"
            accessibilityLabel={`Rate ${star} star${star === 1 ? '' : 's'}`}
            accessibilityState={{ selected: value === star, disabled }}
            disabled={disabled}
            hitSlop={4}
            onPress={() => onChange(star)}
            style={({ pressed }) => [styles.star, pressed && !disabled && styles.pressed]}>
            <MaterialIcons
              name={selected ? 'star' : 'star-border'}
              size={32}
              color={selected ? colors.warning : colors.disabled}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  star: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
