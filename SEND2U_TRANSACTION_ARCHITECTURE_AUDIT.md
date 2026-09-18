# Send2U Transaction Architecture Audit

**Date:** 2026-09-18
**Scope:** Full transaction/payment architecture audit before migration from the helper-financed model to a platform-managed model.
**Method:** Direct inspection of source (`app/`, `components/`, `hooks/`, `services/`, `lib/`, `contexts/`, `types/`), live database schema (tables, columns, CHECKs, FKs, indexes implied by constraints), all `pg_proc` bodies for transaction RPCs, triggers, RLS policies (public + storage), realtime publication, edge functions, migrations list, `package.json` / `app.json` / `.env.example`, and row counts.
**Constraint honored:** Audit only. No source, migration, data, RLS, or schema changes were made. Row counts below are read-only observations as of the audit.

> Data note: the auth roster changed out-of-band before this audit (all requester/helper dev accounts are gone; 3 Gmail users + 6 email-less users + 6 vendors remain; 9 profiles, 1 order, 1 item, 1 payment, 1 rating, 7 notifications, 1 push token). Findings below describe architecture, not this transient fixture data.

---

## Executive Summary

Send2U today implements a **helper-financed, externally-settled** transaction model with **zero in-app money movement**:

1. Requester creates order(s) via `send2u_place_orders` (one row per vendor, `pending`, fee fixed RM2.00 server-side).
2. Helper claims via `send2u_accept_order` (advisory-locked, 3-active cap, atomic).
3. Helper advances `assigned → going_to_vendor → at_vendor → food_available → food_purchased → picked_up → out_for_delivery` via `send2u_helper_advance`. The `purchase` step snapshots `food_cost_cents = subtotal_cents` — **this is the moment the helper finances the food with their own money**. There is no platform funding, no vendor charge, no escrow.
4. Helper marks `delivered`; requester confirms (`send2u_confirm_delivery` → `confirmed`).
5. Requester pays the helper **outside the app** (own banking app → helper's personal QR from `send2u_profiles.payment_qr_path`), uploads the receipt, and `send2u_submit_payment` self-attests `verified` and closes the order to `completed` in one statement. No helper review, no gateway, no webhook.
6. Settlement is **manual and external** (`SettlementRecord` renders only after admin `send2u_resolve_dispute`; disputes preserve a `food_cost` liability flag for out-of-band settlement). Refunds do not exist. COD does not exist. Online payment does not exist. Commission does not exist. Wallets/ledgers do not exist.

The database **cannot** distinguish payment method, cannot represent COD collection, helper earnings, vendor settlement, commission, settlement status, refunds, or failed payments. Payment state (`submitted/verified/rejected`) exists but is coupled to the order lifecycle (submit requires `confirmed`; submit closes the order). Order cancellation **hard-deletes** pre-purchase rows, so cancelled transactions leave no record.

Race safety is genuinely good for the current model (advisory lock + guarded single-statement UPDATEs + server-derived amounts + evidence-existence checks). RLS is SELECT-only on transaction tables with all writes through `SECURITY DEFINER` RPCs gated on `auth.uid()` — a sound foundation to reuse.

---

## Current Transaction Architecture

### The money path (every step verified in code + RPC bodies)

| Step | Actor action | Code / RPC | Money movement |
|---|---|---|---|
| Browse/menu | View vendors/items | `useMenu()` → menu sections; `services/menu.ts` | None |
| Cart | Add items, pick drop-off | `contexts/CartContext.tsx` (in-memory; "No fees, checkout, or payment here"), `app/(requester)/create.tsx`, `app/(requester)/location.tsx` | None; fee shown as `est.` via `ESTIMATED_DELIVERY_FEE_CENTS = 200` (`lib/orders.ts:137`) |
| Submit | `placeOrders()` sends ids+qty only | `services/orders.ts:226` → `send2u_place_orders` | None. Server derives prices/snapshots, splits per vendor, fee hardcoded `200`, generates dead `pickup_code` |
| Accept | Slide to accept | `acceptOrder()` → `send2u_accept_order` | None |
| Advance | Go/arrive/available/**purchase**/pickup/start/deliver | `advanceFulfilment()` → `send2u_helper_advance` | **`purchase` = helper pays vendor out-of-pocket** (`food_cost_cents = subtotal_cents`). No platform funds involved |
| Confirm | Requester confirms receipt | `confirmDelivery()` → `send2u_confirm_delivery` (`delivered`→`confirmed`, atomic) | None |
| Pay | Requester pays helper in banking app, uploads receipt | `usePaymentFlow.confirm()` → upload to `evidence/<uid>/…` → `submitPaymentEvidence()` → `send2u_submit_payment` | **Outside the app.** In-app effect only: payment row `verified` + order `completed` |
| Settle | Nothing automatic | Admin `send2u_resolve_dispute` (no UI); `SettlementRecord` copy: "manual settlement outside Send2U" | External/manual only |
| Refund | Does not exist | Copy only: "no automatic refund" (`orders/[id].tsx:622`, `lib/help-content.ts:84`, `lib/legal-content.ts:43`) | N/A |

### Core invariant (current)

`orderTotalCents(subtotal, fee) = subtotal + fee` (`lib/orders.ts:146-148`, "added exactly once") is the single payable-total definition. The helper's earning is **only** `delivery_fee_cents` (RM2.00); the requester always pays food + fee externally.

---

## Target Transaction Architecture

(Per the audit brief; for comparison only — nothing here is implemented.)

- Requester checks out choosing **Online Payment** or **COD**; Send2U owns transaction + payment state.
- Cafeteria prepares on platform-confirmed orders; helper never finances food.
- Helper delivers; COD cash (full amount) is collected and recorded as platform money, **not** helper earnings; online payments settle through a provider.
- Ledger distinguishes customer payment, vendor amount, delivery fee, helper earning, commission, settlement status, refunds.

---

## Current Order Lifecycle

**Live DB states** (`send2u_orders_status_check` CHECK — 13 values, verified live):
`pending → assigned → going_to_vendor → at_vendor → food_available → food_purchased → picked_up → out_for_delivery → delivered → confirmed → completed`, plus `cancelled` (stored but currently unwritable — see below) and `disputed`.

State drivers (all single-statement atomic, ownership + status guarded):
- `send2u_place_orders` → `pending` (per-vendor rows).
- `send2u_accept_order` → `assigned`. Protections: `pg_advisory_xact_lock('send2u_accept:' || helper)` + 3-active cap count + `WHERE status='pending' AND helper_id IS NULL` guarded UPDATE (exactly one winner).
- `send2u_helper_advance` (11 actions: `go_to_vendor, arrive, report_food_available, report_food_unavailable, purchase, mark_picked_up, start_delivery, mark_delivered, report_failed, abandon, release`). Each branch is one UPDATE with `helper_id = auth.uid()` + exact-status predicate; failures raise `Invalid action for the current order state`. Notable: `report_food_unavailable` **hard-deletes** the row (returns `{deleted: true}`); `release` returns to `pending`/NULL helper; `abandon`/`report_failed` → `disputed` with `helper_unable`/`delivery_failed`.
- `send2u_confirm_delivery`: `delivered`→`confirmed`, owner-only, atomic.
- `send2u_submit_payment`: requires `confirmed` + helper assigned; writes `verified` + sets `completed` in the same function.
- `send2u_cancel_order`: pre-purchase states → **hard DELETE** (row + cascaded items/payments/notifications/ratings vanish; "cancelled orders are never stored"); post-purchase (`food_purchased/picked_up/out_for_delivery`, incl. legacy `purchased/delivering` strings) → `disputed`/`late_cancellation` preserving `food_cost_cents` + `cancel_reason/cancelled_by/cancelled_at`. Nothing else can produce `cancelled`, so the CHECK member is stored-unreachable except via admin `resolve_dispute(resolution='cancelled')` — which itself **deletes** the row.
- `send2u_open_dispute` (requester, `delivered` only, 4 reasons) / `send2u_withdraw_dispute` (own unresolved requester-category disputes back to `delivered`).
- `send2u_resolve_dispute`: **admin role-gated** (`profiles.role='admin'`); `completed` stamps `resolution/resolved_at/resolved_by(+note)`; `cancelled` deletes the row. **No admin UI exists anywhere in the repo** — settlement is currently unoperable in-app.
- Dispatch: `trg_send2u_order_dispatch` (AFTER INSERT) + `trg_send2u_order_release_redispatch` (AFTER UPDATE) call `send2u_dispatch_next` (availability count + throttled `order.dispatch_failed` notice); failures swallowed (`EXCEPTION WHEN OTHERS THEN NULL`) so dispatch can never break writes. `set_helper_availability` re-checks up to 5 pending orders.

Client display vocabulary in `lib/orders.ts` / `types/domain.ts` retains legacy strings (`accepted, preparing, ready_for_pickup, delivering, awaiting_requester_payment, purchased`) that the DB CHECK rejects — defensive display compat only.

---

## Current Payment Architecture

- **Representation:** `send2u_payments` — one row per order (`order_id` UNIQUE): `amount_cents` (= subtotal + fee snapshot), `evidence_path`, `status ∈ {submitted, verified, rejected}`, `submitted_at/verified_at/verified_by`, timestamps. No method, no provider ref, no attempt log, no failure record.
- **Creation:** only via `send2u_submit_payment(order_id, evidence_path)`. Guards: authenticated owner-requester; order `confirmed` + helper assigned; evidence path must match `^evidence/<uid>/.+` **and exist in `storage.objects`**; double-submit rejected (`already submitted/verified`). A `rejected` row may be overwritten by resubmission (UPDATE branch) — the only "retry" path.
- **Verification:** none by any party — the requester's own submit writes `verified`/`verified_by = requester` (self-attestation) and closes the order. `send2u_review_payment` was dropped (`drop_review_payment_function`); help/legal copy still says "so the helper can verify it" — **stale copy, no such step exists**.
- **Exposure:** `send2u_payment_context` returns `helper_qr_path` (from `profiles.payment_qr_path`), amounts, payment row to both parties; queue/pending view suppresses QR + pickup code.
- **QR system:** helper uploads personal QR image (`qr/<uid>/<ts>[_name].ext`, square-cropped at pick) in `send2u-private`; pointer on own profile; replace = remove-old-first; requester renders via signed URL + download. Missing-QR branches block payment UI with "don't pay anyone outside this QR."
- **Evidence system:** PDF/JPG/PNG/WEBP/HEIC ≤10MB via document picker, staged confirm-first, `evidence/<uid>/<order>_<ts>[_name].ext`, orphan cleanup on failure, replace-removes-old on resubmit.

---

## Current COD Support

**None.** Zero code hits for COD/cash handling. No cash-collection action (`FulfilmentAction` is strictly the 11 lifecycle verbs), no collected-amount field, no unpaid/settled payment states, no cash-handoff UI on either side.

---

## Requester Audit

Flow `Home → vendors/[id] → menu/[id] → create → location → confirmation → orders → orders/[id] (+ payment/receipt/confirm/rate children)`:
- **No payment-method selection** (verified by grep: no `paymentMethod`/`payment_method`/COD/cash UI or fields; sole rail is external-QR + receipt).
- Helper QR exposed on payment card + payment screen; receipt upload gated on QR presence; amounts always server-derived (`getPaymentContext`); submit closes order immediately.
- Order vs payment status: lists show **order status only** (`requesterStatusMessage`); payment state appears only inside payment card/detail history. Statuses are visually separate but semantically coupled (payment exists only post-`confirmed`; submit forces `completed`).
- Cancelled transactions are **deleted, not stored** (clean path) — history shows only completed/disputed/cancelled-from-dispute records; `cancelled` CHECK member is otherwise unreachable.
- UI depends on helper-pay model throughout: status copy ("Your helper will pay for and collect them", "Your helper paid for your items"), late-cancel liability warning ("The helper already paid for your food… settle it with them directly"), payment steps ("Scan the provided QR… Helper … will receive this payment directly"), `OrderTimeline` "{amount} fronted by helper", legal/help docs ("Helpers buy your food upfront", "Send2U never touches your money").
- Realtime: `send2u_orders` (unfiltered on lists; id-filtered on detail/confirmation) + `send2u_ratings`; **no direct `send2u_payments` subscription** — payment freshness arrives via order echoes + focus/token refetch (`usePaymentFlow` stale-while-revalidate, realtime failure silent by design).
- Duplicate submission: client flags (`submitting/busy/confirming/cancelling/reporting`) + required inputs; server single-statement atomicity + double-submit rejection; `placeOrders` has **no idempotency key** (dedupe is reads-only) — rapid double-tap relies on the `submitting` flag; post-success `back()+push` strands the emptied cart out of history.

---

## Helper Audit

- Queue rows show **no money** by design; decision view shows item lines + `Your delivery fee` (no summed food total, no "you pay" warning pre-accept).
- The helper **must pay out-of-pocket at `collect`**: `foodCents = foodCostCents ?? subtotalCents`; UI: "Check that your order is available, then pay with your own money and collect it", "Food cost (you pay)", "You pay {X} now… You will receive {Y} as your delivery fee." `purchase` RPC snapshots `food_cost_cents = subtotal_cents`.
- Helper sees: item lines, food cost (collect only), `+fee` everywhere, never `orderTotalCents` in-workspace (only deliveries-list subtitle shows a total). No payment status/receipt visibility in the active workspace; history shows payment record read-only.
- No earnings dashboard/aggregation; "earnings" = per-row `+fee`; settlement explainer: "Payouts total your completed delivery fees; food costs you fronted are reimbursed separately by requesters."
- No COD/cash/commission/settlement mechanics; completion auto-returns to Deliveries.
- Capacity: 3-active cap enforced race-safely in `accept_order`; UI mirrors it.

---

## Cafeteria/Vendor Audit

- Vendor app is **stall + menu only** (`services/vendor.ts`: "Option A"; RPCs `send2u_update_vendor_profile`, `send2u_upsert_menu_item`, `send2u_delete_menu_item`; reads own stall + items). Header comment: "Vendors never see orders here."
- **Orders never reach vendors**: no order list/detail/query, no payment-status visibility, no paid/unpaid/COD distinction, no settlement info, no preparation-status toggle (only catalog `is_available` + stall `is_open` visibility switches), no pickup verification (`pickup_code` never referenced in vendor code).
- Snapshots decouple vendor edits from history (`order_items.menu_item_id SET NULL` on delete; prices/names snapshotted at placement).

---

## Backend Audit

- **Query pattern:** tables are SELECT-only for clients; every write goes through `SECURITY DEFINER` RPCs (16 client-invoked RPCs inventoried; `send2u_resolve_dispute` admin-only, never invoked from client). Server derives identity, prices, snapshots, amounts, states — clients send ids/quantities/paths only.
- **Atomicity:** accept (advisory lock + guarded UPDATE), all advances, confirm, disputes, rating (eligibility + once-per-party + immutable), vendor writes (ownership server-side). `place_orders` uses a temp table + per-vendor loop; multi-order placement is **not** one atomic statement across vendors (partial placement possible — client surfaces per-order results; NOT VERIFIED whether a failure mid-loop rolls back prior inserts — function has no explicit transaction control beyond the implicit per-call transaction: plpgsql functions run in the caller's transaction, so a mid-loop error aborts the whole call. Marking the loop itself as atomic-by-transaction; verified from function body structure, no explicit SAVEPOINTs).
- **Race matrix (current model):** double-accept → single winner (lock + predicate). Double-submit → rejected by status check. Double-confirm → single winner (predicate). Double-rate → existence check **plus** unique index `send2u_ratings_order_id_from_user_id_key` on `(order_id, from_user_id)` (verified live) — concurrent double-submit fails safe at the constraint. Concurrent purchase vs requester-cancel → whoever's predicate matches first wins; loser gets invalid-action/cannot-cancel; both are single statements — no torn state, but no cross-serialization between helper-advance and requester-cancel beyond status predicates.
- **New-model races with NO protection today:** duplicate provider callbacks (no idempotency-key column, no webhook table), duplicate COD confirmation (no collected flag/column), duplicate settlement (no ledger, no unique settlement record), payment-after-cancel (no `paid` state distinct from order state; a success arriving after clean-cancel finds the row deleted), helper-cancel-after-accept on paid/COD orders (no paid-aware release path; `release` only handles pre-purchase states), vendor rejection (no such actor/action), failed online payment (no `failed` state), COD-not-collected (no state), partial/full refunds (no mechanism; `disputed` + manual only).
- **Triggers:** `send2u_orders_notify_event` (AFTER UPDATE OF status, fires `send2u_notify_order_event` → notification rows for 7 milestone statuses + push fan-out via pg_net; actor-skipped; guarded so fan-out can never roll back transitions), `send2u_profiles_guard_immutable` (blocks id/role/dev-flag changes), `trg_send2u_order_dispatch` (AFTER INSERT), `trg_send2u_order_release_redispatch` (AFTER UPDATE) — both swallowing errors.
- **Realtime publication:** `send2u_vendors, send2u_menu_items, send2u_orders, send2u_payments, send2u_notifications, send2u_ratings` (profiles/locations/tokens excluded).
- **Edge functions:** exactly one — `dev-switch-profile` (dev test-account sign-in minting; unrelated to transactions).
- **Validation:** strict server-side everywhere (UUID/quantity regexes, 1–99 qty caps, ≤500-char texts, 5–10MB file caps, evidence-path regex + existence check, receipt MIME allowlist).

---

## Database Audit

**Tables (10, row counts as observed):** `send2u_vendors` (6), `send2u_menu_items` (28), `send2u_profiles` (9), `send2u_delivery_locations` (6), `send2u_orders` (18→1 at audit time, roster changed out-of-band), `send2u_order_items`, `send2u_payments`, `send2u_notifications`, `send2u_ratings`, `send2u_push_tokens` (platform column dropped 2026-09-18 as unused).

**`send2u_orders` columns (31):** `id, requester_id, vendor_id, delivery_location_id, status, subtotal_cents, created_at, updated_at, helper_id, accepted_at, delivery_fee_cents, pickup_code, arrived_at, purchased_at, food_cost_cents, delivered_at, cancelled_at, cancelled_by, cancel_reason, dispute_reason, dispute_note, disputed_at, resolved_at, resolved_by, resolution, going_to_vendor_at, food_available_at, picked_up_at, out_for_delivery_at, confirmed_at, dispute_details`.
- Transaction representation: `status + subtotal_cents + delivery_fee_cents + food_cost_cents + *_at timestamps`. Payment coupled via `send2u_payments.order_id` UNIQUE.
- `pickup_code`: written at placement, exposed in `payment_context`, **never verified** (verification removed; dead field, keep-or-drop decision needed).
- `cancelled` status + `cancelled_at/by/reason`: near-dead (clean path deletes; only dispute-origin rows carry them).
- No `payment_method`, `paid_at`, `cod_*`, `commission_*`, `settlement_*`, `refund_*`, `attempt_*`, `idempotency_*` columns anywhere.

**Answers to the brief's 19 DB questions:**
1. Transaction = `send2u_orders` row + snapshots + timestamps. 2. Payment = `send2u_payments` row (0–1 per order). 3. Yes, tightly coupled (UNIQUE order_id; submit requires `confirmed` and forces `completed`). 4–5. No method distinction possible. 6. Partially: payment `status` exists but lifecycle-coupled. 7. No COD representation. 8. Earnings derivable only as `delivery_fee_cents` per completed row (no aggregation/ledger). 9–11. No vendor settlement, commission, or settlement status. 12. No refunds (only `disputed` + external). 13. No failed-payment state. 14. Duplicates prevented only for submits/accepts/confirms/ratings (predicate-based); settlement/payment-callback idempotency absent. 15. Current-model races covered (locks + guarded UPDATEs); new-model races uncovered (see Backend Audit). 16. FKs sound (order delete cascades to items/payments/ratings/notifications; menu-item delete SET NULL preserves snapshots; user delete cascades profiles/notifications/tokens/ratings, SET NULLs helper/audit refs — verified live after the 2026-09-17 user cleanup with zero dangling refs). 17. RLS is SELECT-only + RPC writes: compatible as a *pattern*, but every policy/RPC touching helper-QR exposure, requester-pays-helper copy, and fronted-cost liability must change. 18. Candidates: `pickup_code` (dead), `cancelled*` columns (near-dead by hard-delete), `food_cost_cents` semantics must invert (platform-funded, not fronted), `payment_qr_path`/`profiles.payment_qr_path` (helper-QR model obsolete), `payments.status='rejected'` + evidence-resubmit path (gateway model replaces), `awaiting_requester_payment`-era leftovers in client display vocabulary. 19. Missing: payment-method + attempt ledger, COD collection record, settlement ledger, commission rule store, refund records, idempotency keys, vendor payout accounts, admin ops surface.

---

## Transaction State Audit

- **Order status:** single 13-state CHECK, linear with dispute/exception exits. Clean-cancel and food-unavailable paths **delete** rather than transition — terminal history is therefore incomplete by design (only completed + disputed + admin-cancelled-as-deleted... actually admin-cancelled also deletes; stored `cancelled` rows effectively only from legacy data).
- **Payment status:** `submitted/verified/rejected` exists on paper, but `submit_payment` writes `verified` directly; `submitted` is reachable only transiently/NOT VERIFIED as ever stored by current code paths; `rejected` writable only by... nothing in current RPCs writes `rejected` (submit writes verified; no review RPC) — **dead value** unless legacy rows exist.
- **Settlement status:** absent. `disputed` + `food_cost` liability + external/manual copy only.
- Target separation (order/payment/settlement ledgers) does not exist; payment state is a sidecar of order state.

---

## Financial/Settlement Audit

Representable today: customer total (`subtotal+fee` snapshot), vendor amount (derivable as subtotal), delivery fee (fixed 200), helper earning (fee-per-completed, display-only), fronted cost (`food_cost_cents`). **Not representable:** commission, COD collected, settlement amount/status, refunds, outstanding balances, failed attempts. **No wallet, no balance, no ledger, no aggregation query** (verified by repo-wide search; only prose mentions of "payout"/"earning" meaning the fee). Per the brief: do NOT build a consumer wallet; an internal settlement ledger is the appropriate target structure.

---

## Security/RLS Audit

- **Model:** authenticated-only; transaction tables SELECT-only via ownership/assignment/queue/capability predicates (`select_own/assigned/queue`, payments visible to both parties, ratings to parties, notifications own + UPDATE own for read_at); all writes via `SECURITY DEFINER` RPCs checking `auth.uid()` (+ role/capability where needed); `send2u_profiles_guard_immutable` blocks id/role/dev-flag writes; role CHECK `requester/vendor/admin`; vendor RPCs derive ownership server-side with anon EXECUTE revoked.
- **Who can what (current):** create orders — any authenticated caller via validated RPC; update payments — nobody directly (RPC only); COD/settlement/earnings — no such operations exist; cancel — owning requester pre/post-purchase rules; disputes — requester (4 reasons, pre-payment) + admin resolve (no UI); ratings — parties on completed+verified, immutable; financial reads — parties only; QR — owner writes, both order parties read.
- **Findings for migration:** (a) helper-QR exposure to requesters must be removed (it *is* the current payment rail); (b) `payment_context` also leaks dead `pickup_code`; (c) legacy `role='helper'` still accepted in predicates (compat, harmless but widen attack surface conceptually); (d) any new money-moving RPC (charge, COD-confirm, settle, refund) must remain definer-gated with ownership + state predicates and must never accept client-supplied amounts — the current codebase already follows this rule everywhere and it must be preserved; (e) dispute/admin paths need a real admin surface or human procedure before volume; (f) push-token table is owner-ALL — fine today (tokens only), must not gain financial columns.

---

## Realtime Audit

- Mechanism: `useRealtimeReload` (debounced reload, silent failure) on `send2u_orders` (+ `send2u_ratings` on details); lists unfiltered (RLS-scoped), details id-filtered; payment screens have **no payments subscription** (order echo + focus/token refetch); writes optimistically patch + `emitOrderChanged` local bus.
- Event coverage today: accepts, advances, releases, confirm, submit (via order `completed` echo), disputes, ratings. Queue discovery is realtime INSERT; dispatch notices via notification rows.
- Stale-state risks: payment context can lag (no direct subscription — acceptable today since submitter sees own write; a second device would lag until focus); list/detail rely on RLS-filtered streams (correct under new model if policies follow the same party-visibility); hard-deletes (cancel/unavailable) arrive as DELETE events — clients handle via missing-row states (verified pattern in code).
- New-model needs: payment-attempt + COD-collection + settlement events need publication + subscriptions (policies must admit the new party/role visibility, e.g. vendor app currently subscribes to nothing order-related); provider webhooks must reconcile via server-side state, never client writes.

---

## Obsolete Architecture

Explicit kill-list for migration (do not delete yet):
1. Helper QR rail: `profiles.payment_qr_path`, `setPaymentQrPath`, `payment-qr.tsx` manager, `qr/*` storage convention, `helper_qr_path` in `payment_context`, requester QR rendering (`RequesterPaymentCard`, `payment.tsx` `DownloadableQR`), missing-QR gates, "don't pay anyone outside this QR" copy.
2. Helper financing: `food_cost_cents` fronted semantics, `purchase` step as self-pay, all "pay with your own money / fronted / reimbursed separately" copy (helper UI, history, timeline, breakdown `frontedCents`, legal/help docs), late-cancel `food_cost` liability model.
3. Receipt self-attestation: `StagedFileCard` receipt flow as *the* payment record, `submit_payment` writes-verified behavior, `rejected`/resubmit path, `ReceiptEvidenceView` as payment proof.
4. Dead fields/flows: `pickup_code` (write-only), `payments.status` trichotomy as posted, `cancelled*` columns under hard-delete, legacy display statuses, `awaiting_requester_payment` client strings.
5. Manual settlement: `SettlementRecord` external-manual model, dispute-as-settlement, "no automatic refunds" policy copy.
6. Role model: `is_verified_helper` as the helper gate can stay, but helper-as-financier assumptions across `accept_order`, queue visibility, and 3-cap logic need re-examination under platform-funded fulfilment (cap is about workload, likely keep).

---

## Gap Analysis

| Area | Status | Notes |
|---|---|---|
| Order lifecycle (happy path) | EXISTS BUT MUST CHANGE | States exist; financing actor + vendor-prep + paid-gating must change |
| Payment (online) | MISSING | No provider, no attempt/state machine, no webhook path |
| Payment (COD) | MISSING | No method, states, collection action, or cash accounting |
| Helper flow | EXISTS BUT MUST CHANGE | Remove financing; add COD-collection confirm; keep queue/accept/cap/realtime |
| Cafeteria flow | MISSING | Vendor app has zero order surface; needs prep queue + paid-visibility + handoff |
| Requester flow | EXISTS BUT MUST CHANGE | Needs method selection + platform payment status; QR/evidence flow obsolete |
| Settlement | MISSING | Only manual/external copy + admin RPC without UI |
| Commission | MISSING | No rule store, no computation, fixed RM2 fee hardcoded in RPC |
| Refunds | MISSING | Policy-level "no refunds"; dispute→manual only |
| Database | PARTIALLY IMPLEMENTED | Transaction skeleton exists; missing method/attempt/COD/settlement/commission/refund/idempotency structures |
| Backend | PARTIALLY IMPLEMENTED | Atomic RPC discipline exists; missing all new-money operations + webhook handling |
| Security | EXISTS AND COMPATIBLE (pattern) | SELECT-only + definer-RPC discipline reusable; QR exposure + amount rules must be re-cut for new flows |
| Realtime | PARTIALLY IMPLEMENTED | Order/ratings streams fine; needs payment/settlement/vendor event coverage |
| Frontend | EXISTS BUT MUST CHANGE | All three roles need flow changes; track per §13-style screen list in report body above |
| Admin | MISSING | `resolve_dispute` exists with zero UI; settlement/commission/refund ops need a surface or procedure |
| Accept race | EXISTS AND COMPATIBLE | Advisory lock + predicate (reuse pattern) |
| Payment/callback duplicates | DATA INTEGRITY RISK | No idempotency anywhere in payment path |
| Clean-cancel data loss | DATA INTEGRITY RISK (by design) | Hard-delete erases transaction history; incompatible with settlement/refund audit needs |
| Stale help/legal copy | OBSOLETE | "helper verifies receipt" step never existed; must be rewritten with new model |
| `rejected` payment status | OBSOLETE (likely dead) | No writer in current RPCs |
| `pickup_code` | OBSOLETE | Written, exposed, never verified |

---

## Migration Map

1. **Database** — Current: 10-table order+payment skeleton, 13-state order CHECK, coupled payment row. Problem: no method/attempt/COD/settlement/commission/refund/idempotency. Change: add payment-method + attempt ledger w/ idempotency keys; COD collection record; settlement ledger (vendor/helper/platform splits, statuses); commission rule; refund records; stop hard-deleting financial history (terminal `cancelled` records). Dependencies: business rules (fee/commission/refund policy). Risk: migrating live rows; CHECK widening.
2. **Backend** — Current: disciplined atomic RPCs, helper-financed verbs. Problem: every money verb assumes old model. Change: new definer RPCs (create-intent, provider-callback handler, COD-confirm, settle, refund, vendor-prep advance) with ownership+state predicates, server-derived amounts, no client money. Dependencies: DB structures + provider choice. Risk: double-callback/double-settle without idempotency.
3. **Payment integration** — Current: none (external banking app + QR image). Problem: no provider, keys, webhooks. Change: select provider (FPX/e-wallet per MY market — decision required), server-side intent + callback verification, deep-link return. Dependencies: provider account, secrets handling. Risk: spoofed callbacks; amount tampering (mitigate: server-side amount recompute).
4. **Transaction/settlement engine** — Current: none (manual). Problem: no splits, no statuses. Change: ledger writer (order→splits on terminal events), settlement states, admin resolve path wired to ledger. Dependencies: DB + commission rules. Risk: partial writes (use transactional functions).
5. **Requester frontend** — Current: QR+receipt flow (§4). Problem: method selection absent; QR/evidence obsolete. Change: checkout method picker, platform payment-status UI, receipt flow removal, order-detail payment section rewrite. Dependencies: backend intents. Risk: UX confusion during transition (feature-flag per-order-method recommended).
6. **Helper frontend** — Current: finance-first workspace. Problem: fronting copy/flows, no COD handling. Change: remove pay steps; show "covered by platform"; add COD-collect confirm with collected-amount display; keep queue/accept/cap/workspace/realtime. Dependencies: COD RPC. Risk: helpers mid-flow during cutover (drain in-flight helper-financed orders first).
7. **Cafeteria frontend** — Current: no order surface. Problem: vendors blind to paid/prep state. Change: prep queue (paid/COD-approved orders only), prep-state advance, handoff-to-helper confirm. Dependencies: order-prep states + RLS for vendors on orders. Risk: scope creep into full POS; keep to queue + states.
8. **Admin frontend** — Current: none (`resolve_dispute` exists). Problem: settlement/refund/commission unoperable. Change: minimal ops surface or documented procedure. Dependencies: ledger. Risk: privilege creep; keep admin-gated RPCs.
9. **Security/RLS** — Current: sound pattern. Problem: policies encode old visibility (helper-QR to requesters; no vendor order visibility; no new-verb coverage). Change: re-cut policies per new flows; keep definer-only money writes. Dependencies: final state model. Risk: over-broad policies during transition.
10. **Realtime** — Current: orders/ratings/vendor/menu/notifications. Problem: no payment/settlement/vendor-order events. Change: publish + subscribe new tables; keep reload-only discipline. Dependencies: new tables. Risk: stale payment UI (subscribe attempts directly).
11. **Testing** — Current: no test suite (verified: `package.json` scripts are only start/android/ios/web/lint; no test dirs in repo). Problem: money logic untestable. Change: RPC-level regression matrix (accept race, double-callback, cancel-during-payment, refund paths) + client flow checks. Dependencies: staging project. Risk: testing against production data (use throwaway accounts).
12. **Cleanup** — Current: obsolete rail permeates copy/schema/UI. Problem: dead code ENABLES confusion. Change: remove helper-QR system, `pickup_code`, resubmit path, dead statuses, stale legal/help copy — only after new flows live. Dependencies: migration completion. Risk: premature deletion breaks in-flight old-model orders.

---

## Risks

1. **In-flight cutover:** helper-financed orders mid-lifecycle during migration (fronted cash outstanding). Mitigation: drain + settle manually before cutover; freeze new helper-financed accepts.
2. **Clean-cancel history loss:** hard-delete destroys the audit trail settlement/refunds need. Must change before handling real money.
3. **No idempotency anywhere:** provider retries would double-record without attempt keys + unique constraints.
4. **Amount authority:** current discipline (server-derived) must survive; any client-supplied total in new RPCs is a vulnerability.
5. **COD cash handling:** collected cash is platform liability in helper hands; needs confirm + reconciliation states, and policy for shortfalls (business decision required).
6. **Commission/fee policy undecided:** RM2.00 hardcoded in `place_orders`; new splits need a rule store, not constants.
7. **Admin gap:** money-moving admin verbs without UI invite direct-SQL ops; define procedure or build surface.
8. **Scope creep (vendor POS, consumer wallet):** explicitly out of scope per brief; ledger-only.
9. **Device-only verification debt:** per repo standing notes, interactive/device flows are unverified; payment flows raise the stakes.

---

## Recommended Implementation Sequence

1. Business decisions first: fee/commission/refund/COD-shortfall policy, provider selection.
2. DB: stop hard-delete of financial history; add method/attempt(idempotent)/COD/settlement/commission/refund structures; widen states.
3. Backend: intent + callback + COD-confirm + settle + refund RPCs (definer, predicate-guarded, server amounts); keep old RPCs until drain.
4. Vendor prep queue (minimal) + RLS.
5. Requester checkout (method picker) + payment-status UI; helper COD/cash UI (remove financing).
6. Realtime for new tables; notification copy rewrite.
7. Admin ops surface/procedure.
8. Cutover: drain old-model orders → flip → cleanup obsolete rail → legal/help copy rewrite.
9. Full regression matrix incl. race/duplicate/refund paths.

---

## Files Inspected

`app/(requester)/index.tsx, vendors/[id].tsx, menu/[id].tsx, create.tsx, location.tsx, orders/confirmation.tsx, orders.tsx, orders/[id].tsx (+ confirm/payment/receipt/rate/report children), profile.tsx, helper-portal/{_layout,index,jobs/[id],deliveries,payment-qr,profile}.tsx, app/(vendor)/{index,menu,profile,_layout}.tsx, components/{RequesterPaymentCard,OrderBreakdown,ReceiptEvidenceView,SettlementRecord,HelperHistoryDetail,OrderRatingSection,RatingStars,DownloadableQR,PrivateImage,RequestCard,OrderTimeline,RequestProgress,NotificationCenter,CopyButton,StagedFileCard,HelperIdentity,RequestStatusCard,VendorCard,MenuItemRow,CartFab,QuantityStepper,Avatar,headers,SearchBar,DevProfileSwitcher,ui/*}, contexts/CartContext.tsx, hooks/{usePaymentFlow,useMyOrders,useMyOrderHistory,useMyDeliveries,useMyDeliveryHistory,useAvailableJobs,useHelperAvailability,useHelperIdentity,useMenu,useVendorMenu,useNotifications,useUnreadCount,usePushNotifications,useRealtimeReload,useAuth,useDeliveryLocations,useMyVendor}, services/{orders,payments,ratings,storage,auth,vendor,menu,helperIdentity,notifications,availability,devProfiles,locations,pushTokens}, lib/{money,orders,orderEvents,help-content,legal-content,dedupe,maps,push,supabase,unread}, types/domain.ts, package.json, app.json, .env.example` (frontend file findings above were produced by delegated codebase agents and cross-checked against service/RPC signatures; line references are from those inspections).

## Database Objects Inspected

Tables (10, all listed with row counts in Database Audit) + full `send2u_orders` column list (31) + CHECKs (`send2u_orders_status_check` 13 states, `send2u_payments_status_allowed`, `send2u_orders_dispute_reason_allowed`, `send2u_orders_resolution_allowed`, `send2u_orders_pending_unassigned`, nonnegativity, `send2u_profiles_role_allowed` requester/vendor/admin) + FKs (order-delete cascades; menu-item SET NULL; user-delete cascades profiles/notifications/tokens/ratings, SET NULLs helper/audit refs) + RLS (18 public policies incl. SELECT-only transaction tables; 12 storage policies qr/evidence/avatar × CRUD) + realtime publication (6 tables) + triggers (4, all enabled) + RPC bodies read in full (`send2u_place_orders`, `send2u_accept_order`, `send2u_helper_advance`, `send2u_cancel_order`, `send2u_confirm_delivery`, `send2u_open_dispute`, `send2u_withdraw_dispute`, `send2u_resolve_dispute`, `send2u_submit_payment`, `send2u_payment_context`, `send2u_submit_rating`, `send2u_set_helper_availability`, `send2u_after_order_insert_dispatch`, `send2u_after_order_release_redispatch`, `send2u_dispatch_next`, `send2u_notify_order_event` head) + 74 migrations (counted live; key ones: `send2u_broadcast_dispatch`, `retire_offer_subsystem_narrow_checks`, `add/revert_order_number`, `drop_unused_push_token_platform`, `cancelled_records_hard_delete`, `send2u_no_pickup_code`, `drop_review_payment_function`) + edge functions (1: `dev-switch-profile`).

---

## Final Audit Conclusion

The current system is a coherent, well-guarded implementation of the **wrong transaction model** for the target: helper-financed, externally-settled, manually-reconciled, with no platform money handling whatsoever. Its engineering discipline (atomic RPCs, server-derived amounts, SELECT-only RLS, receipt-evidence hygiene, race-safe claiming) is sound and should be carried forward — but every money verb, every financial display, the vendor blind spot, the missing admin surface, and the absent payment/settlement/refund machinery must change. The database needs additive structures (method, attempts, COD, ledger, commission, refunds, idempotency) plus an end to history-destroying hard-deletes; nothing in the current schema can be repurposed without breaking the old flow, so the migration must run both models during a drain-then-cutover. No payment provider, wallet, commission, or settlement code exists anywhere in the repo — all greenfield, all requiring business decisions first.
