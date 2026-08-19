# Bulk Meter Credit Note (Overpayment Deposit) — Implementation Plan

**Goal:** when a bulk-meter customer pays **more** than their actual bill (e.g. a duplicated transaction, or a bill that was corrected downward after payment), the excess is **not lost** — it becomes a **credit / deposit balance** on the bulk meter that is automatically applied to future bills until fully consumed. Visible and auditable from the **Bulk Meter Details** page.

Scope: **bulk meters first** (the user request). The schema is designed so individual customers can reuse it later.

---

## 1. Current state (audited)

| Area | What exists today | Gap |
|---|---|---|
| Payments (`payments` table) | One row per payment: `bill_id`, `bulk_meter_id`, `amount_paid`, `payment_method`, `transaction_reference`, `payment_date`, `processed_by_staff_id`. Written by the CSV payment upload (`db-queries.ts` ≈ L3480–3700) and read for the Paid Bills report. | A payment amount larger than the bill's `TOTALBILLAMOUNT` is allowed — `amount_paid = GREATEST(COALESCE(amount_paid,0), $1)` — but the **excess is never tracked anywhere**. |
| Bill payment state (`bills` table) | `amount_paid`, `payment_status`, `OUTSTANDINGAMT`, `TOTALBILLAMOUNT`, `THISMONTHBILLAMT`, `PENALTYAMT`, `debit_30/30_60/60`, `balance_carried_forward`. `updateBillAction` (Posted bills) whitelists `amount_paid` / `payment_status` edits. | Marking a bill `Paid` with `amount_paid > TOTALBILLAMOUNT` (via CSV, "Edit Status", or reconciliation) silently discards the surplus. |
| Aging / balance engine — **server** | `dbSyncAgingForCustomer(customerKey)` in `db-queries.ts` (L4108) replays a customer's bills oldest→newest and recomputes debit buckets, penalty, per-bill totals, and `bulk_meters."outStandingbill"`. **`carriedForwardUnpaid = Math.max(0, debtForNextMonth - amtPaid)`** (L4240) — any overpayment is clamped to 0 and lost. | **The clamp is the core gap.** This function is the single source of truth for the meter's balance; it must instead route the excess into a credit balance. |
| Aging / balance engine — **client** | `calculateDebtAging` (`src/lib/billing-utils.ts` L130+) and the `reconstructedHistoryMap` in `BulkMeterDetailsClient.tsx` reproduce the same FIFO replay with the same `Math.max(0, …)` clamps. | All three copies must agree on how credit is carried forward, or the details page will disagree with the DB. |
| Billing cycle (`closeBillingCycleAction`, `actions.ts` L1230+) | Computes `totalPayable = penalty + outstanding + currentBill`, inserts the bill, sets `amount_paid = totalPayable` when `!carryBalance`, writes `outStandingbill = totalPayable` (or 0), then calls `dbSyncAgingForCustomer`. | **No credit awareness**: a meter with a deposit balance is billed for the full amount and the deposit sits untouched. |
| Bill correction (`updateBulkAndAssignedReadingsAction`, `recalculateBulkBillAction`, `EditReadingsRecalculateSection.tsx`) | Re-runs billing after reading edits; a corrected bill can be **lower** than what the customer already paid. | The overpayment from "bill correction" is precisely one of the two scenarios the user called out — currently discarded by the clamp. |
| Duplicate transactions | CSV upload matches by Bill Key / Customer Key / Amount; the `payments` table keeps `transaction_reference`. | No detection or handling of the same `transaction_reference` paid twice; the second payment's amount becomes an overpayment that vanishes. |
| Bulk Meter Details UI | Cards for meter info, Difference Billing Calculation, Reading History, Billing History, Associated Customers. Payslip prints a fixed 4-line total block (Current Bill / Penalty / Outstanding / Total Payable). | No credit/deposit display, no credit history, payslip never mentions credit. |

---

## 2. Design decisions

