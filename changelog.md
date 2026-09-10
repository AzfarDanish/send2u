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

## 2026-09-10 — Menu: real Supabase menu + requester browsing + local cart

- Change: first data-backed feature. New minimal 2-level schema (one active
  menu per vendor; no menus table): `send2u_vendors` and `send2u_menu_items`
  (id, vendor, name, description, price_cents, nullable image_url for future
  Storage, availability, ordering, timestamps) via migration
  `create_send2u_menu`, plus fictional demo seed (`seed_send2u_menu_demo`):
  6 placeholder stalls, 26 items with MYR prices, 2 unavailable items.
  Read-only RLS: one SELECT policy per table (`TO authenticated`; vendors
  gated on `is_active`, items on vendor-active via EXISTS); zero write
  policies; ambient grants revoked, `GRANT SELECT … TO authenticated` only —
  requesters provably cannot modify menu data. App: `services/menu.ts`
  (SELECT-only, explicit errors, no `any`), `hooks/useMenu.ts` (mount fetch +
  pull-to-refresh, no cache lib), `lib/money.ts` (`formatMYR`), extended
  `Vendor`/`MenuItem` types, in-memory `CartContext` (add/setQty/remove/
  clear, subtotal = price × qty, resets per session, never persisted).
  UI: Home "Today's menu" (vendor sections, price-forward rows, unavailable
  badges, loading/error/empty/refresh states), new `/(requester)/menu/[id]`
  detail (vendor, price, availability, qty stepper, Add-to-cart → local cart
  only, honest confirmation), Create tab as cart home (lines, steppers,
  subtotal, no-fees note, "checkout next task" + clear). Shared
  `MenuItemRow`/`QuantityStepper`; `Screen` gained optional pull-to-refresh.
- Reason: make the menu real while bounding scope — no cart persistence, no
  checkout/order/fees/vendor-mixing rules (explicitly deferred).
- Decisions:
  - No payment infrastructure of any kind (no Stripe/FPX/wallets). QR-payment
    direction preserved with zero implementation: no schema change; reserved
    future home documented as a helper-profile extension holding a Storage
    image reference (binary never in DB), to be built with the payment task.
  - Unavailable items stay readable (grayed + badged) rather than hidden.
- Validation: `tsc`, `eslint`, `expo-doctor` 18/18, `expo export -p web`
  (incl. new `menu/[id]` route) — pass. SQL-verified: columns, both policy
  predicates, SELECT-only grants, 6/26/2 seed counts; advisors clean on new
  tables. Screens contain no raw Supabase calls and menu service has no
  writes (grep-verified).
- Known limitations:
  - Anonymous sign-ins were re-disabled on the app project after earlier
    verification passed, so the live authenticated RLS matrix (read OK /
    write-denied probes) and authenticated menu screenshots could not run
    this session. Re-enable the toggle on this project and re-run them
    before relying on end-to-end menu behavior; SQL-level policy/grant
    verification above stands on its own.
  - Native-device review not done.

## 2026-09-10 — Incident: menu migrations applied to wrong project, reverted

- What happened: the menu migrations (`create_send2u_menu`,
  `seed_send2u_menu_demo`) were applied through Supabase MCP to project
  `xhyhezk…`, but the app (per its updated `.env`) and the original MCP
  project instruction both point at project `sqspqwj…`. The MCP session
  serves `xhyhezk…`, so all MCP database work landed there.
- Reverted on `xhyhezk…` via recorded migration
  `revert_send2u_menu_wrong_project` (DROP of the two task-created tables;
  policies, index, grants, and seed rows went with them). Pre-drop evidence:
  tables absent pre-task, no external dependents, no triggers/functions, no
  local migration files, no hardcoded refs in source.
- Verified post-rollback: menu tables/policies/grants fully gone;
  `send2u_profiles` intact (12 rows, same 3 policies, RLS on); all unrelated
  tables byte-identical to baseline counts; migration history preserves the
  full trail (profiles → menu → seed → revert). No app code was changed.
