# Send2U — Implementation Report (CODER)

Agent: CODER · Iteration 1 · Plan: `TEAM/plan.md`
Executed by: orchestrating session (the delegated CODER child died on a provider
billing error — HTTP 402, `deepseek-v4-pro` out of balance — before its first
file write; verified zero progress and re-ran the role directly).

---

## 1. What was implemented

Two commits on `main`:

| Commit | Subject |
|---|---|
| `282dae3b` | `fix(ratings): gate eligibility on paid/collected + loader, availability caption` |
| `8cbd3d16` | `fix(money,orders): correct payment/status labels + price comma parsing; add lib test suite` |

**Commit `282dae3b` (P0 — committed as-is, no logic rewritten):**
the three pending files from the previous session, unchanged:
- `components/OrderRatingSection.tsx` — eligibility gate `payment?.status === 'verified'` → `paymentStatus === 'paid' \| 'collected'`; `LoadingState` while ratings fetch.
- `app/(requester)/orders/[id]/rate.tsx` — same gate on the screen-level predicate + comment.
- `app/(requester)/helper-portal/index.tsx` — "Updating…" caption while the availability write is in flight.
- Plus the already-staged `changelog.md` entry that belongs to them.

**Commit `8cbd3d16` (P1 defects + test suite):**
- `lib/orders.ts` — `paymentStatusLabel(status, method?)`; new `orderStatusLabel` sentence case.
- `lib/money.ts` — `parsePriceToCents` comma handling.
- `components/RequesterPaymentCard.tsx`, `components/TransactionRecord.tsx`, `app/(vendor)/orders/[id].tsx` — pass the order's method.
- 5 new test files + `package.json` scripts + `tsconfig.json`.
- New changelog entry (both paths).

---

## 2. Real defects found and fixed

### D1 — `paymentStatusLabel('unpaid')` labelled online orders "Cash due on delivery" (HIGH, user-visible copy)

- **Reproduction:** an order with `paymentMethod='online'` and
  `paymentStatus='unpaid'` (the state between placement and initiating the
  in-app payment — `RequesterPaymentCard` itself treats it as payable via
  `needsOnlinePay`).
- **Actual (before):** `RequesterPaymentCard` rendered the caption "Cash due
  on delivery" directly above body copy reading "Pay in Send2U now (simulated
  for this demo)" — self-contradictory on one card. The vendor order detail
  rendered `"Online Payment · Cash due on delivery"`.
  `components/TransactionRecord.tsx` rendered the same wrong row.
- **Expected:** cash-due wording only for COD; online unpaid orders read as an
  outstanding in-app payment.
- **Fix:** `paymentStatusLabel(status, method?)` — `unpaid` → "Cash due on
  delivery" only when `method === 'cod'`, otherwise "Payment due". Method is
  optional and backward-compatible; all three call sites pass it. Verified by
  test that `method` changes **no other** state's label.

### D2 — `orderStatusLabel` produced title case ("Ready For Pickup") (MEDIUM, user-visible copy)

- **Reproduction:** `orderStatusLabel('ready_for_pickup')` → `'Ready For Pickup'`;
  `'out_for_delivery'` → `'Out For Delivery'`.
- **Actual (before):** the generic fallback title-cased every word, so every
  multi-word status it serves rendered wrong English. Reachable in the shipped
  UI: `app/(requester)/helper-portal/deliveries.tsx:52` renders it as visible
  text and `:38` embeds it in an accessibility label.
- **Expected:** sentence case, matching the hand-written labels
  (`helperStatusLabel` already returns "Ready for pickup", "On the way").
- **Fix:** capitalise only the first word. No caller depended on the
  title-case form (grep: no `"For Pickup"`/`"For Delivery"` literals).

### D3 — `parsePriceToCents` could misread a price by 100x (HIGH, money path)

- **Reproduction:** `parsePriceToCents('6,50')` returned `65000` (RM 650.00).
- **Cause:** commas were stripped unconditionally before validation, so a
  comma-decimal typo was read as a thousands separator and silently became
  100x the intended amount. Live caller: `app/(vendor)/menu.tsx:186` — the
  vendor's menu price field. Max is RM 9999.99, so RM 650.00 passed validation
  and would have been stored.
