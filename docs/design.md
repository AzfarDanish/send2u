# Send2U Frontend Redesign — Design Specification (`design.md`)

- **Status:** implementation-ready design reference for a future frontend redesign.
- **Source of truth basis:** inspected against the actual codebase (Expo SDK 57, Expo Router, TypeScript, Supabase) — every "Current" statement below was read from source, not assumed.
- **Brand anchor:** Send2U icon red `#DA0A1B` (sampled from the shipped app-icon artwork; currently used only as the Android adaptive-icon background).
- **Scope rule:** the redesign changes presentation and information architecture only. Backend statuses, permissions, validation, RPC transaction semantics, and role routing are preserved unless a separate product decision changes them.
- **Roles served by the app:** requester, helper, vendor. `admin` is a database-only role with no UI. A lecturer role does not exist anywhere in the implementation.

---

## Section 1: Executive summary

### 1.1 What Send2U currently is (frontend perspective)

Send2U is an Expo React Native app (single codebase, Expo Router file-based navigation) with three role-grouped experiences behind one email/password auth gate:

- **Requester** (campus food ordering): Home discovery with vendor sections, item detail, in-memory cart, Review Request with predefined drop-off selection, stateless confirmation, Active/History orders, state-driven Request Detail, external-QR payment with receipt-evidence upload, delivered-confirmation, delivered-only issue reporting with withdrawal, and two-sided ratings on completed/paid orders.
- **Helper** (delivery work): availability-gated open job queue with atomic first-claim accept, a per-status fulfilment stepper (go-to-vendor → purchase → pickup → deliver), fee-only earnings, payment-QR management, read-only payment inspection, and the same history/rating primitives as the requester.
- **Vendor** (stall operations only): open/closed switch, stall-detail editing, menu CRUD with availability toggles. Deliberately no orders, preparation, verification, notification, or payment UI.

The shared foundation is a light-only teal design system (`constants/theme.ts`), ~12 shared `ui/` primitives plus domain components, MaterialIcons exclusively, SafeArea-plus-scroll page shells, and inline loading/empty/error states everywhere. There are no modals, bottom sheets, toasts, dialogs, drawers, gradients, food/vendor photography, maps, GPS, chat, or in-app payment processing. The single production dialog is a vendor delete-confirm `Alert`.

### 1.2 Overall design direction

Evolve the calm, light, native-feeling foundation into a **minimalist red-and-white, Apple-inspired** Send2U identity: clarity first, generous spacing, one primary action per screen, progressive disclosure of operational detail (statuses, fees, evidence), deference to content (food, prices, statuses), and honest transaction communication. More visual, less text-heavy — larger touch targets, status pills with icon+label pairs, and restrained motion. Red is the brand accent (actions, active states, brand surfaces); semantic success/warning/error keep their own non-red treatments.

### 1.3 Primary usability goals

1. A first-time student can discover food and submit a first request without instructions.
2. At any moment, the requester can answer "what is happening with my request and what must I do?" within five seconds of opening Request Detail.
3. Payment-required and receipt-submitted states are unmistakable and never confused with in-app payment.
4. Helpers can work one-handed through the fulfilment stepper; vendors can open/close and edit menus in seconds.
5. Every state (loading, empty, error, cancelled, disputed, completed) is explicit and actionable.

### 1.4 Major problems the redesign should solve

- **Teal-vs-red brand split:** the launcher icon is red while the entire UI is teal; the product reads as two brands.
- **Text-heavy operational screens:** Request Detail, payment, and history lean on paragraphs where hierarchy, pills, and progressive disclosure would scan faster.
- **No shared Input component:** 11 raw `TextInput`s with slightly different borders (auth uses `border`, detail forms use 1.5px `primary`).
- **Verified micro-defects:** notification-dot radii hardcodes (fixed), `&apos;` literals rendering literally on native (requester fixed; 4 helper strings remain), helper `picked_up` error-retry refiring the action, helper dead-end card for 5 legacy statuses, hardcoded rating title for helper viewers.
- **Missing confirm-first patterns in vendor forms** (vendor stall/item forms save directly, unlike the receipt flow).
- **No empty/error/loading gaps, but no skeletons:** lists jump from spinner to content; no toast system for transient confirmations (currently inline only).

### 1.5 What the redesign must not change

Backend enum values and RPC semantics; role model and immutability; split-per-vendor order creation; server-derived prices, snapshots, and the RM2.00-per-order fee; external-QR payment with self-attesting receipt submit; delivered-only confirm/dispute gates; dispute categories; rating eligibility/immutability; RLS ownership; realtime-as-enhancement (fully usable offline-from-realtime) architecture; the vendor operations-only scope; the absence of maps/chat/photo-proof/gateways.

---

## Section 2: Current frontend inventory

Conventions: **Route** as declared in Expo Router. **Redesign?** = Yes where presentation rework is warranted (functionality preserved regardless).

### 2.1 Shared / Authentication

| Screen | Route | Purpose | Layout / components / actions | States | Data | Destinations | Usability problems | Redesign? |
|---|---|---|---|---|---|---|---|---|
| App launch router | `/` (`app/index.tsx`) | Auth/role gate, no UI decisions | Full-screen `LoadingState` ("Getting Send2U ready…") or instant `Redirect` | loading → sign-in / setup-fix / role home | session + role | `(auth)/sign-in`, `/select-role`, role groups | None (correctly invisible) | No (keep) |
| Sign in | `/(auth)/sign-in` | Email/password entry | `BrandHeader` (teal rounded square + "send" glyph + wordmark), `SectionHeader`, email + password `TextInput`s, primary submit, tertiary mode-switch | setup-missing card, session-restore notice, inline form errors, email-confirmation card, loading/disabled buttons | auth session, config flags | role home via `/`; toggles sign-up mode | Role picker only on sign-up (correct); no password reset (backend gap, not UI) | Yes (rebrand, shared Input) |
| Create account | `/(auth)/sign-in` mode | Signup + permanent role pick | Same inputs + two `OptionCard`s (ordering / helping), "role is permanent" note | confirmation-required branch, validation + inline errors | signup result | sign-in mode; role home | Copy accurate; visual weight of role cards good | Yes (rebrand only) |
| Finish account setup | `/select-role` | Recovery for role-less accounts | Role cards + Confirm (permanent) + check-again + sign out; unsupported-role error branch | loading, claim error, refresh states | profile row presence | `/` on success | Rare path; copy good | Light touch only |
| Not found | `+not-found` | Dead-link fallback | Standard Expo Router not-found | static | none | back/home | None | No |

### 2.2 Requester

| Screen | Route | Purpose | Layout / components / actions | States | Data | Destinations | Usability problems | Redesign? |
|---|---|---|---|---|---|---|---|---|
| Home | `/(requester)` (tab Home) | Discovery + live status | Header ("Today on campus" / "Good food, carried by students", item-count badge); dynamic active-request preview (status pill, dish title, vendor, total, View request; "View all N" when multiple); cart shortcut row; vendor sections (name, location hint, hours, Closed pill) with compact item rows (price, description, Unavailable pill) | menu loading/empty/error; orders-preview loading (silent on error); pull-to-refresh both | menu sections, active orders (newest first), cart count | item detail, Review Request, order detail, orders list | Preview shows newest only (mitigated by View-all); dense but consistent | Yes (priority: §7.6) |
| Food detail | `/(requester)/menu/[id]` (hidden) | Inspect + add to cart | Icon placeholder panel; title + large teal price; description; vendor card (hours, Available/Unavailable pill, closed note); quantity stepper + live total + Add to cart; added-state (View cart / Add more) | loading, missing-item error, just-added confirmation, disabled CTA | item + vendor snapshot | Review Request (View cart), back | Copy good; placeholder panel plain but honest | Yes (§7.7) |
| Review Request | `/(requester)/create` (hidden tab) | Cart review + submit | Title + count badge; vendor-grouped lines with steppers (0 removes); subtotal / est. fee / est. total breakdown; radio drop-off list; split-vendor notice; Submit Request (est. total) + Clear cart | empty cart, locations loading/empty/error, submit loading/error (cart preserved) | cart lines, locations, fee estimate | confirmation (params), menu | Fee is estimate until server confirms (labelled) | Yes (§7.8) |
| Request created | `/(requester)/orders/confirmation` (hidden) | Post-submit summary | Success visual; "Request created / submitted successfully"; Waiting-for-helper pill; vendors, items, drop-off, subtotal/fee/total; external-pay note | invalid-params fallback; single-order View request | route params (server-recorded fee) | orders list, order detail, menu (all `replace`) | Stateless by design (no refetch) | Yes (§7.9) |
| My Orders | `/(requester)/orders` (tab) | Active + History | Segmented Active/History; active rows (vendor, dish title, location, badge-first total); history rows (vendor, date, location, final status) | loading/error/empty per tab; lazy history; pull-to-refresh | active-only + terminal-only queries | order detail | None structural | Yes (§7.10) |
| Request Detail | `/(requester)/orders/[id]` (hidden) | Transaction control centre | Header (vendor, dish title, pill, short ID/date); 6-dot progress strip; location card; itemised breakdown; pending-wait card / transit-info card / Required-action confirm card + 4-category report form; payment card; Other-options cancel card | loading/missing; terminal → read-only history rendering | full order + items + payment context | payment submit (inline), history | Text-heavy; cancel below payment (acceptable) | Yes (priority: §7.11) |
| Payment required | embedded `RequesterPaymentCard` in detail | External pay + receipt | "Payment required"/Unpaid header; amount-to-pay; 4 numbered steps; helper QR image; Submit → staged review (name/size/preview, confirm/rechoose/cancel); recorded state with viewer/download | QR-missing, submit error (orphan cleanup), recorded | payment context (server totals) | none (inline) | Good; steps could be more visual | Yes (§§7.14–7.15) |
| Notifications | `/(requester)/notifications` (tab) | Order updates inbox | "Updates for you" + unread badge + Mark-all-read; icon rows with unread dot, body, date | loading/error/empty; pull-to-refresh | notification rows | order detail (mark-read-first) | None | Light touch (§7.18) |
| Profile | `/(requester)/profile` (tab) | Identity + sign out | Identity card (avatar, display name or fallback, email, short ID, Requester pill); My-orders row; env-gated dev switcher (invisible in prod); Sign out | none (sync context; gate handles loading) | auth user + profile | orders list | Hardcoded fallback name only when no display name | Light touch (§7.19) |

