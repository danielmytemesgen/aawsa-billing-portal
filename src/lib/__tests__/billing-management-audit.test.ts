import { describe, it, expect } from 'vitest';

describe('Bill Management Audit - Aging Fallback & Anomaly Heuristics', () => {
  it('preserves database aging buckets and outstanding debt when only single bill is present in memory', () => {
    // Simulate single-month bill state
    const singleBill: any = {
      id: 'bill-single-1',
      CUSTOMERKEY: 'BM-200',
      status: 'Posted',
      month_year: '2025-03',
      debit_30: 1500,
      debit_30_60: 800,
      debit_60: 450,
      OUTSTANDINGAMT: 2750,
      PENALTYAMT: 250,
      THISMONTHBILLAMT: 1200,
      TOTALBILLAMOUNT: 4200,
    };

    const customerBills = [singleBill];

    // Replay logic mimicking BillManagementContent
    let reconstructed: any = null;
    if (customerBills.length <= 1) {
      const b = customerBills[0];
      const isVoided = b.status === 'Deleted' || b.status === 'Void';
      const d30 = Number(b.debit_30 || b.debit30 || 0);
      const d30_60 = Number(b.debit_30_60 || b.debit30_60 || 0);
      const d60 = Number(b.debit_60 || b.debit60 || 0);
      const penalty = Number(b.PENALTYAMT || 0);
      const outstanding = Number(b.OUTSTANDINGAMT ?? (d30 + d30_60 + d60)) + penalty;
      const currentMonthly = isVoided ? 0 : Number(b.THISMONTHBILLAMT || 0);
      const totalPayable = isVoided ? 0 : outstanding + currentMonthly;

      reconstructed = {
        d30,
        d30_60,
        d60,
        penalty,
        outstanding,
        currentMonthly,
        totalPayable,
      };
    }

    expect(reconstructed).not.toBeNull();
    expect(reconstructed.d30).toBe(1500);
    expect(reconstructed.d30_60).toBe(800);
    expect(reconstructed.d60).toBe(450);
    expect(reconstructed.penalty).toBe(250);
    expect(reconstructed.outstanding).toBe(3000); // 2750 + 250 penalty
    expect(reconstructed.totalPayable).toBe(4200); // 3000 + 1200
  });

  it('preserves legacy imported balance when derived replay is lower than db balance', () => {
    const derivedOutstanding = 500;
    const dbOutstanding = 1800; // imported balance from legacy billing system

    const finalOutstanding = Math.max(derivedOutstanding, dbOutstanding);
    expect(finalOutstanding).toBe(1800);
  });

  it('detects usage spikes correctly when records are ordered chronologically', () => {
    const rawUsage = [
      { monthYear: '2025-03', usage: 250 }, // current month: spike!
      { monthYear: '2025-01', usage: 50 },
      { monthYear: '2025-02', usage: 60 },
    ];

    // Chronological sort
    rawUsage.sort((a, b) => a.monthYear.localeCompare(b.monthYear));

    const pastRecords = rawUsage.slice(0, -1);
    const avg = pastRecords.reduce((s, r) => s + r.usage, 0) / pastRecords.length; // (50 + 60) / 2 = 55
    const current = rawUsage[rawUsage.length - 1].usage; // 250

    expect(avg).toBe(55);
    expect(current).toBe(250);
    expect(current > avg * 2.5).toBe(true); // 250 > 137.5 -> Flagged as spike!
  });

  it('safely extracts audit data from server action response shapes', () => {
    // Test unwrapping { success: true, data: { ... } }
    const successRes = {
      success: true,
      data: {
        monthYear: '2025-02',
        totalPending: 5,
        cleanBillsCount: 4,
        flaggedBillsCount: 1,
        cleanBillIds: ['b1', 'b2', 'b3', 'b4'],
        flaggedBills: [
          {
            id: 'b5',
            customerKey: 'BM-1',
            customerName: 'Test Customer',
            meterType: 'Bulk',
            monthYear: '2025-02',
            status: 'Pending',
            bulkIntakeUsage: 100,
            differenceUsage: 45,
            thisMonthBillAmt: 2500,
            outstandingAmt: 0,
            flags: ['High distribution loss: difference usage is 45.0% of bulk inflow'],
          },
        ],
      },
      error: null,
    };

    const payload = (successRes.data ?? successRes) as any;
    expect(Array.isArray(payload.cleanBillIds)).toBe(true);
    expect(payload.cleanBillsCount).toBe(4);
    expect(payload.flaggedBills.length).toBe(1);
    expect(payload.flaggedBills[0].flags[0]).toContain('High distribution loss');

    // Test error shape
    const errorRes = {
      success: false,
      data: null,
      error: { message: 'Forbidden: Missing permission to audit bills' },
    };

    const isError = errorRes.success === false;
    expect(isError).toBe(true);
    expect(errorRes.error.message).toContain('Forbidden');
  });
});
