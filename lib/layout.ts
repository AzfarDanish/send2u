import { spacing, touchTargets } from '@/constants/theme';

/**
 * Trailing padding a tab-root scroller needs so its final row is never hidden
 * behind the requester tab bar (design.md §5: the bar floats, so tab roots
 * carry one tab height of clearance).
 *
 * Same value `components/ui/Screen.tsx` applies for `underTabs`, kept here so
 * new tab roots (the red-header shells) end their content at the identical
 * height instead of each inventing their own number.
 */
export const TAB_BAR_CONTENT_CLEARANCE = touchTargets.tabBar + spacing.xxxl;