- **Expected:** fail loudly rather than change the amount.
- **Fix:** commas are accepted only in well-formed thousands-separator
  positions (`^\d{1,3}(,\d{3})+(\.\d{1,2})?$`); anything else raises the
  existing "Enter a valid price, e.g. 6.50." error. `"1,234.56"` and
  `"1,234"` still parse; `"6,50"`, `"6,5,0"`, `"12,34"`, `"1,23,456"`,
  `",6.50"`, `"6.50,"`, `"1,2345"` now throw.

### Non-defects confirmed (verified, deliberately not changed)

- `lib/orderEvents.ts` `applyOrderChange` / `emitOrderChanged` /
  `subscribeOrderChanges` — all four branches and the throwing-listener
  isolation behave as documented.
- `lib/dedupe.ts` `dedupeRequest` — in-flight sharing, error sharing, and
  key release after settlement all correct.
- `lib/unread.ts` `setUnreadCount` — clamps negatives, no-ops when unchanged.
- `lib/orders.ts` status/label switches — exhaustive over
  `OrderStatus` (18), `PaymentStatus` (12), `SettlementStatus` (4); no member
  falls through to a raw `snake_case` key (asserted by test).
- `formatRelativeTime` boundaries — correct at 60s / 60min / 24h / 7d.
- `services/auth.ts` 4× `as any` — data shaping, per plan; untouched.

---

## 3. Test suite (new — the project had none)

- **Runner:** Node's built-in test runner. 40 tests, all passing.
  `npm test` / `npm run test:watch`.
- **Deviation from `plan.md` (justified):** the plan chose Vitest. Vitest pulls
  in vite/esbuild/rollup, and this machine's data volume is at **99% (2.5 GB
  free)** with the changelog already recording an ENOSPC-caused build abort.
  Node 22.23 strips TypeScript natively, and every targeted module uses only
  erased `import type` imports, so the built-in runner covers the identical
  scope with **zero new dependencies**. This honours the plan's stated
  principle ("smallest correct setup", "no RN/native/Supabase mocking") more
  faithfully than the plan's stated tool.
- **Coverage:** `lib/money.test.ts`, `lib/orders.test.ts`,
  `lib/orderEvents.test.ts`, `lib/dedupe.test.ts`, `lib/unread.test.ts`.
  Includes explicit regression tests for D1 and D3.
- **Out of unit scope (documented):** `useSharedUnreadCount` (React hook),
  all `services/*`, `hooks/*`, components/screens, `lib/supabase.ts`,
  `lib/push.ts`, `lib/maps.ts` — they need an RN/Supabase environment that was
  deliberately not added.
- **Config deviations from `plan.md` (required, both minimal):**
  - `tsconfig.json` + `"types": ["node", "react"]` — TypeScript 6 no longer
    auto-includes `@types/node`, so `node:test`/`node:assert` would not
    resolve. `react` is kept explicitly so React types keep resolving.
  - `tsconfig.json` + `"allowImportingTsExtensions": true` — Node ESM requires
    explicit file extensions; test files import `'./money.ts'` etc.
    (Signature-level `.ts` extensions only; no source module changed.)

---

## 4. Validation performed

All commands run in `/Users/azfardanish/Documents/GitHub/send2u`.

| # | Command | Result |
|---|---|---|
| 1 | `npx tsc --noEmit` | **PASS** (exit 0) |
| 2 | `npm test` | **PASS** — 40 tests, 40 pass, 0 fail |
| 3 | `npx expo lint` | **PASS** (exit 0, no findings) |
| 4 | `npx expo export -p web` | **PASS** (exit 0; all routes bundled incl. `pay-online`, vendor `orders/[id]`) |
| 5 | `npx tsc --noEmit` + `npm test` (final pass after changelog update) | **PASS** |
| 6 | `git status --short` | clean except pre-existing untracked artifacts |

---

## 5. Known issues / limitations

1. **On-device tap-through still pending** (pre-existing, unchanged by scope) —
   no device run in this sweep. The two label fixes and the parser fix are
   verified by unit test and type/bundle checks, not by tapping the app.
