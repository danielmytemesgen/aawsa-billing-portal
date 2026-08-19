import { describe, it, expect } from 'vitest';
import { computeCreditForBill, roundMoney } from '@/lib/credit-utils';

describe('roundMoney', () => {
    it('rounds to 2 decimal places', () => {
        expect(roundMoney(10.005)).toBe(10.01);
        expect(roundMoney(10.004)).toBe(10.0);
        expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    });
});

describe('computeCreditForBill — overpayment becomes a deposit', () => {
    it('creates a credit from the excess when payment exceeds the debt', () => {
        const r = computeCreditForBill({ debtForNextMonth: 500, amtPaid: 1000, creditBalance: 0 });
        expect(r.creditCreated).toBe(500);
        expect(r.creditCreatedAdjustment).toBe(0);
        expect(r.creditVoided).toBe(0);
        expect(r.creditApplied).toBe(0);
        expect(r.carriedForwardUnpaid).toBe(0);
        expect(r.newCreditBalance).toBe(500);
    });

    it('is idempotent: re-running with the existing created row produces no new events', () => {
        const r = computeCreditForBill({
            debtForNextMonth: 500,
            amtPaid: 1000,
            creditBalance: 500, // already includes the earlier credit
            existingCreated: { id: 'c1', amount: 500 },
        });
        expect(r.creditCreated).toBe(0);
        expect(r.creditCreatedAdjustment).toBe(0);
        expect(r.creditVoided).toBe(0);
        expect(r.newCreditBalance).toBe(500);
        expect(r.carriedForwardUnpaid).toBe(0);
    });

    it('adjusts an existing created row when the excess changes (bill correction)', () => {
        // Old excess was 500; the bill now generates an excess of 600.
        const r = computeCreditForBill({
            debtForNextMonth: 400,
            amtPaid: 1000,
            creditBalance: 500,
            existingCreated: { id: 'c1', amount: 500 },
        });
        expect(r.creditCreated).toBe(0);
        expect(r.creditCreatedAdjustment).toBe(100);
        expect(r.newCreditBalance).toBe(600);
    });

    it('voids an existing created row when the bill no longer overpays', () => {
        const r = computeCreditForBill({
            debtForNextMonth: 300,
            amtPaid: 200, // no longer overpays
            creditBalance: 500,
            existingCreated: { id: 'c1', amount: 500 },
        });
        expect(r.creditVoided).toBe(500);
        expect(r.newCreditBalance).toBe(0);
        expect(r.carriedForwardUnpaid).toBe(100); // 300 - 200
    });

    it('ignores sub-cent excesses (rounding tolerance)', () => {
        const r = computeCreditForBill({ debtForNextMonth: 500, amtPaid: 500.004, creditBalance: 0 });
        expect(r.creditCreated).toBe(0);
        expect(r.newCreditBalance).toBe(0);
    });
});

describe('computeCreditForBill — deposit applied to future bills', () => {
    it('applies available credit to partially paid debt', () => {
        const r = computeCreditForBill({ debtForNextMonth: 1000, amtPaid: 300, creditBalance: 500 });
        expect(r.creditApplied).toBe(500);
        expect(r.carriedForwardUnpaid).toBe(200);
        expect(r.newCreditBalance).toBe(0);
    });

    it('applies only the unpaid portion when credit exceeds the debt', () => {
        const r = computeCreditForBill({ debtForNextMonth: 500, amtPaid: 0, creditBalance: 800 });
        expect(r.creditApplied).toBe(500);
        expect(r.carriedForwardUnpaid).toBe(0);
        expect(r.newCreditBalance).toBe(300);
    });

    it('does nothing when there is no debt and no credit', () => {
        const r = computeCreditForBill({ debtForNextMonth: 500, amtPaid: 500, creditBalance: 0 });
        expect(r.creditCreated).toBe(0);
        expect(r.creditApplied).toBe(0);
        expect(r.carriedForwardUnpaid).toBe(0);
        expect(r.newCreditBalance).toBe(0);
    });

    it('is idempotent: does not re-apply an existing applied row', () => {
        const r = computeCreditForBill({
            debtForNextMonth: 1000,
            amtPaid: 300,
            creditBalance: 0, // balance was already reduced when the credit was applied
            existingApplied: { id: 'a1', amount: 500 },
        });
        expect(r.creditApplied).toBe(500);
        expect(r.existingAppliedAdjusted).toBeUndefined();
        expect(r.carriedForwardUnpaid).toBe(200);
        expect(r.newCreditBalance).toBe(0);
    });
});