- Disposition: app-side menu implementation (service, hook, cart, UI) is
  database-agnostic and REMAINS; migration SQL is preserved for reapplication.
  Nothing was applied to `sqspqwj…` — it cannot be inspected or modified with
  current tooling, so menu migrations are intentionally HELD, not reapplied.
- Target verdict: app → `sqspqwj…`, MCP → `xhyhezk…` — DO NOT MATCH. Canonical
  project is `sqspqwj…` by converging user evidence, but app/MCP alignment is
  still unresolved.
- Validation: `tsc`, `eslint` — pass (no app changes in this task).
- Remaining blocker: establish a single reachable target (MCP session serving
  `sqspqwj…`, or explicit instruction otherwise) before any menu migration
  runs again.

## 2026-09-10 — Incident follow-up: wrong-DB cleanup script + service key slot

- Change: added one-time `cleanup-send2u-wrong-database.sql` (repo root, to be
  deleted after use) that drops the leftover `send2u_profiles` table on the
  wrong project ONLY — pre-flight guard aborts if menu tables reappear, and
  post-flight queries verify zero `send2u` objects remain while unrelated
  tables stay intact. Pre-verified safe: no FKs, policies, views, or functions
  depend on the table. Added an empty `SUPABASE_SERVICE_ROLE_KEY` slot to
  `.env`/`.env.example` (deliberately NOT `EXPO_PUBLIC_`-prefixed and never
  referenced from app code, so it cannot leak into the client bundle).
- Reason: fully clear the wrong database via a guarded paste-into-dashboard
  script, and hold the server-only secret outside the codebase.
- Validation: `tsc` — pass; dependency/secret scans clean; script read back
  and reviewed statement-by-statement (guard + 3 `IF EXISTS` drops + 3
  verification queries). Script NOT executed by the agent — user runs it.
- Known limitations: the secret value itself must be pasted by the user from
  the dashboard (secret keys are not retrievable via tooling, by design).

## 2026-09-10 — Menu: clean implementation on canonical database

- Target verification (before any mutation): app `.env`
  `EXPO_PUBLIC_SUPABASE_URL` and Supabase MCP project URL both resolve to
  `sqspqwj…` (canonical); wrong project `xhyhezk…` untouched. Pre-migration
  state confirmed empty: 0 tables in `public`, 0 migrations, only system
  schemas present.
- Database: migration `create_send2u_menu` — 2-level schema, no menus table:
  `send2u_vendors` (name, description, location_hint, nullable image_url,
  is_active/is_open, sort_order, timestamps; non-empty-name and ordering
  checks) and `send2u_menu_items` (vendor FK cascade, name, description,
  price_cents with non-negative check, nullable image_url, is_available,
  sort_order, timestamps); indexes on vendor display order and
  (vendor_id, sort_order, name).
- RLS: enabled on both tables, read-only. `send2u_vendors_select_active`
  and `send2u_menu_items_select_active_vendor` (EXISTS on active vendor),
  both `FOR SELECT TO authenticated`; zero write policies. Grants stripped
  (`REVOKE ALL FROM PUBLIC, anon, authenticated`) then `GRANT SELECT …
  TO authenticated` only. Unavailable items stay readable by design;
  inactive vendors hidden.
- Seed: migration `seed_send2u_menu_demo` — exactly 6 fictional demo vendors
  (all active; 5 open + `Selera Barat Palsu` closed to demo the closed badge)
  with 28 items total (5/5/5/4/5/4 per vendor), realistic MYR prices in cents,
  3 unavailable items across vendors, all image references NULL. Names are
  invented development data, not real businesses.
- App: requester menu layer from the earlier (wrong-DB) task already matches
  this schema and needed no rework — `services/menu.ts` (SELECT-only, no
  `any`), `hooks/useMenu.ts`, `lib/money.ts`, `CartContext` (in-memory,
  subtotal = price × quantity, no fees/checkout/persistence), Home vendor
  sections, `menu/[id]` detail, Create tab as cart home. One hardening fix:
  detail `handleAdd` now returns early for unavailable items, so they cannot
  enter the cart even if the disabled button is activated programmatically.
  No Supabase calls in presentation components; no hardcoded menu fallback;
  no image URLs; light-only design system intact.
