# Send2U — Fix Sweep: Build & Architecture Plan

Author: ARCHITECT · Scope: CEO brief (TEAM/brief.md) · Iteration 1
Status: ready for CODER

---

## 1. Context summary

Send2U is an Expo SDK 57 / React Native 0.86 / TypeScript-strict mobile app
(Expo Router `app/` groups for `(auth)`, `(requester)`, `(vendor)`, and the
requester-nested `helper-portal/`) over a Supabase/Postgres backend. All
transaction writes go through `SECURITY DEFINER` RPCs; order `status`,
`payment_status`, and `settlement_status` evolve independently. Money/state
display logic is concentrated in small pure functions under `lib/`
(`orders.ts`, `money.ts`, `orderEvents.ts`, `dedupe.ts`, `unread.ts`).

The 2026-09-18 "platform-managed Online/COD" migration is **correct and
authoritative** — do not re-audit it. This run is a defect-fix + test-suite
sweep only. No re-architecture, no Supabase schema/RPC changes, no DB
migrations, no deleting legacy write-dead columns (`pickup_code`,
`payment_qr_path`, `evidence_path`).

Authoritative domain vocabulary (see `types/domain.ts`):
- `Order.paymentStatus: PaymentStatus` (paid/collected/failed/refunded/…) — the
  authoritative payment state. `OrderWithDetails.payment: Payment | null` still
  exists as the raw latest payment row, but **eligibility/state gating must use
  `paymentStatus`, not `payment?.status`**.
- Ratings are rateable only when `status === 'completed'` **and**
  `paymentStatus is 'paid' | 'collected'` (server enforces the same).
- Payable total = `orderTotalCents(subtotalCents, deliveryFeeCents)`; delivery
  fee is a DB snapshot (`delivery_fee_cents`, RM2.00 = 200), never a client
  constant. `ESTIMATED_DELIVERY_FEE_CENTS = 200` is **display-only** (pre-submit
  estimate), never the charged amount.

Workflow contract (`send2u-dev` skill): read changelog → inspect → implement →
run `npx tsc --noEmit`, `npx expo lint` (i.e. `npm run lint`), `npx expo
export -p web` → append `changelog.md` → final validation → report. Both
`changelog.md` (canonical, the skill's target) and `CHANGELOG.md` (git-synced
copy) are byte-identical and must **stay** identical — append to both.

---

## 2. Prioritized concrete fixes

### P0 — Commit the pending ratings-gate + loader fixes (do NOT redo)

These three files carry verified-correct uncommitted changes. The Coder's job
is to **commit them as-is**, not rewrite them.

1. `components/OrderRatingSection.tsx`
   - What: `eligible` gate changed from legacy `order.payment?.status ===
     'verified'` to `(order.paymentStatus === 'paid' ||
     order.paymentStatus === 'collected')`; added a `<LoadingState message=
     "Loading ratings…" />` when `ratings === null && !loadError`.
   - Why: the old gate matched a legacy `Payment.status` that the platform
     model no longer writes, so completed paid/collected orders never showed
     ratings; the new gate matches the RPC's server-side eligibility.

2. `app/(requester)/orders/[id]/rate.tsx`
   - What: same gate fix on the rate screen's `orderComplete`/eligibility
     predicate (`paymentStatus === 'paid' || 'collected'`), plus comment
     updated.
   - Why: screen-level guard must agree with the section's guard or the link
     can dead-end / render inconsistently.

3. `app/(requester)/helper-portal/index.tsx`
   - What: added an `Updating…` caption under the availability toggle while
     `updating` is true.
   - Why: the availability write is async; the caption closes a no-feedback gap.

**Commit instruction:** one focused commit, e.g.
`fix(ratings): gate eligibility on paid/collected + loader, availability caption`.
This is the only "change" to these files.

### P1 — Real code defects found in the sweep

The sweep confirmed the migration was thorough: **no remaining** references to
`payment?.status === 'verified'` or `.payment.status` outside the (already-fixed)
files above. The following are small, real, in-scope defects:

**(If a listed item is found not to reproduce or is already fixed, the Coder
notes that in TEAM/report.md rather than inventing a change.)**

4. `lib/orders.ts` — `formatRelativeTime` pluralization / boundary correctness
   (verify, then fix only if wrong):
   - `formatRelativeTime` uses `Date.now()` internally; test against fixed
     timestamps by injecting "now" or refactoring to accept an optional `now`
     param **only if needed for testability** (prefer not changing the public
     signature — see §4 on test technique).
   - Confirm "Just now" (0–59s), "X min ago" (1–59), "X hr ago" (1–23),
     "X day ago" (1–6), then `formatOrderDate` fallback at ≥7 days.

