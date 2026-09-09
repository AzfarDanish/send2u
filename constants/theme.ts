/**
 * Send2U light-only design system — the single source of truth for color,
 * typography, spacing, radii, and elevation.
 *
 * LIGHT THEME ONLY: there are no dark-mode tokens. Do not branch on the
 * device color scheme; every surface below is used as-is on all devices.
 */

export const colors = {
  /** Brand primary (trust/speed). White text passes contrast on this. */
  primary: '#0A6E94',
  primaryPressed: '#085B7A',
  onPrimary: '#FFFFFF',
  /** Tinted surfaces for highlights, icon chips, selected states. */
  primarySoft: '#E2F1F7',

  background: '#F5F7F9',
  surface: '#FFFFFF',

  text: '#17242C',
  secondary: '#4E5D66',
  muted: '#69757E',

  border: '#E1E7EB',

  success: '#1D7A4C',
  successSoft: '#E4F3EB',
  warning: '#96590A',
  warningSoft: '#F9EEDB',
  error: '#BC3A2A',
  errorSoft: '#FAE7E3',
  info: '#0A6E94',
  infoSoft: '#E2F1F7',

  disabled: '#98A3AB',
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
  full: 999,
} as const;

/** Minimum interactive heights. All touch targets are ≥ 48pt. */
export const touchTargets = {
  button: 52,
  listRow: 60,
  tabBar: 70,
} as const;

export const shadows = {
  card: {
    shadowColor: '#16232B',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;

/** Shared tab-bar / header styling so both experiences stay consistent. */
export const navigation = {
  headerBackground: colors.surface,
  headerText: colors.text,
  tabBarBackground: colors.surface,
  tabBarBorder: colors.border,
  tabActive: colors.primary,
  tabInactive: colors.muted,
} as const;
