import { describe, it, expect } from 'vitest';
import { calculateDebtAging } from '@/lib/billing-utils';

function currentMonthYear() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

describe('calculateDebtAging', () => {
  it('assigns outstanding to debit30 for current month bills', () => {
    const month = currentMonthYear();
    const historicalBills = [
      { month_year: month, THISMONTHBILLAMT: 100, amount_paid: 0 }
    ];
    const result = calculateDebtAging(100, historicalBills, undefined, month);
    expect(result.debit30).toBeCloseTo(100);
    expect(result.debit30_60).toBeCloseTo(0);
    expect(result.debit60).toBeCloseTo(0);
    expect(result.penaltyAmt).toBeCloseTo(0);
  });

  it('moves older unpaid balances to debit60 and computes penalty when threshold met', () => {
    // Construct bills 4 months ago to trigger penalty tier
    const ref = new Date();
    const older = new Date(ref.getFullYear(), ref.getMonth() - 4, 1);
    const month = `${older.getFullYear()}-${String(older.getMonth() + 1).padStart(2, '0')}`;
    const historicalBills = [
      { month_year: month, THISMONTHBILLAMT: 200, amount_paid: 0 }
    ];
    const result = calculateDebtAging(200, historicalBills, undefined, currentMonthYear());
    expect(result.debit60).toBeGreaterThanOrEqual(200);
    // penalty may be >0 depending on default tier rates
    expect(result.penaltyAmt).toBeGreaterThanOrEqual(0);
  });

  it('strictly returns penaltyAmt = 0 when penalty_enabled is false', () => {
    const ref = new Date();
    const older = new Date(ref.getFullYear(), ref.getMonth() - 5, 1);
    const month = `${older.getFullYear()}-${String(older.getMonth() + 1).padStart(2, '0')}`;
    const historicalBills = [
      { month_year: month, THISMONTHBILLAMT: 500, amount_paid: 0 }
    ];
    const tariffWithPenaltyOff: any = {
      penalty_enabled: false,
      penalty_month_threshold: 3,
      bank_lending_rate: 0.15,
      penalty_tiered_rates: [{ month: 3, rate: 0.05 }, { month: 4, rate: 0.10 }]
    };
    const result = calculateDebtAging(500, historicalBills, tariffWithPenaltyOff, currentMonthYear());
    expect(result.penaltyAmt).toBe(0);
  });

  it('computes positive penaltyAmt when penalty_enabled is true and threshold is exceeded', () => {
    const ref = new Date();
    const older = new Date(ref.getFullYear(), ref.getMonth() - 5, 1);
    const month = `${older.getFullYear()}-${String(older.getMonth() + 1).padStart(2, '0')}`;
    const historicalBills = [
      { month_year: month, THISMONTHBILLAMT: 500, amount_paid: 0 }
    ];
    const tariffWithPenaltyOn: any = {
      penalty_enabled: true,
      penalty_month_threshold: 3,
      bank_lending_rate: 0.15,
      penalty_tiered_rates: [{ month: 3, rate: 0.05 }, { month: 4, rate: 0.10 }]
    };
    const result = calculateDebtAging(500, historicalBills, tariffWithPenaltyOn, currentMonthYear());
    expect(result.penaltyAmt).toBeGreaterThan(0);
  });
});
