# Send2U

[![Expo SDK](https://img.shields.io/badge/Expo_SDK-57-DA0A1B?logo=expo&logoColor=white)](https://docs.expo.dev/versions/v57.0.0/)
[![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres_RLS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Platforms](https://img.shields.io/badge/platforms-Android_iOS_Web-lightgrey)](https://expo.dev/)

Campus food delivery, fulfilled by fellow students — not restaurants.

**Send2U** is a cross-platform mobile app (Android, iOS, web from one
codebase) where **requesters** order food from campus stalls, choosing
**Online Payment** (simulated in-app for this competition prototype) or
**Cash on Delivery**. Send2U records and manages every transaction: the
cafeteria prepares the food, a nearby student **helper** collects and
delivers it, and COD cash is recorded on collection. Helpers never pay
for food with their own money — no money ever moves outside the app's
transaction record.

A companion vendor web app lives outside this repo (see
[send2u-web](#send2u-web--vendor-web-client) below) on the same backend.

## How it works

```
Requester                          Helper                         Vendor
─────────                          ──────                         ──────
Browse stalls & menu
Pick own saved spot, brand   →     Sees open job in queue               Sees paid/COD order
Pick Online or COD                                                    (prep queue)
Submit per-vendor checkout   →     Accepts (atomic first-claim)    Prepares → marks ready
  Online: simulated payment  →          ↓                               ↓
  (persisted, idempotent)         Goes to stall → collects
                                  Send2U-covered food → delivers
                                        ↓
Delivery auto-completes      ←     Marks delivered (paid/collected only)
  COD: hand cash to helper   →     Confirms cash collected (COD)
Send2U records settlement (cafeteria / helper earning / Send2U split)
Rate each other (after completed order)
```

Order lifecycle (happy path):

`pending` → `assigned` → `preparing` → `ready_for_pickup` →
`going_to_vendor` → `at_vendor` → `food_available` → `food_purchased` →
`picked_up` → `out_for_delivery` → `delivered` → (`confirmed` no-op) →
`completed`

Delivery completes the order: once the helper marks delivered (and payment
is resolved — online paid or COD collected), the order converges to
completed with its settlement recorded; unpaid parks at awaiting-payment.
The tracker shows 5 stages ending at Delivered. Order, payment
(`unpaid`/`pending`/`paid`/`failed`/`collected`/`refunded`), and
settlement (`pending`/`settled`/`reversed`) states are independent.
Exception states: `cancelled` (history preserved; paid online orders reach
a simulated refund) and `disputed` (needs review, retractable by the
reporter). A fixed **RM 2.00** delivery fee is recorded server-side per
order; food totals are database snapshots, never estimates.

## Features

### Requester
- Red-header Home (greeting, saved-spot label, search) with Popular tiles
  and vendor list; image-header vendor page with category bar + grid;
  sheet-style item detail with same-vendor add-ons and fixed Add-to-Cart bar
- Personal address book: Deliver-to bottom sheet + full Set Location flow
  (campus search, structured fields, map pin) — the legacy shared
  drop-off-points table is gone
- Carts overview + independent per-vendor checkout (saved spot, delivery
  note, leave-at-door, payment brands: Cash, Visa, Debit/Credit,
  Touch 'n Go, FPX, DuitNow QR on the Online/COD rails)
- Simulated online payment (persisted, idempotent, retry-safe) or
  cash-on-delivery state
- Request Submitted confirmation with real order data, then full Request
  Detail (flat sections, 5-stage tracker, timeline, transaction record)
- Active / Past request lists with live status and recorded totals
- Slide-to-cancel, delivered-only issue reporting (with withdrawal),
  two-sided ratings
- In-app notification center + push notifications, Help Center, report flow

### Helper
- Helper Portal (stack, no tabs): live open-job queue with claim-on-the-row
  (atomic first-claim accept), active-delivery islands, availability toggle
- Two-point in-app decision map (vendor + drop-off pins, OSRM driving leg,
  distance — no external app jump) and full-bleed workspace map with
  in-map zoom/recenter controls
- Guided fulfilment stepper: go to vendor → collect Send2U-covered food →
  deliver; live position publishing (throttled, one row per order)
- COD cash-collection confirmation (exact server amount, double-tap safe)
- Delivery-fee earnings (distinct from COD cash), settled-earnings total,
  delivery history, ratings, profile

### Vendor
- Orders prep queue with payment method/state visibility + prepare/ready
  actions (paid online and COD appear here)
- Open/closed switch and stall-detail editing; vendor pickup-pin placement
  on the map
- Menu CRUD with availability toggles
- Desktop surface: [send2u-web](#send2u-web--vendor-web-client) (Next.js,
  same backend)

### Platform
- Email/password auth (sign-in, create-account, forgot-password) with
  immutable role profiles; credential-free dev mode (never in production)
- Freshness without swipe-down: realtime (`postgres_changes`, RLS-scoped)
  + focus refetch + local mutation emitters (`orderEvents`,
  `locationEvents`) — lists, details, the address book, and the vendor
  stall converge live, with pull-to-refresh/retry as the offline fallback
- In-app maps (Leaflet, no new deps): MapTiler Streets basemap with OSM
  fallback, locate-me control, delivery tracking with follow/recenter
- `goBackOr` + floating back controls: every back affordance names a
  destination, so deep links and terminal screens never dead-end
- Light-only red/white design system, no shadows, MaterialIcons exclusively
- Inline loading / empty / error states on every data screen

## send2u-web — vendor web client

`AzfarDanish/send2u-web` (sibling directory, Vercel target) is a second
client on **this same Supabase project** — same `send2u_*` tables, RLS,
and RPCs; no backend was rebuilt for it. Next.js 16 + React 19 +
TypeScript strict: vendor sign-in with role guard, prep queue with
prepare/ready actions, order detail, stall open/close + editing, menu CRUD.
Its `src/lib/vendor.ts` ports this repo's `services/vendor.ts`; pickup-pin
placement stays in the mobile app.

## Tech stack

| Layer      | Choice |
|------------|--------|
| App        | Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict) |
| Navigation | expo-router v57 (file-based, typed routes, Tabs + Stack) |
| Backend    | Supabase Postgres (RLS) + Auth + Storage + Realtime |
| Data access| Thin `services/` layer over Supabase client + Postgres RPCs |
| Freshness  | `useRealtimeReload` + `useFocusEffect` refetch + local emitters |
| Maps       | Leaflet WebView (`lib/maps`), OSM/OSRM, MapTiler Streets w/ fallback |
| Push       | expo-notifications, per-device push tokens, notification outbox |
| UI         | `RedScreen` shell + `components/ui` primitives + `constants/theme.ts` tokens, MaterialIcons |
| Validation | `tsc --noEmit` · `expo lint` (eslint-config-expo) · `npm test` (node:test, 51 tests) · `expo-doctor` · `expo export -p web` |

Key backend contracts live in `types/domain.ts` (`OrderStatus`,
`PaymentStatus`, `SettlementStatus`, `OrderWithDetails`, `Payment`,
`Settlement`, `Rating`, …). All fulfilment and transaction transitions
run as Postgres RPCs (`send2u_place_orders`, `send2u_initiate_payment` /
`send2u_complete_payment`, `send2u_vendor_advance`, `send2u_accept_order`,
`send2u_helper_advance`, `send2u_confirm_cod_collection`,
`send2u_settle_order`, `send2u_cancel_order`, `send2u_confirm_delivery`,
`send2u_open_dispute` / `send2u_withdraw_dispute`, `send2u_submit_rating`,
`send2u_update_vendor_profile`, `send2u_upsert_menu_item`, …) so amounts,
splits, and states stay derived server-side and every money verb is
idempotent.

## Project structure

```
app/                    # expo-router routes (auth gate + role groups)
  (auth)/               #   sign-in, create-account, forgot-password
  (requester)/          #   Home, vendors/[id], menu/[id], carts, checkout,
                        #   payment-method, orders (Active) + orders/past,
                        #   orders/[id] (+confirm/rate/pay-online/payment/receipt),
                        #   set-location, notifications, help, report, profile,
                        #   settings, helper-portal/ (stack: queue, jobs/[id],
                        #   deliveries, earnings, profile, about)
  (vendor)/             #   Stall, orders (prep queue) + [id], menu,
                        #   pickup-pin, profile
components/             # Domain components (RedScreen, RequestCard,
                        # RequestProgress, NotificationCenter, SearchBar,
                        # FloatingBackButton, DockedActionBar, CartFab, …)
components/ui/          # Design-system primitives (Button, Screen, Text,
                        # LoadingBlocks, EmptyState, ErrorState,
                        # SlideToConfirm, …)
components/location/    # DeliverToSheet (personal address book UI)
components/map/         # DeliveryMap, JobOverviewMap, HelperDeliveryMap
components/payment/     # payment-brand icons
constants/theme.ts      # Single source of truth: color, type, spacing, radii
contexts/               # AuthContext, CartContext (in-memory draft cart)
hooks/                  # Data hooks (useMyOrders, useMenu,
                        # useSavedDeliveryLocations, useMyVendor, …) +
                        # useRealtimeReload
lib/                    # Pure helpers (orders, money, navigation,
                        # locationEvents, orderEvents, dedupe) + lib/maps
services/               # Supabase access per domain (orders, menu, payments,
                        # ratings, notifications, storage, vendor,
                        # savedLocations, deliveryPositions, auth, …)
types/domain.ts         # Shared domain vocabulary (source of truth for shapes)
supabase/migrations/    # Applied schema evolution (source of truth for DDL)
config/                 # env + app/dev config
docs/design.md          # Product/design reference
changelog.md            # append-only record of every meaningful change
```

## Getting started

### Prerequisites

- Node.js 20 LTS or later
- npm (lockfile committed: `package-lock.json`)
- A Supabase project provisioned with the `send2u_*` schema (tables, RLS
  policies, and RPCs — `services/` + `types/domain.ts` define the client
  contract; `supabase/migrations/` + `changelog.md` record schema evolution)
- For devices: [Expo Go](https://expo.dev/go), an Android emulator, or an
  iOS simulator

### 1. Clone and install

```bash
git clone https://github.com/AzfarDanish/send2u.git
cd send2u
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase publishable/anon key |
| `EXPO_PUBLIC_SEND2U_DEV_AUTH` | Dev only | `1` enables credential-free dev entry (anonymous session + role picker). Never enable in production builds |
| `EXPO_PUBLIC_MAPTILER_KEY` | No — OSM fallback | MapTiler API key for the Streets basemap (building detail). URL-restrict it in the MapTiler dashboard; push to EAS env for builds |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only | Bypasses RLS. **Never** prefix with `EXPO_PUBLIC_`, never reference from app code, never commit |

`.env` is gitignored — paste real keys only from the Supabase Dashboard.

### 3. Run it

```bash
npx expo start          # dev server — scan QR with Expo Go, or press a/i/w
npm run web             # web only (http://localhost:8081)
npm run android         # local native build + install (needs Android SDK)
npm run ios             # local native build (macOS + Xcode only)
```

> **Docs version gate:** this repo targets **Expo SDK 57**. When writing
> code, read the exact versioned docs at
> <https://docs.expo.dev/versions/v57.0.0/> — APIs have changed
> between SDK versions.

### 4. EAS preview APK (on-device testing)

```bash
eas build -p android --profile preview --non-interactive
```

The `preview` profile builds an installable `.apk`
(`com.azfardanish.send2u` — the id lives in `android/`, which EAS reads
instead of `app.json`). EAS bakes env vars at build time, so set them per
environment in the Expo dashboard (`preview` needs the Supabase URL + anon
key and the MapTiler key). Verify the artifact id with
`aapt2 dump badging <apk>`. Never enable `EXPO_PUBLIC_SEND2U_DEV_AUTH` in
a store-bound build.

## Development workflow

```bash
npx tsc --noEmit              # typecheck (strict)
npm run lint                  # expo lint
npm test                      # node:test suite (lib/**, 51 tests)
npx expo-doctor                # 18/21 (3 pre-existing environmental failures)
npx expo export -p web --clear # production web bundle smoke test
```

Conventions for contributors (enforced by `AGENTS.md` + the `send2u-dev`
project skill):

- **Read `changelog.md` before changing code**, inspect the existing
  implementation first, and never duplicate what exists.
- **Append every meaningful change to `changelog.md`** (features, fixes,
  schema/backend changes, decisions, limits) — never rewrite history.
- Keep the light-only red/white theme: new UI uses `constants/theme.ts`
  tokens, MaterialIcons only, no shadows, 52pt buttons / 48pt targets.
- Backend truth stays server-side: new state transitions belong in
  Postgres RPCs, mirrored in `types/domain.ts` — never client-mutated.

## Backend overview

- **Tables** (`send2u_*`): `profiles` (immutable role per `auth.uid()` +
  `is_verified_helper` capability flag for Helper Portal access, granted
  out-of-band and guarded server-side),
  `vendors`, `menu_items`, `orders` (independent order / payment /
  settlement states + `saved_location_id` / `delivery_instruction` /
  `leave_at_door`), `order_items` (immutable purchase
  snapshots), `saved_delivery_locations` (personal address book, one
  active row per user), `delivery_positions` (one live row per order),
  `notifications` (outbox + in-app center), `push_tokens`,
  `payments` (simulated-online + COD records),
  `settlements` (vendor / helper / platform splits, one row per order),
  `app_config` (commission + fee rules),
  `ratings` (one row per party per order, write-once).
- **Freshness**: `useRealtimeReload` subscribes to `postgres_changes`
  (RLS-scoped; unique channel per mount, reconnect reconciliation);
  screens refetch on focus; local emitters (`orderEvents`,
  `locationEvents`) notify mounted consumers at the mutation site.
  Pull-to-refresh/retry is the offline fallback everywhere.
- **Storage**: profile avatars via signed paths; photo permission copy explains exactly why access is needed.
- **Security**: ownership-pinned RLS throughout (SELECT-only on
  transaction tables; all money writes through `SECURITY DEFINER` RPCs
  with anon EXECUTE revoked); service-role key never
  ships in the app; no secrets in code, chat, or `changelog.md`.

## Status & limitations

- Device-verified on ELP-NX9 across the 3-day batch (home/vendor/detail
  shells, maps with HOT + MapTiler layers, locate-me, set-location sheet
  and pin save, carts/checkout scoping, portal stack) — **on-device
  verification is still pending** for anything a changelog entry doesn't
  explicitly mark verified (live delivery with a real moving helper,
  slider completion under realtime load, stacked active-delivery islands).
- `admin` is a database-only role with no UI.
- Real payment gateways and chat are intentionally out of scope (online
  payment is simulated for the competition prototype; no real money moves).

## Resources

- [Expo SDK 57 docs (versioned)](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Router docs](https://docs.expo.dev/router/introduction/)
- [Supabase docs](https://supabase.com/docs)
- `docs/design.md` — product/design reference (authoritative on roles,
  lifecycle wording, and scope boundaries)
- `changelog.md` — what changed, when, why, and how it was validated
