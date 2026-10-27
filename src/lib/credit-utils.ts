/**
 * Pure helpers for the bulk-meter credit note (deposit) feature.
 *
 * Credits are ONLY created by explicit manual operator actions (`addMeterCreditAction`).
 * Bill overpayments do NOT automatically generate credits — excess payment simply satisfies
 * the debt with carriedForwardUnpaid = 0, and nothing is inserted into credit_ledger.
 *
 * If a legacy auto-created credit row exists for a bill (`existingCreated`), it is voided
 * on the next sync so phantom balances cannot persist.
 *
 * These functions are side-effect free so the aging replay (dbSyncAgingForCustomer)
 * and its unit tests share exactly the same math. See docs/CREDIT_NOTE_PLAN.md.
 */

/** Round an ETB amount to 2 decimal places (half away from zero). */
export const roundMoney = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Anything below this (ETB) is treated as zero — avoids micro-credits from float noise. */
export const MONEY_EPSILON = 0.005;

export interface ExistingCreditRow {
  /** ledger row id */
  id: string;
  /** the amount currently recorded for this bill */
  amount: number;
}

export interface ComputeCreditForBillInput {
  /** total debt this bill contributes (d30 + d30_60 + d60 + penalty + currentMonthly) */
  debtForNextMonth: number;
  /** amount actually paid against this bill (0 when the bill is voided) */
  amtPaid: number;
  /** available credit balance at the start of this bill */
  creditBalance: number;
  /** existing non-voided auto-created credit for this bill (from a previous sync) */
  existingCreated?: ExistingCreditRow | null;
  /** existing non-voided applied credit for this bill (from a previous sync / billing cycle) */
  existingApplied?: ExistingCreditRow | null;
}

export interface ComputeCreditForBillOutput {
  /** > 0 → INSERT a new `created` ledger row */
  creditCreated: number;
  /** ≠ 0 and existingCreated present → UPDATE that row's amount by this delta */
  creditCreatedAdjustment: number;
  /** > 0 → INSERT a `voided` ledger row referencing existingCreated.id */
  creditVoided: number;
  /** credit applied to this bill (existing applied amount, possibly capped at the unpaid debt) */
  creditApplied: number;
  /** when existingApplied is present, the amount its ledger row should now hold (capped); undefined = unchanged */
  existingAppliedAdjusted?: number;
  /** residual debt after payment + credit (feeds carriedForwardUnpaid / outStandingbill) */
  carriedForwardUnpaid: number;
  /** credit balance after this bill's events */
  newCreditBalance: number;
}

/**
 * Compute the credit events and residual debt for ONE bill inside the aging
 * replay. Idempotent: re-running with the same inputs and the same existing
 * ledger rows produces no new events.
 */
export function computeCreditForBill(input: ComputeCreditForBillInput): ComputeCreditForBillOutput {
  const { debtForNextMonth, amtPaid, creditBalance } = input;
  const existingCreated = input.existingCreated ?? null;
  const existingApplied = input.existingApplied ?? null;

  let balance = roundMoney(creditBalance);
  let creditCreated = 0;
  let creditCreatedAdjustment = 0;
  let creditVoided = 0;
  let creditApplied = 0;

  // IMPORTANT: Credits are ONLY created or voided via explicit manual operator actions.
  // The billing / aging engine only APPLIES available credit balance to unpaid bills.

  let existingAppliedAdjusted: number | undefined;
  const excess = roundMoney(amtPaid - debtForNextMonth);

  if (excess <= MONEY_EPSILON) {
    const unpaid = roundMoney(Math.max(0, debtForNextMonth - amtPaid));
    if (existingApplied) {
      creditApplied = existingApplied.amount;
      if (creditApplied > unpaid + MONEY_EPSILON) {
        const refund = roundMoney(creditApplied - unpaid);
        balance = roundMoney(balance + refund);
        creditApplied = unpaid;
        existingAppliedAdjusted = unpaid;
      }
    } else if (unpaid > MONEY_EPSILON && balance > MONEY_EPSILON) {
      creditApplied = roundMoney(Math.min(unpaid, balance));
      balance = roundMoney(balance - creditApplied);
    }
  }

  const carriedForwardUnpaid = roundMoney(Math.max(0, debtForNextMonth - amtPaid - creditApplied));

  return {
    creditCreated: 0,
    creditCreatedAdjustment: 0,
    creditVoided,
    creditApplied,
    existingAppliedAdjusted,
    carriedForwardUnpaid,
    newCreditBalance: Math.max(0, balance),
  };
}
