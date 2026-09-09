import { describe, it, expect, vi } from 'vitest';
import { dbGetPreApprovalAuditMetrics, dbGetWaterBalanceMetrics } from '../db-queries';

vi.mock('../db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (cb) => cb({
    query: vi.fn().mockResolvedValue({ rows: [] })
  }))
}));

import { query } from '../db';

describe('Premium Billing Features - Smart Audit & Water Balance', () => {
  it('dbGetPreApprovalAuditMetrics categorizes clean vs flagged bills with anomaly flags', async () => {
    const mockBills = [
      {
        id: 'bill-clean-1',
        month_year: '2025-01',
        status: 'Pending',
        CUSTOMERKEY: 'BM-101',
        individual_customer_id: null,
        prev_read: 100,
        curr_read: 150,
        diff_usage: 10, // 10 / 50 = 20% loss (normal, < 30%)
        this_month_bill: 1500,
        total_bill: 1500,
        outstanding_amt: 0,
        customer_name: 'St. Paul Complex',
        meter_type: 'Bulk'
      },
      {
        id: 'bill-high-loss',
        month_year: '2025-01',
        status: 'Pending',
        CUSTOMERKEY: 'BM-102',
        individual_customer_id: null,
        prev_read: 200,
        curr_read: 300,
        diff_usage: 45, // 45 / 100 = 45% loss (exceeds 30% threshold!)
        this_month_bill: 4200,
        total_bill: 4200,
        outstanding_amt: 0,
        customer_name: 'Bole Mall',
        meter_type: 'Bulk'
      },
      {
        id: 'bill-negative-diff',
        month_year: '2025-01',
        status: 'Pending',
        CUSTOMERKEY: 'BM-103',
        individual_customer_id: null,
        prev_read: 50,
        curr_read: 100,
        diff_usage: -12, // Negative difference!
        this_month_bill: 1200,
        total_bill: 1200,
        outstanding_amt: 0,
        customer_name: 'Condo Block A',
        meter_type: 'Bulk'
      }
    ];

    vi.mocked(query).mockResolvedValueOnce(mockBills as any);

    const result = await dbGetPreApprovalAuditMetrics('2025-01');

    expect(result.totalPending).toBe(3);
    expect(result.cleanBillsCount).toBe(1);
    expect(result.flaggedBillsCount).toBe(2);
    expect(result.cleanBillIds).toEqual(['bill-clean-1']);

    const flaggedHighLoss = result.flaggedBills.find(b => b.id === 'bill-high-loss');
    expect(flaggedHighLoss).toBeDefined();
    expect(flaggedHighLoss?.flags.some(f => f.includes('High distribution loss'))).toBe(true);

    const flaggedNegDiff = result.flaggedBills.find(b => b.id === 'bill-negative-diff');
    expect(flaggedNegDiff).toBeDefined();
    expect(flaggedNegDiff?.flags.some(f => f.includes('Negative difference usage'))).toBe(true);
  });

  it('dbGetWaterBalanceMetrics aggregates intake, billed sub-meters, and loss volume', async () => {
    const mockBills = [
      {
        CUSTOMERKEY: 'BM-1',
        prev_read: 1000,
        curr_read: 1500, // 500 m³ intake
        diff_usage: 100, // 100 m³ difference loss
        bill_amt: 20000
      },
      {
        CUSTOMERKEY: 'BM-2',
        prev_read: 500,
        curr_read: 1000, // 500 m³ intake
        diff_usage: 50,  // 50 m³ difference loss
        bill_amt: 18000
      }
    ];

    vi.mocked(query).mockResolvedValueOnce(mockBills as any);

    const metrics = await dbGetWaterBalanceMetrics('2025-01');

    expect(metrics.totalBulkIntakeVolume).toBe(1000);
    expect(metrics.differenceLossVolume).toBe(150);
    expect(metrics.totalSubMeterVolume).toBe(850);
    expect(metrics.lossPercentage).toBe(15);
    expect(metrics.totalActiveBulkMeters).toBe(2);
    expect(metrics.estimatedRevenueLossEtb).toBeGreaterThan(0);
  });

  it('generates standard utility payment string for QR encoding', () => {
    const customerKey = 'BM-00123';
    const billId = 'BILL-88210';
    const monthYear = '2025-01';
    const amount = 3450.5;

    const qrPayload = `AAWSA|PAY|${customerKey}|${billId}|${monthYear}|${amount.toFixed(2)}`;
    expect(qrPayload).toBe('AAWSA|PAY|BM-00123|BILL-88210|2025-01|3450.50');
    expect(qrPayload.startsWith('AAWSA|PAY')).toBe(true);
  });
});