1. **Store the credit as a balance + a ledger, not a per-bill field.**
   - `bulk_meters."creditBalance" numeric NOT NULL DEFAULT 0` — the live deposit (ETB, never negative).
   - New **`credit_ledger`** table — every credit **add** / **apply** / **void** as a row, so the balance is fully auditable and can be recomputed by replay (same philosophy as the aging engine).
   - The credit belongs to the **meter**, not a specific bill — it rides the balance until the next bill consumes it.

2. **Overpayment is detected inside the aging engine, not at payment time only.**
   - Today `dbSyncAgingForCustomer` is the authoritative replay. When `amtPaid > debtForNextMonth`, the engine already knows the exact surplus — that is where the credit is born. **One change in the engine fixes CSV uploads, `amount_paid` edits, reconciliation, and bill correction at once**, because every path eventually calls `dbSyncAgingForCustomer` (billing cycle, reconciliation, correction).
   - Payment-time detection (CSV upload / `updateBillAction`) can additionally **log a `Credit Created` security event immediately** so the operator sees it right away, but the authoritative bookkeeping stays in the replay.

3. **Credit application order (FIFO on debt, credit is the last resort).**
   - For each bill cycle: compute the total due (`penalty + outstanding + currentBill`), then apply **available credit** to reduce it. Credit is consumed only **after** all other payment sources, oldest debt first, and the residual flows into `outStandingbill` as today.
   - Rationale: credit is the customer's own money; it should never prevent the aging buckets/penalty from being computed normally. It simply discounts what the customer owes at the end.
   - The **replay** must remain deterministic: credit balance at cycle N = (credit balance at N−1) + (overpayments in cycle N−1) − (credit applied in cycle N−1).

4. **Rounding.** All money is 2-dp ETB. Apply credit with `GREATEST(0, ROUND(due − credit, 2))`; any residual sub-cent (< 0.005) stays on the credit. Never negative.

5. **Security/audit.** Credit events land in `security_logs` (info): `Bulk Meter Credit Created` (amount + reason + source bill), `Bulk Meter Credit Applied` (amount + bill), `Bulk Meter Credit Voided` (manual reversal). Manual credit add/void are permission-gated (reuse `BULK_METERS_*` edit permission or `SETTINGS_MANAGE` — see open questions).

6. **Duplicate transactions get flagged, not auto-credited.** If a new payment's `transaction_reference` already exists for the same meter, show a **warning** in the payment flow ("this reference already appears on …") and record the payment as a credit with `reason = 'duplicate_transaction'` — the operator decides whether to keep it as a deposit or void it. No auto-decision.

---

## 3. Schema (migration) — ✅ IMPLEMENTED (tranche 1)

`database/migrations/019_bulk_meter_credit_notes.sql` (same convention as 017/018: idempotent, raw SQL, **gitignored by project convention** — copy alongside `.env.local`; applied via `database/run-migration.ts`, which runs every `.sql` in filename order):

```sql
-- 1. Live deposit balance on the meter
ALTER TABLE bulk_meters
    ADD COLUMN IF NOT EXISTS "creditBalance" numeric NOT NULL DEFAULT 0.00;

-- 2. Audit ledger: every credit event
CREATE TABLE IF NOT EXISTS credit_ledger (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bulk_meter_id   text NOT NULL REFERENCES bulk_meters("customerKeyNumber") ON DELETE CASCADE,
    individual_customer_id text REFERENCES individual_customers("customerKeyNumber") ON DELETE CASCADE,  -- future use
    event_type      text NOT NULL,               -- 'created' | 'applied' | 'voided'
    amount          numeric(12,2) NOT NULL,      -- positive for created; positive for applied/voided (we store the delta, never signed-negative)
    reason          text NOT NULL,               -- 'duplicate_transaction' | 'bill_correction' | 'manual' | 'billing_cycle'
    source_bill_id  uuid,                        -- the bill that overpaid / the bill that consumed credit
    source_payment_id uuid,                      -- the payment row that produced the credit (when known)
    balance_after   numeric(12,2) NOT NULL,      -- meter credit balance after this event (for easy audit reads)
    created_by      uuid REFERENCES staff_members(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    notes           text
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_meter  ON credit_ledger (bulk_meter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_bill   ON credit_ledger (source_bill_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_payment ON credit_ledger (source_payment_id);
```