- Decisions: no payment infrastructure (QR-payment direction preserved with
  zero implementation, same as before); no vendor-mixing rules, no cart
  persistence, no order creation — all deferred.
- Validation (live on `sqspqwj…`): 6 vendors / 28 items / 3 unavailable;
  relationships and prices row-verified; RLS on both tables; authenticated
  reads 6 vendors + 28 items incl. 3 unavailable; anon SELECT denied
  (permission denied); authenticated INSERT/UPDATE/DELETE all denied
  (42501); counts unchanged after denied writes. Advisors: only pre-existing
  `rls_auto_enable` SECURITY DEFINER warns, expected anon-sign-in
  informational flags (dev uses anonymous auth → authenticated role), and one
  INFO unused-index on the fresh seed. `tsc` clean, `eslint` 0 errors
  (1 pre-existing generated-file warning), `expo-doctor` 18/18,
  `expo export -p web` pass (incl. `menu/[id]`).
- Known limitations:
  - `send2u_profiles` does not exist on the canonical DB (it was empty
    before this task and this task scopes to menu tables only), so dev
    `continueAs`/`switchRole` profile persistence will fail until the
    profiles migration is re-applied in a separate auth task. Menu RLS
    itself needs only the `authenticated` role and is fully verified.
  - No authenticated end-to-end screenshots this session (needs the missing
    profiles table + anon toggle state); UI code is unchanged from the
    previously screenshot-verified implementation apart from the guard above.
  - Native-device review not done.

## 2026-09-10 — Auth: dev-auth profiles on canonical database

- Target verification (before mutation): app `.env`
  `EXPO_PUBLIC_SUPABASE_URL` and Supabase MCP project URL both resolve to
  `sqspqwj…` (canonical). Pre-migration `public` held only the two menu
  tables; `send2u_profiles` confirmed absent.
- Database: migration `create_send2u_profiles` — `send2u_profiles` keyed by
  `auth.uid()` (`id` uuid PK with FK to `auth.users` cascade delete; `role`
  text restricted to `requester|helper|vendor|admin` via CHECK; timestamps).
  RLS on with three ownership-pinned `TO authenticated` policies
  (select/insert/update own row, `auth.uid() = id`); no DELETE policy.
  Grants stripped then `GRANT SELECT, INSERT, UPDATE … TO authenticated`
  only — matches the original profile design and the existing
  `services/auth.ts` contract (`fetchProfile` select, `setProfileRole`
  upsert on `id`), so no app code changes were needed.
- Validation (live on `sqspqwj…`): table present with RLS on; 3 policies and
  SELECT/INSERT/UPDATE-only grants confirmed; PK/FK/role-CHECK constraints
  present; authenticated SELECT with no JWT returns 0 rows (no leak); anon
  SELECT denied (42501); authenticated INSERT with no JWT denied by RLS;
  invalid role `'superuser'` rejected by CHECK with no row written; menu
  tables byte-identical (6 vendors / 28 items); profiles at 0 rows (clean,
  no seed — correct for an auth table). Advisors: no RLS-disabled findings;
  only pre-existing `rls_auto_enable` warns plus expected anon-sign-in
  informational flags (dev uses anonymous auth → authenticated role).
  `tsc` clean, `eslint` 0 errors, `expo-doctor` 18/18,
  `expo export -p web` pass.
- Known limitations:
  - No live anonymous sign-in round trip this session (toggle state not
    re-checked); end-to-end `continueAs`/`switchRole` should be exercised on
    device once anon sign-ins are confirmed enabled.
  - Native-device review not done.

## 2026-09-10 — Orders: requester order creation with campus locations

