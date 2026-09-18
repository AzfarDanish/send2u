# Send2U Fix Sweep — Manager / Quality Gate Review

**CLASSIFICATION: NEEDS_FIXES**

One-line justification: the three headline fixes (D1/D2/D3) and the four QA findings
(F1–F4) are genuinely implemented, tested and build-clean, but the sweep corrupted the
project's own record — **both new changelog entries were appended twice** (AC8 unmet in
substance, proven below) — and the F1 caption fix is itself incomplete in the same
"state-blind payment copy" class it was written to close, on a reachable state
(cancelled orders). Both are concrete, reproducible, small and in-scope.

Reviewed commits: `282dae3b`, `8cbd3d16`, `135d3aff` (HEAD) on `main`.
All findings below are from commands I ran myself in this session; nothing was modified
(read-only review — the only file written is this one).

---

## 1. Acceptance-criteria table (plan.md §4, verified item by item)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| AC1 | Three pending files committed with the exact already-verified diffs, no logic rewritten | **MET (with an unprovable part)** | `git show 282dae3b`: 3 target files + changelog pair; the diffs are exactly plan §2.1–2.3 (gate `payment?.status === 'verified'` → `paymentStatus === 'paid' \|\| 'collected'` in both `OrderRatingSection.tsx` and `rate.tsx`; `LoadingState` while `ratings === null && !loadError`; `Updating…` caption while `updating`). No extra hunks. *Unprovable:* the pre-commit working-tree state was never recorded (no stash, no WIP commit, no diff artifact in `TEAM/`), so "unchanged from what was staged" rests on the diffs matching the plan's prose. |
| AC2 | No unstaged modifications to those three files after commit | **MET** | `git status --short` = only pre-existing untracked (`.claude/skills/`, `SEND2U_TRANSACTION_ARCHITECTURE_AUDIT.md`, `TEAM/`, `agent/`); `git diff`/`git diff --cached` empty. |
| AC3 | New minimal **Vitest** suite, `lib/**/*.test.ts`, runs under Node with the `@/` alias resolved, no RN/native/Supabase mocks | **PARTIALLY MET** | Suite exists (5 files, **43 tests**, `npm test` exit 0 — re-run by me). No RN/Supabase mocks — true. But (a) **Vitest was not used** (Node built-in runner; no `vitest.config.ts`, no `vitest` in `package.json`) — the named tool in the plan is absent; (b) the `@/` alias requirement is **vacuous**: tests import `./money.ts` relatively and `lib/*.ts` only ever uses `@/` in erased `import type`, so the alias is never resolved at runtime; (c) `react-dom/server` (`renderToString`) is now a renderer inside a suite the plan scoped as pure logic (plan §3: "skip jsdom/@testing-library unless a future component test demands it"). |
| AC4 | `package.json` has `test`; `npm test` exits 0, all pass | **MET** | `"test": "node --test \"lib/**/*.test.ts\""`; `# tests 43 / # pass 43 / # fail 0`, exit 0 (my run). Test counts match file-by-file: 8+15+9+5+6 = 43. |
| AC5 | No Supabase schema/RPC change, no migration, no legacy column dropped | **MET** | `git diff --name-only 356d1548..HEAD` contains no `supabase/`, no `.sql`, no migration; legacy `pickup_code` / `payment_qr_path` / `evidence_path` are still only *read* exactly as before (`services/orders.ts:52,80,124,174,256,264`, `services/auth.ts:31,37,54`) and were not touched by the sweep. |
| AC6 | No re-architecture: no component extraction, no signature churn | **PARTIALLY MET** | No extraction, no new components — good. But (a) `paymentStatusLabel(status, method?)` **is a public signature change** that was not strictly needed for testability (it was needed for the D1 product fix) — legitimate, yet the plan asserted "none should be needed for `lib/`" and the Coder documented only the tsconfig deviations, not this plan conflict; (b) `tsconfig.json` gains two project-wide compiler options (see §3). |
| AC7 | `tsc --noEmit`, `lint`, `expo export -p web` pass | **MET (export corroborated, not re-run by me)** | Re-ran myself: `npx tsc --noEmit` exit 0; `npx expo lint` exit 0; `npm test` 43/43. Export: not re-run (see §7). Corroborated instead — `dist/_expo/static/js/web/entry-4ec91fee….js` (mtime 23:34, i.e. after `135d3aff`) contains `"Not paid yet"` ×1 and `"Refunded by Send2U"` ×1, strings that exist only post-`135d3aff` ⇒ an export did run on the final code. The Tester's stale-`dist` caveat no longer applies. |
| AC8 | New dated entry appended to `changelog.md` **and** `CHANGELOG.md`, remaining byte-identical | **UNMET (substance)** | Byte-identical: true, but only because both index entries are the same blob (`git ls-files -s` → both `a07ea200…`; same inode 120914338). The **content is duplicated**: at HEAD `grep -n "^## .*Fix sweep" changelog.md` → 4 headings at lines 13/53/93/141; sections 13–52 vs 53–92 have **identical md5** `9c19b909…`, and 93–140 vs 141–188 both `aee51676…`. Blob growth proves double-append: 2888 → 3002 lines at `8cbd3d16` (+114 = 18-line `282dae3b` entry + **2×48**), 3002 → 3082 at HEAD (**2×40**). No other heading in the file is duplicated, so this is new and attributable to the sweep. |
| AC9 | `services/auth.ts` 4× `as any` untouched | **MET** | `grep -c "as any" services/auth.ts` = 4. |
| §5 MUST NOT | "no dependency additions beyond `vitest`" | **BREACHED** | `@types/node@^26.6.1` and `@types/react-dom@~19.2.0` declared, installed (`node_modules/@types/node` = 26.6.1, `@types/react-dom` = 19.2.7) and the lockfile bumped (`@types/node` 26.5.0 → 26.6.1, 18 lock lines) on a disk with 2.2 GB free. Pragmatically right; contractually outside the authorized set. |

---

## 2. Defects and risks I found myself

### MG1 — HIGH — the changelog double-appended every sweep entry; both agents certified it as clean

