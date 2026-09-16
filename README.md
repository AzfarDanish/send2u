# Send2U

[![Expo SDK](https://img.shields.io/badge/Expo_SDK-57-DA0A1B?logo=expo&logoColor=white)](https://docs.expo.dev/versions/v57.0.0/)
[![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres_RLS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Platforms](https://img.shields.io/badge/platforms-Android_iOS_Web-lightgrey)](https://expo.dev/)

Campus food delivery, fulfilled by fellow students — not restaurants.

**Send2U** is a cross-platform mobile app (Android, iOS, web from one
codebase) where **requesters** order food from campus stalls, **helpers**
(a nearby student) accept the request, buy the food at the stall with
their own money, and deliver it to a campus drop-off point. The requester
then pays the helper **externally** (QR + receipt evidence) — no money
ever moves inside the app.

## How it works

```
Requester                          Helper                         Vendor
─────────                          ──────                         ──────
Browse stalls & menu
Add to cart, pick drop-off   →     Sees open job in queue
Submit request               →     Accepts (atomic first-claim)
                                       ↓
                                  Goes to stall → confirms
                                  availability → pays for food
                                  → picks up → delivers
                                       ↓
Confirm receipt              ←     Marks delivered
Pay helper externally   →→→→→→→→→→  Receives food + fee
Submit receipt evidence  →     Review (verified → completed)
Rate each other (after verified payment)
```

Order lifecycle (happy path):

`pending` → `assigned` → `going_to_vendor` → `at_vendor` →
`food_available` → `food_purchased` → `picked_up` → `out_for_delivery` →
`delivered` → `confirmed` → `awaiting_requester_payment` → `completed`

Exception states: `cancelled` (clean) and `disputed` (needs settlement,
retractable by the reporter). A fixed **RM 2.00** delivery fee is recorded
server-side per order; food totals are database snapshots, never estimates.

## Features

### Requester
- Vendor discovery, item detail, and in-memory cart with floating cart button
- Review Request with predefined campus drop-off locations
- Request Submitted confirmation with real order data, then full Request Detail
- Active / Past request lists with live status badges and recorded totals
- Six-stage progress tracker, contextual status cards, order timeline
- Delivery confirmation, external-QR payment with receipt-evidence upload
- Delivered-only issue reporting (with withdrawal) and two-sided ratings
- In-app notification center + push notifications, Help Center, report flow

### Helper
- Availability toggle gating a live open-job queue (atomic first-claim accept)
- Guided fulfilment stepper: go to vendor → availability → purchase → pickup → deliver
- Fee-only earnings screen, payment-QR management, read-only payment inspection
- Deliveries history, ratings, notifications, profile

### Vendor (stall operations only)
- Open/closed switch and stall-detail editing
- Menu CRUD with availability toggles
- Deliberately no orders, preparation, verification, notification, or payment UI

### Platform
- Email/password auth with immutable role profiles; credential-free dev mode
- Realtime updates (orders, notifications) via Postgres changes; pull-to-refresh everywhere
- Origin-aware back navigation (chevron + Android hardware) on tab history
- Light-only red/white design system, no shadows, MaterialIcons exclusively
- Inline loading / empty / error states on every data screen

## Tech stack

| Layer      | Choice |
|------------|--------|
| App        | Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict) |
| Navigation | expo-router v57 (file-based, typed routes, Tabs + Stack) |
| Backend    | Supabase Postgres (RLS) + Auth + Storage + Realtime |
| Data access| Thin `services/` layer over Supabase client + Postgres RPCs |
| Push       | expo-notifications, per-device push tokens, notification outbox |
| UI         | Custom `components/ui` primitives + `constants/theme.ts` tokens, MaterialIcons |
| Validation | `tsc --noEmit` · `expo lint` (eslint-config-expo) · `expo-doctor` · `expo export -p web` |

Key backend contracts live in `types/domain.ts` (`OrderStatus`,
`OrderWithDetails`, `Payment`, `Rating`, …). All fulfilment transitions
run as Postgres RPCs (`send2u_place_orders`, `send2u_accept_order`,
`send2u_helper_advance`, `send2u_cancel_order`, `send2u_confirm_delivery`,
`send2u_open_dispute` / `send2u_withdraw_dispute`, `send2u_submit_payment`,
`send2u_submit_rating`, …) so state changes stay atomic server-side.

## Project structure

```
app/                    # expo-router routes (auth gate + role groups)
  (auth)/               #   sign-in
  (requester)/          #   Home, vendors/[id], menu/[id], create (cart review),
                        #   orders/confirmation, orders (Active/Past), orders/[id],
                        #   location(s), notifications, help, report, profile,
                        #   helper-portal/ (verified helpers: queue, jobs/[id],
                        #   deliveries, payment-qr)
  (vendor)/             #   Stall, menu, profile
components/             # Domain components (RequestCard, OrderBreakdown,
                        # RequestProgress, NotificationCenter, …)
components/ui/          # Design-system primitives (Button, Card, Screen, Text,
                        # Badge, ListRow, Skeleton, Empty/Error/LoadingState, …)
constants/theme.ts      # Single source of truth: color, type, spacing, radii
contexts/               # AuthContext, CartContext (in-memory draft cart)
hooks/                  # Data hooks (useMyOrders, useMenu, …) + useRealtimeReload
lib/                    # Pure helpers (orders, money, supabase client, push)
services/               # Supabase access per domain (orders, menu, payments,
                        # ratings, notifications, storage, vendor, auth, …)
types/domain.ts         # Shared domain vocabulary (source of truth for shapes)
config/                 # env + app/dev config
docs/design.md          # Product/design reference (implementation现状 inside)
changelog.md            # append-only record of every meaningful change
```

## Getting started

### Prerequisites

- Node.js 20 LTS or later
- npm (lockfile committed: `package-lock.json`)
- A Supabase project provisioned with the `send2u_*` schema (tables, RLS
  policies, and RPCs — `services/` + `types/domain.ts` define the client
  contract; `changelog.md` records schema evolution)
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

## Development workflow

```bash
npx tsc --noEmit              # typecheck (strict)
npm run lint                  # expo lint
npx expo-doctor                # 21/21 checks expected
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
  `vendors`, `menu_items`, `orders`, `order_items` (immutable purchase
  snapshots), `delivery_locations`, `notifications` (outbox + in-app
  center), `push_tokens`, `payments` (external-receipt records),
  `ratings` (one row per party per order, write-once).
- **Realtime**: `useRealtimeReload` subscribes to `postgres_changes`
  (RLS-scoped); lists, detail screens, and the unread badge refresh live,
  with pull-to-refresh/retry as the offline fallback.
- **Storage**: helpers' payment QR + requesters' payment receipts via
  signed paths; photo permission copy explains exactly why access is needed.
- **Security**: ownership-pinned RLS throughout; service-role key never
  ships in the app; no secrets in code, chat, or `changelog.md`.

## Status & limitations

- Verified via `expo export -p web` + Playwright on web (layout-representative
  screenshots); **on-device verification is pending** unless a changelog
  entry says otherwise.
- No automated test suite yet — `tsc` + `lint` + `expo-doctor` + web-export
  is the current validation loop.
- `admin` is a database-only role with no UI.
- Food/vendor photography, maps/GPS, chat, and in-app payments are
  intentionally out of scope.

## Resources

- [Expo SDK 57 docs (versioned)](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Router docs](https://docs.expo.dev/router/introduction/)
- [Supabase docs](https://supabase.com/docs)
- `docs/design.md` — product/design reference (authoritative on roles,
  lifecycle wording, and scope boundaries)
- `changelog.md` — what changed, when, why, and how it was validated
