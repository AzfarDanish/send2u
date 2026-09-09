import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { OptionCard } from '@/components/ui/OptionCard';
import { Text } from '@/components/ui/Text';
import type { UserRole } from '@/types/domain';

interface RoleSelectProps {
  onSelect: (role: UserRole) => void;
  /** Role currently being submitted, if any. */
  busyRole?: UserRole | null;
  /** Currently active role, shown for context when switching. */
  currentRole?: UserRole | null;
  disabled?: boolean;
}

/** Shared requester/helper picker used by entry and role-switch screens. */
export function RoleSelect({ onSelect, busyRole = null, currentRole = null, disabled = false }: RoleSelectProps) {
  const busy = busyRole !== null || disabled;
  return (
    <View style={styles.container}>
      {currentRole && <Text color="secondary">Current role: {currentRole}. Pick again to switch.</Text>}
      <OptionCard
        icon="shopping-bag"
        title="I'm ordering food"
        description="Browse the campus menu and get meals delivered to you."
        selected={currentRole === 'requester'}
        loading={busyRole === 'requester'}
        disabled={busy}
        onPress={() => onSelect('requester')}
      />
      <OptionCard
        icon="delivery-dining"
        title="I'm helping & earning"
        description="Pick up delivery jobs between classes and earn on campus."
        selected={currentRole === 'helper'}
        loading={busyRole === 'helper'}
        disabled={busy}
        onPress={() => onSelect('helper')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
});
