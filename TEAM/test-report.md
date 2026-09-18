# Send2U — Adversarial QA Report (TESTER)

Agent: TESTER · Iteration 1 · Adversarial pass on commits `282dae3b`, `8cbd3d16`
Repo: `/Users/azfardanish/Documents/GitHub/send2u` · Node v22.23.1 · npm 10.9.8 · TypeScript 6.0.3
Date: 2026-09-18 23:31 +08

**Stance:** assume the Coder's report (`TEAM/report.md`) is a set of claims to falsify, not
facts. Everything below is from commands I ran in this session. Where a claim survived my
attack I say so explicitly; where it did not, I give the reproduction.

**Repo hygiene:** I did not modify, add, or leave any file in the repo. All probes live in
`/tmp`. Mutations were applied to **copies** in `/tmp/s2u_mutants` (repo `lib/` untouched).
`git status --short` before and after is byte-identical (only the pre-existing untracked
`.claude/skills/`, `SEND2U_TRANSACTION_ARCHITECTURE_AUDIT.md`, `TEAM/`, `agent/`).

---

## 1. Headline result

The three headline fixes (D1 `unpaid` per-rail label, D2 sentence case, D3 comma parsing) are
**real, correctly implemented, and genuinely covered by tests** — I could not break them by
mutation. `npx tsc --noEmit`, `npm test` (40/40) and `npm run lint` all pass on my run too.

But the sweep is **not clean**:

| # | Finding | Severity |
|---|---|---|
| F1 | The D1 defect class is **still live on the same screen**: `app/(requester)/orders/[id].tsx:575-578` tells an online *unpaid* requester "Paid in Send2U (simulated for this demo)." while three other elements on that screen say the opposite. Confirmed present in the shipped web bundle. | **HIGH** (user-visible, money copy, contradicts the fix) |
| F2 | `lib/unread.test.ts` (4 of 40 tests) is **entirely vacuous** — all four pass with `setUnreadCount` replaced by a total no-op. Plan §3 required clamp/no-op assertions; `TEAM/report.md` §2 lists "clamps negatives, no-ops when unchanged" as *verified*; it is not verified at all. | **MEDIUM** (false assurance) |
| F3 | `tsconfig.json:5` `"types": ["node", "react"]` creates a **hard dependency on an undeclared package**: `@types/node` is not in `package.json` (resolves transitively, 26.5.0). If it leaves the hoisted graph, `tsc` fails with `TS2688` on the whole app. Reproduced. | **MEDIUM** (build fragility) |
| F4 | The new comma grammar is **not** "well-formed thousands separators only": leading-zero groups are accepted, keeping the 100×-misread class alive for `0,123` → RM 123.00 (76/112 comma inputs in my sweep are malformed but accepted). Not a regression — the old code accepted these too — but the changelog over-claims. | **MEDIUM-LOW** |
| F5 | Changelog/report claim "every targeted module uses only erased `import type` imports" is **false**: `lib/unread.ts:1` does a runtime `import { useSyncExternalStore } from 'react'`; the suite only runs because `react` resolves from the repo's `node_modules` (proved: the unread tests crashed `ERR_MODULE_NOT_FOUND` in my /tmp copy until I symlinked `node_modules`). | **LOW** (inaccurate claim; portability) |
| F6 | `formatRelativeTime` / `formatOrderDate` have **zero** coverage although plan §2.4 explicitly asked for boundary verification; `TEAM/report.md` §2 asserts "correct at 60s/60min/24h/7d" with no evidence. They are also the only locale/time-dependent functions in the touched area. | **LOW** |
| F7 | `setUnreadCount` stores non-integers and can poison the store with `NaN` (proved with an instrumented copy). Unreachable today (all 4 callers pass safe numbers — verified), latent only. | **LOW** |
| F8 | Helper-facing copy inconsistency at the exact call site D2 touched: same job reads "Preparing"/"Delivering" in Deliveries vs "Being prepared"/"On the way" in Jobs. | **LOW** |

---

## 2. Tests performed (exact commands, actual results)

All run in `/Users/azfardanish/Documents/GitHub/send2u` unless stated.