Add `creditBalance` to the `bulkMeters` drizzle table in `src/lib/schema.ts` and to the domain mapping in `src/lib/data-store.ts` (`mapDbBulkMeterToDomain` / updates) so the client store carries it.

---

## 4. Backend changes

### 4.1 Aging engine — `dbSyncAgingForCustomer` (the core change) — ✅ IMPLEMENTED (tranche 2)
Replace the clamp with credit-aware carry-forward:
```
creditAtStart = current meter credit balance (read before replay)
...
for each bill (oldest→newest):
    debtForNextMonth = d30 + d30_60 + d60 + currentMonthly + penalty
    excess = amtPaid - debtForNextMonth
    if excess > 0.005:
        creditBalance += excess                 -- overpayment becomes deposit
        INSERT credit_ledger ('created', excess, reason, source_bill_id, source_payment_id, balance_after)
    else:
        applyFromCredit = MIN(creditBalance, debtForNextMonth - amtPaid)
        if applyFromCredit > 0.005:
            creditBalance -= applyFromCredit
            INSERT credit_ledger ('applied', applyFromCredit, 'billing_cycle', bill.id, ..., balance_after)
    carriedForwardUnpaid = MAX(0, debtForNextMonth - amtPaid - appliedCredit)
```
- The ledger `balance_after` makes the balance recomputable; the engine can also **rebuild** `creditBalance` from the ledger if a `rebuildCreditFromLedger` helper is needed for self-healing.
- Keep `outStandingbill` update as-is (it is the residual after credit).
- Because `creditBalance` lives on `bulk_meters`, add a read at replay start and write at the end inside the same function (it already writes `outStandingbill`).

