/**
 * Static application configuration for Send2U.
 * No secrets belong here — see `config/env.ts` for env-based config.
 */

export const appConfig = {
  name: 'Send2U',
  tagline: 'Student-powered campus delivery',
  defaultRole: 'requester',
} as const;

export const routes = {
  auth: '/(auth)/sign-in',
  selectRole: '/select-role',
  requesterHome: '/(requester)',
  helperPortal: '/(requester)/helper-portal',
} as const;
