import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { GlassHeader } from '@/components/GlassHeader';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

function Value({ children }: { children: string }) {
  return (
    <Text variant="secondary" color="secondary" numberOfLines={1} ellipsizeMode="middle">
      {children}
    </Text>
  );
}

/**
 * Settings in three groups — Account (real profile values), Preferences
 * (only rows that do something real), About (real version + v1 legal).
 * Account values are edited in Edit Profile; rows navigate there.
 */
export default function SettingsScreen() {
  const { user, profile } = useAuth();
  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <>
      <GlassHeader title="Settings" />
      <Screen beneathHeader>
      <Text variant="subtitle" style={styles.groupTitle}>
        Account
      </Text>
      <Card style={styles.groupCard}>
        <View style={styles.divider}>
          <ListRow
            icon="mail-outline"
            title="Email"
            right={<Value>{user?.email ?? 'Not available'}</Value>}
            accessibilityLabel={`Email, ${user?.email ?? 'not available'}`}
          />
        </View>
        <View style={styles.divider}>
          <ListRow
            icon="badge"
            title="Student ID"
            right={<Value>{profile?.studentId?.trim() || 'Not set'}</Value>}
            accessibilityLabel={`Student ID, ${profile?.studentId?.trim() || 'not set'}`}
            onPress={() => router.push('/(requester)/edit-profile')}
          />
        </View>
        <View style={styles.divider}>
          <ListRow
            icon="phone"
            title="Phone Number"
            right={<Value>{profile?.phoneNumber?.trim() || 'Not set'}</Value>}
            accessibilityLabel={`Phone number, ${profile?.phoneNumber?.trim() || 'not set'}`}
            onPress={() => router.push('/(requester)/edit-profile')}
          />
        </View>
        <ListRow
          icon="lock-outline"
          title="Change Password"
          accessibilityLabel="Change password"
          onPress={() => router.push('/(requester)/settings/change-password')}
        />
      </Card>

      <Text variant="subtitle" style={styles.groupTitle}>
        Preferences
      </Text>
      <Card style={styles.groupCard}>
        <View style={styles.divider}>
          <ListRow
            icon="notifications-none"
            title="Notifications"
            subtitle="Order updates and announcements"
            accessibilityLabel="Notifications. Order updates and announcements"
            onPress={() => router.push('/(requester)/notifications')}
          />
        </View>
        <ListRow
          icon="language"
          title="Language"
          right={<Value>English</Value>}
          accessibilityLabel="Language, English"
        />
      </Card>

      <Text variant="subtitle" style={styles.groupTitle}>
        About
      </Text>
      <Card style={styles.groupCard}>
        <View style={styles.divider}>
          <ListRow
            icon="info-outline"
            title="App Version"
            right={<Value>{appVersion}</Value>}
            accessibilityLabel={`App version, ${appVersion}`}
          />
        </View>
        <View style={styles.divider}>
          <ListRow
            icon="description"
            title="Terms of Service"
            accessibilityLabel="Terms of service"
            onPress={() => router.push('/(requester)/terms')}
          />
        </View>
        <ListRow
          icon="privacy-tip"
          title="Privacy Policy"
          accessibilityLabel="Privacy policy"
          onPress={() => router.push('/(requester)/privacy')}
        />
      </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  groupTitle: { color: colors.text },
  groupCard: { gap: 0 },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
});
