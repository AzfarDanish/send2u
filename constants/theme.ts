/**
 * Send2U light-only design system — the single source of truth for color,
 * typography, spacing, and radii. Surfaces separate with borders only;
 * shadows are intentionally not used anywhere.
 *
 * LIGHT THEME ONLY: there are no dark-mode tokens. Do not branch on the
 * device color scheme; every surface below is used as-is on all devices.
 *
 * BRAND: red and white (design.md §5). `primary` is the Send2U icon red;
 * semantic success/warning/error keep their own non-red hues so status is
 * never confused with branding. Token NAMES are stable — screens adopt the
 * rebrand automatically with no layout, copy, or logic changes.
 */

export const colors = {
  /** Brand primary (Send2U red). White text passes contrast on this. */
  primary: '#DA0A1B',
  primaryPressed: '#A80815',
  onPrimary: '#FFFFFF',
  /** Tinted surfaces for highlights, icon chips, selected states. */
  primarySoft: '#FBE7E9',

  /** Pure white app background — the header, content, and tab bar read as one surface. */
  background: '#FFFFFF',
  surface: '#FFFFFF',
  /** Slightly elevated surface for cards/tips/tooltips — subtle lift over background. */
  surfaceElevated: '#FDFCFC',
  /** Secondary surface for muted containers (e.g. quantity stepper bg, empty state bg). */
  surfaceSecondary: '#F1ECEA',
  /** Thin separator lines between rows or sections. */
  divider: '#E9E2E0',

  text: '#22191B',
  secondary: '#5A4E52',
  muted: '#8D8287',

  border: '#E7DFDC',

  success: '#1D7A4C',
  successSoft: '#E4F3EB',
  warning: '#96590A',
  warningSoft: '#F9EEDB',
  error: '#BC3A2A',
  errorSoft: '#FAE7E3',
  /** Informational deep red (brand family, never teal). In-transit statuses only. */
  info: '#8A1A24',
  infoSoft: '#F7E4E5',

  disabled: '#9AA3AB',
  disabledBackground: '#E9EDF0',
} as const;

export type ColorName = keyof typeof colors;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subtitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  secondary: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8 },
  button: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  /** Prices and totals. Pair with tabular-nums at usage sites to avoid jitter. */
  price: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  /** Status-pill labels (sentence-case in UI). */
  status: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
} as const;

export type TextVariant = keyof typeof typography;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

/** Minimum interactive heights. All touch targets are ≥ 48pt. */
export const touchTargets = {
  button: 52,
  listRow: 60,
  tabBar: 70,
} as const;

/** Shared tab-bar / header styling so both experiences stay consistent. */
export const navigation = {
  /** Soft white header tint (Apple-style translucent over content). */
  headerBackground: 'rgba(255, 255, 255, 0.92)',
  headerText: colors.text,
  tabBarBackground: colors.surface,
  tabBarBorder: colors.border,
  tabActive: colors.primary,
  tabInactive: colors.muted,
} as const;