- Target verification (before every mutation): app `.env`
  `EXPO_PUBLIC_SUPABASE_URL` and Supabase MCP project URL both resolve to
  `sqspqwj…` (canonical); pre-task `public` held menu + profiles tables only.
- Database: migration `create_send2u_ordering` — `send2u_delivery_locations`
  (name, description, is_active, sort_order, timestamps; SELECT-only grant +
  active-only `TO authenticated` policy), `send2u_orders` (requester FK to
  `auth.users`, vendor/location FKs RESTRICT, status CHECK covering the
  future `pending…cancelled` set, `subtotal_cents`; SELECT-only grant + own
  SELECT policy, no client INSERT/UPDATE/DELETE), `send2u_order_items`
  (order FK cascade, nullable menu-item FK SET NULL, name/price snapshots,
  quantity 1–99, `line_total = unit × qty` CHECK; SELECT-only grant + own
  order policy). Writes go exclusively through `send2u_place_orders`
  (SECURITY DEFINER, EXECUTE to `authenticated` only): client sends ids +
  quantities only; requester comes from `auth.uid()`; prices/names, vendor
  split, subtotals, and `pending` status are derived server-side in one
  transaction. Two fix migrations corrected a loop-variable reuse and a
  DISTINCT/ORDER BY error (both caught by live RPC tests before seeding).
  Seed `seed_send2u_delivery_locations`: 6 fictional demo drop-off points
  (Block A/B/C, Library, Main Hall, Student Hostel).
- Decisions: mixed-vendor carts split into one order per vendor sharing the
  selected location (explained in UI); subtotal is strictly Σ(price × qty),
  no fees/taxes; no helper assignment, no payment of any kind — orders stay
  `pending`.
- App: new `Order`/`OrderStatus`/`OrderItem`/`OrderWithDetails`/
  `PlacedOrderSummary` types (old skeleton statuses retired);
  `services/locations.ts`, rewritten `services/orders.ts` (rpc + own reads,
  explicit errors, no `any`), `hooks/useDeliveryLocations.ts`,
  `hooks/useMyOrders.ts`, `lib/orders.ts` (date/status format). Create tab is
  now cart review + vendor groups + location selector + Place Request
  (disabled without items/location/while submitting; cart kept on failure,
  cleared only after success); new `orders/confirmation` and `orders/[id]`
  screens; My Orders lists own orders newest-first with pull-to-refresh.
- Validation (live on `sqspqwj…`): two-user JWT-claim tests — A places a
  mixed cart → 2 correct `pending` orders with DB prices; B sees 0 rows;
  unavailable/inactive-vendor/bad-location/empty-cart calls all abort with
  counts unchanged (atomic); direct INSERT/UPDATE denied (42501); invalid
  role/status analogues rejected; menu data byte-identical. Real client-path
  E2E (anon sign-in → profile → locations → rpc → list → detail) passes with
  anon toggle confirmed enabled. Full browser click-through verified with
  screenshots: sign-in, role setup, home menu (28 items), item detail, cart,
  split-vendor review, location select, confirmation (1- and 2-order),
  orders list, order detail. `tsc`, `eslint` (0 errors), `expo-doctor`
  18/18, `expo export -p web` pass. All test users/orders removed (one
  unrelated developer user/profile left untouched).
- Incidents found by verification (fixed/documented):
  - `expo export` baked the WRONG project URL from a stale Metro transform
    cache despite a correct `.env` (first screenshots hit `xhyhezk…` with
    422s). Fixed with `expo export -p web --clear`; bundle re-verified to
    contain only `sqspqwj…`. Always `--clear` after `.env` changes.
  - One transient 401 on a first profile upsert during UI entry; retried
    flow succeeded. Kept under watch, not yet root-caused.
- Known limitations: native-device review not done; visual suite ran on web
  (representative, not a substitute); leaked-password protection toggle and
  pre-existing `rls_auto_enable` advisor warns are untouched auth-config
  items.

## 2026-09-10 — Helper: job queue + atomic order acceptance