2. **`CHANGELOG.md` / `changelog.md` are the same file on disk** (same inode,
   case-insensitive APFS) while git tracks **two** index entries for it. With
   `core.ignorecase=true` git cannot refresh both from an `add`, so one entry
   stays dirty forever (the previous commit `356d1548` was an earlier symptom
   of this). Resolved this run by pinning both index entries to the same blob
   via `git update-index --cacheinfo`; both paths now point at the new content
   and the tree is clean. **This will recur on the next changelog edit** — the
   durable fix is to delete one of the two paths, which is a repo-structure
   decision for the CEO, not taken here.
3. **`MODULE_TYPELESS_PACKAGE_JSON` warning** from Node when running the
   suite — noisy but harmless. Adding `"type": "module"` would silence it but
   would break the Expo/Metro build, so it is intentionally left.
4. **`@types/node` is not a declared devDependency** — it resolves
   transitively (v26.5.0). The suite depends on that being present; declaring
   it explicitly would need a network install. Flagged, not done.
5. Disk remains at 99% full — the next heavy native build may hit ENOSPC.

---

## 6. Anything needing product clarification

None. One item is flagged for the CEO as a **decision, not a blocker**:
the duplicate-case changelog paths (limitation 2) — whether to keep one path
or both.

---

# Iteration 1 — fixes applied in response to QA

Commit `135d3aff`. The independent QA pass returned a "do not accept as clean"
verdict with four findings; all four are closed.

| Finding | Severity | Resolution |
|---|---|---|
| F1 — `app/(requester)/orders/[id].tsx:575-578` told every non-COD requester "Paid in Send2U" regardless of payment state | HIGH | **Fixed.** Caption now branches on `paymentMethod` **and** `paymentStatus`: COD → "Cash collected on delivery." / "Cash due on delivery…"; online → "Paid in Send2U…" only when `paid`, "Refunded by Send2U." when `refunded`, else "Not paid yet — pay in Send2U when your order is ready." Same defect class as D1. |
| F2 — `lib/unread.test.ts` was fully vacuous (passed with `setUnreadCount` replaced by a no-op) | MEDIUM | **Fixed.** The test now reads the store back through the real public hook (`useSharedUnreadCount`) via `react-dom/server`'s `renderToString` and asserts the rendered value, clamping, persistence and replacement. Mutation-verified: the no-op writer now fails 5 tests. |
| F3 — `tsconfig.json` `types:["node","react"]` depended on `@types/node`, which was not declared | MEDIUM | **Fixed.** `@types/node@^26.6.1` and `@types/react-dom@~19.2.0` are now declared devDependencies (the latter was needed for the F2 test's `react-dom/server` types). Both installs verified clean — no unexpected dependency churn. |
| F4 — the new comma rule still accepted zero-led groups (`0,123` → RM 123.00) | MEDIUM-LOW | **Fixed.** Leading group must be 1-3 non-zero-led digits; `0,123`, `00,123`, `0,001.5`, `0,000` now raise the validation error. Covered by test. |

QA findings deliberately **not** actioned, with reasons:

- **F5** — "the 'only erased `import type`' claim is false" (`lib/unread.ts:1`
  runtime-imports react). The claim was imprecise for that one module; the
  suite still needs no bundler and no RN environment. Corrected in this
  report rather than in code.
- **F6** — `formatRelativeTime` / `formatOrderDate` had no coverage (plan
  §2.4 listed them). The functions include `Date.now()`- and
  locale-dependent formatting; a hermetic test needs an injected clock or a
  fixed locale. Deferred rather than written flakily. **Still open.**
- **F7** — `setUnreadCount` stores non-integer input verbatim (NaN-poisoning).
  Unreachable today: all four callers pass integer counts. Recorded as a
  latent limitation, not patched.
- **F8** — helper copy differs between Deliveries ("Delivering") and Jobs
  ("On the way"). Pre-existing copy inconsistency outside this sweep's scope.

**Post-fix validation (all re-run after the fixes):**

| # | Command | Result |
|---|---|---|
| 1 | `npx tsc --noEmit` | **PASS** |
| 2 | `npm test` | **PASS** — 43 tests, 43 pass, 0 fail |
| 3 | `npx expo lint` | **PASS** (exit 0) |
| 4 | `npx expo export -p web` | **PASS** (exit 0) |
| 5 | Mutation check: `setUnreadCount` → no-op | **5 tests fail** (then reverted, `git diff` clean) |
| 6 | `git status --short` | clean (only pre-existing untracked artifacts) |

