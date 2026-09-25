import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

interface NotificationBellProps {
  unreadCount: number;
  onPress: () => void;
  /** Glyph colour; red headers pass the on-primary white. */
  color?: string;
  /** Unread dot colour. Defaults to the error red used on white headers. */
  dotColor?: string;
}

/** Header bell with an unread dot. Silent when everything is read. */
export function NotificationBell({
  unreadCount,
  onPress,
  color = colors.text,
  dotColor = colors.error,
}: NotificationBellProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
      }
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      hitSlop={8}>
      <View>
        <MaterialIcons
          name={unreadCount > 0 ? 'notifications' : 'notifications-none'}
          size={26}
          color={color}
        />
        {unreadCount > 0 ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  dot: {
    position: 'absolute',
    top: 1,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.error,
  },
});
