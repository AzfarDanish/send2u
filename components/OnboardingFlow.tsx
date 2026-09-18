import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';

interface Slide {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  body: string;
}

/**
 * The walkthrough copy states only what the app actually does: campus stalls,
 * Online Payment or Cash on Delivery recorded by Send2U, a student helper
 * collecting and delivering, then confirm and rate. No invented features.
 */
const SLIDES: Slide[] = [
  {
    icon: 'storefront',
    title: 'Order from campus stalls',
    body: 'Browse stalls around campus, add what you want to a cart, and pick a drop-off point.',
  },
  {
    icon: 'payments',
    title: 'Pay online or cash on delivery',
    body: 'Choose Online Payment or Cash on Delivery. Send2U records every transaction — you never settle with the helper.',
  },
  {
    icon: 'delivery-dining',
    title: 'Track it to your door',
    body: 'A nearby student helper collects your food and delivers it. Confirm receipt, then rate the delivery.',
  },
];

interface OnboardingFlowProps {
  /** Invoked once, whichever control the user leaves with (Skip or Get Started). */
  onFinish: () => void;
}

/**
 * Swipeable one-time walkthrough. Presentational: the caller owns navigation
 * and the completion flag. Skippable at every step, so a user who wants to
 * order never has to page through it.
 */
export function OnboardingFlow({ onFinish }: OnboardingFlowProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const pager = useRef<ScrollView>(null);
  const slideWidth = Math.max(240, width - spacing.xl * 2);
  const last = index === SLIDES.length - 1;

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
      pager.current?.scrollTo({ x: clamped * slideWidth, animated: true });
      setIndex(clamped);
    },
    [slideWidth],
  );

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
      setIndex(Math.max(0, Math.min(SLIDES.length - 1, next)));
    },
    [slideWidth],
  );

  return (
    <Screen scrollable={false} contentStyle={styles.content}>
      <View style={styles.topRow}>
        <Text variant="eyebrow" color="muted">
          {`STEP ${index + 1} OF ${SLIDES.length}`}
        </Text>
        <Text
          variant="secondary"
          color="secondary"
          accessibilityRole="button"
          accessibilityLabel="Skip the walkthrough"
          onPress={onFinish}
          suppressHighlighting
          style={styles.skip}>
          Skip
        </Text>
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        style={styles.pager}
        accessibilityLabel={`Walkthrough step ${index + 1} of ${SLIDES.length}`}>
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width: slideWidth }]}>
            <View style={styles.iconTile}>
              <MaterialIcons name={slide.icon} size={44} color={colors.primary} />
            </View>
            <Text variant="display" style={styles.centered}>
              {slide.title}
            </Text>
            <Text color="secondary" style={styles.centered}>
              {slide.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityElementsHidden>
        {SLIDES.map((slide, dot) => (
          <View key={slide.title} style={[styles.dot, dot === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        {last ? (
          <Button
            title="Get Started"
            onPress={onFinish}
            accessibilityLabel="Finish the walkthrough and continue"
          />
        ) : (
          <>
            <Button title="Next" onPress={() => goTo(index + 1)} />
            <Button
              title="Skip"
              variant="tertiary"
              onPress={onFinish}
              accessibilityLabel="Skip the walkthrough and continue"
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, justifyContent: 'space-between' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  skip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  pager: { flexGrow: 0 },
  slide: { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  iconTile: {
    width: 104,
    height: 104,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  centered: { textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  dot: { width: 8, height: 8, borderRadius: radii.full, backgroundColor: colors.surfaceSecondary },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  actions: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.lg },
});