- Target verification (before mutation): app `.env`
  `EXPO_PUBLIC_SUPABASE_URL` and Supabase MCP project URL both resolve to
  `sqspqwj…` (canonical); existing order/locations/menu/profiles schema
  confirmed present.
- Database: migration `add_send2u_helper_assignment` — `send2u_orders`
  gains nullable `helper_id` (FK `auth.users`, SET NULL) + `accepted_at`,
  CHECK `pending → helper IS NULL`, partial indexes for the open queue and
  helper lookups. New RLS (requester ownership untouched, still
  SELECT-only grants, zero client writes): helpers with a `helper` profile
  role can SELECT pending-unassigned orders (queue) and their assigned
  orders; order-items policy extended to the same visibility. RPC
  `send2u_accept_order(p_order_id)` (SECURITY DEFINER, EXECUTE to
  `authenticated`): derives helper from `auth.uid()`, requires the helper
  role, claims via a single `UPDATE … WHERE pending AND unassigned`
  (row lock ⇒ exactly one winner), flips to `assigned` with timestamp, and
  returns the order summary. Client sends only the order id.
- App: `Order` gains `helperId`/`acceptedAt` + `AcceptedOrderSummary` type;
  `services/orders.ts` adds queue/delivery reads (owner-scoped via session),
  `getJobDetail`, and `acceptOrder` with friendly errors — no `any`.
  `hooks/useAvailableJobs.ts`, `hooks/useMyDeliveries.ts`. Helper Jobs tab
  now lists real open jobs (offline toggle kept, pull-to-refresh,
  loading/empty/error); new `jobs/[id]` detail (pickup, drop-off, snapshot
  items, subtotal, Accept with progress + taken-state handling, accepted
  confirmation card); My Deliveries lists assigned jobs. No payment, pickup,
  proof, or completion UI.
- Validation (live on `sqspqwj…`): 3-user JWT-claim matrix — helper queue
  aggregates pending orders across requesters, requester sees own only
  (incl. after assignment), other helper cannot read an assigned order,
  requester accept rejected (`Only helpers`), direct UPDATE denied (42501).
  True concurrent race via PostgREST (Promise.all, two helpers): exactly
  one `assigned`, loser gets `Order is no longer available`, assignee
  verified. Full browser flows screenshot-verified: requester place →
  helper queue (2 open) → job detail → Accept → assigned confirmation → My
  Deliveries; taken-job URL shows `Job not available` for another helper;
  requester regression (place → confirmation → My Orders) passes. `tsc`,
  `eslint` (0 errors), `expo-doctor` 18/18, `expo export -p web --clear`
  (bundle re-verified canonical-only) pass. All test users/orders removed;
  one unrelated developer order/user left untouched.
- Known limitations: native-device review not done; web screenshots only;
  a developer was concurrently testing live data (their order appeared in
  the queue mid-verification — handled, never touched).

## 2026-09-10 — Payments: external helper QR + evidence + verification

- Target verification (before every mutation): app `.env`
  `EXPO_PUBLIC_SUPABASE_URL` and Supabase MCP project URL both resolve to
  `sqspqwj…` (canonical); order/assignment/menu/profiles schema confirmed.
- Database: migration `add_send2u_payments` — `send2u_profiles` gains
  nullable `payment_qr_path` (covered by existing own-row policies);
  `send2u_payments` (one row per order: order FK cascade + UNIQUE, amount
  snapshot, evidence path, `submitted|verified|rejected` CHECK; SELECT-only
  grant + requester/assigned-helper SELECT policies). No row = unpaid, so
  the fulfilment order status is untouched. RPCs (SECURITY DEFINER, EXECUTE
  to `authenticated`): `send2u_submit_payment` (own assigned order only,
  amount from subtotal, evidence path must live under the requester's
  namespace AND the object must exist, resubmit allowed only after
  rejection), `send2u_review_payment` (assigned helper only, single
  conditional UPDATE out of `submitted` ⇒ race-safe), and
  `send2u_payment_context` (QR reference + payment row for exactly the two
  parties, plus a null-safe branch for helpers previewing queue jobs — added
  after live testing exposed the gap). Follow-up
  `add_send2u_evidence_delete` (owner-namespace evidence DELETE for explicit
  replace) and `check_send2u_evidence_exists` (phantom-path guard).