5. `lib/money.ts` — `parsePriceToCents` edge cases (verify, fix only if wrong):
   - `"6.5"` → 650, `"6"` → 600, `"RM 6.50"` → 650, `"1,234.56"` → 123456;
   - reject `"6.555"`, `""`, `"abc"`, `"RM"`, `"6.50.50"`, `"999999.99"+`.
   - `formatMYR`/`formatPriceInput` whole-cent/rounding behavior.

6. `lib/orders.ts` — `orderStatusLabel` / `helperStatusLabel` /
   `requesterStatusMessage` / `paymentStatusLabel` **exhaustiveness**: every
   member of `OrderStatus` / `PaymentStatus` / `SettlementStatus` union is
   handled (the `switch` default + `orderStatusLabel` fallback means unhandled
   values render a raw `snake_case` key — flag any member that falls through to
   a technical label rather than honest copy, and map it deliberately).

7. `lib/orderEvents.ts` — `applyOrderChange`: verify the three branches
   (absent + `belongs` → `needsRefetch`; present + `!belongs` → filtered out;
   present + `belongs` + same ref → no-op) and `emitOrderChanged` isolation of
   throwing listeners.

8. `lib/dedupe.ts` — `dedupeRequest`: verify in-flight sharing, result-sharing
   on error, and self-removal from the map after settlement (no stale entries,
   no premature removal while other callers await).

**Note on scope:** any "defect" beyond the above must be justified in
TEAM/report.md with a reproduction and approved as a real defect (not style).
`services/auth.ts` `as any` casts (4×, all `toProfile(data as any)` data-shaping)
are **declared non-defects** — do not change them.

---

## 3. Test-suite plan

### Framework choice: **Vitest** (smallest correct setup)

Rationale:
- Expo SDK 57 / RN 0.86 / React 19 — Jest's RN preset is heavy and version-fragile;
  Vitest runs pure TS/TSX modules with zero RN/native resolution.
- The target modules (`lib/*.ts`) are **pure logic with no RN imports** — no
  Babel/Metro transform needed. `vitest` resolves the `@/*` alias via a single
  `resolve.alias` entry mirroring `tsconfig.json` paths.
- `lib/orderEvents.ts`, `lib/dedupe.ts`, `lib/unread.ts` (writer side) are
  framework-agnostic even where they (or their consumers) use React hooks —
  test the pure parts; `unread.ts`'s hook is out of scope.

**Deliberately OUT of unit-test scope** (would need RN/Supabase/native mocks for
marginal value): `lib/supabase.ts`, `lib/push.ts`, `lib/maps.ts`, all
`services/*`, `hooks/*`, React components/screens. State classification helpers
that live inside `.tsx` files are exercised indirectly; do not extract them
(avoids re-architecture).

### What to add (files)

- Dev deps: `vitest` (and nothing else — skip jsdom/@testing-library unless a
  future component test demands it).
- `vitest.config.ts` at repo root:
  ```ts
  import { defineConfig } from 'vitest/config';
  import { fileURLToPath } from 'node:url';
  export default defineConfig({
    test: { environment: 'node', include: ['lib/**/*.test.ts'] },
    resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  });
  ```
- `package.json` scripts:
  ```json
  "test": "vitest run",
  "test:watch": "vitest"
  ```
- Test files (co-located under `lib/`): `lib/money.test.ts`, `lib/orders.test.ts`,
  `lib/orderEvents.test.ts`, `lib/dedupe.test.ts`, `lib/unread.test.ts`.

### Key test cases (money/state logic — the sweep's core)

`lib/money.test.ts`
- `formatMYR`: 650 → "RM 6.50"; 200 → "RM 2.00"; 5 → "RM 0.05"; 0 → "RM 0.00".
- `parsePriceToCents`: `"6.50"`→650, `"6"`→600, `"6.5"`→650, `"RM 6.50"`→650,
  `"rm 6.50"`→650, `"1,234.56"`→123456; throws on `""`, `"abc"`, `"6.555"`,
  `"-1"`, `"6.50.50"`, values > 999999 cents.
- `formatPriceInput`: 650 → "6.50", 5 → "0.05".

`lib/orders.test.ts`
- `orderTotalCents(750, 200) === 950`; `orderTotalCents(0, 200) === 200`;
  fee is added exactly once (identity: single call, no double-add).
- `ESTIMATED_DELIVERY_FEE_CENTS === 200` (documents the display-only constant).
- `isTerminalOrderStatus`/`isActiveOrderStatus` across all `OrderStatus` values —
  only `completed`/`cancelled`/`disputed` are terminal; `pending`, `assigned`,
  `delivering`, `confirmed`, `awaiting_requester_payment`, etc. are active.