### 2.3 Helper

| Screen | Route | Purpose / key behavior | States | Redesign? |
|---|---|---|---|---|
| Jobs queue | `/(helper)` (tab Jobs) | Availability switch gating `pending`-only queue; per-row preview + atomic Accept (single-winner, loser auto-refreshes) | offline / loading / error / empty; accepting lock | Yes (§8) |
| Job detail | `/(helper)/jobs/[id]` (hidden) | Per-status fulfilment cards: go-to-vendor, arrive, food available/unavailable, purchase, confirm pickup, start delivery, mark delivered, release/abandon variants; read-only payment inspection; terminal → history | loading/missing; acting locks; update errors | Yes (§8) |
| My Deliveries | `/(helper)/deliveries` (tab) | Active (order + payment badges) / History (fee-focused rows), same segmented control | loading/error/empty per tab; lazy history | Yes (§8) |
| Earnings | `/(helper)/earnings` (tab) | Fee-only finalized total + per-trip fee rows; no withdrawal rail | loading/error/empty | Light touch (§8) |
| Notifications | `/(helper)/notifications` (hidden) | Same center, helper routing | as requester | Light touch (§8) |
| Profile | `/(helper)/profile` (tab) | Identity, My-deliveries/Payouts rows, staged confirm-first QR manager (upload/replace/remove), sign out | QR-local busy/error only | Yes (§8) |

Known helper issues (verified): 5 legacy statuses fall through to a dead-end card; `picked_up` error retry refires instead of dismissing; rating title hardcoded for helper viewers; history empty-copy omits disputed; truncated-ID identities; no directions/contact/dispute-appeal (all absent backend support — correctly absent from UI).

### 2.4 Vendor

| Screen | Route | Purpose / key behavior | States | Redesign? |
|---|---|---|---|---|
| Stall | `/(vendor)` (tab Stall) | Open/closed switch, stall-detail edit form (name ≤120, description ≤500, location ≤120, hours ≤120); admin-hidden notice when `is_active=false` | loading; unlinked-stall empty; save errors | Yes (§9) |
| Menu | `/(vendor)/menu` (tab Menu) | Item rows (price, availability switch, edit, delete via `Alert` confirm); add/edit form (name, description ≤500, decimal price pad, available switch); single-flight mutation lock | loading/error/empty; row errors | Yes (§9) |
| Profile | `/(vendor)/profile` (tab Profile) | Stall-linked identity, role-permanence note, sign out | none | Light touch (§9) |

Vendor scope is operations-only **by construction** (changelog-verified): no orders, preparation states, verification, notifications, or payments exist for vendors. No image upload UI (image columns unused in v1).

### 2.5 Administrator — **Not implemented**

No routes, tabs, screens, or components exist. `admin` is a database-only role (role-less in app routing; explicitly "no admin UI exists" in `AuthContext`). Dispute settlement and vendor provisioning/linking are out-of-band service-role operations. Section 10 of this document is therefore a greenfield proposal with no current behavior to preserve. Lecturer requester: **Not implemented** — no role, screens, or references exist anywhere.

---

## Section 3: Current navigation architecture

### 3.1 Authentication flow

`/` (root gate) → loading shell → `/(auth)/sign-in` (unauthenticated) → role home. Sign-up may pause at an email-confirmation card (no session until verified — correct). `select-role` is recovery-only for role-less sessions (one-time profile repair or unsupported-role notice). No password reset exists (backend/product gap, out of redesign scope).

### 3.2 Role routing

Root gate redirects by immutable server role: requester → `/(requester)`, helper → `/(helper)`, vendor → `/(vendor)`; each group layout cross-ejects other roles to `/`. Vendor accounts are service-provisioned, never self-signed-up. Anonymous sessions are signed out at restore.

### 3.3 Main tab navigation

- Requester: Home / My Orders / Notifications / Profile (+ header bell duplicating Notifications — accepted duplication).
- Helper: Jobs / My Deliveries / Earnings / Profile (+ header bell).
- Vendor: Stall / Menu / Profile (no bell — no vendor notifications exist).
All tab bars: white, 1px top border, 70pt height, 12pt semibold labels, teal active / muted inactive, full safe-area coverage.

### 3.4 Stack / modal navigation

`Stack` used for: auth group, and per-screen titles on hidden requester/helper routes (`Stack.Screen` titles mirror content, e.g. item name, "Request created"). No modals, sheets, dialogs (except vendor delete `Alert`), or drawers exist. Back behavior is platform-default (header back + `router.back()`), correct everywhere audited.

### 3.5 Deep links, notification routing, cart/order navigation

- Push taps route stale-safe: vendors land on vendor home; requester/helper taps open their own detail route after best-effort mark-read (nav never blocked by mark failure).
- Cart flow: Home shortcut / item detail / menu CTA → hidden Review Request → confirmation (`push`), then `replace` to orders/detail/menu (cleared cart unreachable — resubmit impossible).
- Orders/history rows → detail; detail embeds terminal-history rendering on the same route (no route split for closed orders).
- Sign-out returns to the auth gate via session listener; no manual stack clearing needed.

### 3.6 Navigation inconsistencies & recommendations (functionality unchanged)

1. Header bell duplicates the Notifications tab (both roles) — keep (harmless shortcut), but the redesign should visually subordinate one (e.g. bell without badge-count duplication).
2. Hidden routes rely on in-app push only — correct, but confirmation's single-order "View request" link should be retained in the redesign (currently the only confirmation→detail path).
3. Tab order differs by role (Jobs-first vs Home-first) — correct as-is; do not unify.
4. No screen-restoration edge cases found: all detail screens refetch on mount/focus and reconcile on realtime reconnect.

## Section 4: Proposed design principles