- Storage: private bucket `send2u-private`; paths `qr/<uid>/<ts>.<ext>`
  and `evidence/<uid>/<order>_<ts>.<ext>` (unique per upload, never
  `upsert` — upsert pre-flights a read that unsubmitted evidence fails, so
  replace = new upload + best-effort remove). Seven RLS policies: QR
  owner-writes, QR reads for owner + requesters of that helper's orders,
  evidence owner-namespace writes, evidence reads resolved through the
  payment row for the two parties. Private images render via short-lived
  signed URLs; QR is NOT required to accept (requester sees an explicit
  payment-unavailable state instead).
- App: `expo-image-picker` (~17.0.11) + config plugin (library only, no
  camera/mic); `services/storage.ts` (pick ≤5 MB images, upload/remove,
  signed URLs), `services/payments.ts`, `Profile.paymentQrPath`,
  `Payment` types, order reads now join the payment row (with a to-one
  normalizer — PostgREST embeds UNIQUE joins as objects, found by live UI
  test). Helper profile QR manager (upload/replace/remove + empty state);
  requester order detail payment section (QR, amount from snapshot,
  instructions, submit/resubmit, pending/verified/rejected states);
  helper job detail payment card (evidence + Confirm/Reject, accepted
  confirmation); My Deliveries payment badges. Payment cards refetch on
  screen focus + after accept (fixes stale queue/pending views from sticky
  tab mounts — found by live testing).
- Validation (live on `sqspqwj…`): 3-user matrix — own submit ok, other's
  order invisible, double-submit/verified-resubmit blocked, pending-order
  submit blocked, phantom path blocked, requester verify blocked, helper B
  verify blocked, direct INSERT denied, concurrent verify-vs-reject ⇒ one
  winner; storage via real sessions — owner upload/read ok, cross-user
  overwrite/read/profile-hijack denied, signed URLs scoped correctly.
  Browser E2E screenshot-verified: QR empty→set, requester QR+Unpaid,
  submit→pending, helper evidence→verify→verified both sides,
  reject→resubmit affordances both sides, taken-job + empty + error states,
  requester regression (place→orders). `tsc`, `eslint` (0 errors),
  `expo-doctor` 18/18, `expo export -p web --clear` (canonical-only) pass.
  All test users/orders/profiles/storage files removed; one unrelated
  developer order/user left untouched.
- Known limitations: native-device review not done (image picking verified
  on web only — the web File path and native fetch-to-blob path share
  validation but native upload itself is untested); web screenshots only;
  occasional transient 401 on the first authenticated call after anon
  sign-in (retries succeed; all screens have retry affordances);
  background preview servers used for testing were stopped.

## 2026-09-10 — Fulfilment lifecycle: helper advance, cancel/dispute, delivery fee, pickup code, post-delivery payment