| # | Command | Result |
|---|---|---|
| 1 | `git status` / `git log --oneline -8` | branch ahead of origin by 4; working tree clean; `282dae3b`, `8cbd3d16` present as claimed |
| 2 | `git show --stat 282dae3b` | 5 files: the 3 pending files + both changelog paths. **No logic rewrite** — diffs are the 3 documented hunks |
| 3 | `git show --stat 8cbd3d16` | 14 files: `lib/orders.ts`, `lib/money.ts`, 3 call sites, 5 test files, `package.json`, `tsconfig.json`, both changelogs. **No `supabase/`, no migration, no RLS/RPC file** → AC5 ✓ |
| 4 | `npx tsc --noEmit` | **exit 0** (AC7 part 1 ✓) |
| 5 | `npm test` | **exit 0, `# tests 40 / # pass 40 / # fail 0 / # skipped 0 / # todo 0`**, 155 ms (AC4 ✓). Only noise is `MODULE_TYPELESS_PACKAGE_JSON` |
| 6 | `npm run lint` (`expo lint`) | **exit 0**, no findings (AC7 part 2 ✓) |
| 7 | `npm --prefix …/send2u test` run **from `/tmp`** | 40/40 pass → the script is cwd-independent ✓ |
| 8 | `node -e "fs.globSync('lib/**/*.test.ts')"` | exactly the 5 intended files, nothing else → `npm test` cannot pick up stray files ✓ (glob is Node-resolved, shell-quoted) |
| 9 | `node /tmp/s2u_probe_money.ts` — ~70 crafted `parsePriceToCents` inputs | see §4. Whitespace/case/RM-prefix **all still correct**; no accepted input exceeds the cap |
| 10 | `node /tmp/s2u_probe_fuzz.ts` — exhaustive round-trip `0..999999` + comma-grammar sweep | `round-trip failures=0`; `formatPriceInput shape violations=0`; `accepted=112 rejected=80`, **76 malformed-but-accepted**; `accepted inputs above the cap: 0` |
| 11 | `node /tmp/s2u_probe_labels.ts` — full label matrix over all 18 `OrderStatus`, 12 `PaymentStatus`, 4 `SettlementStatus`, all 3 method values | only `unpaid` is method-dependent ✓; no status falls through to a raw key; `orderStatusLabel` is sentence case for all 18 |
| 12 | `python3 /tmp/s2u_mutate.py` — 16 mutations on **copies** of `lib/*.ts` | 13 KILLED, **3 SURVIVED** (all in `unread`) → see §5 |
| 13 | `node /tmp/s2u_probe_unread.ts` — instrumented copy exposing the private counter | clamp works; `2.7` stored as `2.7`; `NaN` stored as `NaN` |
| 14 | `npx tsc` on a scratch project with `types:["node","react"]` but no `@types/node` in the graph | `error TS2688: Cannot find type definition file for 'node'.` exit 2 → F3 |
| 15 | `npx tsc` on a scratch project **without** a `types` field, importing `node:test` | `TS2591 … try npm i --save-dev @types/node and then add 'node' to the types field` → the Coder's *reason* for the tsconfig change is **verified correct** (TS 6 no longer auto-includes `@types/node`) |
| 16 | Repo-wide greps (call sites, old title-case literals, `paymentStatusLabel`, `setUnreadCount` callers, `as any`) | see §3 and §6 |
| 17 | `grep` of `dist/_expo/static/js/web/entry-*.js` (the Coder's export artifact, mtime `Sep 18 23:25:12`) | contains `Payment due` ×1 (string that only exists after `8cbd3d16`), `Cash due on delivery` ×2, **0** occurrences of any test name, and the F1 string ×1 |
| 18 | `md5 CHANGELOG.md changelog.md`, `ls -li` | identical md5 (`ed9da4f6…`) and **same inode 120914338**; `grep -c` confirms 2 "Fix sweep" headings in both → no duplicated section (AC8 ✓) |

---

## 3. Coder claims that I verified as TRUE (attack failed)

- **D3 fix works.** `parsePriceToCents('6,50')`, `'6,5,0'`, `'12,34'`, `'1,23,456'`, `',6.50'`,
  `'6.50,'`, `'1,2345'`, `'6,50.00'`, `'6.50,00'`, `'1,,2'`, `','` **all throw** now, while
  `'1,234.56'`→123456, `'1,234'`→123400, `'1,234.5'`→123450, `'RM 1,234.56'`→123456,
  `'RM 1,234.56'`→123456, `'  6.50  '`→650, `'RM6.50'`→650, `'rm 6.50'`→650 all still work.
  **Specifically asked: `'RM 1,234.56'` is handled** ✓. `'RM'`, `'RM '`, `''`, `'   '`,
  fullwidth `'６.５０'`, Arabic-Indic `'١٢'`, `'1e3'`, `'0x10'`, `'Infinity'`, `'NaN'`, `'.5'`,
  `'5.'`, `'+6.50'` all rejected. **I could not find any input that the new code wrongly
  REJECTS** — the new accept-set is a strict subset of the old one, and the only legal
  thousands-separator shapes I tried are still accepted. **No accepted path bypasses the
  RM 9999.99 cap**: `'9,999,999'`, `'99,999.99'`, `'999,999'`, `'1,000,000'`, `'10,000'`,
  `'1,234,567'` all throw the range error; `'9999.99'`→999999 accepts. `'9999.999'` is
  rejected by the format rule, so there is no rounding path into over-cap.
- **`paymentStatusLabel(status, method?)` is safe and complete.** `npx tsc --noEmit` is clean
  with the existing 1-arg calls still in the suite (`lib/orders.test.ts:136`), so TS still
  accepts the old signature. Full matrix: **only `unpaid` is method-dependent**; for the other
  11 `PaymentStatus` values `label(s) === label(s,'online') === label(s,'cod')` — the Coder's
  "method changes no other state's label" is true. `undefined` and `null` both degrade to
  `'Payment due'`. Repo-wide grep: **no missed call site** — exactly 3 non-test callers
  (`app/(vendor)/orders/[id].tsx:134`, `components/TransactionRecord.tsx:35`,
  `components/RequesterPaymentCard.tsx:66`) and **all three pass the method argument in the
  right positional order** (status first).
- **D2 sentence-case change produces correct English for all 18 `OrderStatus` values** (matrix
  in §2/#11). No caller depended on title case: repo-wide grep for `For Pickup` / `For
  Delivery` finds only CHANGELOG/`TEAM/`/`docs/helper-ui-audit.md:92` (a stale flow diagram —
  cosmetic, not a caller). Grep for `"Ready For Pickup"` in the shipped bundle: **0**.
- **`git status` has no unstaged modification to the 3 pending files** (AC1/AC2 ✓). The
  `git show` diffs match the plan's §2.1–2.3 description exactly.
- **No status member falls through to a raw key** for the declared unions, and the test's
  hardcoded lists are genuinely complete today (18/12/4 — I diffed them by hand against
  `types/domain.ts:147-166`, `:301-312`, `:316`). The label/tone/message switch functions are
  additionally protected at compile time (no `default`, non-`undefined` return type ⇒ TS2366
  if the union grows).
- **`services/auth.ts` still has exactly 4 `as any`** (AC9 ✓). `TESTS`/`dist`/`CHANGELOG`
  integrity as tabled above (AC8 ✓).
- **`npm test` is hermetic** in the ways asked about: no network (no module under test touches
  Supabase), no cwd dependence (verified from `/tmp`), and **no locale/time dependence in the
  test files** — they never call `formatOrderDate`/`formatRelativeTime`. The glob cannot pick
  up unintended files.
- **`@types/react-test-renderer` being dropped by `types:` is harmless**: no source file
  imports `react-test-renderer` or `hammerjs` anywhere in the repo. `expo/types` still loads
  via the triple-slash reference in `expo-env.d.ts` (unaffected by `types`). All timer handles
  in app code use the `ReturnType<typeof setTimeout>` idiom, so the newly-visible Node globals
  create no type hazard I could find. Net: no *functional* breakage from the `types` change —
  only F3.

---

## 4. Failures with reproduction

### F1 — HIGH — The defect class D1 fixed is still live on the same screen, in the shipped bundle

`app/(requester)/orders/[id].tsx:575-578`:

```tsx
          <Text variant="caption" color="muted">
            {order.paymentMethod === 'cod'
              ? 'Cash due on delivery — pay your helper when the food arrives.'
              : 'Paid in Send2U (simulated for this demo).'}
          </Text>
```

The online branch is **unconditional on `paymentStatus`**, so it asserts "Paid" for every
online order that is not paid.

**Reproduction (reachable state):** requester order detail, `paymentMethod='online'`,
`paymentStatus='unpaid'` (the documented state between placement and initiating payment —
`types/domain.ts:297` describes online as `unpaid → pending → paid`). That same screen renders:

- `:73` status card → *"Complete your online payment to fire the kitchen."*
- `:656` `<RequesterPaymentCard>` → after the fix: `"Online Payment"` / `"Payment due"` /
  *"Pay in Send2U now (simulated for this demo)."*
- `:659-670` a `"Continue to Payment"` button for exactly `'unpaid' | 'pending' | 'failed'`
- **and `:578` "Paid in Send2U (simulated for this demo)."**

Four elements, three of which say "pay now", one of which says "paid". This is the identical
defect the Coder rated **HIGH** in D1 ("self-contradictory on one card"), left in place ~80
lines away on the same screen (and the F1 string is also the *only* payment copy the vendor
sibling screens don't share).

**Evidence it is shipped:** `dist/_expo/static/js/web/entry-2fdc306083b3ddebae805c1f1af30a2f.js`
(from the Coder's own export) contains `"Paid in Send2U (simulated for this demo)"` ×1.

**Expected:** the online branch should be state-aware (paid → "Paid in Send2U…"; otherwise
"Payment due — pay in Send2U"), or delegate to `paymentStatusLabel(order.paymentStatus,
order.paymentMethod)`. **Actual:** unconditional "Paid".

**Caveat stated honestly:** this is *not* a file the Coder touched, so it is arguably
scope-adjacent rather than a regression. But the brief scopes "fix real code defects found in
the sweep", the sweep rewrote the payment-label path in three other files, and the sweep's own
changelog claims the contradictory-copy defect was closed. It is not closed.

### F2 — MEDIUM — `lib/unread.test.ts` is vacuous (4 of 40 tests)

Read the file: every assertion is one of

- `lib/unread.test.ts:13` — `assert.ok(true, 'writer accepts positive and zero values without throwing')` (a **constant** assertion; cannot fail),
- `:21`, `:26`, `:27`, `:31`, `:32`, `:33` — `assert.doesNotThrow(() => setUnreadCount(…))`.

**Reproduction (mutations on a copy, `python3 /tmp/s2u_mutate.py`):**

| Mutation to a copy of `lib/unread.ts` | unread.test.ts |
|---|---|
| M1 drop the clamp: `Math.max(0, next)` → `next` | **4 pass, 0 fail — SURVIVED** |
| M2 `setUnreadCount` replaced by a **total no-op** `{ void next; }` | **4 pass, 0 fail — SURVIVED** |
| M3 drop the unchanged-value early `return` (duplicate emits) | **4 pass, 0 fail — SURVIVED** |

A no-op function satisfies all four test names' promises. The test *names* assert behaviour
("stores the clamped count", "clamps negatives to zero", "is a no-op when the count is
unchanged") that the bodies never check. For contrast, all 13 mutations in `money`/`orders`/
`orderEvents`/`dedupe` were killed, including exact reverts of D1 (M8), D2 (M7) and D3 (M4) —
so the suite genuinely fails when those three fixes are reverted. `unread` is the anomaly.

**Root cause (worth stating fairly):** `lib/unread.ts` keeps `count` private and exports only
`setUnreadCount`/`useSharedUnreadCount`, so there is no public observable for a sound test.
The correct Coder behaviour was to say "clamp/no-op is not verifiable at this boundary" rather
than ship assertion-free tests and report the behaviour as verified.

**Expected:** either a real assertion (e.g. export a test hook / assert the emit count via
`subscribe` — both are one-line module changes) or an explicit "not covered" statement.
**Actual:** 4 green tests that assert nothing, reported as coverage of plan §3.

### F3 — MEDIUM — `types: ["node", "react"]` depends on an undeclared `@types/node`

`tsconfig.json:5` names `"node"` explicitly. `package.json` declares only `@types/react`
(`:51`) — `@types/node` is **not** a devDependency (it resolves transitively at 26.5.0, as
`TEAM/report.md` limitation 4 already admits).

**Reproduction:**
```
# scratch project: types:["node","react"], @types/react present, @types/node absent
$ tsc --noEmit -p tsconfig.json
error TS2688: Cannot find type definition file for 'node'.
  The file is in the program because:
    Entry point of type library 'node' specified in compilerOptions
```
The Coder's *reason* for the change is correct (verified: with no `types` field, TS 6.0.3
reports `TS2591 … add 'node' to the types field` for `node:test`/`node:assert`). The problem is
that naming a type package in `types` **promotes an undeclared transitive dep into a hard
build requirement**: any change to hoisting/dedupe (or `npm ci` on a different lockfile state)
turns `npx tsc --noEmit` from green to a whole-project failure. **Expected:** `@types/node`
pinned in `devDependencies` alongside `typescript`; or keep it out of `types` and let the test
files use a separate `tsconfig`. Not fixed by the Coder (flagged as "would need a network
install" — a one-line `package.json` edit, and the package is already on disk).

### F4 — MEDIUM-LOW — "well-formed thousands separators only" is over-claimed: leading-zero groups are still accepted

`lib/money.ts:17`: `!/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)` — `\d{1,3}` happily matches
`0`, `00`, `000`.

**Reproduction:** `node /tmp/s2u_probe_fuzz.ts` (sweep of the whole comma grammar) →
`accepted=112 rejected=80`, and **76 of the accepted ones are malformed**:

```
0,123     -> 12300  (RM 123.00)     # user typed 0.123 → 123× misread
0,001.5   -> 150    (RM 1.50)       # 100× misread, same class as D3
00,123    -> 12300  (RM 123.00)
000,000   -> 0
00,000.5  -> 50
0,000     -> 0
```

**Expected (per the new comment and the changelog wording "a misplaced separator must fail
loudly"):** reject. **Actual:** accepted and silently re-valued.

**Severity rationale:** this is **not a regression** — the old comma-stripping code accepted
exactly the same inputs with the same values. So the fix is strictly an improvement, and it is
not a blocker. But the invariant as documented is false, the `'0,123'` case is the same
100×-misread class D3 was raised for (just with a leading zero rather than a short decimal),
and it is a one-character fix (`[1-9]\d{0,2}`). Fixing it is a claim-accuracy call for the CEO.

### F5 — LOW — the "only erased `import type` imports" claim is false

`TEAM/report.md` §3 and the changelog both say every targeted module uses only erased type-only
imports, justifying "no React dependency". `lib/unread.ts:1` is
`import { useSyncExternalStore } from 'react'` — a **runtime** import.

**Reproduction:** my first mutation run on a `/tmp` copy failed with
`Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'react' imported from …/unread.ts` for all
three unread mutations; they only pass once `/tmp/…/node_modules` is symlinked to the repo's.
So the suite is not react-free — it depends on `react` resolving from the repo's
`node_modules`, which works today but is an undocumented coupling (and the reason the unread
file is the one that cannot be run standalone).

### F6 — LOW — `formatRelativeTime` / `formatOrderDate` untested despite plan §2.4

Plan §2.4 asked for boundary verification of `formatRelativeTime` (0–59 s, 1–59 min, 1–23 h,
1–6 d, ≥7 d fallback). `grep` shows **no test references either function** (nothing in
`lib/orders.test.ts`), while `TEAM/report.md` §2 asserts "`formatRelativeTime` boundaries —
correct at 60s / 60min / 24h / 7d" as verified. That claim has no evidence, and these are the
only two functions in the touched file that are locale- and wall-clock dependent (also why they
were excluded — a fair trade, but it should have been reported as *unverified*, not verified).

### F7 — LOW (latent) — `setUnreadCount` stores non-integers and NaN poisons the store

`node /tmp/s2u_probe_unread.ts` (instrumented **copy**; the private counter is exposed only in
the copy) — real output:

```
after setUnreadCount(-10)   stored=0        <- clamp works (untested by the suite)
after setUnreadCount(2.7)   stored=2.7      <- non-integer stored, not clamped
after setUnreadCount(NaN)   stored=null     <- NaN stored (JSON.stringify(NaN) === 'null')
after setUnreadCount(4)     stored=4        <- self-heals only on the next write
```
A `NaN` write leaves the shared store at `NaN` until some later write — the header bell would
render "NaN". **Reachability checked and negative:** all 4 callers pass safe numbers —
`components/UnreadSync.tsx:14` (from `useUnreadCount`, `useState(0)`-initialised and
`count ?? 0` from `services/notifications.ts:80`), `hooks/useNotifications.ts:51/70`
(`countUnreadNotifications()`), `:107` via `applyUnread`, whose call sites are
`Math.max(0, unreadRef.current - 1)` (`:119`), `await countUnreadNotifications()` (`:129`,
`:154`) and `0` (`:146`). So: latent hardening, not a live bug — and `lib/unread.test.ts:31-33`
asserts only "does not throw", which is exactly why it is invisible.

### F8 — LOW — helper copy inconsistent between the two helper surfaces (at the D2 call site)

`app/(requester)/helper-portal/deliveries.tsx:38` (accessibility label) and `:52` (visible
text) use `orderStatusLabel`; `app/(requester)/helper-portal/index.tsx:179` uses
`helperStatusLabel`. Same job, two labels: `Preparing` vs `Being prepared`, `Food purchased` vs
`Purchased`, `Delivering` vs `On the way`, `Awaiting requester payment` vs `Confirmed`. The D2
commit touched `deliveries.tsx`'s exact call path and chose to lower-case the generic fallback
rather than use the purpose-built helper that already had the right copy. Pre-existing
inconsistency, improved but not resolved.

---

## 5. Vacuous / weak tests (complete list)

1. **`lib/unread.test.ts` — all 4 tests vacuous** (F2, mutation-proved). `:13` is a constant
   `assert.ok(true)`; the rest are `doesNotThrow`. Remove or rewrite before this suite is
   trusted.
2. **`lib/orders.test.ts:24-58` — hand-maintained exhaustiveness lists.** `ALL_ORDER_STATUSES`
   / `ALL_PAYMENT_STATUSES` / `ALL_SETTLEMENT_STATUSES` are literal arrays typed as
   `OrderStatus[]`. They are **complete today** (I diffed them), but the check is
   one-directional: *removing* a union member is a compile error, **adding** one is not, so the
   `for (const status of …)` loops silently stop covering the new member while
   `TEAM/report.md` §2 claims exhaustiveness is "asserted by test". The switch functions
   themselves are protected by `tsc`, so this is a documentation gap more than a hole.
3. **`lib/orderEvents.test.ts:98-107`** — "`applyOrderChange` never blanks or reorders the
   list" duplicates the previous test's assertion and adds
   `assert.ok(patch.next.every((item) => item.id.length > 0))`, which can only fail if the code
   invents empty-id rows. Low value, not vacuous (M13 kills it).
4. **`lib/dedupe.test.ts`** — the local `run` counters are the real code's collaborators, not
   mocks of it: all 3 mutations (M14/M15/M16) were killed. No vacuity found.
5. **`lib/money.test.ts`** — M4/M5/M6 killed. The round-trip test only samples 8 values; I ran
   the exhaustive version (0..999999, `failures=0`) so the gaps are covered by *my* evidence,
   not the suite's. No defect found.
6. **No test asserts anything about the three call sites** (`RequesterPaymentCard.tsx:66`,
   `TransactionRecord.tsx:35`, `app/(vendor)/orders/[id].tsx:134`). `grep '^import' lib/*.test.ts`
   shows the suite imports nothing outside `lib/` and `node:*`; the `npm test` glob only matches
   `lib/**/*.test.ts`. So if a future edit drops the `method` argument, **nothing fails** — the
   D1 regression test covers the function, not its wiring. Worth an explicit note in the review
   ("wiring untested by design — no RN test env added, per plan §3").

---

## 6. Regression risks

- **Old title-case label:** no live consumer. Repo-wide grep for `For Pickup`/`For Delivery` →
  only `CHANGELOG.md:24,72` (history), `TEAM/report.md`, and `docs/helper-ui-audit.md:92`
  ("Assigned → Out For Delivery" in a flow diagram). The doc string is now stale relative to
  the UI; cosmetic.
- **Old unconditional comma stripping:** no other caller of `parsePriceToCents`
  (`grep -rn parsePriceToCents` → only `app/(vendor)/menu.tsx:186` and the tests). No caller
  relied on comma-stripping everywhere.
- **Optional `method` param is type-compatible but not output-compatible:** a 1-arg call now
  renders `'Payment due'` where it used to render `'Cash due on delivery'` for `unpaid`. The
  report calls the param "backward-compatible"; that is true only at the type level. Verified
  moot today (3/3 call sites pass it), but any *new* call site that omits it silently gets the
  rail-neutral wording rather than an error — a footgun worth a lint/comment.
- **`tsconfig types:` (F3)** — the one change that can break `tsc` for reasons unrelated to
  this app's source.
- **`allowImportingTsExtensions: true`** — legal here only because `expo/tsconfig.base.json`
  sets `noEmit: true` (verified: `node_modules/expo/tsconfig.base.json`). It is a project-wide
  loosening to serve 5 test files; if anything ever imports a `.ts`-extension specifier from
  *app* code, Metro (not `tsc`) would be the thing that fails, and `tsc` would no longer catch
  it. Acceptable, but note it.
- **`dist/` is gitignored** (`:409 /dist/`) and `git status` is clean, so the export artifact
  does not endanger the tree.
- **`CHANGELOG.md`/`changelog.md` same-inode hazard** (report limitation 2) — verified
  independently: same inode 120914338, identical md5, both index entries current. The hazard is
  real for the next edit but was handled correctly this run.

---

## 7. UX / product problems (beyond F1)

1. **F1 above** — the requester is told "Paid" while being asked to pay.
2. `components/RequesterPaymentCard.tsx:49-96` — `needsOnlinePay` includes `'pending'`, so an
   online order whose payment is mid-flight shows the caption **"Payment processing"** and a
   **"Pay RM x"** button simultaneously. Pre-existing, untouched by this sweep, but it is the
   same "contradictory payment copy" family as D1.
3. **Comma feedback for a comma-locale user:** the vendor price field is
   `keyboardType="decimal-pad"` (`app/(vendor)/menu.tsx:239`). On a keyboard locale whose
   decimal separator is `,` (or via web/paste — the app has a web target), a user typing
   `6,50` now gets a red *"Enter a valid price, e.g. 6.50."* instead of a silent 100× save.
   That is the right trade, but the message does not explain *why*, and the max/format hints
   live only in the error text. Consider "Use a dot for the decimal: 6.50". (Product call, not
   a defect.)
4. **`helper-portal` F8** inconsistency.
5. Reachability caveat for D3 as originally written: on a mobile `decimal-pad` in a
   dot-decimal locale the user *cannot* type `,`; D3's realistic trigger is web/paste or a
   comma-locale keyboard. The fix is correct regardless — just note the severity was argued
   from a path that is narrower on-device than the report implies.

---

## 8. What I could NOT test, and why

- **Anything server-side** (hard limit): no Supabase/DB access, no migrations. I could not
  confirm that the transaction RPC returns a `paymentMethod` consistent with
  `order.paymentMethod`, that the server re-validates prices as the comment claims
  (`lib/money.ts:8-9`), or that ratings eligibility (`paymentStatus ∈ {paid, collected}`) matches
  the server's rule.
- **Rendered UI**: no RN/react-test-renderer environment was added (by design, plan §3), so the
  3 call sites' wiring, `OrderRatingSection`'s new `LoadingState`, and the `Updating…` caption
  are verified **by reading the diff only** — no visual or tap-through evidence exists
  (consistent with report limitation 1). `useSharedUnreadCount` is likewise untestable here.
- **`npx expo export -p web`** was **not re-run**. Disk free fell from 2.5 GiB to 2.2 GiB (99 %)
  during this session, and the changelog already records an ENOSPC build abort; re-running a
  Metro bundle for a 5 MB artifact risked filling the volume, and a failure would have been an
  environment artifact rather than signal. I corroborated the claim indirectly instead: the
  existing `dist/` bundle (mtime `23:25:12`) **contains the post-`8cbd3d16` string
  `Payment due`**, contains no test-file strings, and contains F1's string → the export
  demonstrably ran on the final code. AC7 therefore stands as *likely pass, not independently
  re-run*. The same applies to the EAS/native builds.
- **The commit-vs-export ordering nuance**: `dist/` is stamped 28 s *before* `8cbd3d16` was
  authored, so I cannot strictly prove the export covered the final changelog edit (a
  non-code file). Code-wise it is covered.
- **`expo-doctor` / device runs** — out of scope.

---

## 9. Verdict

Do **not** accept this sweep as clean. D1/D2/D3 are correctly fixed and properly tested
(mutation-verified); the two commits are scoped exactly as reported; `tsc`, `npm test` and
`lint` pass. But **F1** is the same user-visible money-copy defect the sweep claims to have
closed, still reachable on the same screen and present in the shipped bundle, and **F2** means
4 of the 40 tests provide zero assurance while the report presents them as coverage. F3 is a
build-time landmine the Coder noticed and left. Recommended: fix F1 (one conditional), delete
or repair `lib/unread.test.ts`, pin `@types/node`, and tighten the comma leading-group rule —
then re-run `tsc` + `npm test` (and a single `expo export -p web` once disk allows).

Repo state after QA: unchanged. `git status --short` =
`?? .claude/skills/`, `?? SEND2U_TRANSACTION_ARCHITECTURE_AUDIT.md`, `?? TEAM/`, `?? agent/`
(pre-existing). No repo file was created, edited, or deleted by this pass; all probes are in
`/tmp/s2u_*`.
