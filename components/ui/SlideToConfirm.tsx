import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';

const TRACK_HEIGHT = 56;
const THUMB_SIZE = 48;
const TRACK_PADDING = 4;
const COMPLETE_FRACTION = 0.7;

interface SlideToConfirmProps {
  /** Idle label, e.g. "Slide to accept". */
  label: string;
  /** Label shown while the action runs. */
  busyLabel?: string;
  /** Label shown when disabled, e.g. a capacity explanation. */
  disabledLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}

/**
 * Consequential confirmation control: the caller drags the thumb past
 * ~70% of the track to confirm. Releasing early springs back with
 * nothing committed. Screen-reader users get an equivalent tap action.
 * Used for job acceptance; ordinary navigation never uses this weight.
 */
export function SlideToConfirm({
  label,
  busyLabel = 'Working…',
  disabledLabel,
  disabled = false,
  busy = false,
  onConfirm,
}: SlideToConfirmProps) {
  const [slide] = useState(() => new Animated.Value(0));
  const [trackWidth, setTrackWidth] = useState(0);
  const locked = disabled || busy;
  const maxDx = Math.max(trackWidth - THUMB_SIZE - TRACK_PADDING * 2, 1);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !locked,
        onMoveShouldSetPanResponder: (_, gesture) => !locked && Math.abs(gesture.dx) > 4,
        onPanResponderGrant: () => {
          slide.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          if (locked) return;
          slide.setValue(Math.min(Math.max(gesture.dx, 0), maxDx));
        },
        onPanResponderRelease: (_, gesture) => {
          if (locked) {
            Animated.spring(slide, { toValue: 0, useNativeDriver: false }).start();
            return;
          }
          if (gesture.dx >= maxDx * COMPLETE_FRACTION) {
            Animated.timing(slide, { toValue: maxDx, duration: 120, useNativeDriver: false }).start(
              ({ finished }) => {
                if (finished) onConfirm();
                slide.setValue(0);
              },
            );
          } else {
            Animated.spring(slide, { toValue: 0, useNativeDriver: false }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(slide, { toValue: 0, useNativeDriver: false }).start();
        },
      }),
    [locked, maxDx, onConfirm, slide],
  );

  const shownLabel = busy ? busyLabel : disabled && disabledLabel ? disabledLabel : label;

  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={shownLabel}
      accessibilityState={{ disabled: locked, busy }}
      accessibilityHint="Slide the handle right to confirm"
      onAccessibilityTap={() => {
        if (!locked) onConfirm();
      }}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={[styles.track, (disabled || busy) && styles.trackDisabled]}
      {...panResponder.panHandlers}>
      <Text
        variant="secondary"
        style={[styles.label, disabled && !busy && styles.labelDisabled]}
        numberOfLines={1}>
        {shownLabel}
      </Text>
      <Animated.View
        style={[
          styles.thumb,
          { transform: [{ translateX: Animated.add(TRACK_PADDING, slide) }] },
          disabled && !busy && styles.thumbDisabled,
        ]}>
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <MaterialIcons name="chevron-right" size={28} color={colors.onPrimary} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  trackDisabled: {
    backgroundColor: colors.disabledBackground,
  },
  label: { fontWeight: '600', color: colors.secondary, paddingHorizontal: spacing.xxxl },
  labelDisabled: { color: colors.muted },
  thumb: {
    position: 'absolute',
    left: 0,
    top: TRACK_PADDING,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbDisabled: { backgroundColor: colors.muted },
});