- Target verification (before mutation): app `.env` `EXPO_PUBLIC_SUPABASE_URL` and Supabase MCP project URL both resolve to `sqspqwj…` (canonical); order/assignment/menu/profiles/payment schema confirmed present.
- Database: migration `send2u_fulfilment_lifecycle` — order status CHECK expanded to include `at_vendor, purchased, completed, disputed` (plus legacy `accepted, preparing, ready_for_pickup, confirmed`); new columns on `send2u_orders`: `delivery_fee_cents` (NOT NULL DEFAULT 200, CHECK >= 0), `pickup_code` (NOT NULL DEFAULT md5-based 6-char), `arrived_at`, `purchased_at`, `food_cost_cents`, `delivered_at`, `cancelled_at`, `cancelled_by`, `cancel_reason`, `dispute_reason`, `dispute_note`, `disputed_at`, `resolved_at`, `resolved_by`, `resolution`. Follow-up migration `fix_send2u_resolve_dispute_var` tidies variable reuse in resolve RPC.
- RPCs (SECURITY DEFINER, EXECUTE to `authenticated`):
  - `send2u_helper_advance(p_action, p_order_id, p_food_cost_cents, p_pickup_code, p_note)` — atomic single UPDATE with state validation; actions: arrive, report_unavailable, purchase, verify_pickup (checks 6-char code), start_delivery, mark_delivered, report_failed (→disputed), release (→pending before purchase)
  - `send2u_cancel_order(p_order_id, p_reason)` — before purchase: clean cancelled; after purchase: disputed with food_cost preserved
  - `send2u_resolve_dispute(p_order_id, p_resolution, p_note)` — admin-only, sets resolution + note
  - `send2u_submit_payment` updated: requires `delivered` status, amount = subtotal + delivery_fee
  - `send2u_review_payment` updated: requires `delivered` status, verified flips to `completed`
  - `send2u_payment_context` updated: returns `delivery_fee_cents, totalCents, pickupCode`
  - `send2u_place_orders` updated: records `delivery_fee_cents=200` and `pickup_code` per order
- App: `types/domain.ts` — OrderStatus expanded (full lifecycle), Order interface gained all lifecycle fields, PlacedOrderSummary has delivery_fee_cents; `services/orders.ts` — OrderRow gains all columns, `FulfilmentAction` type, `advanceFulfilment()` and `cancelOrder()` functions, friendly error helpers; `services/payments.ts` — PaymentContext gains deliveryFeeCents/totalCents/pickupCode, submit/payment-open-after-delivery messaging; `lib/orders.ts` — `orderStatusTone` updated for full lifecycle
- UI: `app/(helper)/jobs/[id].tsx` — status-driven fulfilment UI (arrive → purchase → pickup code → start delivery → mark delivered / report failed / release), pickup code input field, status cards for every state; `app/(requester)/orders/[id].tsx` — progress bar (5 steps), food subtotal / delivery fee / total breakdown, cancel flow with reason (clean before purchase, warned after), cancelled/disputed/completed states; `components/RequesterPaymentCard.tsx` — shows "pay after delivery" pre-delivery, full QR + submit post-delivery, amount shows `food + delivery = total`, cancels hidden on cancelled/disputed; `components/HelperPaymentCard.tsx` — hidden on cancelled/disputed; `app/(helper)/earnings.tsx` — real earnings from completed orders, `deliveryFeeCents` only, total finalized amount
- Financial model: helper fronts food cost at stall; requester pays food + delivery fee (RM2) after delivery; delivery fee is helper's earning only; `food_cost_cents` is not earnings, only delivery fee is
- Decisions: fixed delivery fee (200 cents, not configurable by client); pickup code verified at pickup; payment only opens after `delivered` status; cancel before purchase = clean; cancel after purchase = dispute; resolve dispute is admin-only
- Validation: `tsc` clean, `eslint` 0 errors, `expo-doctor` 18/18, `expo export -p web --clear` (canonical-only) pass; live RPC tests: two-user race (two helpers advance same order → exactly one winner); concurrent cancel-and-advance test passes; all test users/orders/profiles/storage files removed; one unrelated developer order/user left untouched
- Known limitations: native-device review not done; web screenshots only; SPA server stability (Python HTTP server periodically crashes on port 8124, requires kill + restart before E2E runs — not a code bug); ephemeral pickup code does not rotate if helper manually shares without verifying at stall (acceptable for MVP)

## 2026-09-10 — Fixes: stable dev role switching + document receipt picker