describe('computeCreditForBill — bill correction / void after credit applied', () => {
    it('refunds the surplus to the balance when a bill shrinks after credit was applied', () => {
        // Bill was 100, fully covered by credit (balance consumed). Corrected to 80.
        const r = computeCreditForBill({
            debtForNextMonth: 80,
            amtPaid: 0,
            creditBalance: 0,
            existingApplied: { id: 'a1', amount: 100 },
        });
        expect(r.creditApplied).toBe(80);
        expect(r.existingAppliedAdjusted).toBe(80);
        expect(r.newCreditBalance).toBe(20);
        expect(r.carriedForwardUnpaid).toBe(0);
    });

    it('does not refund when the bill still exactly covers the applied credit', () => {
        const r = computeCreditForBill({
            debtForNextMonth: 100,
            amtPaid: 0,
            creditBalance: 0,
            existingApplied: { id: 'a1', amount: 100 },
        });
        expect(r.creditApplied).toBe(100);
        expect(r.existingAppliedAdjusted).toBeUndefined();
        expect(r.newCreditBalance).toBe(0);
        expect(r.carriedForwardUnpaid).toBe(0);
    });

    it('restores credit fully when the only bill it paid is voided', () => {
        const r = computeCreditForBill({
            debtForNextMonth: 0, // voided bill contributes no charge and no prior debt
            amtPaid: 0,
            creditBalance: 0,
            existingApplied: { id: 'a1', amount: 100 },
        });
        expect(r.creditApplied).toBe(0);
        expect(r.existingAppliedAdjusted).toBe(0);
        expect(r.newCreditBalance).toBe(100);
        expect(r.carriedForwardUnpaid).toBe(0);
    });
});

describe('computeCreditForBill — billing-cycle wiring (deposit covers first part)', () => {
    it('paid case: deposit covers the first part, cash pays the net (amount_paid = dueAfterCredit)', () => {
        // total 1000, deposit 300 → amount_paid = 700
        const r = computeCreditForBill({ debtForNextMonth: 1000, amtPaid: 700, creditBalance: 300 });
        expect(r.creditApplied).toBe(300);
        expect(r.carriedForwardUnpaid).toBe(0);
        expect(r.newCreditBalance).toBe(0);
    });

    it('fully-covered case: the whole bill is paid by the deposit, excess carries on', () => {
        // total 1000, deposit 1500 → amount_paid = 0
        const r = computeCreditForBill({ debtForNextMonth: 1000, amtPaid: 0, creditBalance: 1500 });
        expect(r.creditApplied).toBe(1000);
        expect(r.carriedForwardUnpaid).toBe(0);
        expect(r.newCreditBalance).toBe(500);
    });

    it('carry case, partial coverage: unpaid balance is the net residual', () => {
        // total 1000, deposit 300, no cash collected → amount_paid = 0
        const r = computeCreditForBill({ debtForNextMonth: 1000, amtPaid: 0, creditBalance: 300 });
        expect(r.creditApplied).toBe(300);
        expect(r.carriedForwardUnpaid).toBe(700);
        expect(r.newCreditBalance).toBe(0);
    });

    it('full cash payment leaves the deposit untouched (amount_paid = full total)', () => {
        const r = computeCreditForBill({ debtForNextMonth: 1000, amtPaid: 1000, creditBalance: 300 });
        expect(r.creditApplied).toBe(0);
        expect(r.carriedForwardUnpaid).toBe(0);
        expect(r.newCreditBalance).toBe(300);
    });
});

describe('computeCreditForBill — legacy clamp parity (non-bulk)', () => {
    it('behaves like Math.max(0, debt - paid) when no credit is involved', () => {
        const r = computeCreditForBill({ debtForNextMonth: 500, amtPaid: 300, creditBalance: 0 });
        expect(r.creditApplied).toBe(0);
        expect(r.carriedForwardUnpaid).toBe(200);
    });
});