*Reproduction (commands I ran):*
```
grep -n "^## " changelog.md | head            # 13, 53 = same title; 93, 141 = same title
sed -n '13,52p' changelog.md | md5            # 9c19b909368a38200737cfff77c0ace5
sed -n '53,92p' changelog.md | md5            # 9c19b909368a38200737cfff77c0ace5   <- identical
git show 8cbd3d16:changelog.md | grep -c "Fix sweep"   # 2  (one entry, already duplicated)
git show 282dae3b:changelog.md | grep -c "Fix sweep"   # 0
```
Because `CHANGELOG.md`/`changelog.md` are **one file on a case-insensitive volume**, "append to
both" writes the entry twice. The Coder then pinned both index entries with
`git update-index --cacheinfo`, which made `git status` clean and **hid** the corruption: the
durable record now says everything twice, including a "Follow-up to the entry below" block
printed above itself.

*Two process failures compounded it:*
1. The Architect's plan (§ workflow + AC8) instructed "append to both paths, keep byte-identical"
   without checking that they are one inode — the instruction itself is the bug.
2. The Tester's own AC8 check was a **false positive**: it ran `grep -c` and, seeing 2
   "Fix sweep" headings at `8cbd3d16`, concluded "no duplicated section (AC8 ✓)". Two headings
   for **one** entry was the duplication, not evidence of correctness. This is the single
   instance in either report where an adversarial pass *endorsed* a broken artifact.

This is the finding that decides the classification: the fix sweep's own record of what it did
is wrong, and the record is the artifact-of-value this workflow exists to produce.

### MG2 — MEDIUM — the F1 caption is still state-blind for terminal orders, so the same defect class survives in the code the fix wrote

`app/(requester)/orders/[id].tsx:575–586` now branches on `paymentMethod` + 4 payment states
(`cod/collected`, `cod/else`, `online/paid`, `online/refunded`, `online/else`). Two problems:

1. **It renders on terminal orders.** The Order Summary card is *not* inside the `terminal`
   gate (that gate exists — it guards `RequesterPaymentCard` at `:662` and the terminal block at
   `:723` — the Order Summary card simply isn't in it). Cancelling an unpaid order is a
   first-class flow (`cancellable` includes `status === 'pending'`, `:479`). Result on a
   cancelled order whose payment was never made — `paymentStatus` is `'unpaid'` or `'cancelled'`:
   the screen shows the *Cancelled* status card, the cancellation reason, a `TransactionRecord`
   row reading `Payment: Payment due` / `Payment cancelled`, **and** the caption
   *"Not paid yet — pay in Send2U when your order is ready."* A cancelled COD order instead gets
   *"Cash due on delivery — pay your helper when the food arrives."* Either way a dead order
   instructs the requester to pay. That is D1/F1's exact class (state-blind money copy asserting
   something the rest of the screen denies) surviving in the new code.
   Honest caveat: I could not query the DB, so the *precise* `paymentStatus` value on a cancelled
   order is inferred from `services/orders.ts:552–557` ("otherwise payment ends as cancelled") —
   but the defect holds for **either** value, so reachability needs no DB assumption.
2. **`paymentMethod` is nullable** — `types/domain.ts:185: paymentMethod: PaymentMethod | null`.
   The new caption tests `=== 'cod'` and treats `null` as online ("pay in Send2U"), while the
   `RequesterPaymentCard` 40 lines below tests `=== 'online'` and treats `null` as COD ("pay your
   helper in cash"). Two adjacent components on the same screen now disagree on the null case.

### MG3 — MEDIUM — the fix hand-rolled a third copy of the payment-copy matrix instead of using the tested function

`lib/orders.ts:paymentStatusLabel(status, method?)` already covers **all 12** `PaymentStatus`
values, is mutation-tested, and exists precisely so copy is decided in one place. The F1 fix
ignored it in the `.tsx` and re-derived a partial rail×state matrix inline. Payment wording is
now hand-written in at least three places (`orders/[id].tsx:577–585`,
`components/RequesterPaymentCard.tsx:48–100`, `helper-portal/jobs/[id].tsx:977`). MG2's null-case
mismatch is the *demonstration* that the copies have already drifted — this is a small
architectural regression introduced by a copy fix, in a plan that explicitly said
eligibility/copy should be derived from the authoritative state.

### MG4 — LOW/MEDIUM — two plan-conforming behaviours remain unverified after the F2 repair (I mutation-tested it)

I reproduced the Coder's mutation claim and pushed further (copies in `/tmp/mgr_mut*`, repo
untouched):

