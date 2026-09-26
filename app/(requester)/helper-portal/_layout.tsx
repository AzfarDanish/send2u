import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

/**
 * Helper Portal shell: a stack, with no bottom navigation of its own.
 *
 * The portal is one capability surface entered from the requester Profile, and
 * the requester tab bar is already hidden for this whole subtree (see
 * `app/(requester)/_layout.tsx`). Active deliveries are reached through the
 * island on the Jobs root, and delivery history through the Profile, so there is
 * nothing left for a bar to hold.
 *
 * Root: `index` (Available Jobs). Pushed: `profile` from the header avatar,
 * `deliveries` (history) and `earnings` / `about` from the Profile rows, and
 * `jobs/[id]` for a delivery. Capability itself is guarded per screen by
 * HelperPortalGuard — this layout only owns the chrome.
 */
export default function HelperPortalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