- `paymentStatusLabel`/`paymentStatusTone`: `paid`/`collected` → success "Paid"/
  "Cash collected"; `failed`/`unpaid`/`not_collected` → warning; `refunded`/
  `cancelled` → error; `pending`/`submitted`/`refund_pending` → info.
- `requesterStatusMessage`: `pending`→"Waiting for a helper", `food_purchased`→
  "Food secured", `disputed`→"Under review", `cancelled`→"Cancelled";
  `out_for_delivery`/`delivering`→"On the way"; `confirmed`→"Confirmed — finishing up".
- `orderStatusLabel('ready_for_pickup') === 'Ready for pickup'`.
- `orderItemsTitle`: `[]`→"Your request"; single×1→name; single×2→"2 × name";
  two items→"A + B"; 3+→"A + N more".

`lib/orderEvents.test.ts`
- `applyOrderChange` absent + belongs → `{ next: same, needsRefetch: true }`.
- present + !belongs → removed, `needsRefetch: false`.
- present + belongs + same ref → `{ next: prev (same ref), needsRefetch: false }`.
- present + belongs + changed ref → replaced at same index, other rows untouched.
- `emitOrderChanged` calls every subscriber; a throwing subscriber does not
  prevent others from receiving the emit.
- `subscribeOrderChanges` returns an unsubscribe that actually removes the listener.

`lib/dedupe.test.ts`
- concurrent identical-key calls → one underlying `run` invocation, same resolved
  value to all awaiters.
- a rejected `run` rejects all awaiters and clears the key so a later call retries.
- key is removed after settlement (second call re-runs `run`).

`lib/unread.test.ts`
- `setUnreadCount` clamps negatives to 0 and is a no-op when unchanged (no
  duplicate emit). (Hook `useSharedUnreadCount` needs React — out of unit scope.)

### Validation ordering (mandatory, per send2u-dev)

After Coder implements, in order, until clean:
1. `npx tsc --noEmit`
2. `npm run lint` (== `npx expo lint`)
3. `npm test` (new vitest suite — all green)
4. `npx expo export -p web`
5. Append `changelog.md` **and** `CHANGELOG.md` (keep byte-identical), re-run
   a final `npx tsc --noEmit` + `npm test`.

---

## 4. Acceptance criteria (Manager verifies against these)

1. The three pending files (OrderRatingSection, rate.tsx, helper-portal/index.tsx)
   are **committed** with the exact already-verified diffs; no logic rewritten.
2. `git status` shows no unstaged modifications to those three files after commit.
3. A new, minimal Vitest suite exists (`lib/**/*.test.ts`) covering money and
   order/state logic; it runs under **Node with the `@/` alias resolved** — no
   RN/native/Supabase mocks were introduced.
4. `package.json` has a `test` script; `npm test` exits 0 with all tests passing.
5. No Supabase schema/RPC change, no migration file, no legacy column dropped.
6. No re-architecture: no component extraction, no signature churn beyond what is
   strictly needed to test (and none should be needed for `lib/`).
7. `npx tsc --noEmit`, `npm run lint`, and `npx expo export -p web` all pass.
8. `changelog.md` and `CHANGELOG.md` are appended (new dated entry describing the
   fix sweep + test suite) and remain byte-identical.
9. `services/auth.ts` `as any` casts untouched (4 remain).

---

## 5. MUST NOT change (hard boundaries)

- **Supabase**: no schema edits, no RPC body edits, no policy/grant changes, no
  migrations, no seed changes. DB is read-only this run.
- **Legacy columns**: `pickup_code`, `payment_qr_path`, `evidence_path` stay in
  the DB and are not deleted, repurposed, or newly read/written.
- **Migration correctness**: do not re-audit or "improve" the 2026-09-18
  platform-managed transaction migration.
- **Auth**: `services/auth.ts` 4× `as any` casts are data shaping, not defects.
- **Architecture**: no re-architecture, no new features, no UI redesign, no
  dependency additions beyond `vitest`, no refactor of `services/` or `hooks/`.
- **Files outside scope**: only `TEAM/plan.md` (this run's only direct write by
  Architect), the Coder's `TEAM/report.md`, and the changelog pair + the
  committed fix files + new test files are targets. Do not touch other screens,
  components, config (except `package.json`/`vitest.config.ts` for the test setup).

---

## 6. Product-level ambiguities (none unresolved)

None. The CEO brief fixes scope precisely: commit the three correct pending
fixes, fix only reproducible real defects, add a minimal money/state test suite,
and honor the send2u-dev workflow. The only engineering judgment is framework
choice (Vitest, justified above) and test granularity (pure `lib/` logic only,
avoiding RN/Supabase mocking) — both are implementation decisions, not product
ambiguities.
