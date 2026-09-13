import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

interface NotificationBellProps {
  unreadCount: number;
  onPress: () => void;
}

/** Header bell with an unread dot. Silent when everything is read. */
export function NotificationBell({ unreadCount, onPress }: NotificationBellProps) {
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
          color={colors.text}
        />
        {unreadCount > 0 ? <View style={styles.dot} /> : null}
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