| Mutation to a copy of `lib/unread.ts` | result on the new `unread.test.ts` |
|---|---|
| total no-op writer | **not ok 1,3,4,5,6** → 5 fail / 1 pass (Coder's "fails 5 tests" **verified true**) |
| clamp dropped (`Math.max(0, next)` → `next`) | **not ok 3** → 1 fail (clamp is genuinely covered now) |
| unchanged-value early `return` dropped (duplicate emits) | **6 pass / 0 fail — MUTANT SURVIVES** |

So: plan §3's requirement for `setUnreadCount` was "clamps negatives to 0 **and** is a no-op when
unchanged (no duplicate emit)". The clamp half is now genuinely covered; the no-duplicate-emit
half still has **zero** coverage — it is unobservable through a server render, as the changelog
honestly admits. Also, `a zero count renders as zero` is still non-discriminating (it is the 1
test that survives the no-op mutant, because the store starts at 0). The iteration-2 report's
phrasing ("asserts the rendered count, clamping, persistence and replacement") is accurate; the
plan's criterion is half-met, not fully.

### MG5 — LOW — the durable changelog still carries a claim the Coder knows is false

F5 (the "only erased `import type`" claim is false — `lib/unread.ts:1` runtime-imports react) was
"corrected in this report rather than in code", but the claim is in the **changelog**, the
artifact of record: `changelog.md:119` and `:167` both still read "the tested modules use only
erased type-only imports". Worse, the `8cbd3d16` entry states `useSharedUnreadCount` "stays out"
of unit scope — while the `135d3aff` test now exercises that exact hook. Append-only history is
normal, but leaving a known-false statement in the record while fixing it only in a chat report
inverts the plan's stated priority ("changelog is canonical").

### MG6 — LOW — claim discipline (two unevidenced "verified" claims in the Coder's report)

`TEAM/report.md` §2 asserted `formatRelativeTime` boundaries "correct at 60s/60min/24h/7d" with
no test, and asserted the unread clamp/no-op as verified when it was not. I verified the time
formatters **independently** (`/tmp/mgr_probe_time.ts`, `Date.now` pinned): 0s/59s → "Just now",
60s → "1 min ago", 59min → "59 min ago", 60min → "1 hr ago", 23hr → "23 hr ago", 24hr →
"1 day ago", 6d → "6 days ago", 7d → `formatOrderDate` fallback ("Sep 11, 12:00 PM"), future
timestamp → "Just now", invalid input → passthrough. **0 failures** — the claim was true but
unevidenced; the F2 claim was simply false until QA forced it. One report, two assertions of
verification without evidence, is the process smell worth naming even though the outcome is fine.

### MG7 — Not a defect, recorded for completeness
`app/(requester)/orders/[id]/confirm.tsx:203–207` renders "Finish your online payment to complete
the request." for a `refunded` online order (the refund only excludes the *button*). Reachability
unproven (refunds appear to coincide with cancelled/disputed orders per `services/orders.ts:552`),
pre-existing, file not touched by the sweep — a follow-up ticket, not a blocker.

---

## 3. Challenges to each agent

### Architect (`plan.md`)
- **The framework decision ignored a constraint it had already recorded.** The brief states
  disk 98 % full; the plan chose Vitest and banned alternatives ("no dependency additions beyond
  `vitest`", §5) — yet allowed itself no disk allowance and no contingency. The Coder then had to
  deviate *because of the very constraint the plan had in hand*. A plan that both mandates a
  dependency-heavy tool and forbids substitutes, on a volume with 2.2 GB free, is not robust.
- **AC8's instruction is the root cause of MG1.** "Append `changelog.md` **and** `CHANGELOG.md`
  (keep byte-identical)" is impossible-by-construction when both paths are one inode; the AC
  should have been "one physical file, one append".
- **AC3 asserts a `@/`-alias requirement that the delivered suite never exercises** (vacuous
  criterion) and a §3 test requirement ("no duplicate emit") that is not assertable at the
  module's public boundary as the plan assumed — both criteria were unverifiable as written.
- **The AC list could not have caught what actually mattered.** F1 (and my MG2) live in `.tsx`
  copy, which the plan deliberately excluded from test scope, and no AC required reading back the
  changelog *content* or diffing the payment-copy surfaces. The plan's acceptance table validated
  mechanics and missed the product surface — that is why QA found F1, not the plan.
- Credit where due: the plan's central diagnosis (gate on `paymentStatus`, not `payment?.status`)
  was right, and its "verify, then fix only if wrong" discipline is what kept D-level scope tight.

### Coder (`report.md`)
- **Deviations, judged individually:**
  - *Node test runner instead of Vitest — JUSTIFIED.* Disk argument is real (89 % used, 2.2 GB
    free, ENOSPC in this repo's own history) and the deliverable's core coverage is not weakened:
    13/16 mutations killed in the Tester's pass, including exact reverts of D1/D2/D3, and the
    suite fails when the fixes are reverted. It honours the plan's stated principle over its
    stated tool.
  - *`tsconfig.json` keys — JUSTIFIED BUT COSTLY, and it caused a real defect.* `types:["node",
    "react"]` promotes an undeclared transitive dep into a whole-project `tsc` failure mode (F3);
    `allowImportingTsExtensions` is a **project-wide** loosening granted to 5 test files (legal
    only because `expo/tsconfig.base.json` sets `noEmit`) — it means app code could start using
    `.ts` extension imports and `tsc` would no longer object, while Metro would fail. Choosing a
    runner that required two global compiler options, then needing a follow-up commit to defuse
    the failure mode one of them created, is a sign the runner choice was under-considered; a
    test-only `tsconfig` was available.
  - *`@types/node` + `@types/react-dom` — SUBSTANTIVELY NEEDED, CONTRACTUALLY A BREACH.* Right that
    F3 needed pinning. But `@types/react-dom` is needed **only** because of the F2 test technique,
    and it is an explicit §5 "MUST NOT" (no deps beyond `vitest`). It was also done as a live
    install + lockfile bump on a 2.2 GB-free volume. Flagged as a CEO authorization item (§6).
  - **Deviation that is arguably scope creep:** `paymentStatusLabel(status, method?)` changed a
    public signature (AC6's "no signature churn"), and the report did not name it as a plan
    conflict alongside the tsconfig deviations. The change is *product-correct* (D1), so I do not
    call it wrong — I call it undisclosed.
- **F2's fix: right outcome, wrong-weight tool.** It is effective — I reproduced 5/1 on the no-op
  mutant and the clamp mutant now dies. But it drags `react-dom/server` (a renderer) into the
  "pure-logic, no renderer/DOM" suite and required a new type package, when the Tester had already
  named two cheaper, plan-conformant options ("export a test hook / assert the emit count via
  `subscribe` — both are one-line module changes"). It also leaves 1 of 6 tests non-discriminating
  and the plan's duplicate-emit requirement uncovered (MG4). Verdict: acceptable, not minimal.
- **The F1 fix introduced the next instance of its own defect class** (MG2) and a third hand-rolled
  copy of the payment matrix (MG3) in the same 10-line hunk. That, plus MG1 (never reading back
  the file it appended to) and MG6 (two unevidenced "verified" claims), is the pattern: the Coder
  verifies *functions* and *build gates* well and *files-as-artifacts* poorly.
- Credit where due: D3's diagnosis (`6,50` → RM 650.00 on a live vendor price field), the F4
  tightening, and the two deliberate non-fixes (`orderEvents`/`dedupe` verified correct and left
  alone) are exactly the judgment the brief asked for.

### Tester (`test-report.md`)
- Strongest-performing role: mutation-driven rather than assertion-counting, and F1 was a genuine
  catch that the Coder had missed, evidenced in the shipped bundle. Its `F5`/`F6`/`F7`
  reachability analysis (all four `setUnreadCount` callers, the `NaN` path, the narrow on-device
  trigger for D3) is careful work.
- **But two of its own claims fail my re-check:**
  - **AC8 false positive (MG1).** It counted 2 "Fix sweep" headings and certified "no duplicated
    section". The duplication was already in the blob it inspected.
  - **It endorsed the `types` approach** as "no functional breakage … only F3", while the very next
    commit had to add `@types/react-dom` to make the suite run — a dependency consequence that
    only appears once the unread test is rewritten. A reviewer who flags the fragility of `types`
    should have priced the fix it recommended.
- **Process gap it could not cover, and that nobody covered:** its report scopes `282dae3b` and
  `8cbd3d16` **only**. `135d3aff` — which contains the F1 caption fix, the money rule change, the
  rewritten test and two dependency additions — **has had no adversarial review at all**. Its
  findings F1–F4 are closed on the Coder's own say-so. That is precisely why MG1 and MG2 sit in
  that commit: the last, most defect-dense change is the one no one attacked.

---

## 4. Are the 7 fixes real product improvements? (per fix)

| Fix | Real, cosmetic, or risky? |
|---|---|
| **D1** `unpaid` per-rail label | **Real.** Removes literal self-contradiction on the same card ("Cash due on delivery" + "Pay in Send2U now") and the vendor's "Online Payment · Cash due on delivery". Method optional + defaulting to rail-neutral is the right shape; 3/3 live call sites pass the method in the right positional order (verified by reading all three). |
| **D2** sentence case | **Real but low-impact.** `Ready For Pickup` was wrong English on a helper surface that renders it as visible text; no caller depended on title case (`grep` finds only CHANGELOG/`TEAM/`/a stale doc diagram). Cosmetic in the money sense, correct in the copy sense. |
| **D3** comma parsing | **Real, and the right trade.** `'6,50'` → RM 650.00 on the live vendor menu price field (`app/(vendor)/menu.tsx:186`) was a silent 100× misread. F4's follow-up (`0,123` etc. now rejected) closes the same class. **Regression check: I found no input the new code wrongly rejects.** The accept-set is a strict subset of the old one; every well-formed thousands shape still parses (`1,234.56`→123456, `1,234`→123400, `RM 1,234.56`→123456); no accepted path bypasses the RM 9999.99 cap. The one behavioural loss is a comma-decimal-locale typist now getting a validation error instead of a 100× charge — correct, and the error copy ("Enter a valid price, e.g. 6.50.") is at least honest, though it doesn't explain *why*. |
| **F1** Order Summary caption | **Real improvement, but incomplete and now the largest residual risk** — see MG2/MG3. The state-aware branch is correct for `cod/collected`, `cod/unpaid`, `online/paid`, `online/refunded`; it is wrong (pay-now instruction) for cancelled/terminal orders on both rails, and null-method handling contradicts the adjacent payment card. |
| **F2** unread test rewrite | **Real.** Mutation-verified (5/1 no-op, clamp now covered). Cost: a renderer and a type package in a pure-logic suite; one test still non-discriminating; plan §3's duplicate-emit half still uncovered. |
| **F3** pinned `@types/node` | **Real.** Removes a genuine whole-project `tsc` landmine (I accept the Tester's TS2688 reproduction). Cost: a §5 breach and a 2.2 GB-free-volume install. |
| **F4** zero-led comma groups | **Real, low.** Same 100× class with a leading zero; one-character rule change; not a regression (the old code accepted these too). |

**Any regression in behaviour?** No regression I can demonstrate in the money path — the strictest
change (D3/F4) only rejects inputs the old code mis-read, and the only copy change with reach
(D2) has no live consumer of the old form. The one behaviour that *does* change silently without a
compile error is the **`paymentStatusLabel` optional-method footgun**: a future 1-arg call site
now renders rail-neutral "Payment due" instead of the previous unconditional "Cash due on
delivery" — the report's claim that this is "backward-compatible" is true only at the type level
(the Tester said this; I agree and would add a comment/lint rule).

---

## 5. Remaining wrong copy this sweep should have caught

`grep` sweep over `app/ components/ lib/` for `Paid in Send2U`, `simulated`, `Cash due`,
`fronted`, `QR`:

- **Wrong / contradictory, must be judged by the CEO:** `app/(requester)/orders/[id].tsx:577–585`
  (MG2 — cancelled-order pay instruction) and `components/RequesterPaymentCard.tsx:64–79`, where an
  online order in `'pending'` simultaneously renders the caption **"Payment processing"** and a
  **"Pay RM x"** button (`needsOnlinePay` includes `'pending'`), and an online order in
  `'refunded'` renders **"Pay in Send2U now (simulated for this demo)."** (the refund only excludes
  the button). These are the same "contradictory payment copy" family as D1/F1 — one of them
  (the card) was edited by this sweep and left as-is, the other (the caption) was written by it.
- **Correctly worded, no action:** `app/(vendor)/orders/[id].tsx:137–140` (gated on
  `paymentStatus === 'paid'`; COD branch is accurate), `helper-portal/jobs/[id].tsx:967–979`
  ("Cash due" only when COD and not collected/refunded), `confirm.tsx:203–207` (correct for
  COD/unpaid; see MG7 for the refunded edge), `app/(requester)/create.tsx:260,272`,
  `lib/help-content.ts`, `lib/legal-content.ts` (all consistently say "simulated for this demo",
  which matches the platform model), `components/TransactionRecord.tsx` ("Refunded (simulated)").
- **`fronted`:** zero occurrences in user-facing copy — good; `types/domain.ts:172` explicitly
  documents "not a fronted expense".
- **`QR`:** no live helper-QR payment copy; remaining hits are the write-dead legacy column names
  in `services/*` and the legal text *denying* QR transfers ("There are no helper QR codes") —
  consistent with the platform model.
- **Hardcoded duplicates of the payment matrix** (drift risk, not currently wrong):
  `jobs/[id].tsx:977`, `orders/[id].tsx:577–585`, `RequesterPaymentCard.tsx:64–100`. MG3.

---

## 6. CEO decisions required

1. **Changelog paths (now a defect, not just hygiene).** `CHANGELOG.md` and `changelog.md` are one
   inode on a case-insensitive volume, tracked as two index entries. Any "append to both"
   instruction double-writes; this run did exactly that (MG1). Recommend: keep one path (delete
   the other from the index), then fix the duplicated sections.
2. **Authorize or revert the two extra devDependencies.** `@types/node@^26.6.1` +
   `@types/react-dom@~19.2.0` were added outside the plan's authorized dependency set (§5), with a
   lockfile bump. Keep-and-amend the plan, or move to a test-only `tsconfig` and drop them.
3. **Scope call on the residual payment copy (MG2):** fix now (it is a ~6-line conditional in one
   file, plus aligning the `RequesterPaymentCard` `pending`/`refunded` branches) or log as a
   backlog ticket. My position: the cancelled-order pay instruction is reachable, user-facing
   money copy in the exact class this sweep was commissioned to close → fix before calling the
   sweep done. The `RequesterPaymentCard` `pending`/`refunded` wording is pre-existing and can be
   ticketed.
4. **On-device verification / disk.** 2.2 GB free, 89 % used; no tap-through evidence exists for
   any of the 7 fixes, and the export was not re-run by me for that reason. Decide whether a device
   run is in scope at all, or whether unit + bundle evidence is accepted for this sweep.
5. **Does `135d3aff` need its own adversarial pass?** Every other commit had one; this one did not,
   and it is where MG1/MG2 were introduced (see §3, Tester).

---

## 7. What I could NOT verify, and why

- **Anything server-side.** No Supabase/DB access and no `supabase/` directory in the repo, so I
  cannot confirm (a) that the RPC's ratings eligibility really is `paymentStatus ∈ {paid,
  collected}`, (b) that legacy completed orders whose payment state is `'verified'` were
  backfilled — if any remain, the new gate (matching the plan's stated server rule) made them
  **unrateable**, a possible product regression the plan asserted away without evidence, (c) that
  `paymentMethod` on the transaction RPC agrees with the order row, or (d) that `not_collected` /
  `refund_pending` are reachable at all (no writer for them exists in-repo). This is the single
  biggest unverified area of the whole sweep and it belongs to the CEO/DB owner.
- **"No DB touched"** is verifiable only negatively: no `.sql`, migration, seed or `supabase/`
  change exists in `356d1548..HEAD`. A live write through the service-role key in `.env` would
  leave no local trace; I could not audit the remote project.
- **The pre-commit state of the three P0 files.** Nothing recorded it (no stash/WIP artifact), so
  "committed as-is, no logic rewritten" is supported by the diffs matching the plan's prose, not by
  a diff against the original working tree.
- **Rendered UI.** No RN renderer for components (deliberately, per plan §3), so the new caption,
  the `LoadingState` and the `Updating…` caption are verified by reading code, not by execution —
  the same limitation both prior reports state.
- **`npx expo export -p web` / native builds.** Not re-run by me: 2.2 GB free with an ENOSPC abort
  already in this repo's history; a failure would be an environment artifact and a risk to the
  user's volume. Corroborated instead by the post-`135d3aff` `dist` bundle strings (§ AC7).
- **`expo-doctor`, device runs, unchanged-unchanged**: out of scope / not attempted.

---

## 8. Repo hygiene verification (my own)

- `git log --oneline -5` → `135d3aff`, `8cbd3d16`, `282dae3b`, `356d1548`, `b5a8f868`.
- `git status --short` → only pre-existing untracked entries (`.claude/skills/`,
  `SEND2U_TRANSACTION_ARCHITECTURE_AUDIT.md`, `TEAM/`, `agent/`). **Working tree clean;
  `git diff` and `git diff --cached` empty.**
- **Nothing pushed:** `main` = `135d3aff`, `origin/main` = `09cc116d` (ahead 5, of which 3 are this
  sweep's commits and 2 predate it). `refs/remotes/origin/main` unchanged (31 h old); the only
  other ref, `consistent-header-optimization-6d110`, is untouched.
- Reflog shows `8cbd3d16` was **amended twice** (`a246d0fc` → `d6c9886c` → `8cbd3d16`); harmless
  locally (nothing pushed), worth knowing that the pre-amend states are unreachable-by-ref.
- I did not modify, add or delete any repo file; all my probes live in `/tmp/mgr_*`.

---

## 9. Verdict

**NEEDS_FIXES.** Required before this can be called done:

1. **MG1** — de-duplicate the changelog (each sweep entry appears twice) and settle the two-path
   issue so it cannot recur. Both the Coder's validation and the Tester's AC8 check passed this.
2. **MG2** — make the Order Summary caption correct for terminal orders (or use
   `paymentStatusLabel(order.paymentStatus, order.paymentMethod)` and stop hand-rolling the
   matrix), including the null-`paymentMethod` case that already contradicts
   `RequesterPaymentCard`.
3. **MG5** — correct or retract the false "only erased `import type`" statement in the changelog
   (the artifact of record), and reconcile the `8cbd3d16` entry's "hook stays out of scope" line
   with the `135d3aff` test that now exercises it.

Recommended (not blocking): MG4's remaining unread coverage gap, MG7's `confirm.tsx` refunded
copy, the three hardcoded copies of the payment matrix, and the `paymentStatusLabel` optional-arg
footgun. Not defects, no action: F6 (independently verified **correct**, just untested), F7
(unreachable), F8 (pre-existing, out of scope).

This is **not** a build-quality problem — `tsc`, `lint` and 43/43 tests all pass on my run too, and
the money-path fixes are real. It is an **artifact-and-copy** problem: the record of the work is
wrong, and the last, unreviewed commit re-opened the very copy defect class the sweep exists to
close. Neither is hard to fix; both are visible to a user or a judge.

---

# Iteration 2 — Final verification gate (adversarial re-review of `a496ff07`)

**CLASSIFICATION: NEEDS_FIXES**

One-line justification: **both fixes in `a496ff07` are correct and I reproduced them independently**
(the changelog de-duplication is *provably exact* — a full section-multiset diff of
`a496ff07^..a496ff07` shows the only removals were byte-identical duplicates and nothing else moved;
the payment caption is now `null` for every terminal status × method × payment-status combination,
and its null-method fallback is correct for all 12 `PaymentStatus` values), and all four gates pass
on my own run — **but the prior gate's third required item (MG5) was neither fixed nor mentioned**,
while the new entry is titled "review findings closed", so the durable record still overstates its
own completeness in exactly the "record accuracy" class iteration 1 treated as deciding. The
outstanding work is a two-sentence changelog correction, not code.

Reviewed commit: `a496ff07` (HEAD) on `main`. Read-only: the only file written is this one.
All findings below are from commands I ran in this session.

---

## 1. Verdict on the two findings the fix commit claims to close

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| MG1 | Duplicate changelog sections | **FIXED — verified exact** | Section-level multiset diff of `a496ff07^` vs `a496ff07`: exactly two removals (`…Fix sweep iteration 1: QA findings closed` md5 `aa7b307192`, `…Fix sweep: money/state defects + first test suite` md5 `d016ec8591`), each of which had **two** identical copies in the parent (so one surviving copy each = a true de-duplication, not a deletion of content); exactly one addition (the new iteration-2 entry). No other section added, removed or modified. The 12-line file preamble is byte-identical. |
| MG2 | Caption state-blind on terminal orders / null-method contradiction | **FIXED — verified exact** | `terminal = isTerminalOrderStatus(order.status)` is `TERMINAL_ORDER_STATUSES = ['completed','cancelled','disputed']` (`lib/orders.ts:40,47`), so it is `true` for cancelled/disputed/completed. The IIFE's first statement is `if (terminal) return null;` (`app/(requester)/orders/[id].tsx:480`) and the render site is `{paymentCaption ? (<Text …>) : null}` (`:594–598`) — **no empty `<Text>` is emitted**. Enumerated over 3 methods × 12 payment statuses × 3 terminal statuses the caption is `null` in every case. |

### 1a. Changelog numbers, stated exactly (because the commit's own wording is loose)

| Measure | Parent `a496ff07^` | HEAD `a496ff07` |
|---|---|---|
| Lines | 3082 | 3022 |
| `## ` headings (grep count) | 130 | **129** |
| Distinct headings | 128 | 129 |
| Headings occurring more than once | 2 (`Fix sweep iteration 1`, `Fix sweep money/state`) | **0** |
| Headings containing "Fix sweep" | 4 | **3** (iteration 2, iteration 1, money/state) |

So: **128 pre-existing unique entries all survive, each exactly once; 129 `## ` headings at HEAD =
128 + the new entry; 3 headings contain "Fix sweep".** That matches the brief's expectation
(128 historical sections preserved, 3 Fix-sweep headings). The entry's phrase "128 unique sections,
exactly 2 sweep headings" is true only of the de-duplication step it describes (the two previously
doubled entries), not of the file at HEAD — a wording nit, not a defect, recorded here so the count
is not mistaken for an error later.

### 1b. Both paths really are one file, and the worktree agrees with HEAD

```
git ls-files -s CHANGELOG.md changelog.md
  100644 f4ea75ce… 0  CHANGELOG.md
  100644 f4ea75ce… 0  changelog.md
ls -li CHANGELOG.md changelog.md   → both 120914338 (same inode, same size)
git rev-parse a496ff07:changelog.md a496ff07:CHANGELOG.md  → both f4ea75ce…
git hash-object changelog.md CHANGELOG.md                  → both f4ea75ce…   (worktree == HEAD)
git ls-files -v                                            → "H" for both (no assume-unchanged/skip-worktree flag)
```
The dual-path hazard iteration 1 raised is *acknowledged* in the new entry's Limits/decisions line
as a CEO decision — honest, and the reason it cannot silently recur undetected is that a future
double-append would now show up as new duplicate headings in a single file. `core.ignorecase=true`.

### 1c. MG3 (third hand-rolled copy of the payment matrix) — still true, quantified

The fix moved the caption to `:475–489` and made the `.tsx` matter *worse* on one axis: the rail
branches now override the status for every state except `paid`/`collected`, so for **20 of the 24
(method ∈ {online, cod}) × status** combinations the caption disagrees with the tested
`paymentStatusLabel(status, method)` — the exact drift MG3 warned about. The null-method path is the
only one routed through the tested function. This is an architectural residue, not a wrong-output
bug (see I2-2 for the one combination that yields wrong copy).

---

## 2. New / remaining defects

### I2-1 — MEDIUM — a required item from iteration 1 (§9 item 3 = MG5) is still open, and the new entry is titled "review findings closed"

Iteration 1's verdict listed **three** required items: MG1, MG2 **and MG5** ("correct or retract the
false 'only erased `import type`' statement … and reconcile the `8cbd3d16` entry's 'hook stays out
of scope' line"). `a496ff07` fixed the first two. MG5 is untouched, and the new entry does not
mention it, while its heading claims *all* review findings are closed and its Reason bullet names
only "a high-severity documentation defect and a re-opened instance of the copy-defect class".

Reproduction (reads only):
```
grep -n "erased\|type-only" changelog.md
  107:  natively and the tested modules use only erased type-only imports, so no
       108:  bundler/Jest/RN transform was added.
grep -n "^import" lib/unread.ts
  1:import { useSyncExternalStore } from 'react';      ← a TESTED module with a runtime import
grep -n "useSharedUnreadCount" changelog.md
   62:  …the new unread test now reads the store back through `useSharedUnreadCount` (iteration-1 entry)
  123:  …`useSharedUnreadCount` and all React/RN/Supabase modules stay out (money/state entry)
```
So the record at HEAD simultaneously states (line 62) that `useSharedUnreadCount` **is** exercised by
the test and (line 123) that it **stays out**, with the false "only erased type-only imports"
justification in between at line 107 — and nothing in the new entry reconciles or retracts either.
The operative half of line 107 ("no bundler/Jest/RN transform was added") *is* true; the premise
clause is what is false. Severity is low, but it is (a) explicitly required by the previous gate,
(b) in the artifact the plan calls canonical, and (c) now covered by a heading that asserts
closure. That combination is what forces NEEDS_FIXES rather than READY_FOR_CEO_REVIEW.

**Required fix (documentation, ~2 lines):** amend the iteration-2 entry (or add a dated correction)
to retract the "only erased type-only imports" clause, note that `lib/unread.ts` runtime-imports
`react` and is exercised through `react-dom/server`'s `renderToString`, and mark the money/state
entry's "hook stays out" line as superseded by iteration 1. Do not silently rewrite another entry's
history; a correction line is fine.

### I2-2 — LOW — the fix deleted the only `Refunded by Send2U.` branch; non-terminal `refunded` now reads "Not paid yet"

Old caption (`135d3aff`) for `paymentMethod === 'online' && paymentStatus === 'refunded'` →
`Refunded by Send2U.` New caption → `Not paid yet — pay in Send2U when your order is ready.`
(`:487`). The new matrix is **not a superset of the old one** on the non-terminal domain: the same
state is now correct only when the caption is suppressed (terminal) or when `paymentMethod` is
`null` (fallback → `Refunded`). Same shape for `refund_pending` → "Not paid yet"/"Cash due", and
`cancelled` → "Not paid yet"/"Cash due" on a non-terminal order.

Reproduction: transcribe `:475–489` and evaluate — for `status='delivered'`, `method='online'`,
`ps='refunded'` the old code returned `Refunded by Send2U.` and the new code returns
`Not paid yet — pay in Send2U when your order is ready.` (Both strings verified absent/present in
`dist/` as noted in §5.)

**Reachability: I could not demonstrate it, and in-repo documentation argues it is unreachable** —
refunds are attributed to cancellation (`types/domain.ts:299` "Cancelled orders end at cancelled (or
refunded when money was recorded)", `services/orders.ts:552–557`) and late cancellation moves to
`disputed`; both are terminal. The only documented route from a terminal state back to a
non-terminal one is `withdrawDispute`, which resumes at `delivered` (`services/orders.ts:645–650`)
but is reachable only for the four requester-opened reasons (`WITHDRAWABLE_REASONS`,
`app/(requester)/orders/[id].tsx:44–49`), which `openDispute` documents as "only from `delivered`
(pre-payment, so payment history can never overlap a dispute)". `refund_pending` has no writer
anywhere in the repo. **Disposition: residual risk, not a demonstrated defect.** The one-line
superset fix (route the residual through `paymentStatusLabel(order.paymentStatus, order.paymentMethod)`
instead of hand-rolling the rail branches) removes it and simultaneously closes MG3.

### I2-3 — LOW — matrix ordering makes two impossible-but-harmless states wrong-railed (informational)
Because `paid`/`collected` are tested before `paymentMethod`, a `(cod, paid)` order reads
"Paid in Send2U (simulated for this demo)" and an `(online, collected)` order reads "Cash collected
on delivery". No writer for either combination exists in the repo; recorded so the next reader does
not rediscover it.

### R-items carried over (unchanged, all pre-existing, none introduced by `a496ff07`)
- **RequesterPaymentCard `pending`/`refunded` contradiction** (`components/RequesterPaymentCard.tsx:74–96`):
  an online order in `pending` renders "Payment processing" *and* "Pay RM x" (again at
  `components/RequesterPaymentCard.tsx:84`), and `refunded` renders "Pay in Send2U now". Flagged by
  iteration 1 as ticketable; this commit neither worsened nor fixed it. Its null-method branch
  (`:99–108`) still treats `null` as COD — now consistent with the caption's new fallback only by
  accident (the caption is rail-neutral, the card says cash); the *contradiction* iteration 1 named
  is gone because the caption no longer claims online for `null`.
- **MG3** (three hand-rolled copies of the payment matrix): still three.
- **MG4** (unread duplicate-emit half still uncovered), **MG7** (`confirm.tsx:203–207` "Finish your
  online payment" for a refunded order), `paymentStatusLabel` optional-arg footgun: unchanged.
- **`npx expo export -p web` disk risk** (2.2 GB free) remains a CEO item.

---

## 3. Fresh-eyes copy sweep (every payment string in `app/` + `components/`, judged against real state)

`grep -rn "Paid in Send2U|simulated|Cash due|Not paid yet|fronted|Cash collected|Pay in Send2U|Payment due|Refunded by Send2U" app components lib` — 30 hits, all read:

| Site | Judgement |
|---|---|
| `orders/[id].tsx:481–487` (the fixed caption) | Correct for every reachable non-terminal state; suppressed on terminal. |
| `orders/[id].tsx:186` cancelled card "You owe nothing." | Correct. |
| `orders/[id].tsx:668,708` cancel/report notes ("recorded as refunded when cancelled before completion") | Correct and consistent with the platform model. |
| `orders/[id].tsx:56–200` `statusCardFor` — `pending` + online + not paid → "Complete your online payment to fire the kitchen"; `confirmed` + not paid/collected + online → "Finish your online payment…" | Consistent with the caption's own pay prompt (same state, same instruction). Not reachable in contradiction because both are non-terminal-gated and `confirmed` is non-terminal; no false "paid". |
| `components/RequesterPaymentCard.tsx:83–84,106–107` | `failed` → "you were not charged" is accurate; the `pending`/`refunded` cases are R-item above. |
| `components/TransactionRecord.tsx:38,56` — "Cash collected" row only when `codCollectedCents != null`; "Refunded (simulated) — no real money moved." only when `refundedAt` set | Correctly state-gated; this is why suppressing the terminal caption loses no information (§4). |
| `app/(vendor)/orders/[id].tsx:137–140,150–156` | Method + status both from the tested labels; online-unpaid → "Waiting for the customer payment. Do not prepare yet."; COD note is accurate. |
| `app/(requester)/helper-portal/jobs/[id].tsx:967–979` | `codDue` excludes `collected` **and** `refunded`; "the cash belongs to Send2U" matches the model. |
| `app/(requester)/orders/[id]/confirm.tsx:195–207` | COD branches accurate; online+`refunded` falls to "Finish your online payment…" = MG7 (pre-existing, not this commit). |
| `app/(requester)/orders/[id]/pay-online.tsx:73–91,124,154,163` | COD → "Nothing is due now"; cancelled/disputed → "no longer payable"; "You were not charged." on failure. No contradiction found. |
| `app/(requester)/orders/confirmation.tsx:163,300–320` | COD → cash copy; online && `payStatus !== 'paid'` → "complete its online payment"; Pay button gated to `pending/failed/unpaid`. Consistent. |
| `lib/help-content.ts:34,46,86`, `lib/legal-content.ts:36,42,70`, `create.tsx:260,272` | All consistently "simulated for this demo", "no helper QR transfers". Consistent with the platform model. |
| **`fronted`** | Zero occurrences in user-facing copy (`types/domain.ts:172` documents the negative). |

No *new* contradictory money copy found outside I2-2/I2-3.

---

## 4. Does suppressing the caption lose information? (checked, no)

For terminal orders the screen still renders `<TransactionRecord orderId={order.id} />`
(`:736–737`), whose rows are Method / Payment (`paymentStatusLabel(status, method)`) / Amount /
Cash collected / settlement split, plus "Refunded (simulated)…" when `refundedAt` is set
(`components/TransactionRecord.tsx:33–58`). So a completed paid order still shows "Paid"; a
cancelled refunded order still shows "Refunded". The caption's removal is information-neutral on
terminal orders — good design, and worth stating because iteration 1's "the transaction record …
already cover them" claim is now verified by reading both files.

---

## 5. Gates re-run by me (not inherited)

| Gate | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | **exit 0**, no output |
| Tests | `npm test` | **43/43 pass, 0 fail** (`1..43`) — matches the entry's claim |
| Lint | `npx expo lint` | **exit 0** |
| Export | `npx expo export -p web` | **not re-run** (2.2 GB free; reiterating iteration 1's reasoned skip) — **corroborated instead**: `dist/_expo/static/js/web/entry-2b5997cd….js` (2.84 MB, mtime `Sep 18 23:39`, commit `a496ff07` = `23:39:36`) contains `Not paid yet` ×1, `Cash due on delivery` ×1, `Cash collected on delivery` ×1, `Paid in Send2U` ×1, and **zero** occurrences of `Refunded by Send2U` — a string that existed only in the pre-fix caption. The bundle therefore contains *post*-`a496ff07` code, and it is a new bundle hash relative to iteration 1's observation (`entry-4ec91fee…`). The entry's "export pass" claim holds on the fixed code. |
| Working tree | `git status --short` | exactly the four pre-existing untracked entries (`.claude/skills/`, `SEND2U_TRANSACTION_ARCHITECTURE_AUDIT.md`, `TEAM/`, `agent/`); `git diff` and `git diff --cached` empty; `git diff HEAD -- 'app/(requester)/orders/[id].tsx'` empty. |

**Scope of `a496ff07`:** exactly 3 files (`CHANGELOG.md`, `changelog.md`, `app/(requester)/orders/[id].tsx`), +76/−183. The `.tsx` change is two hunks only: the `paymentStatusLabel` import, the IIFE, and the JSX replacement. `tsconfig.json`, `package.json`, `package-lock.json` untouched by this commit (so the §5 dependency breach remains an open CEO item, unchanged).

---

## 6. Repo hygiene, push state, DB/SQL

- `main` = `a496ff07`, `origin/main` = `09cc116d` (`git rev-list --left-right --count origin/main...main` → `0  6`): **six commits ahead, nothing pushed**; `refs/remotes/origin/main` mtime `Sep 17 17:07` (predates the sweep). The other branch ref, `consistent-header-optimization-6d110`, is untouched.
- Range `356d1548..a496ff07` = exactly the four sweep commits (`282dae3b`, `8cbd3d16`, `135d3aff`, `a496ff07`); `git diff --name-only` over it lists 19 files, **none** matching `\.sql|migration|supabase`. There is **no `supabase/` directory** in the repo and `git ls-files '*.sql'` = 0 files. No legacy column touched.
- Reflog confirms `8cbd3d16` was amended twice (`a246d0fc` → `d6c9886c` → `8cbd3d16`) — local only, nothing pushed, so no unreachable-content risk for anyone else.
- I wrote nothing except this file (`TEAM/` is untracked, so appending here does not dirty the index).

---

## 7. What I could NOT verify

- **Server-side reality (unchanged from iteration 1, still the largest hole).** No Supabase access and no `supabase/` in the repo: I cannot confirm the RPC's ratings gate, whether legacy `'verified'` payments were backfilled, whether `paymentStatus` on a cancelled/disputed row is `refunded` vs `cancelled`, or whether `not_collected`/`refund_pending` are reachable. **This is what caps I2-2 at LOW**: its reachability depends entirely on the server, and the in-repo documentation says the state is terminal-only.
- **Rendered UI.** No RN renderer in the test suite, so the caption/`loading`/`Updating…` strings are verified by reading the current source and by the exported bundle, not by executing a device render. Tap-through remains un-evidenced for all sweep changes.
- **`npx expo export -p web`, `expo-doctor`, native builds, device runs** — not re-run by me (see §5 for the corroboration instead).
- **The pre-commit working-tree state of the P0 files** — still unrecorded by anyone; AC1's "committed as-is" remains supported by prose, not by evidence.

---

## 8. Challenges

- **Coder (this iteration):** the engineering fixes are right, but the coverage claim is not: the entry is titled "review findings closed" while one of the three items the review listed as *required* was neither addressed nor listed in Limits/decisions. Before writing "closed", the Coder should have walked the reviewer's own numbered verdict list. Note also that the quality of the two fixes is high precisely where iteration 1's advice was followed literally (de-dup verified by reading the file back; the tested label reused for the fallback) — the lesson generalises: reuse `paymentStatusLabel` for the *whole* caption instead of the remaining rail branches (that also closes MG3, I2-2).
- **Manager (iteration 1) / this gate:** my own list is now the one that must not over-close. If the CEO chooses to accept the MG5 wording as-is, the honest way to record that is an explicit "not closed — accepted by CEO" line rather than a heading that implies otherwise.
- Credit: the de-duplication was done the *correct* way (delete only the byte-identical duplicate, keep the surviving section's content byte-for-byte, prove it with counts) rather than by rewriting the file; the terminal gate is placed before the string construction, not inside the render; and the null-method case was routed to the tested function — all three are exactly right.

---

## 9. Iteration 2 verdict

**NEEDS_FIXES** — one required item, documentation only:

1. **I2-1 / MG5** — retract or correct the false "the tested modules use only erased type-only
   imports" clause (`changelog.md:107`) and reconcile the money/state entry's "`useSharedUnreadCount`
   … stay out" line (`:123–124`) with the iteration-1 test that exercises it (`:62`); and stop the
   iteration-2 heading from implying all review findings were closed while this one was open.

Everything else is verified good: MG1 fixed and provably exact (128 pre-existing entries intact, one
copy each, no other content touched, both paths one blob, worktree == HEAD); MG2 fixed (caption
`null` on all 3 terminal statuses × all methods × all statuses, correct for every reachable
non-terminal combination, null-method fallback correct for all 12 payment statuses via the tested
function, no empty `<Text>`); `tsc`/43-43 tests/`lint` green on my run; export corroborated against
a bundle that contains the post-fix code; nothing pushed; no SQL/migration/supabase file in any of
the four commits.

Recommended (not blocking): the one-line `paymentStatusLabel(status, method)` superset for the
caption residual (I2-2 + MG3), the ticketable `RequesterPaymentCard` `pending`/`refunded` wording,
MG4's unread-emit coverage half, and the two unwritten AC8/MG4 caveats.
