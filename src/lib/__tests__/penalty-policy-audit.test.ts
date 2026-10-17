import { describe, it, expect } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { calculateDebtAging, normalizeTariff, getMonthlyBillAmt, isPenaltyEngineEnabled, reconstructOutstandingForBill } from '@/lib/billing-utils';
import { useCardPenaltyDisplay } from '@/hooks/useCardPenaltyDisplay';

function getMonthsAgo(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

describe('Penalty Policy Engine Audit - All Modules', () => {
  const baseTariff = {
    customer_type: 'Non-domestic' as const,
    effective_date: '2026-01-01',
    tiers: [{ rate: 10, limit: 'Infinity' as const }],
    sewerage_tiers: [{ rate: 5, limit: 'Infinity' as const }],
    maintenance_percentage: 1,
    sanitation_percentage: 1,
    meter_rent_prices: { '1': 10 },
    vat_rate: 0.15,
    domestic_vat_threshold_m3: 15,
    additional_fees: [],
    penalty_month_threshold: 3,
    bank_lending_rate: 0.15,
    penalty_tiered_rates: [
      { month: 3, rate: 0.05 },
      { month: 4, rate: 0.10 },
      { month: 5, rate: 0.15 }
    ]
  };

  describe('1. normalizeTariff & Tariff Parsing', () => {
    it('normalizes penalty_enabled: false correctly', () => {
      const raw = { ...baseTariff, penalty_enabled: false };
      const normalized = normalizeTariff(raw);
      expect(normalized.penalty_enabled).toBe(false);
    });

    it('normalizes penalty_enabled: true correctly', () => {
      const raw = { ...baseTariff, penalty_enabled: true };
      const normalized = normalizeTariff(raw);
      expect(normalized.penalty_enabled).toBe(true);
    });

    it('defaults penalty_enabled to true when undefined or null', () => {
      const raw = { ...baseTariff, penalty_enabled: undefined };
      const normalized = normalizeTariff(raw);
      expect(normalized.penalty_enabled).toBe(true);
    });
  });

  describe('2. calculateDebtAging (Batch Jobs & Real-time Bill Generation)', () => {
    it('strictly outputs penaltyAmt = 0 when penalty_enabled is false', () => {
      const oldMonth = getMonthsAgo(5);
      const bills = [
        { month_year: oldMonth, THISMONTHBILLAMT: 1000, amount_paid: 0 }
      ];
      const tariffOff = { ...baseTariff, penalty_enabled: false };
      const result = calculateDebtAging(1000, bills, tariffOff);

      expect(result.penaltyAmt).toBe(0);
      expect(result.debit60).toBeGreaterThanOrEqual(1000);
    });

    it('calculates proper tiered penalty when penalty_enabled is true and threshold is met', () => {
      const oldMonth = getMonthsAgo(5);
      const bills = [
        { month_year: oldMonth, THISMONTHBILLAMT: 1000, amount_paid: 0 }
      ];
      const tariffOn = { ...baseTariff, penalty_enabled: true };
      const result = calculateDebtAging(1000, bills, tariffOn);

      // 1000 base * (0.15 bank + 0.15 tier) = 300
      expect(result.penaltyAmt).toBe(300);
    });

    it('correctly handles camelCase monthYear from DomainBill in calculateDebtAging', () => {
      const oldMonth = getMonthsAgo(4);
      const bills = [
        { monthYear: oldMonth, THISMONTHBILLAMT: 1000, amountPaid: 0 }
      ];
      const tariffOn = { ...baseTariff, penalty_enabled: true };
      const result = calculateDebtAging(1000, bills, tariffOn);

      // 1000 base * (0.15 bank + 0.10 tier) = 250
      expect(result.penaltyAmt).toBe(250);
    });
  });

  describe('3. Bill Management & Bulk Meter Aging Reconstruction Simulation', () => {
    function simulateReconstruction(billsList: any[], penaltyEnabled: boolean) {
      const activeTariff = {
        ...baseTariff,
        penalty_enabled: penaltyEnabled
      };

      const threshold = activeTariff.penalty_month_threshold ?? 3;
      const bankRate = Number(activeTariff.bank_lending_rate ?? 0.15);
      const tieredRates = activeTariff.penalty_tiered_rates;

      let carriedForwardUnpaid = 0;
      let d30_bucket = 0;
      let d30_60_bucket = 0;
      let d60_bucket = 0;
      let billIndexCounter = 0;
      const results = new Map<string, any>();

      for (const bill of billsList) {
        billIndexCounter++;
        const arrearsSum = carriedForwardUnpaid;
        let penalty = 0;
        let maxAge = 0;

        if (d60_bucket > 0.01) maxAge = 3;
        else if (d30_60_bucket > 0.01) maxAge = 2;
        else if (d30_bucket > 0.01) maxAge = 1;

        maxAge = Math.max(maxAge, billIndexCounter);
        const legacyDebt = Math.max(0, arrearsSum - (d30_bucket + d30_60_bucket + d60_bucket));
        if (legacyDebt > 0.01) maxAge = Math.max(maxAge, 3);

        const isPenaltyEnabled = activeTariff.penalty_enabled !== false;
        if (isPenaltyEnabled && maxAge >= threshold) {
          const applicableTier = [...tieredRates].sort((a, b) => b.month - a.month).find(t => maxAge >= t.month);
          const totalRate = bankRate + Number(applicableTier?.rate || 0);
          penalty = arrearsSum * totalRate;
        } else {
          penalty = 0;
        }

        const currentMonthlyCharge = getMonthlyBillAmt(bill);
        const totalD60AndLegacy = d60_bucket + legacyDebt;
        const derivedOutstanding = d30_bucket + d30_60_bucket + totalD60AndLegacy + penalty;
        const totalPayable = derivedOutstanding + currentMonthlyCharge;

        results.set(bill.id, {
          d30: d30_bucket,
          d30_60: d30_60_bucket,
          d60: totalD60AndLegacy,
          penalty,
          outstanding: derivedOutstanding,
          currentMonthly: currentMonthlyCharge,
          totalPayable
        });

        const amtPaid = Number(bill.amountPaid || 0);
        const debtForNextMonth = d30_bucket + d30_60_bucket + totalD60AndLegacy + currentMonthlyCharge + penalty;
        carriedForwardUnpaid = Math.max(0, debtForNextMonth - amtPaid);
      }

      return results;
    }

    it('produces 0.00 penalty across all cycles when penalty is OFF', () => {
      const mockBills = [
        { id: 'b1', month_year: getMonthsAgo(4), THISMONTHBILLAMT: 100, amountPaid: 0 },
        { id: 'b2', month_year: getMonthsAgo(3), THISMONTHBILLAMT: 100, amountPaid: 0 },
        { id: 'b3', month_year: getMonthsAgo(2), THISMONTHBILLAMT: 100, amountPaid: 0 },
        { id: 'b4', month_year: getMonthsAgo(1), THISMONTHBILLAMT: 100, amountPaid: 0 }
      ];

      const resultsOff = simulateReconstruction(mockBills, false);
      for (const [id, r] of resultsOff.entries()) {
        expect(r.penalty).toBe(0);
      }

      const lastBill = resultsOff.get('b4');
      // 3 previous unpaid months * 100 = 300 outstanding principal, NO penalty
      expect(lastBill.outstanding).toBe(300);
      expect(lastBill.totalPayable).toBe(400); // 300 outstanding + 100 current
    });

    it('accumulates tiered penalty when penalty is ON', () => {
      const mockBills = [
        { id: 'b1', month_year: getMonthsAgo(4), THISMONTHBILLAMT: 100, amountPaid: 0 },
        { id: 'b2', month_year: getMonthsAgo(3), THISMONTHBILLAMT: 100, amountPaid: 0 },
        { id: 'b3', month_year: getMonthsAgo(2), THISMONTHBILLAMT: 100, amountPaid: 0 },
        { id: 'b4', month_year: getMonthsAgo(1), THISMONTHBILLAMT: 100, amountPaid: 0 }
      ];

      const resultsOn = simulateReconstruction(mockBills, true);
      const b3 = resultsOn.get('b3');
      const b4 = resultsOn.get('b4');

      expect(b3.penalty).toBeGreaterThan(0);
      expect(b4.penalty).toBeGreaterThan(0);
      expect(b4.totalPayable).toBeGreaterThan(400);
    });
  });

  describe('4. Difference Billing Calculation Card Logic', () => {
    function computeCardPayable(params: {
      currentBill: number;
      outstanding: number;
      rawPenalty: number;
      isPenaltyOff: boolean;
    }) {
      const displayedPenaltyAmt = params.isPenaltyOff ? 0 : params.rawPenalty;
      const displayedTotalPayable = params.isPenaltyOff
        ? params.outstanding + params.currentBill
        : params.outstanding + params.currentBill + displayedPenaltyAmt;
      return { displayedPenaltyAmt, displayedTotalPayable };
    }

    it('during OFF: excludes penalty value from Total Amount Payable and displays ETB 0.00', () => {
      const currentBill = 497.09;
      const outstanding = 8057.75;
      const calculatedPenalty = 1208.66;

      const { displayedPenaltyAmt, displayedTotalPayable } = computeCardPayable({
        currentBill,
        outstanding,
        rawPenalty: calculatedPenalty,
        isPenaltyOff: true,
      });

      expect(displayedPenaltyAmt).toBe(0);
      // Total Amount Payable = Outstanding + Current Bill strictly
      expect(displayedTotalPayable).toBe(8554.84);
    });

    it('during ON: displays penalty amount and adds it into Total Amount Payable', () => {
      const currentBill = 497.09;
      const outstanding = 8057.75;
      const calculatedPenalty = 1208.66;

      const { displayedPenaltyAmt, displayedTotalPayable } = computeCardPayable({
        currentBill,
        outstanding,
        rawPenalty: calculatedPenalty,
        isPenaltyOff: false,
      });

      expect(displayedPenaltyAmt).toBe(1208.66);
      // Total Amount Payable = Outstanding + Current Bill + Penalty
      expect(displayedTotalPayable).toBe(9763.50);
    });
  });

  describe('5. Partial Payment Penalty Base Reduction', () => {
    const oldMonth = getMonthsAgo(5);
    const tariffOn = { ...baseTariff, penalty_enabled: true };

    it('reduces penalty base when partial payment is made', () => {
      // 1000 billed, 600 paid => 400 unpaid principal
      const bills = [
        { month_year: oldMonth, THISMONTHBILLAMT: 1000, amount_paid: 600 }
      ];
      const result = calculateDebtAging(400, bills, tariffOn);
      // 400 * (0.15 bank + 0.15 tier) = 120
      expect(result.penaltyAmt).toBe(120);
    });

    it('charges full penalty when zero payment is made', () => {
      const bills = [
        { month_year: oldMonth, THISMONTHBILLAMT: 1000, amount_paid: 0 }
      ];
      const result = calculateDebtAging(1000, bills, tariffOn);
      // 1000 * 0.30 = 300
      expect(result.penaltyAmt).toBe(300);
    });

    it('charges zero penalty when bill is fully paid', () => {
      const bills = [
        { month_year: oldMonth, THISMONTHBILLAMT: 1000, amount_paid: 1000, paymentStatus: 'Paid' }
      ];
      const result = calculateDebtAging(0, bills, tariffOn);
      expect(result.penaltyAmt).toBe(0);
    });

    it('aggregates multiple historical bills with partial payments correctly', () => {
      const month5 = getMonthsAgo(5);
      const month4 = getMonthsAgo(4);
      const bills = [
        { month_year: month5, THISMONTHBILLAMT: 500, amount_paid: 200 }, // unpaid 300
        { month_year: month4, THISMONTHBILLAMT: 500, amount_paid: 100 }, // unpaid 400
      ];
      // total balance = 700
      const result = calculateDebtAging(700, bills, tariffOn);
      // max age is 5 months => totalRate = 0.30
      // 700 * 0.30 = 210
      expect(result.penaltyAmt).toBe(210);
    });
  });

  describe('6. Global Engine vs Per-Tariff Interaction Guard', () => {
    const oldMonth = getMonthsAgo(5);
    const bills = [
      { month_year: oldMonth, THISMONTHBILLAMT: 1000, amount_paid: 0 }
    ];

    it('case 1: Global ON + Tariff ON => penalty applied', () => {
      const allTariffs = [
        { effective_date: '2026-06-01', penalty_enabled: true },
        { effective_date: '2026-01-01', penalty_enabled: false },
      ];
      const globalOn = isPenaltyEngineEnabled(allTariffs);
      expect(globalOn).toBe(true);

      const tariff = { ...baseTariff, penalty_enabled: true };
      const effectiveTariff = globalOn ? tariff : { ...tariff, penalty_enabled: false };
      const result = calculateDebtAging(1000, bills, effectiveTariff);
      expect(result.penaltyAmt).toBe(300);
    });

    it('case 2: Global ON + Tariff OFF => penalty suppressed (per-tariff override)', () => {
      const allTariffs = [
        { effective_date: '2026-06-01', penalty_enabled: true },
      ];
      const globalOn = isPenaltyEngineEnabled(allTariffs);
      expect(globalOn).toBe(true);

      const tariff = { ...baseTariff, penalty_enabled: false };
      const effectiveTariff = globalOn ? tariff : { ...tariff, penalty_enabled: false };
      const result = calculateDebtAging(1000, bills, effectiveTariff);
      expect(result.penaltyAmt).toBe(0);
    });

    it('case 3: Global OFF + Tariff ON => penalty suppressed (master switch)', () => {
      const allTariffs = [
        { effective_date: '2026-06-01', penalty_enabled: false },
        { effective_date: '2026-01-01', penalty_enabled: true },
      ];
      const globalOn = isPenaltyEngineEnabled(allTariffs);
      expect(globalOn).toBe(false);

      const tariff = { ...baseTariff, penalty_enabled: true };
      const effectiveTariff = globalOn ? tariff : { ...tariff, penalty_enabled: false };
      const result = calculateDebtAging(1000, bills, effectiveTariff);
      expect(result.penaltyAmt).toBe(0);
    });
  });

  describe('7. reconstructOutstandingForBill Utility', () => {
    it('returns stored OUTSTANDINGAMT when present on the bill', () => {
      const bill = { id: 'b1', OUTSTANDINGAMT: 1250.50 };
      const result = reconstructOutstandingForBill(bill, 0, [bill], true);
      expect(result).toBe(1250.50);
    });

    it('reconstructs from historical bills when OUTSTANDINGAMT is undefined/null', () => {
      const history = [
        { id: 'b2', monthYear: '2026-02', THISMONTHBILLAMT: 100, amountPaid: 0, paymentStatus: 'Unpaid' },
        { id: 'b1', monthYear: '2026-01', THISMONTHBILLAMT: 200, amountPaid: 50, paymentStatus: 'Unpaid', OUTSTANDINGAMT: null },
      ];
      // b2 is the newest bill (index 0). Looking for b2's outstanding balance from prior bills:
      // prior bill b1 has unpaid: totalThisMonth 200 - paid 50 = 150
      const result = reconstructOutstandingForBill(history[0], 0, history, true);
      expect(result).toBe(150);
    });

    it('includes balanceCarriedForward on the oldest historical bill', () => {
      const history = [
        { id: 'b2', monthYear: '2026-02', THISMONTHBILLAMT: 100, amountPaid: 0, paymentStatus: 'Unpaid' },
        { id: 'b1', monthYear: '2026-01', THISMONTHBILLAMT: 200, amountPaid: 200, paymentStatus: 'Paid', balanceCarriedForward: 500 },
      ];
      // b1 is fully paid, but carried 500 initial debt from before system ingestion
      const result = reconstructOutstandingForBill(history[0], 0, history, true);
      expect(result).toBe(500);
    });

    it('returns billToRender.balanceCarriedForward if bill is the oldest in history', () => {
      const oldestBill = { id: 'b1', monthYear: '2026-01', balanceCarriedForward: 750 };
      const result = reconstructOutstandingForBill(oldestBill, 0, [oldestBill], true);
      expect(result).toBe(750);
    });

    it('ignores penalty portion in increment when isPenaltyOn is false', () => {
      const history = [
        { id: 'b2', monthYear: '2026-02', THISMONTHBILLAMT: 100, amountPaid: 0 },
        { id: 'b1', monthYear: '2026-01', THISMONTHBILLAMT: 200, PENALTYAMT: 50, amountPaid: 0, OUTSTANDINGAMT: 0, TOTALBILLAMOUNT: 250 },
      ];
      const withPenaltyOn = reconstructOutstandingForBill(history[0], 0, history, true);
      const withPenaltyOff = reconstructOutstandingForBill(history[0], 0, history, false);

      expect(withPenaltyOn).toBe(250); // 200 monthly + 50 penalty
      expect(withPenaltyOff).toBe(200); // 200 monthly only (penalty ignored)
    });

    it('ignores bills that are Deleted, Void, or Reversed', () => {
      const history = [
        { id: 'b3', monthYear: '2026-03', THISMONTHBILLAMT: 100, amountPaid: 0 },
        { id: 'b2', monthYear: '2026-02', THISMONTHBILLAMT: 500, amountPaid: 0, status: 'Void' },
        { id: 'b1', monthYear: '2026-01', THISMONTHBILLAMT: 200, amountPaid: 0, paymentStatus: 'Unpaid' },
      ];
      // b2 is Void, so only b1 (200) contributes to b3's outstanding balance
      const result = reconstructOutstandingForBill(history[0], 0, history, true);
      expect(result).toBe(200);
    });

    it('reconstructs correctly when billIndex is -1 by matching older months', () => {
      const history = [
        { id: 'b2', monthYear: '2026-02', THISMONTHBILLAMT: 300, amountPaid: 100, paymentStatus: 'Unpaid' },
        { id: 'b1', monthYear: '2026-01', THISMONTHBILLAMT: 200, amountPaid: 50, paymentStatus: 'Unpaid' },
      ];
      const unindexedBill = { id: 'b_custom', monthYear: '2026-03', OUTSTANDINGAMT: null };
      const result = reconstructOutstandingForBill(unindexedBill, -1, history, true);
      // b2 unpaid (200) + b1 unpaid (150) = 350
      expect(result).toBe(350);
    });
  });

  describe('8. useCardPenaltyDisplay Hook Integration', () => {
    function TestComponent({ params, onResult }: { params: any; onResult: (res: any) => void }) {
      const result = useCardPenaltyDisplay(params);
      onResult(result);
      return null;
    }

    it('derives zero penalty when isPenaltyOff is true', () => {
      let output: any;
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(TestComponent, {
          params: {
            billCardDetails: {
              billId: 'b1',
              penaltyAmt: 150,
              outstandingBill: 500,
              totalDifferenceBill: 200,
            },
            billingHistory: [],
            reconstructedHistoryMap: new Map(),
            isPenaltyOff: true,
          },
          onResult: (res: any) => { output = res; }
        })
      );

      expect(output.displayedPenaltyAmt).toBe(0);
      expect(output.displayedTotalPayable).toBe(700); // 500 + 200
    });

    it('derives calculated penalty when isPenaltyOff is false and penaltyAmt is present', () => {
      let output: any;
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(TestComponent, {
          params: {
            billCardDetails: {
              billId: 'b1',
              penaltyAmt: 150,
              outstandingBill: 500,
              totalDifferenceBill: 200,
            },
            billingHistory: [],
            reconstructedHistoryMap: new Map(),
            isPenaltyOff: false,
          },
          onResult: (res: any) => { output = res; }
        })
      );

      expect(output.displayedPenaltyAmt).toBe(150);
      expect(output.displayedTotalPayable).toBe(850); // 500 + 200 + 150
    });

    it('falls back to reconstructedHistoryMap when saved bill has penaltyAmt = 0', () => {
      let output: any;
      const historyMap = new Map();
      historyMap.set('b1', { penalty: 275.50 });

      ReactDOMServer.renderToStaticMarkup(
        React.createElement(TestComponent, {
          params: {
            billCardDetails: {
              billId: 'b1',
              penaltyAmt: 0,
              outstandingBill: 1000,
              totalDifferenceBill: 300,
            },
            billingHistory: [{ id: 'b1', monthYear: '2026-01' }],
            reconstructedHistoryMap: historyMap,
            isPenaltyOff: false,
          },
          onResult: (res: any) => { output = res; }
        })
      );

      expect(output.displayedPenaltyAmt).toBe(275.50);
      expect(output.displayedTotalPayable).toBe(1575.50); // 1000 + 300 + 275.50
    });

    it('safely handles null billCardDetails without crashing', () => {
      let output: any;
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(TestComponent, {
          params: {
            billCardDetails: null,
            billingHistory: [],
            reconstructedHistoryMap: new Map(),
            isPenaltyOff: false,
          },
          onResult: (res: any) => { output = res; }
        })
      );

      expect(output.displayedPenaltyAmt).toBe(0);
      expect(output.displayedTotalPayable).toBe(0);
      expect(output.currentRenderedBillId).toBe(null);
    });
  });
});