- Role switching (`services/auth.ts`, `contexts/AuthContext.tsx`): repeated
  requester↔helper switches could mint a new anonymous user (transient
  empty session read from double-taps or token-refresh races → orphaned
  identity, assigned jobs "lost"). Fixed three layers deep, dev-only:
  `continueAsDev` serializes concurrent entries and retries the session
  lookup before ever signing in; `AuthContext.continueAs` reuses the
  restored in-memory user via role-only upsert and can never sign in;
  `switchRole` path never signed in (unchanged, verified). Production auth
  untouched.
- Receipt picker (`services/storage.ts`, `RequesterPaymentCard`,
  `HelperPaymentCard`): evidence now uses `expo-document-picker`
  (~14.0.8, no config plugin needed) accepting PDF + JPG/PNG/WEBP/HEIC up
  to 10 MB; helper QR keeps the image library. Storage paths/RPC flow,
  signed URLs, and authorization unchanged (extension flows into the
  existing unique-path convention). Helper evidence renders inline for
  images and as an openable signed-URL file row for PDFs; UI wording is
  receipt/file-based. Verification flow untouched.
- Validation (live on `sqspqwj…`): 12-step browser test — sign in, record
  uid, place, switch helper (same uid), accept own job, switch requester
  (same uid), switch helper (same uid): all four uids identical, one
  profile row, accepted job present in My Deliveries. Full PDF E2E:
  QR set → place → accept → submit PDF → helper PDF row → Confirm →
  verified both sides; stored path ends `.pdf`. Requester/helper/payment
  regressions pass. `tsc`, `eslint` (0 errors), `expo-doctor` 18/18,
  `expo export -p web --clear` (canonical-only) pass. All test
  users/orders/profiles/storage files removed; one unrelated developer
  order/user left untouched.
- Known limitations: native file picking untested (web picker verified);
  web screenshots only; transient first-call 401s persist under watch.

## 2026-09-10 — Fulfilment lifecycle v2: refined status model and workflow

- Target verification (before mutation): app `.env` `EXPO_PUBLIC_SUPABASE_URL` and Supabase MCP project URL both resolve to `sqspqwj…` (canonical); existing order/assignment/menu/profiles/payment schema confirmed.
- Database: migration `send2u_fulfilment_lifecycle_v2` — added new statuses to CHECK constraint (`going_to_vendor`, `food_available`, `food_purchased`, `out_for_delivery`, `awaiting_requester_payment`); added new timestamp columns (`going_to_vendor_at`, `food_available_at`). Updated `send2u_helper_advance` RPC with refined workflow: `go_to_vendor` (assigned → going_to_vendor), `arrive` (going_to_vendor → at_vendor), `report_food_available` (at_vendor → food_available), `report_food_unavailable` (at_vendor → cancelled), `purchase` (food_available → food_purchased), `verify_pickup` (food_purchased → picked_up), `start_delivery` (picked_up → out_for_delivery), `mark_delivered` (out_for_delivery → delivered), `release` (going_to_vendor/at_vendor → pending). Updated `send2u_submit_payment` to transition to `awaiting_requester_payment` after delivery. Updated `send2u_review_payment` to transition to `completed` after verification.
- App: `types/domain.ts` — OrderStatus expanded with new statuses; Order interface gained `goingToVendorAt`, `foodAvailableAt` fields; `services/orders.ts` — OrderRow gains new columns, `FulfilmentAction` type updated with new actions; `lib/orders.ts` — `orderStatusTone` updated for new statuses. Helper UI (`app/(helper)/jobs/[id].tsx`) shows refined workflow: Go to vendor → Arrive → Check food availability → Purchase → Pickup verification → Start delivery → Mark delivered. Requester UI (`app/(requester)/orders/[id].tsx`) shows lifecycle progress with appropriate status messages. Payment components updated to handle new statuses.
- Validation: `tsc` clean, `eslint` 0 errors (1 pre-existing warning), `expo-doctor` 18/18, `expo export -p web --clear` (canonical-only) pass. Database schema verified: CHECK constraint includes all new statuses, new columns exist, RPC functions configured correctly. Test data cleaned up.
- Known limitations: native-device review not done; web screenshots only; transient first-call 401s persist under watch.
