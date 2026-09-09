/**
 * Development-only switches for Send2U.
 *
 * `DEV_AUTH_ENABLED` gates the credential-free development authentication flow
 * (anonymous Supabase sign-in + self service role selection/switching).
 * It is OFF unless explicitly enabled via `EXPO_PUBLIC_SEND2U_DEV_AUTH=1`,
 * so production builds never expose the dev flow by accident.
 *
 * To remove the dev flow later, delete the UI gated by this flag and the
 * `continueAsDev` / `switchDevRole` service functions. The underlying
 * Supabase session + `send2u_profiles` role model stays valid for
 * production auth (email/OAuth/SSO linking onto the same user row).
 */

export const DEV_AUTH_ENABLED = process.env.EXPO_PUBLIC_SEND2U_DEV_AUTH === '1';