### 4.2 Payment-time detection (operator visibility) — ⏳ later tranche
- **CSV upload** (`applyPaymentCsvAction` / the loop at db-queries L3480): after computing `amountPaid`, if `amountPaid > TOTALBILLAMOUNT + 0.005`, log a `Bulk Meter Credit Created` security event (warning) with the excess and the bill key, and note it in the CSV result summary (`updatedCount` + a new `creditFlaggedCount`). The authoritative credit row still lands via the engine.
- **`updateBillAction`** (`amount_paid` > `TOTALBILLAMOUNT`): same warning event; still allowed (it's a whitelisted field), but the excess now survives via the engine.
- **Duplicate reference check** (`payments.transaction_reference`): before inserting a payment, if the same reference exists for the same meter, tag the payment `notes = 'possible duplicate transaction — credit'` and surface the warning (see §6 open question on hard-block vs. warn).

### 4.3 Billing cycle — `closeBillingCycleAction` + `runBillingCycleAction` — ✅ IMPLEMENTED (tranche 3)
- Read `bulk_meters."creditBalance"` before computing the bill.
- `dueAfterCredit = MAX(0, totalPayableForCycle - creditBalance)`; `creditApplied = totalPayableForCycle - dueAfterCredit`.
- **Design note (deviation from the sketch above):** instead of the action inserting the `applied` ledger row and writing `TOTALBILLAMOUNT = dueAfterCredit` itself, the **engine stays the single writer**. The action only sets the bill row's `amount_paid` / `payment_status` so it reflects what is actually owed, and `dbSyncAgingForCustomer` (already called at the end of both actions, in-transaction for `closeBillingCycleAction`) records the ledger row, decrements the balance, and sets the meter's `outStandingbill`/`paymentStatus`. This keeps `TOTALBILLAMOUNT` at the full consumption value (the engine's write-back recomputes it that way anyway) and avoids any double-application risk.
  - `closeBillingCycleAction`: when the incoming `payment_status` is `'Paid'`, `amount_paid = dueAfterCredit` (deposit covers the first part, cash covers the net). Carry/Unpaid bills keep `amount_paid` 0 and the engine applies the credit + flips the bill to `Paid` when fully covered.
  - `runBillingCycleAction`: `!carryBalance` → `amount_paid = dueAfterCredit`, `payment_status = 'Paid'` (a fully-covered bill is Paid with `amount_paid` 0). `carryBalance` → `amount_paid` 0, `payment_status` `Paid` iff `dueAfterCredit <= 0.005`; the meter's carried `outStandingbill` is the **net** `dueAfterCredit`.
  - Both actions return `creditApplied` / `dueAfterCredit` for the UI to surface later.
- Verified: 4 new unit tests (paid-partial / fully-covered / carry-partial / full-cash-untouched) + a live integration script (`.freebuff/test-cycle-credit.ts`, 18 checks) replaying the exact action sequence against the dev DB: cash+deposit pays a bill, fully-covered bill flips to Paid with the excess staying on deposit, partial carry leaves the net residual on the meter, no-deposit behaviour unchanged, and re-sync is idempotent.

### 4.4 Query layer — `src/lib/db-queries.ts` — ✅ IMPLEMENTED (tranche 4)
- `dbGetMeterCredit(bulkMeterId)` → `{ creditBalance, ledger }` (ledger newest-first; joins `BILLKEY` for display).
- `dbCreateCredit(bulkMeterId, amount, reason, notes, staffId)` → inserts a `created` ledger row and bumps the balance atomically (CTE); rejects non-positive amounts.
- `dbVoidCredit(bulkMeterId, ledgerId, staffId)` → reverses only the **unconsumed** portion (`min(created.amount, currentBalance)`); fully-consumed credits and non-created rows are blocked; double-void blocked.
- **Source columns wired**: `dbCreateCredit` accepts an optional `sourceBillId` (from the Add Credit dialog's Source Bill picker); the CSV payment path (`dbBatchUpdatePaymentsFromCsv`) now syncs affected bulk meters after the batch and runs `dbLinkCreditSourcePayments()` to attach the producing payment row as `source_payment_id` (idempotent). `voided_ledger_id` fills automatically on `voided` rows.
- **CSV overpayments accepted + backfilled**: the CSV amount guard previously rejected any payment differing from the bill total (`|amount − total| > 0.05`) — so duplicate-payment overpayments could not be imported at all. It now allows **amount > total** (the excess becomes a deposit; partial payments are still rejected as mismatches). After the batch, `dbLinkCreditsToOverpaidBills(affectedMeters)` backfills `source_bill_id` on any `duplicate_transaction` / `bill_correction` credit that still has none (legacy/edge rows), linking it to the meter's most recent overpaid bill — idempotent, and manual standalone deposits (`manual` reason) are left alone. Verified by `.freebuff/test-csv-autolink.ts` (14 checks: link / exclusions / idempotency / full CSV path / partial-payment guard).
- **Overpaid-bill auto-link**: `dbGetMostRecentOverpaidBill(meterKey)` finds the meter's most recent bill with `amount_paid > TOTALBILLAMOUNT` (not deleted, and **not already linked** to a live `created` credit). `dbCreateCredit` auto-links it when the reason is `duplicate_transaction` and no `sourceBillId` was passed — so a manual duplicate-payment credit is tied to the bill that actually overpaid even if the operator skips the picker. Idempotent: once a bill carries a live credit it stops being suggested, so repeated adds walk older overpaid bills and then stop linking.
- `dbSyncAgingForCustomer` changes per §4.1.
- Verified live: `.freebuff/test-credit-actions.ts` (15 checks) — add → read → void (full) → double-void blocked → void-of-applied blocked → negative-add blocked → rebuild-from-ledger.

### 4.5 Server actions — `src/lib/actions.ts` — ✅ IMPLEMENTED (tranche 4)
- `getMeterCreditAction(bulkMeterId)` (gated by `BULK_METERS_VIEW_ALL` / `VIEW_BRANCH`).
- `addMeterCreditAction(bulkMeterId, amount, reason, notes)` and `voidMeterCreditAction(bulkMeterId, ledgerId)` — gated by `BULK_METERS_MANAGE_CUSTOMERS` OR `BULK_METERS_UPDATE` (branch-isolated unless global), wrapped like other actions, log `Bulk Meter Credit Created` (info) / `Bulk Meter Credit Voided` (warning) security events.

---

## 5. UI — Bulk Meter Details (`[[...id]]/BulkMeterDetailsClient.tsx`) — ✅ PARTIAL (tranche 6, items 1 & 3)

1. **Credit / Deposit card** (`src/components/billing/BulkMeterCreditCard.tsx`, placed between the Difference Billing card and Reading History) — ✅ done
   - **Source Bill column is live**: the Add Credit dialog has a Source Bill picker (the meter's bills, `BillKey · month · total`) that populates `source_bill_id`; ledger rows with a source bill render a **clickable link** to the bill's payslip in place (`onViewBill`).
   - **Overpayment suggestion**: when the reason is set to **Duplicate payment** and no bill is picked, the dialog shows an amber *"Overpayment detected — {bill} ({month}) — paid ETB X against ETB Y"* box for the most recent overpaid bill that isn't already linked to a live credit, with a one-click **Link this bill** button that fills the picker. (The server auto-link in §4.4 is the safety net behind it.)
   - Balance badge: green `Credit Note` pill when > 0, `ETB X` figure.
   - Ledger table (paged 5/10/25, newest first): Date, Event (Created / Applied / Voided pills; voided targets show `(reversed)`), signed Amount, Reason (human labels), Source Bill (`BILLKEY`), Balance After, Notes.
   - Buttons (permission-gated by `canManageCustomers`): **Add Credit** (dialog: amount + reason dropdown `manual | duplicate_transaction | bill_correction` + notes) and **Void** (confirm dialog; server blocks fully-consumed credits). Refresh via `getMeterCreditAction`.
2. **Difference Billing card**: informational `Credit Balance (Deposit)` line when a deposit exists (payable math untouched — credit is applied at billing time, not shown as a discount here). — pending
3. **Payslip / invoice print** (the `print-section` totals block) — ✅ done
   - When the printed bill has an `applied` ledger row: `Credit Applied (Deposit): −ETB X` and `Remaining Deposit: ETB Y` lines above the total, and `Total Amount Payable` shows the **net** (full − applied). Data comes from the meter's credit ledger keyed on `source_bill_id`.
4. **Billing History table**: when a bill's `payment_status` is `Paid` via credit, show a small `⚡ credit` badge next to the status. — pending
5. **Bulk meter table** (`bulk-meter-table.tsx`) + export: optional `Credit (ETB)` column in the list view and the XLSX export. — pending

---

## 6. Implementation order

1. **Migration** `019_bulk_meter_credit_notes.sql` + runner + `schema.ts`/`data-store.ts` mappings. Run against dev DB. — ✅ done
2. **Aging engine** (`dbSyncAgingForCustomer`) credit-aware replay + ledger writes + idempotency guard. This is the heart of the feature. — ✅ done
   - Implemented in `src/lib/credit-utils.ts` (`roundMoney` + `computeCreditForBill`, pure + unit-tested) and wired into `dbSyncAgingForCustomer` (overpayment → `created`; unpaid debt → `applied` with per-bill idempotency; bill corrected down → `voided`/adjust; bill removed → `bill_removed` void; credit counts as a payment source in the bucket allocation so credit-paid bills don't carry phantom debt). New helpers: `dbGetMeterCreditBalance`, `dbRebuildCreditBalance` (recompute balance from the ledger — self-heal/test), `dbInsertCreditLedgerRow`. `dbDeleteBill` now re-syncs the engine in-transaction so deleting an overpaid bill reverses its credit immediately.
   - Verified: 14 unit tests + a live integration script (`.freebuff/test-credit-engine.ts`) proving credit created → applied → consumed → idempotent re-sync → delete-reversal → rebuild-from-ledger against the dev DB.
3. **Billing cycle** credit application (`closeBillingCycleAction` + `runBillingCycleAction`): deposit covers the first part, `amount_paid`/`payment_status` correct for fully-covered bills, meter carries the **net** residual. — ✅ done
4. **Query layer + actions**: `dbGetMeterCredit`, `dbCreateCredit`, `dbVoidCredit`, `getMeterCreditAction`, `addMeterCreditAction`, `voidMeterCreditAction`. — ✅ done
5. **Payment-path warnings**: CSV upload + `updateBillAction` credit-flagged events; duplicate `transaction_reference` detection.
6. **UI**: credit card + ledger + Add/Void dialogs on Bulk Meter Details ✅; payslip credit lines ✅; Difference Billing deposit line, ⚡ badge on credit-paid bills, list column + export — pending.
7. **Client-side reconstruction parity**: `reconstructedHistoryMap` in `BulkMeterDetailsClient` now runs the **same credit-aware replay** as the server (`computeCreditForBill`, shared from `credit-utils.ts`): it starts from the meter's stored `creditBalance`, builds `createdByBill`/`appliedByBill` from the ledger (excluding voided rows), applies the deposit before carrying debt, and treats credit as a payment source in the bucket allocation so credit-paid bills don't carry phantom debt. `Reversed` bills are treated as voided like the engine. Results also carry `creditApplied`/`paymentStatus` per bill (the table badge still uses the DB-authoritative `payment_status`). — ✅ done
   - Verified live: seeded an overpayment → credit 500 → bill 2 (300) paid by deposit → bill 3 (1000) partially covered → meter outstanding 800. The client Billing History table matched the DB's per-bill write-back exactly (500/300/1000 totals, Paid/Paid/Unpaid), the Difference Billing card showed outstanding 800, the credit card ledger matched, and the credit-paid bill's payslip printed `Credit Applied −300`, `Remaining Deposit 200`, `Total 0`.
8. **Tests & verify**:
   - Unit: aging replay with overpayment (CSV-style excess, corrected-bill excess, credit fully/partially consumed, credit floor at 0, idempotent re-sync) in `src/lib/__tests__/` (extract the replay into a pure helper like `session-monitoring.ts` did).
   - Live: create a meter bill, record an overpayment (CSV + manual), confirm credit appears; run next billing cycle; confirm the bill is discounted and the balance drops; void a credit and confirm the audit trail.
   - Typecheck + full vitest suite.

---

## 7. Edge cases to handle

- **Excess < rounding tolerance**: anything under ETB 0.005 is ignored (no micro-credits).
- **Voiding a bill that overpaid** (bill-delete path at db-queries L994–1001 decrements `outStandingbill`): must also **reverse** the credit that payment created, or the meter gets a phantom deposit. The ledger's `source_bill_id` makes this reversible.
- **Voiding a credit** while a later bill already consumed part of it: void only the **unconsumed** portion; if fully consumed, block the void (show which bill used it) or require an explicit compensating adjustment.
- **Bill correction downward after payment** (`updateBulkAndAssignedReadingsAction`): the engine's replay handles it automatically — the corrected (lower) `THISMONTHBILLAMT` makes the prior `amount_paid` an excess → credit.
- **Two copies of the aging math** (server + client) must agree: keep the pure helper shared/tested (see §6.8).
- **`amount_paid` vs. `payments` table sum drift**: the existing payment-audit check (`ABS(b.amount_paid − SUM(payments.amount_paid))`) will now legitimately flag overpaid bills; teach the audit view that bills with an open credit are expected, or base the check on `creditBalance`.
- **Never a negative credit**: every decrement is `GREATEST(0, balance − x)`; ledger `balance_after` must equal the live balance (assert in tests).
- **`outStandingbill` semantics**: remains the residual debt *after* credit — the details-page payable formula (`outstanding + differenceBill + penalty`) already reads it, so it stays consistent.

---

## 8. Open questions for the user

1. **Permission for manual credit add/void** — reuse the existing bulk-meter edit permission (`BULK_METERS_MANAGE_CUSTOMERS` / edit), or a new `bulk_meters_credit_manage` permission?
2. **Duplicate transactions: hard-block or warn-and-credit?** Recommend **warn-and-credit** (keep the money, flag for review) — a hard block could reject legitimate same-reference reprocessing.
3. **Individual customers too?** The schema is generic; the engine change (§4.1) applies to any `customerKey`. Include individuals in the same tranche or defer?
4. **Negative billing months** (credit exceeds the bill and the meter is inactive for months): the balance just sits — should it expire or be refundable (a "Refund" event type), or remain indefinitely as a deposit?
