/**
 * Development-only switches for Send2U.
 *
 * `DEV_AUTH_ENABLED` gates dev-only UI — currently the test-account switcher
 * section on the Profile page (`DevProfileSwitcher`). It is OFF unless
 * explicitly enabled via `EXPO_PUBLIC_SEND2U_DEV_AUTH=1`, so production
 * builds never expose dev controls by accident.
 *
 * Account entry itself is always production-style (real email/password
 * accounts with permanent roles). The old credential-free anonymous entry and
 * in-place role switching were removed; the underlying Supabase session +
 * `send2u_profiles` role model is unchanged. Server-side, dev capabilities
 * are additionally gated by the `is_dev_account` profile flag (out-of-band
 * admin only), so hiding this UI is defense in depth, not the authorization.
 */

export const DEV_AUTH_ENABLED = process.env.EXPO_PUBLIC_SEND2U_DEV_AUTH === '1';