1. **Minimalism.** Every screen answers one question (What's for lunch? What must I do now?). Remove paragraphs that restate what the UI already shows; the current codebase already trended this way (StageLegend/guides deleted) — finish the job.
2. **Visual hierarchy.** Status first, money second, metadata last. Active order status is always the most prominent element on order surfaces (pill + title size before totals).
3. **Progressive disclosure.** Show the happy-path minimum (status, total, one action); tuck evidence, timelines, report forms, and settlement notes one tap deeper. The current report-form toggle and read-only history sections are the pattern to extend.
4. **Content-first layouts.** Food names, prices, and statuses are the content — no hero banners, promo cards, or decorative panels. The current flat tinted panels (icon chips, success wash) are the maximum decoration allowed.
5. **Touch-friendly interaction.** All targets ≥48pt (buttons 52–56, rows 60, steppers 48, stars 44+hitSlop). One-handed reach: primary actions live in the lower half (full-width buttons, sticky bottom actions on long forms).
6. **One primary action per screen.** Review Request = Submit; delivered detail = Confirm; payment card = Submit receipt; job step = the single advance verb. Secondary/destructive actions sit below in secondary/danger styles.
7. **Clear system status.** Every async surface declares loading / empty / error / success explicitly with the shared state components; never a blank screen or a spinner without a label.
8. **Consistent terminology.** One vocabulary file (§14): "request" (not order) in requester UI, "delivery fee" (never service charge), "Review Request" (never checkout/cart-pay), "Waiting for a helper" (never finding/preparing).
9. **Accessibility.** Status is never color-only (pill always pairs color + text + optional icon); minimum contrast 4.5:1 body / 3:1 large; roles/labels on all interactive elements (already the codebase norm — keep).
10. **Responsive design.** Single-column flow layout, `flex:1` text columns, wrapping names, right-aligned values that wrap (§11). No fixed-width assumptions beyond 320pt minimum.
11. **Restrained motion.** Native stack/tab transitions only; pressed-state opacity; skeleton shimmer only for list loading. No decorative animation, no artificial delays.
12. **Error prevention.** Destructive or irreversible actions are confirm-first (staged receipt review, delete `Alert`, withdraw is explicit); reason-gated cancel; submit buttons disabled until valid with the blocking reason stated adjacent.
13. **Honest transaction communication.** Estimates labelled "est."; server-confirmed figures unlabeled; no arrival times, no preparation claims, no refund promises, no payment-success language before backend confirmation.

---

## Section 5: Send2U visual design system

### 5.1 Color palette

Primary red is the shipped icon red. All tints are derived mechanically (white mixes) so engineering can reproduce them exactly.

| Name | Hex | Purpose | Use | Do not use |
|---|---|---|---|---|
| `brand` (Primary red) | `#DA0A1B` | Brand accent: primary buttons, active tab, links, key highlights | Primary CTA fill, active states, brand header tile | Status meaning, large backgrounds, body text |
| `brandPressed` (Deep red) | `#A80815` | Pressed/active depth for brand surfaces | Button pressed state, selected segmented thumb edge | Text on white (contrast too low for small text) |
| `brandSoft` (Soft red tint) | `#FBE7E9` | Tinted wash for brand chips, icon tiles, selected states | Icon chips on discovery surfaces, selected option cards, notification dot on light? (see below) | Error semantics — warm but must not read as danger |
| `surface` (White) | `#FFFFFF` | Cards, headers, tab bar, sheets | All elevated content | Page background |
| `background` (Page) | `#F6F4F2` | Warm-neutral app background (current `#F5F7F9` shifted warm to sit with red) | Screen base | Text |
| `surfaceElevated` | `#FDFCFC` | Subtle lift over background | Tips, tooltips, pressed cards | Borders |
| `surfaceSecondary` | `#F1ECEA` | Muted containers (stepper bg, empty-state wash, doc rows) | Quantity backgrounds, file rows, skeleton base | Primary surfaces |
| `text` | `#22191B` | Primary text (warm-black for red harmony) | Titles, body, prices | On brand fill (use `onBrand`) |
| `secondary` | `#5A4E52` | Secondary text | Descriptions, metadata | Small/caption text (use tertiary at ≥12pt only with care) |
| `muted` | `#8D8287` | Tertiary text | Captions, hints, timestamps | Essential information, interactive labels |
| `onBrand` | `#FFFFFF` | Text/icons on brand fill | Primary button labels, brand tile glyph | Elsewhere |
| `border` | `#E7DFDC` | Card/row separators | Card borders, dividers, input borders (rest) | Focus state (use brand) |
| `success` | `#1D7A4C` | Confirmed/completed/paid states | Completed, Delivered, Recorded, Available pills | Brand actions |
| `successSoft` | `#E4F3EB` | Success wash | Success icon tiles, completed banners | — |
| `warning` | `#96590A` | Needs-attention states | Unpaid, Unavailable, Closed, out-for-delivery | Errors |
| `warningSoft` | `#F9EEDB` | Warning wash | As above, backgrounds | — |
| `error` | `#BC3A2A` | Destructive + failure states | Cancelled, disputed, destructive buttons, error states, unread dot | Brand accent, success paths |
| `errorSoft` | `#FAE7E3` | Error wash | Error icon tiles, dev-only accents | — |
| `info` | `#8A1A24` | Informational (deep red, NOT teal) | In-transit statuses (going-to-vendor…picked-up), neutral highlights | Success/error meaning |
| `infoSoft` | `#F7E4E5` | Info wash | In-transit icon tiles, "N open" badges | — |
| `disabled` / `disabledBg` | `#9AA3AB` / `#E9EDF0` | Disabled text/surfaces | Disabled buttons, inputs, steppers | Active content |

Rule: red family = brand + in-transit info only. Success/warning/error keep the current (contrast-verified) non-red hues so a red "Delivered" or red "Unpaid" can never occur.

### 5.2 Typography

System-font stack (no custom font assets — preserves native feel, zero download, correct Dynamic Type behavior): iOS San Francisco / Android Roboto via React Native defaults.

| Token | Size / line-height / weight | Usage |
|---|---|---|
| `display` | 28/34, 700 | Brand wordmark, oversized numerals (earnings total, payable total hero) |
| `title` | 22/28, 700 | Page titles (SectionHeader), dish names, totals |
| `subtitle` | 17/24, 600 | Card titles, row titles, item names, amounts-to-pay |
| `body` | 16/24, 400 | Default text, descriptions, instructions |
| `secondary` | 15/22, 400 | Row titles in dense lists, metadata lines |
| `caption` | 13/18, 400 | Hints, timestamps, helper text (never essential-only info) |
| `eyebrow` | 12/16, 700, +0.8 tracking, uppercase | Section eyebrows ("Today on campus", "Required action") |
| `button` | 16/24, 600 | All button labels |
| `price` | 17/24, 700, tabular-nums | Prices/totals in rows (pairs with `subtitle` color-brand for hero totals) |
| `status` | 13/18, 600 | Pill labels (always sentence-case in UI: "Waiting for a helper") |

Numeric emphasis: totals in `title`/`price` weight with `fontVariant: ['tabular-nums']` so amounts don't jitter on update.

### 5.3 Spacing

8-scale retained from current theme (already consistent codebase-wide): `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32`. Usage: page padding `xl` horizontal / `xl` top / `xxxl` bottom; inter-card gap `lg`; intra-card gap `sm–md`; icon-to-text `sm–md`; section-to-section `xxl`. Never introduce off-scale values (current audit found only three, all fixed to tokens).

### 5.4 Corner radii

`sm 8` (chips, dots are `full`), `md 12` (buttons, inputs, steppers, icon tiles, image frames), `lg 16` (cards, doc rows, file rows), `xl 20` (brand visuals, hero panels), `full 999` (pills, avatars, dots, badges). Dots/progress pips are always `full`, never magic numbers.

### 5.5 Shadows and borders

Borders first: 1px `border` on cards and row separators is the default separation on `background`. Shadows reserved for genuinely floating content: `card` (opacity .06/10px/2dp — standard Card), `lg` (modals/sheets/floating actions only). Never both heavy shadow and border on the same surface; never decorative glow. Dark-mode: out of scope (light-only product decision retained).

### 5.6 Icons

Single library retained: **MaterialIcons** (already exclusive). Sizes: nav (system), 20 inline/row glyphs, 22 list chips, 24 chevrons/checks, 26 option/bell, 28 avatars/feature glyphs, 32 empty/error/file glyphs, 48 hero visuals. Rules: every status pill pairs icon+label (never icon-only meaning); nav icons always carry text labels; decorative icon tiles use `brandSoft`/`infoSoft`/semantic washes at 44–64pt; file-type glyphs (`picture-as-pdf`, `insert-drive-file`) stay monochrome semantic colors (no rainbow).

### 5.7 Buttons

| Variant | Visual | Usage |
|---|---|---|
| Primary | `brand` fill, `onBrand` label, 52–56pt, `md` radius, full width | The one screen action (Submit, Confirm, Save) |
| Secondary | white fill, 1.5px `brand` border, brand label | Safe alternatives (View orders, Add more, Back) |
| Tertiary | transparent, brand label, 48pt min | Inline navigation (mode switch, View-all links) |
| Destructive | transparent, `error` label (red text, never red fill) | Cancel order, Delete item, Clear cart, Sign out |
| Disabled | `disabledBg` + `disabled` label | Until valid; blocking reason stated adjacent |
| Loading | spinner + verb label ("Submitting…") | All async submits; buttons lock concurrent taps |
| Icon buttons | 48pt, `md` radius, bordered | Steppers (see §5.8), star inputs (44+hitSlop) |
| Sticky bottom actions | primary pinned above safe-area on long scrolls | New pattern: review/submit screens on small devices |

Pressed: opacity .85 (buttons) / .6–.7 (rows, tiles). No gradients on buttons ever.

### 5.8 Inputs and controls

New: introduce one shared **`Input`** (the current gap — 11 raw `TextInput`s). Spec: 1.5px `border` resting → `brand` focus, `md` radius, 16pt text, `lg` horizontal padding, `muted` placeholder, inline error caption in `error` + `error` border, always `accessibilityLabel`, `maxLength` matching server caps (120 names, 500 free text), `keyboardType` per field (email, decimal-pad for prices), multiline for descriptions/details with the `n/500` counter pattern (already proven in rating input).

- Password: secure entry + show/hide toggle (new, 48pt).
- Textarea: same Input, multiline, counter.
- Radio-style selection: `ListRow` + trailing `check-circle` (current drop-off/category pattern — keep exactly).
- Segmented control: `surfaceSecondary` track, white thumb, brand label (current Active/History toggle — keep).
- Quantity stepper: 48pt bordered −/+, centered value, disabled states at min/max (current — keep, recolor border to brand).
- File picker: staged confirm-first card (current `StagedFileCard` — keep flow, rebrand accents): preview, full name, size, confirm/rechoose/cancel; nothing uploads pre-confirm.
- Confirmation controls: destructive `Alert` for deletes (current vendor pattern — extend to Clear-cart if desired; currently direct — keep direct, note as decision).

---

## Section 6: Shared component library

Each entry: purpose → structure → variants/states → a11y → used-in. All exist today except `Input`, `Skeleton`, `StickyAction`, and `Sheet` (marked NEW where applicable).

- **AppHeader** (existing, via Tabs `screenOptions`): white, no shadow, `subtitle`-weight title, `headerText`; right-slot bell. Keep; subordinate bell badge when tab badge present.
- **TabBar** (existing): white, 1px top border, 70pt, 12pt semibold labels, `brand` active / `muted` inactive, full safe-area. Keep metrics; recolor active to brand.
- **Screen/Page container** (existing `Screen`): SafeArea all edges, scroll default (`xl`/`xl`/`xxxl` padding, `lg` gaps), `keyboardShouldPersistTaps=handled`, optional refresh slot. Keep; add `KeyboardAvoidingView`-equivalent behavior for input-heavy screens (currently absent — NEW requirement, no library change).
- **SectionHeader** (existing): eyebrow/title/badge/tertiary-action. Keep API; eyebrow color → brand.
- **StatusPill** (existing `Badge`, rename recommended): `full` pill, soft wash + colored 600 label + optional icon; tones brand/info/success/warning/error/neutral. Keep; never color-only.
- **VendorHeader** (existing pattern in Home): name (`subtitle`), locationHint + hours (`caption`), open/Closed pill. Formalize as component (currently inline, duplicated in Review Request groups).
- **FoodRow** (existing `MenuItemRow`): name + price row, 2-line description, availability pill, chevron; dimmed when unavailable; 60pt min. Keep; price uses `price` token.
- **DetailHero** (existing placeholder panel): tinted `xl` panel with feature glyph; reserved for future real imagery (image columns exist unused). Keep placeholder honest — no stock photos.
- **Stepper** (existing `QuantityStepper`): 48pt bordered controls. Keep; recolor to brand.
- **Money** (formatting helpers, keep): `formatMYR` + `orderTotalCents` as the ONLY total definition; per-order fee derived from server data, never a second constant.
- **OrderCard** (existing `Card`+`ListRow` composition): badge-first right column (status over total). Formalize the badge-first ordering as the rule.
- **ActiveRequestCard** (existing Home preview): pill + dish title + vendor·total + primary/tertiary actions. Keep structure; add overflow link when N>1 (already implemented).
- **CostBreakdown** (existing `OrderBreakdown`): item lines + subtotal + fee + total with dividers, no pills. Reuse everywhere incl. confirmation/payment (currently confirmation duplicates rows — refactor to reuse).
- **LocationRow** (existing radio `ListRow`): place glyph, name, description, check-circle selected. Keep.
- **ProgressStrip** (existing 6-dot): numbered `full` dots, done = tinted wash, labels below; purely reflective of timestamps. Keep steps/labels; recolor done-state to brand wash.
- **StateMessageCard** (existing pending/transit pattern): pill + title + one-line explainer. Extend as the standard for all non-actionable statuses.
- **EmptyState / ErrorState / LoadingState** (existing): 64pt tinted glyph + title + concise message + optional secondary action; error carries `role=alert`. Keep; add `Skeleton` (NEW) for list loading shimmer.
- **ConfirmPanel** (existing delivered-confirm pattern): success pill + title + what-happened + primary + attestation caption + secondary toggle. Generalize for confirm/withdraw/accept confirmations.
- **UploadCard** (existing `StagedFileCard`): keep flow verbatim; show constraints line (types + 10 MB) before picking (already added on payment card — extend to QR manager).
- **ReceiptView** (existing `ReceiptEvidenceView`): inline image or PDF row + filename + download-with-progress + open + notices/errors. Keep; reuse in all recorded states (already extended to payment card).
- **RatingControl** (existing `RatingStars`+`RatingInput`): 5-star radio group, 44pt+ targets, counter textarea, immutable submitted rendering. Keep; fix hardcoded viewer copy ("your helper" vs "your requester").
- **IdentityCard** (existing profile pattern): avatar tile + name + email·short-ID + role pill. Keep; prefer real display names.
- **NavRow** (existing `ListRow` link rows): icon chip + title + chevron. Keep.
- **Sheet** (NEW — does not exist): bottom sheet spec reserved for future disclosure needs (report details, filters). Do NOT build until a concrete use case lands; toggles+inline expansion cover current needs.
- **ConfirmDialog** (existing `Alert.alert` pattern): destructive confirms only (vendor delete — keep; extend to account-danger actions if any appear).

## Section 7: Requester frontend redesign

Format per screen: purpose → goal → entry/exit → hierarchy → composition/components/type/color → actions → interactions → states → responsive/a11y → issues → changes → **unchanged contract**.

### 7.1 App launch / automatic routing

Purpose: invisible gate. Goal: zero-tap routing. Entry: cold start / deep link. Exit: sign-in, setup-fix, or role home. Hierarchy: full-screen centered loader ("Getting Send2U ready…") or immediate redirect. Components: `LoadingState` only. Type/color: `body`/`secondary` on `background`. No actions. States: loading vs instant redirect (no error state — failures surface on destination screens). Responsive/a11y: trivially safe; loader has role+label. Issues: none. Changes: none (rebrand loader tint only). **Unchanged:** routing outcomes, no marketing splash (explicitly not required).

### 7.2 Sign in

Purpose: credential entry. Goal: signed in within 30 seconds. Entry: launch gate, sign-out, session expiry, mode toggle. Exit: role home; sign-up mode; (future) password reset — NOT implemented, do not design. Composition: `BrandHeader` (rebuilt §6 tile in brand red + wordmark, no tagline bloat) → SectionHeader (eyebrow Welcome-back / title) → one `Input` card (Email `email-address` keyboard; Password secure + show/hide) → primary submit (loading "Working…", disabled while busy) → tertiary mode-switch. Type: `title` heading, `subtitle` field labels, `caption` hints. Color: brand primary button; `error` inline form card. Interactions: submit-on-return, persist-taps, no autofocus wars. Loading: button spinner. Empty: n/a. Error: invalid credentials → inline `ErrorState` card naming the problem; backend-missing → Setup-needed card (keep both). Disabled: busy lock. Responsive: single column, full-width buttons already thumb-safe. A11y: labelled inputs, `role=alert` errors, sufficient contrast. Issues: raw `TextInput`s (→ shared `Input`); no password reset (backend gap). Changes: rebrand tile/button, shared `Input`, show/hide password. **Unchanged:** email/password+permanent-role model, confirmation-required pause, error taxonomy.

### 7.3 Create account

Purpose: signup + one-time role choice. Goal: correct role, first try. Entry: mode toggle. Exit: confirmation card or role home. Composition: same inputs + two large `OptionCard`s (ordering / helping) + permanent-role note + Create-account primary. Type/color as §7.2; selected card = brand border + `brandSoft` wash. Loading: saving lock incl. cards disabled. Validation: email/password rules server-side; role required (default requester preselected — keep). Error: "Could not create account" card verbatim server-friendlies. Empty/disabled: as §7.2. Responsive/a11y: cards 60pt+, `selected` state exposed. Issues: none structural. Changes: rebrand only. **Unchanged:** role written once by server, anonymous excluded, helper vs requester set.

### 7.4 Finish account setup

Purpose: recovery for role-less sessions. Goal: repair or exit cleanly. Entry: root gate only. Exit: `/` or sign-in. Composition: SectionHeader (Setup) → missing-profile branch (permanence note + 2 role cards + Confirm-permanent primary + check-again secondary) OR unsupported-role error branch + tertiary Sign out. States: loading / claim error / refresh busy. Issues: none (rare path, copy accurate). Changes: rebrand only. **Unchanged:** INSERT-only repair semantics, no role mutation surface.

### 7.5 Requester bottom navigation

Four tabs — Home (home), My Orders (receipt-long), Notifications (notifications-none), Profile (person-outline) — white bar, 70pt, 12pt semibold labels, brand-active/muted-inactive, full safe-area; header bell retained as shortcut with unread dot. Entry/exit: tab switches preserve per-tab stack; cross-role ejects to root. Active/inactive: color + label weight (never color alone for the dot: dot + "N unread" badge text on Notifications). Unread: bell dot + tab badge text. States: n/a (tabs always rendered post-gate). Responsive: 4 tabs fit 320pt (short labels verified). A11y: native tab roles, labels include unread counts. Issues: bell/tab duplication (accepted; subordinate bell visually). Changes: recolor active to brand; keep order, icons, duplication. **Unchanged:** tab set, guards, hidden-route reachability.

### 7.6 Home / food discovery (priority)

Purpose: campus food directory + live status glance. Goal: find food or check request in seconds. Entry: tab, back-from-detail, confirmation "Back to menu". Exit: item detail, Review Request, order detail, orders list. Hierarchy: campus header (eyebrow + title + item-count badge) → active-request card → cart row (conditional) → vendor sections. Composition: `ActiveRequestCard` (pill, dish title `subtitle`, vendor·total `caption`, secondary View-request + tertiary View-all-N); `NavRow` cart shortcut; `VendorHeader` (name, hint, hours, Closed pill) + `Card` of `FoodRow`s. Type: title header → subtitle names → `price` amounts → caption hints. Color: brand accents, semantic pills only. Primary action: none (browse screen; row taps). Secondary: View-request / View-all / Start-a-request (empty state). Interactions: row press → detail; pull-to-refresh reloads menu+orders; realtime silently reconciles. Loading: "Checking your requests…" mini + "Loading today's menu…". Empty: no-active-requests card (with Start-a-request, never stale); "No menu today". Error: menu error card (orders errors stay silent to protect browsing). Disabled: unavailable rows dimmed + pill, still open detail (read-only CTA there). Responsive: rows wrap (`flex:1` columns), prices right-keep with `tabular-nums`. A11y: row labels include price+availability; badges textual. Issues: newest-only preview (View-all mitigates); header copy fixed. Changes: rebrand, `Skeleton` rows for menu loading (NEW), keep all copy/logic. **Unchanged:** vendor-section architecture, active-only newest-first preview source, cart math, no search/GPS/ratings/images/promos.

### 7.7 Food detail

Purpose: decide + add to cart. Goal: name, price, availability absorbed instantly. Entry: Home/menu rows. Exit: Review Request (View cart), back, add-more (in-place). Composition: hero panel (tinted `xl` tile + restaurant glyph — NO photography; image columns unused by product decision) → name `title` + price `title`-brand → description `body/secondary` → vendor card (hours, Available/Unavailable pill, closed note) → stepper card (48pt stepper, live Total, primary Add-to-cart / disabled Unavailable, cart-flow caption) → added-state (confirmation row, View-cart primary, Add-more secondary). Loading: "Loading item…". Empty: n/a. Error/missing: "Item unavailable" + Back-to-menu. Disabled: CTA disabled with reason. Responsive: hero scales, total row wraps. A11y: stepper labels, disabled announced, live total is plain text. Issues: placeholder panel is plain (honest; keep). Changes: rebrand accents, shared pill/stepper; optional `Skeleton` for loading. **Unchanged:** cart-only writes, quantities, unavailable gating, server-trust-nothing (ids+qty only at submit).

### 7.8 Review Request / cart

Purpose: review-before-submit (NOT checkout). Goal: verify items, fee, drop-off, submit once. Entry: cart shortcut, detail View-cart, Home CTA. Exit: confirmation (push), menu (empty), stays on failure. Composition: title + count badge → vendor-grouped `VendorHeader` + line cards (qty × name, unit×line, stepper, 0-removes) → `CostBreakdown` (subtotal / est. fee `formatMYR × N` / est. Total + fee-confirmed caption) → "Delivery location" header + radio `LocationRow`s → split-vendor notice (conditional) → Submit card (error, primary "Submit Request · RMxx (est.)", drop-off hint, cart-kept caption, danger Clear-cart). Type: title header, subtitle vendors/totals, caption hints. Color: brand primary; danger only for Clear. Interactions: stepper edits instant local; location tap selects; submit locks + spins; failure preserves everything. Loading: locations loader; submit busy. Empty: "Your cart is empty" + Browse-menu. Error: locations error + retry; submit error + retry (same payload). Validation: lines>0 + selected location + ready locations (unchanged rule). Disabled: submit until valid with adjacent hint. Responsive: line rows wrap names; totals `tabular-nums`. A11y: stepper labels, radio semantics on location rows (role + selected), errors as alerts. Issues: fee is estimate pre-submit (correctly labelled). Changes: rebrand; reuse `CostBreakdown` (already shared); optional sticky bottom submit on small screens (NEW pattern). **Unchanged:** "Submit Request" (never Pay Now), estimate labelling, split semantics, validation rule, failure preservation, server-derived charges.

### 7.9 Request created confirmation

Purpose: prove submission + orient next steps. Goal: certainty in one glance. Entry: submit success only (params-carried, stateless). Exit: `replace` to orders / single-order detail / menu (cart unreachable). Composition: success visual (tinted panel + check glyph) → "Request created / submitted successfully" → summary card (Waiting-for-helper pill; vendors; items; drop-off; subtotal/fee/total; external-pay note). Type: title + subtitle + caption. Color: `successSoft` visual + info pill. Interactions: three `replace` buttons (single-order View-request conditional). Loading: none (instant params). Empty: n/a. Error/fallback: "Nothing to confirm" + View-My-Orders for incomplete links. Disabled: n/a. Responsive: value column wraps right. A11y: success announced via heading order. Issues: statelessness means no live status (acceptable — pill states the initial truth). Changes: rebrand; reuse `CostBreakdown` instead of duplicated rows. **Unchanged:** wording bans (no preparing/paid/assigned/ETA claims), `replace` semantics, param contract (+`itemsSummary`).

### 7.10 My Orders

Purpose: scan active work; browse record. Goal: status-first scanning. Entry: tab, confirmation, profile row. Exit: detail per row. Composition: eyebrow header ("Your orders") + segmented Active/History → `OrderCard`s: active = vendor, dish title, location, badge-FIRST total column; history = vendor, date, location, final pill. Type:.subtitle vendors, caption metadata, `price` totals. Color: semantic pills; totals brand-adjacent neutral (current primary-bold — shift to text-bold with brand reserved for actions; minor rebrand decision). Interactions: tap → detail; tab switch lazy-loads history; pull-to-refresh visible tab; realtime silent. Loading: per-tab loaders. Empty: differentiated ("No orders yet" vs "No active orders" vs "No history yet"). Error: per-tab retry. Disabled: n/a. Responsive: badge+total stack without clipping at 320pt. A11y: rows labelled vendor+status+total. Issues: none structural. Changes: rebrand, badge-first rule formalized, skeleton rows (NEW). **Unchanged:** Active/History query split, ordering, realtime-focus contract, detail routing (terminal rows render read-only on same route).

### 7.11 Request Detail (operational control centre — priority)

Purpose: the single screen answering "what's happening and what must I do". Goal: 5-second comprehension. Entry: orders rows, notifications, confirmation link, Home preview. Exit: back, payment (inline), history (terminal auto-render). Composition (fixed order): header (vendor `title`, dish `subtitle`, status pill, short-ID · placed-date caption) → `ProgressStrip` → drop-off card → itemised `CostBreakdown` (+ pay-after-hands caption) → state section → payment card → Other-options (cancel, conditional). Type/color: title → subtitle → pill → caption; brand for actions only.

Per-status contract (labels from §14; titles reuse the shared message so all surfaces agree):

| Status | User sees / understands | Action required? | Primary / secondary | Must NOT show |
|---|---|---|---|---|
| `pending` | Waiting-for-helper pill + "No action required — notified on accept" | No | None / cancel if allowed | Helper identity, ETA |
| `assigned` | "Helper assigned — a helper accepted your request" | No | None / cancel if allowed | Location tracking |
| `going_to_vendor` | "Helper is going to the vendor — …going to collect the items" | No | None / cancel if allowed | "Out for delivery", map, ETA |
| `at_vendor` | "Helper is at the vendor — at the stall now" | No | None / cancel if allowed | Preparation claims |
| `food_available` | "Food is available — stall confirmed" | No | None / cancel if allowed | "Preparing" |
| `food_purchased` | "Food purchased — helper paid at the stall" | No | None / late-cancel path | Refund math |
| `picked_up` | "Request picked up — helper collected your items" | No | None / late-cancel path | Live tracking |
| `out_for_delivery` / `delivering` | "On the way — bringing to your drop-off" | No | None / late-cancel path | Time promises |
| `delivered` | Required-action panel (§7.12) + report toggle (§7.13) | **Yes** | Yes-confirm / Report-issue | Payment UI (gated shut until confirm) |
| `confirmed` / `awaiting_requester_payment` | Payment card (§7.14) | **Yes** | Submit receipt | Confirm button, cancel |
| `completed` / `cancelled` / `disputed` | Read-only record rendering (§§7.16–7.17) | No | Withdraw (own unresolved only) | Any mutation CTA |

Loading: "Loading order…". Missing: "Order not found" + back. Terminal: same route, history rendering. Responsive: header wraps; strip compresses (6 dots fit 320pt today — preserve). A11y: pill text carries status; strip decorative (dots) with pill as truth. Issues: previously text-heavy (resolved via state cards); cancel sits last (correct — least common). Changes: rebrand pills/buttons/strip; skeletons for first load (NEW). **Unchanged:** status set, cancel windows, delivered-only gates, terminal routing, realtime+focus reload.

### 7.12 Delivery confirmation

Purpose: attest receipt to unlock payment. Goal: deliberate, unambiguous tap. Entry: delivered detail only. Composition: `ConfirmPanel` — Delivered pill, "Confirm delivery", "The helper marked this request as delivered" (+ delivered date), primary **"Yes, confirm delivery"** (busy "Confirming…", locked), attestation caption ("By confirming, you attest that you received the request"), secondary Report-toggle. Loading: button spinner. Success: status flips to Payment-required (no toast needed — state change IS the feedback; realtime reconciles). Error: inline dismissible "Could not confirm". Already-confirmed: panel disappears (status-gated); double-taps serialize server-side to one winner. Responsive/a11y: full-width primary lower-half; attestation readable (not caption-small — use `secondary`). Issues: none. Changes: rebrand; promote attestation one type-step. **Unchanged:** delivered-only owner-only atomic RPC, no photo proof, no independent verification claims.

### 7.13 Issue reporting

Purpose: file a structured delivery complaint. Goal: category + optional note in under a minute. Entry: delivered-detail toggle only (backend: delivered-only). Composition: "What went wrong?" + 4 fixed radio rows (**Didn't receive it / Wrong or incomplete / Damaged or spoiled / Refused at handover** — the exact server-supported set, never extended in UI) + optional details `Input` (500 cap — add the proven `n/500` counter) + danger Submit + "moves to dispute — no automatic refund" warning. Validation: category required (button disabled until chosen). Loading: "Reporting…" lock. Error: inline dismissible. Success: order becomes disputed (state change feedback). Withdrawal: history-only, own-unresolved, four requester reasons (§7.16). Responsive/a11y: radio semantics + selected checks; warning plain text. Issues: none (copy verified against RPC errors). Changes: rebrand; add counter; keep categories frozen. **Unchanged:** delivered-only gate, 4 categories, no refunds/timelines/chat/compensation.

### 7.14 Payment required

Purpose: collect externally-paid money with proof. Goal: unmistakable "pay outside, prove inside" model. Entry: confirmed/awaiting detail (and only there — earlier stages show truthful "not yet" placeholders). Composition: "Payment required"/Unpaid header → itemised `CostBreakdown` (server figures) → **Amount to pay** hero → 4 numbered steps (banking app → scan QR → complete → save receipt) → helper QR image (signed-URL, loading/error states) → Submit entry → recorded state. QR-missing: explanatory error card ("don't pay anyone outside this QR") with submission disabled. Eligibility: submit UI only when server will accept (confirmed/awaiting); confirmed wording "Payment opens after you confirm…" on violations. Recorded: "Recorded" pill + amount + `ReceiptView` + "nothing left to do". Type/color: amount in `title`-brand; steps as numbered `body`; warning pill for Unpaid (never red). Loading/error/disabled per §7.15 flow. Responsive/a11y: QR `contain` full-width; steps plain text (screen-reader linear). Issues: steps could be more visual (numbered medallions — redesign win). Changes: rebrand; medallion steps; keep all copy semantics. **Unchanged:** external-only model, server-derived amounts, no gateways/wallets/methods, no auto-success/refund, no helper approval step.

### 7.15 Receipt upload and review

Purpose: attach proof that closes the order. Goal: confirm-first, zero false success. Composition: constraints line FIRST ("PDF or photo JPG/PNG/WEBP/HEIC, up to 10 MB") → Submit-receipt primary → `UploadCard` review (preview, full name ≤2 lines, size, note) → Confirm-&-submit (amount) / rechoose / cancel → recorded `ReceiptView` (image inline or PDF row, filename, download-with-progress, open, notices). Validation: MIME + 10 MB enforced pre-pick with friendly rejects; oversize/unsupported never leaves the picker. Loading: choosing → uploading → submitting messages on the locked button. Failure: inline error + orphan-upload cleanup (server row never created) — success UI appears ONLY after RPC confirmation. Duplicates: staged cleared + order completes (terminal routing) + server rejects resubmits. Recorded: viewer/download/share (proven pattern). Responsive: preview 1:1 `contain`; long filenames ellipsis. A11y: labelled picker button, progress announced, errors as alerts. Issues: none (audited exemplary). Changes: rebrand accents only. **Unchanged:** confirm-first pipeline, constraints, cleanup, no rejection/resubmit states (none exist server-side).

### 7.16 Disputes

Purpose: transparent holding state. Goal: "under review, here's what happens next (nothing automatic)". Entry: terminal rendering of disputed orders. Composition: "Under review" pill + "Issue under review" → category sentence (7 mapped reasons incl. helper-side late-cancel/delivery-failed/unable with fronted-cost wording) + flagged date + own report text + resolution note when present → conditional Withdraw (secondary, own-unresolved-requester-reasons only, busy lock, dismissible error) → settlement explainer ("settle directly", "manual settlement outside Send2U"). Read-only otherwise. Loading/error: withdraw-local only. Responsive/a11y: standard cards. Issues: none. Changes: rebrand. **Unchanged:** withdraw rules, no refunds/timelines/chat, admin resolution stays out-of-band (Section 10 proposal may add it later — product decision required).

### 7.17 Rating

Purpose: close the trust loop on completed+paid orders. Goal: rate in 30 seconds or skip knowingly. Entry: completed history record (eligibility: participant + completed + verified payment + unresolved + helper assigned — all server-enforced). Composition: "Rate your helper" + helper short-ID caption → 5-star radio group (44pt+, selected states) → optional feedback `Input` with `n/500` counter → Submit (locked until a star chosen) → immutable submitted rendering (stars, comment, date, "cannot be changed") + counterpart state ("Waiting for the helper/requester rating"). Loading/error: submit lock + dismissible error (incl. "already rated"). Responsive: stars fit 320pt. A11y: radiogroup/radio roles, per-star labels, text-paired stars. Issues: viewer copy must switch helper/requester correctly (one historical bug — fixed for requester, verify helper side in §8 build). Changes: rebrand stars (selected = brand? NO — keep warm amber `warning` for stars; brand is for actions, §5.1 rule). **Unchanged:** eligibility, 1–5, 500 cap, immutability, no feeds/aggregates/leaderboards/vendor ratings.

### 7.18 Notifications

Purpose: order-update inbox. Goal: triage unread in seconds. Entry: tab or header bell. Exit: order detail per row (mark-read-first, nav never blocked). Composition: "Updates for you" + unread-count badge + Mark-all-read (conditional) → icon rows (per-kind glyph, headline, detail, date, unread dot). Type/color: headline `secondary`-semibold, dot brand/info (keep primary-dot? recolor to brand — decision: unread dot = brand red, consistent with brand-as-attention). Loading/empty/error: standard trio + pull-to-refresh. Disabled: n/a. Responsive: title row wraps, dot pinned. A11y: rows labelled headline+body; unread exposed in label. Issues: bell/tab duplication (accepted). Changes: rebrand dot/accents; keep routing contract. **Unchanged:** milestone-only triggers, payload hygiene, mark semantics, realtime+refresh.

### 7.19 Profile

Purpose: identity + exit. Goal: confirm account, leave safely. Entry: tab. Exit: orders list, sign-out → auth gate. Composition: `IdentityCard` (avatar tile, display name w/ fallback, email · short ID, role pill) → My-orders `NavRow` → env-gated dev switcher (invisible in prod — keep gate, never restyle as feature) → danger Sign out. States: none (sync; gate covers loading). Responsive/a11y: trivial. Issues: none. Changes: rebrand only. **Unchanged:** exposed fields; NO wallet/payments/addresses/favorites/loyalty/promo/referral/subscription/settings — the redesign must not add any.

## Section 8: Helper frontend redesign

Design posture: same system, operational tone — verbs first ("Go to the vendor", "Food purchased"), money framed as fronted-cost vs fee-earning, one action per step. All behaviors below are implemented today; "Proposed" marks pure presentation changes.

### 8.1 Home / job queue (`/(helper)`, tab Jobs)

Header ("Helper hub" / "Delivery jobs" + "N open" badge) → availability card (status line + Switch: `brandSoft` track when on, locked while updating, inline error) → offline empty ("You're offline — go available…") / loading / error / rows. Rows: vendor, item summary ("2 × Nasi Ayam + 1 more"), location · date, bold subtotal, preview-tap + **Accept job** (locked while accepting; loser sees friendly taken-message + auto-refresh). Redesign: rebrand; skeleton rows; keep atomic-accept semantics, pending-only query, offline-hides-queue.

### 8.2 Job detail (`/(helper)/jobs/[id]`, hidden)

Header (vendor + status pill + requested date) → pickup/drop-off card → itemised breakdown + fronted-cost caption → per-status action card → read-only payment card. Per-status cards (keep verbs, rebrand): assigned→"Go to the vendor"+Release; going→"I'm at the vendor"+Release; at-vendor→Food-available/unavailable (+Release); food-available→"Food purchased with my money"+Release (+nothing-spent caption); food-purchased→"Confirm pickup"+"Can't complete"(dispute warning); picked-up→"Start delivery"+abandon; out-for-delivery→"Mark delivered"+"Requester unavailable"; delivered→waiting-for-requester text; confirmed→pay-via-QR text. Missing: "Job not available" + back. **Fix in redesign:** (a) legacy `delivering`/`awaiting_requester_payment`/`accepted`/`preparing`/`ready_for_pickup` currently dead-end — map to nearest real card; (b) `picked_up` error-retry must dismiss, not refire. **Unchanged:** advance RPC verbs, release/abandon/dispute routing, terminal→history.

### 8.3 Deliveries, Earnings, Notifications, Profile

- **Deliveries** (`/deliveries`): same segmented control; active rows add a payment-status badge (Unpaid/recorded — keep, it prevents unpaid-work confusion); history rows fee-focused without payment badge. Fix empty-copy to include disputed.
- **Earnings** (`/earnings`): finalized fee-only total + per-trip fee rows with fronted-food caption. No withdrawal rail exists — do not design one without a product decision.
- **Notifications**: same center, helper detail routing. Rebrand only.
- **Profile**: identity (hardcoded "Student helper" — prefer display name when present), My-deliveries/Payouts rows, confirm-first QR manager (staged review, replace/remove guards, orphan cleanup — exemplary, rebrand only), sign out.

### 8.4 Helper states, payment inspection, history, rating

Payment card stays read-only (submitted → "Verification pending", verified → earning-finalized + evidence viewer/download, rejected shown honestly). History stays read-only with settlement explainer + fronted-cost record. Rating reuses §7.17 control with viewer-correct copy (fix hardcoded title). Loading/empty/error already complete; add skeletons for queue/deliveries. **Unchanged:** no maps/directions/contact/photo-proof/dispute-appeal (no backend support — correctly absent).

## Section 9: Vendor frontend redesign

Design posture: operational tool, not a storefront — density over delight, same tokens. Vendor scope stays operations-only (no orders/payments/notifications — verified by construction).

### 9.1 Stall dashboard (`/(vendor)`, tab Stall)

"Your stall" header → status card (Open/Closed pill + honest state line + admin-hidden notice when `is_active=false`) → details-or-form card. Open-switch: immediate, locked while saving, errors dismissible. Edit form: name (≤120), description (≤500), location (≤120), hours (≤120); Save (locked, client-validated non-empty name) + Cancel. Unlinked account: "No stall linked — ask your administrator" empty state (keep — it names the real human process). Redesign: rebrand; consider confirm-first for the open-switch? NO — switch must stay instant (day-to-day tool); keep direct-save for stall form but add inline success confirmation (currently silent — small NEW feedback affordance, no behavior change).

### 9.2 Menu management (`/(vendor)/menu`, tab Menu)

"Your menu" header → rows (name, price · availability caption, availability switch, Edit secondary, Delete danger w/ `Alert` double-confirm — keep, it's the sole production dialog) → Add-item primary / inline form (name, description ≤500, decimal-pad price with live RM formatting, available switch; client-validated; single-flight lock across rows). Loading/error/empty ("No items yet") complete. Redesign: rebrand; keep Alert pattern; snapshots protect history (say so in a caption? already implied — add one line "Past orders keep their records" near delete — display-only honesty win). **Unchanged:** RPC-only writes, validation caps, no image upload (columns unused in v1 — do not design imagery until the bucket product decision lands).

### 9.3 Vendor profile, states, anti-patterns

Identity (stall name or fallback, email, short ID, permanence note) + sign out. No loading states needed (sync). Must NOT inherit requester patterns: no timelines, no payment cards, no ratings, no notification bell (none exist). Keep the tab set (Stall/Menu/Profile) and cross-eject guards.

## Section 10: Administrator frontend redesign (greenfield proposal)

Status: **nothing exists** — no routes, no components, no behavior to preserve. What follows is proposed purely from backend capabilities discovered in code (admin-only `send2u_resolve_dispute`, `is_active` kill-switch, service-role provisioning/linking, `disputeNote`/`resolution` columns, ownership-pinned RLS). Building any of this requires a product decision + backend access story (currently service-role SQL); the redesign must not assume admin auth exists in-app.

- **Dashboard (proposed):** counts by status (pending/disputed/unresolved), unlinked-vendor-account flags, recent settlements — dense table style (§11), info-density over cards.
- **Dispute queue (proposed):** filterable list (reason, age, amounts, parties) → detail (both histories, evidence links, report text) → resolve action writing `resolution`+`disputeNote` via the existing RPC shape. Never promise requesters timelines (see §7.16 constraint).
- **Vendor management (proposed):** stall list with `is_active` toggle (the existing kill-switch), link-account action (currently manual SQL), hours/menu read-only preview.
- **User monitoring (proposed, read-only):** role/dev-flag visibility; no in-app role mutation (immutability is a security property — admin hatch stays out-of-band).
- **Design rules:** same tokens/components (tables added per §11); destructive admin actions confirm-first; every mutation shows actor + timestamp (no silent writes); empty/error/loading per table.

## Section 11: Responsive design specification

Baseline truth: the current app is single-column flow layout on every screen — no grids, no breakpoints, no landscape optimization. The redesign keeps that (it is correct for this product) and formalizes the rules.

- **320pt small phones:** page padding drops to `lg` horizontal (keep `xl` top / `xxl` bottom); segmented controls and 6-dot strip verified to fit (strip: reduce dot to 26pt + 10pt labels under 360pt); badge+total stacks never clip (right column wraps); star row fits (5×44 = 220 + gaps < 320 − padding).
- **375–430pt standard:** reference canvas — `xl` page padding, all specs in §§5–7 composed here.
- **Large phones / tablets:** cap content width at **560pt centered** (readability + thumb reach); tab bar caps identically; do NOT stretch rows edge-to-edge. No multi-column (unnecessary for these flows); admin tables (§10) scroll horizontally inside the cap with sticky first column.
- **Text wrapping:** names/descriptions/filenames wrap (`flex:1` columns, `numberOfLines` only on filenames 1–2 + descriptions 2); right-aligned values (`textAlign:right`, wrap allowed); pills never wrap mid-label (allow horizontal scroll of pill rows if ever crowded — currently none crowd).
- **Buttons:** full-width primaries everywhere; side-by-side only for View-cart/Add-more class pairs (stack under 360pt).
- **Sticky actions:** submit/confirm primaries may pin above the safe-area on Review Request, report, and rating screens (NEW pattern; currently end-of-scroll — acceptable fallback).
- **Sheets (future):** 90% height max, grabber, scrim dismiss, safe-area bottom.
- **Keyboard:** no `KeyboardAvoidingView` exists — add platform behavior (iOS `padding`, Android `adjustResize` via config) + keep persist-taps + scroll; inputs must scroll above keyboard on 320pt screens (verify on stall/item forms, dispute details, rating comment).
- **Safe areas:** all edges on every screen (current norm); sticky actions sit inside bottom inset; tab bar respects home indicator.
- **Horizontal scrolling rules:** forbidden except admin tables and (if ever needed) image carousels. No horizontal food rails (directory, not marketplace).

## Section 12: Accessibility specification

Current baseline is strong (roles/labels on interactive elements, alert-role errors, labelled steppers/stars/switches, text-paired badges) — the redesign must not regress it.

- **Contrast:** body ≥4.5:1, large/disabled ≥3:1. Note: `muted` on white is decorative-only; the new `brand` `#DA0A1B` on white passes for large/bold (buttons use white-on-brand — verify at build; darken to `brandPressed` for text if audit fails).
- **Touch targets:** ≥48pt everywhere (buttons 52–56, rows 60, steppers 48, stars 44+4 hitSlop, switches native, dots non-interactive). Bell 48 + hitSlop 8 (keep).
- **Text scaling:** layouts must survive 200% Dynamic Type (wrapping columns already do; verify pill rows and strip labels under scaling — allow strip labels to truncate, never overlap).
- **Screen readers:** tab roles with unread counts; rows announce name+status+price; steppers announce value changes; stars radiogroup/radio; timelines `summary`; upload progress + errors announced; success conveyed by heading/state change, not color.
- **Status communication:** never color-only — pill = wash + 600-label + optional icon (current rule, keep). Red-green pairs never adjacent without labels.
- **Form errors:** inline, `role=alert`, adjacent to field, naming the fix ("Tell us briefly why…" pattern — keep).
- **Focus/keyboard (web/next):** visible focus rings on web builds; logical order preserved (no positive tabIndex).
- **Reduced motion:** respect `prefers-reduced-motion` / `AccessibilityInfo.reduceMotion` — disable shimmer and transitions (NEW requirement; currently no motion to gate, keep it that way).
- **Icons/files:** functional glyphs always labelled or text-paired; upload button states announced ("Choosing…/Uploading…/Submitting…" pattern — keep).

## Section 13: Motion and interaction specification

Principle: motion reports state changes; it never decorates. The current app has effectively zero custom motion — preserve that discipline.

- **Navigation:** platform-default stack/tab transitions only. No custom screen animations.
- **Cart updates:** stepper value changes instantly; totals update with `tabular-nums` (no jitter, no animation needed).
- **Loading completion:** content cross-fades or simply appears; skeleton shimmer (NEW) at low amplitude, motion-gated.
- **Status changes:** confirm/submit/accept transitions render the new state (pill + card swap); no celebratory animation beyond the existing static success panels.
- **Confirmation:** static success visual (current check panels — keep). No confetti/progress-theater.
- **Sheets (future):** native spring up / scrim fade, swipe-to-dismiss, motion-gated.
- **Upload states:** button-label progression (Choosing→Uploading→Submitting) + determinate progress on downloads (current — keep). No indeterminate-plus-success inventing.
- Forbidden: staggered list entrances, parallax heroes, animated counters, skeleton-to-content layout shift (reserve space), any delay inserted for effect.

## Section 14: State and status vocabulary

Single source for all user-facing status language. Backend values are NEVER renamed; only labels/presentation are specified. Facing: R=requester, H=helper, V=vendor, A=admin(future).

### 14.1 Order lifecycle (backend `OrderStatus`)

| Internal value | User label | Meaning | Color / icon | Allowed requester actions | Read-only? | Facing |
|---|---|---|---|---|---|---|
| `pending` | Waiting for a helper | No helper yet | info pill / schedule | Cancel (clean window) | No | R, H(queue) |
| `assigned` | Helper assigned | Helper claimed, not moving yet | info / person | Cancel (clean window) | No | R, H |
| `going_to_vendor` | Helper is going to the vendor | En route to stall | info / navigation | Cancel (clean window) | No | R, H |
| `at_vendor` | Helper is at the vendor | At stall | info / storefront | Cancel (clean window) | No | R, H |
| `food_available` | Food is available | Stall confirmed items | info / check | Cancel (clean window — nothing spent) | No | R, H |
| `food_purchased` | Food purchased | Helper paid at stall | info / payments | Cancel→dispute path | No | R, H |
| `picked_up` | Request picked up | Helper has the food | info / shopping-bag | Cancel→dispute path | No | R, H |
| `out_for_delivery` | On the way | Heading to drop-off | warning / delivery-dining | Cancel→dispute path | No | R, H |
| `delivering` (legacy) | On the way | Same as above | warning / delivery-dining | None in UI (map to card — §8 fix) | No | R, H |
| `delivered` | Delivered | Helper marked arrival | success / check | Confirm delivery; Report issue | No | R, H |
| `confirmed` | Payment required | Receipt attested, pay now | warning / payments | Submit receipt | No | R, H |
| `awaiting_requester_payment` | Payment required | Same gate, later hook | warning / payments | Submit receipt | No | R, H |
| `completed` | Completed | Paid + closed | success / check-circle | Rate (if eligible) | Yes (+rating) | R, H |
| `cancelled` | Cancelled | Closed without fulfilment | error / cancel | None | Yes | R, H |
| `disputed` | Under review | Needs settlement | error / report-problem | Withdraw (own unresolved only) | Yes (+withdraw) | R, H |
| `accepted` / `preparing` / `ready_for_pickup` (legacy) | Mapped to nearest real label (never surfaced raw) | Reserved, unused by flows | info | None (map to card — §8 fix) | No | H |

Terminology fixes locked: never "Preparing/Finding/Out-for-delivery(for going_to_vendor)/Track". Requester says "request"; helper says "job/delivery"; vendor says "stall/menu" (never sees these).

### 14.2 Payment (`PaymentStatus`) and misc

| Value | Label | Color | Rule |
|---|---|---|---|
| `submitted` | Verification pending | info | Display-only (no helper review exists) |
| `verified` | Payment verified | success | Closes order; enables rating |
| `rejected` | Payment rejected | error | Display-only; no resubmit path exists (do not design one without backend) |
| Unpaid (null row) | Unpaid | warning | Submit entry when eligible |
| Recorded (requester) | Recorded | success | Viewer + download |
| Notification unread | Dot + "N unread" | brand dot | Text-paired, never dot-only meaning |
| Open / Closed (vendor) | Open / Closed | success / warning | Day-to-day switch state |
| Available / Unavailable (item) | Available / Unavailable | success / warning | Purchasability gate |
| Settled (dispute resolution) | Settled · {resolution} | neutral/error wash | Read-only record |

## Section 15: UX issues and redesign priorities

- **Critical 1 — Helper dead-end on 5 legacy statuses.** Current: generic "no longer open" card with no action if backend ever emits them for an assigned helper. Fix: map to nearest real action card (§8.2). Risk: stranded paid orders. Screens: job detail.
- **Critical 2 — `picked_up` error retry refires the action.** Current: `onRetry` re-calls advance instead of dismissing (all sibling cards dismiss). Fix: dismiss + manual retry button. Risk: accidental double-advance (server serializes, but UX lies). Screens: job detail.
- **High 1 — Teal/red brand split.** Current: red icon, teal UI. Fix: §5.1 migration (button/border/active-token sweep; snapshot-test every screen). Risk: brand confusion. Screens: all.
- **High 2 — Text-heavy operational cards.** Current: paragraphs in payment/history/cancel. Fix: medallion steps, key-value rows, progressive disclosure (§§7.11/7.14). Risk: missed required actions. Screens: detail, payment, history.
- **High 3 — No shared Input.** Current: 11 raw inputs, two border styles. Fix: §5.8 `Input` + migrate. Risk: inconsistent validation display. Screens: auth, vendor forms, dispute, rating.
- **Medium 1 — Rating viewer copy.** Current: hardcoded "your helper" caption for helper viewers. Fix: viewer-conditional copy. Screens: rating section.
- **Medium 2 — History copy omits disputed.** Current: "Completed and cancelled…" while disputed lives there (both roles). Fix: "Completed, cancelled and settled…". Screens: 4 history lists.
- **Medium 3 — Vendor saves are silent.** Current: no success feedback on stall/menu saves. Fix: inline saved-confirmation (no behavior change). Screens: vendor stall/menu.
- **Medium 4 — No skeletons/toasts.** Current: spinner→content jumps; inline-only feedback. Fix: `Skeleton` rows + keep inline (do not add toast library until a transient-only need proves it).
- **Low 1 — Bell/tab duplication.** Accepted; subordinate bell visually. Low 2 — Confirmation duplicates breakdown rows; reuse `CostBreakdown`. Low 3 — Stepper/docs use `surfaceSecondary` inconsistently with new warm neutrals; re-token.

## Section 16: Implementation strategy

Dependency order: tokens → primitives → shells → requester journey → transactions → inbox/profile → other roles. (Matches the recommended order; inspection confirms no better sequence — requester detail depends on payment/upload/rating components, helper reuses them.)

- **Phase 1 — Tokens, type, primitives, shell.** Scope: §5 tokens, `Input`, `Skeleton`, recolor Button/Badge/TabBar/Screen headers, sticky-action pattern. Affects: all screens visually, none functionally. Risks: token sweep misses (mitigate: grep each old hex). Acceptance: every screen renders with zero old-teal references; tsc/lint/doctor/export green.
- **Phase 2 — Home, Food Detail, Review Request.** Scope: §§7.6–7.8 + `VendorHeader`/`FoodRow`/`Stepper` formalization. Dependencies: Phase 1. Risks: cart math untouched (verify with multi-vendor × multi-qty matrix). Acceptance: discovery→submit flow pixel-complete; fee/estimate labelling intact.
- **Phase 3 — Confirmation, Orders, Detail, status system.** Scope: §§7.9–7.11 + §14 vocabulary enforcement (single shared message helper). Dependencies: Phase 2. Risks: status-label drift across surfaces (mitigate: one helper, snapshot tests). Acceptance: all 9 statuses render specified labels/actions; terminal routing intact.
- **Phase 4 — Confirm, report, payment, receipt, rating.** Scope: §§7.12–7.17 + `ConfirmPanel`/`UploadCard`/`ReceiptView`/`RatingControl` generalization. Dependencies: Phase 3. Risks: payment-semantics drift (mitigate: no service changes; receipt matrix re-run). Acceptance: confirm-first everywhere; no success-before-RPC.
- **Phase 5 — Notifications, Profile, auth polish.** Scope: §§7.18–7.19, 7.2–7.4 + unread-dot recolor + password show/hide. Dependencies: Phase 1 only (parallelizable after). Risks: low. Acceptance: auth flows + inbox + profile complete.
- **Phase 6 — Helper, vendor, admin-future.** Scope: §§8–10 + legacy-status mapping + retry/copy fixes (§15 Critical/Mediums). Dependencies: Phases 1–4 components. Risks: helper stepper regression (mitigate: per-status action matrix test). Acceptance: fulfilment matrix green; vendor CRUD intact; admin clearly flagged future-gated.

Each phase: implement → `tsc` + `expo lint` + `expo-doctor` + `expo export -p web` → changelog entry → report (the repo's send2u-dev workflow).

## Section 17: Design acceptance checklist

- [ ] Zero old-teal references; red used for brand/actions only, never success/error meaning
- [ ] Type scale, spacing scale, radii applied from tokens (no magic numbers)
- [ ] Tabs: correct set/order/icons/labels per role; hidden routes reachable; bell duplication subordinated
- [ ] Touch targets ≥48pt; sticky actions inside safe-area; 320pt layouts don't clip
- [ ] Loading/empty/error/disabled on every async surface; skeletons where specified
- [ ] §14 labels exact on all surfaces; no preparing/ETA/tracking/rating-of-food copy
- [ ] Cart integrity: multi-vendor math, estimate labelling, failure preservation, no-resubmit
- [ ] Submit/confirm/report buttons appear only at valid stages; reason/category gates intact
- [ ] External-payment clarity: steps, QR states, receipt confirm-first, recorded viewer, no gateway implication
- [ ] Dispute: 4 categories frozen, no refund/timeline promises, withdraw rules intact
- [ ] Rating: eligibility, 5 stars, 500-cap counter, immutability, viewer-correct copy
- [ ] Contrast ≥4.5:1 body; status never color-only; screen-reader labels on interactive/status/upload elements
- [ ] No unsupported features (search/GPS/chat/photo-proof/gateway/wallet/promos/favorites/aggregates)
- [ ] No broken navigation, no dead controls, no misleading labels, no functional diffs vs backend contracts
- [ ] Validation suite green; changelog updated; device smoke completed (see Limitations)

## Inspection limitations (could not be verified from code)

1. **On-device behavior:** touch feel, keyboard overlap on small screens, Dynamic Type extremes, camera/file-picker native sheets, share-sheet flow, push delivery to physical devices — all need a device build (last-mile push explicitly unvalidated in project history).
2. **Real backend data shapes at runtime:** RLS/role matrices, legacy-status emission frequency, and volume/edge rows (e.g. 50-item carts) were read from code/migrations, not exercised live.
3. **Admin needs:** no admin users or workflows were observable; Section 10 requirements should be validated with stakeholders before build.
4. **Brand red rendering:** `#DA0A1B` sampled from icon pixels; on-screen contrast audit (especially white-on-brand at small sizes) must be re-verified at implementation and adjusted toward `brandPressed` for text if it fails.
5. **Pricing/fee policy:** RM2.00-per-order fee and external-QR model taken as fixed product facts; any policy change invalidates §§7.8/7.14 figures.






