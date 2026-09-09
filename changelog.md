# Send2U Changelog

Persistent development record for the Send2U Expo React Native project.
Every meaningful change must be appended here (never overwrite history).
See `.agents/skills/send2u-dev/SKILL.md` for the mandatory workflow.
Source code, schema, migrations, and config remain authoritative if anything
here conflicts with the actual implementation.

## 2026-09-09 — Skeleton: MVP app foundation

- Change: established the Send2U MVP skeleton on the existing Expo template
  (Expo SDK 54, React Native 0.81, Expo Router, TypeScript).
  Navigation groups `app/(auth)`, `app/(requester)` (Home / New Request /
  My Orders / Profile), `app/(helper)` (Jobs / My Deliveries / Earnings /
  Profile), root auth gate (`app/index.tsx`), role picker
  (`app/select-role.tsx`); removed template `(tabs)` and `modal` routes.
  Added separation layers: `config/` (env, app, dev flags), `lib/supabase.ts`
  (shared client, AsyncStorage persistence), `contexts/AuthContext.tsx`,
  `hooks/useAuth.ts`, `services/` (auth, orders placeholder),
  `types/domain.ts` (user/requester/helper/vendor/order/delivery/menu
  item/location/payment/rating; order stages
  request → assignment → fulfilment → verification → confirmation → payout),
  reusable UI (`components/ui`: Button, Card, Screen, PlaceholderScreen).
  Supabase deps added via `expo install`: `@supabase/supabase-js`,
  `@react-native-async-storage/async-storage`, `react-native-url-polyfill`.
- Reason: stable, extensible foundation for the full transaction workflow.
- Validation: `tsc`, `eslint`, `expo-doctor` 18/18, `expo export -p web` — pass.

## 2026-09-09 — Auth: real Supabase anonymous dev entry + profile roles

- Change: replaced skeleton/mock auth with real Supabase Auth. `(auth)/sign-in`
  is now credential-free dev entry ("Continue as Requester / Helper") using
  `supabase.auth.signInAnonymously()`; deleted email/password UI and
  `(auth)/sign-up`. Role lives in new `send2u_profiles` table keyed by
  `auth.uid()` (migration `20260909153529_create_send2u_profiles`; roles
  `requester|helper|vendor|admin`; RLS on with three ownership-pinned
  `TO authenticated` policies; grants to `authenticated` only).
  `AuthContext` centralizes session restore, `onAuthStateChange`, profile
  load, `continueAs` / `switchRole` (both dev-gated by
  `EXPO_PUBLIC_SEND2U_DEV_AUTH=1`), and real `signOut`. Profile screens show
  session info plus a dev-only role-switch card; routing after entry/switch/
  logout is declarative via route guards.
- Reason: rapid MVP development with a valid `auth.uid()` for future RLS,
  while keeping production auth replaceable later.
- Details: service functions in `services/auth.ts` throw real errors (no fake
  fallback). Fixed `expo export -p web` SSR crash (`AsyncStorage` needs
  `window`): `lib/supabase.ts` uses ephemeral memory storage during static
  pre-render; render path no longer creates the client. Added gitignored local
  `.env` (`.gitignore` previously did not ignore plain `.env`).
- Validation: `tsc`, `eslint`, `expo-doctor` 18/18, `expo export -p web`
  (19 routes) — pass. Live REST probe as anon returns 0 rows (RLS enforced).
  Supabase advisors show no findings on the new table.
- Known limitations:
  - Supabase "Allow anonymous sign-ins" toggle was still disabled on the
    app's project at last live check (`anonymous_provider_disabled`); dev
    entry cannot succeed until it is enabled.
  - Canonical project unresolved: app/MCP use one project ref while the
    configured MCP URL references another; confirm before going further.

## 2026-09-09 — Workflow: Send2U dev skill + changelog tracking

- Change: created project skill `.agents/skills/send2u-dev/SKILL.md`
  (follows the existing `.agents/skills/<name>/SKILL.md` frontmatter
  convention) enforcing read-changelog → inspect → implement → validate →
  append-changelog → report; created this `changelog.md` with the verified
  initial state; added a continuity pointer to `AGENTS.md`.
- Reason: persistent, reusable change tracking for the whole Send2U lifecycle.
- Validation: `tsc`, `eslint` — pass. Changelog claims cross-checked against
  tree, routes, and migration record; no secrets in new files.

## 2026-09-10 — UI: light-only design system + MVP screen polish

- Change: established the Send2U visual foundation and polished every screen.
  `constants/theme.ts` is now the single light-only source of truth (brand
  primary `#0A6E94` with white text at 5.7:1 contrast; full color/typography/
  spacing/radii/elevation/nav tokens; no dark-mode tokens — all text/background
  pairs verified ≥ 4.5:1). Reusable UI in `components/ui`: Text, Button
  (primary/secondary/tertiary/danger, loading, 52pt targets), Card, Screen
  (safe-area + scroll), Badge, EmptyState, LoadingState, ErrorState,
  SectionHeader, ListRow, OptionCard, FeaturePreview (honest "Coming soon"
  placeholders), StageLegend (static 5-stage lifecycle), plus BrandHeader and
  shared RoleSelect. All screens rewritten: branded credential-free auth entry,
  role picker with current-role context, requester Home (active-order card,
  how-it-works, menu preview), New Request steps, Orders with stage legend,
  helper Jobs (local availability toggle driving honest empty states),
  Deliveries, Earnings (no invented amounts), and mirrored profiles with
  dev-only role switch and danger-styled sign-out. Tab bars use consistent
  MaterialIcons with styled light headers. Deleted dead template components
  (ThemedText/View, theme hooks, PlaceholderScreen, parallax/collapsible/
  icon-symbol/haptic leftovers).
- Reason: MVP should feel like a coherent campus product, not a prototype,
  while unbuilt features stay clearly labeled instead of faked.
- Decisions:
  - LIGHT THEME ONLY: `app.json` `userInterfaceStyle` → `light` (incl. splash
    dark variant), root layout pinned to light `DefaultTheme` + dark status
    bar, device color scheme never consulted. No new animation/icon
    dependencies (`@expo/vector-icons` only, no emoji icons).
  - No `TextField` component yet — no screen needs inputs; add when ordering
    lands.
- Bug fixes found by visual inspection:
  - Tab-bar labels clipped (62pt bar too short): bar → 70pt, removed negative
    icon margin; verified legible in screenshots.
  - `select-role` redirected unauthenticated users during session restore,
    bouncing logged-in users through sign-in on cold start: now waits for
    `isLoading` with a loading state.
- Backend/auth verification (live, no code change): anonymous sign-ins are now
  enabled on the app project — full round trip passes (anon sign-in ×2, own
  profile upsert/select/update, cross-user read returns 0 rows, sign-out).
  Dev entry is unblocked. Note: a few throwaway anonymous test users/rows
  remain from verification; safe to purge later via the documented anon-user
  cleanup query.
- Validation: `tsc`, `eslint`, `expo-doctor` 18/18, `expo export -p web`
  (19 routes) — pass. Rendered 10 mobile-viewport screenshots in headless
  Chrome with real injected Supabase sessions and inspected them; the two
  defects above were fixed and re-verified visually. Remaining screenshots
  show consistent hierarchy, spacing, safe areas, and touch targets.
- Known limitations: native-device rendering not checked (no simulator run in
  this environment); web screenshots are representative of layout but not a
  substitute for on-device review.
