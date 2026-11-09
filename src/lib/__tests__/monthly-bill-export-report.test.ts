import { describe, it, expect, vi } from 'vitest';
import { PERMISSIONS } from '@/lib/constants/auth';
import {
  ALL_MONTHLY_BILL_COLUMNS,
  exportMonthlyBillsToCsv,
  exportMonthlyBillsToXlsx,
} from '@/lib/export-utils';

vi.mock('@/lib/xlsx', () => ({
  arrayToCsvBlob: vi.fn((data, headers) => new Blob([JSON.stringify({ data, headers })])),
  arrayToXlsxBlob: vi.fn((data, headers) => new Blob([JSON.stringify({ data, headers })])),
  downloadFile: vi.fn(),
}));

describe('Monthly Bill Export Report Feature', () => {
  it('has exactly 16 official switch columns defined in ALL_MONTHLY_BILL_COLUMNS', () => {
    expect(ALL_MONTHLY_BILL_COLUMNS).toHaveLength(16);
    const ids = ALL_MONTHLY_BILL_COLUMNS.map((c) => c.id);
    expect(ids).toEqual([
      "BILLKEY", "CUSTOMERKEY", "CUSTOMERNAME", "CUSTOMERTIN", "CUSTOMERBRANCH", "REASON",
      "CURRREAD", "PREVREAD", "CONS", "TOTALBILLAMOUNT", "THISMONTHBILLAMT",
      "OUTSTANDINGAMT", "PENALTYAMT", "DRACCTNO", "CRACCTNO", "VAT_AMOUNT"
    ]);
  });

  it('has REPORT_MONTHLY_BILL_EXPORT and REPORT_BRANCH_MONTHLY_BILL_EXPORT constants defined', () => {
    expect(PERMISSIONS.REPORT_MONTHLY_BILL_EXPORT).toBe('report:monthly_bill_export');
    expect(PERMISSIONS.REPORT_BRANCH_MONTHLY_BILL_EXPORT).toBe('report:branch_monthly_bill_export');
  });

  it('exports all 16 columns by default when customHeaders is omitted', async () => {
    const { arrayToCsvBlob } = await import('@/lib/xlsx');
    vi.clearAllMocks();

    const sampleRecords = [
      {
        BILLKEY: 'BBPT-0000000001',
        CUSTOMERKEY: 'CUST-1001',
        CUSTOMERNAME: 'Test Customer',
        CUSTOMERTIN: 'TIN-987654',
        CUSTOMERBRANCH: 'Arada',
        REASON: 'Sep-2026',
        CURRREAD: 1500,
        PREVREAD: 1400,
        CONS: 100,
        TOTALBILLAMOUNT: 1250.50,
        THISMONTHBILLAMT: 1000.00,
        OUTSTANDINGAMT: 250.50,
        PENALTYAMT: 0,
        VAT_AMOUNT: 150,
        DRACCTNO: '1000123456',
        CRACCTNO: '2000654321',
      },
    ];

    exportMonthlyBillsToCsv(sampleRecords, 'monthly_bill_export_test');

    expect(arrayToCsvBlob).toHaveBeenCalled();
    const calledHeaders = (arrayToCsvBlob as any).mock.calls[0][1];
    expect(calledHeaders).toHaveLength(16);
  });

  it('exports only selected columns when a subset of columns is specified (multi-select filter)', async () => {
    const { arrayToCsvBlob, arrayToXlsxBlob } = await import('@/lib/xlsx');
    vi.clearAllMocks();

    const sampleRecords = [
      {
        BILLKEY: 'BBPT-0000000002',
        CUSTOMERKEY: 'CUST-1002',
        CUSTOMERNAME: 'Another Customer',
        TOTALBILLAMOUNT: 600.00,
        THISMONTHBILLAMT: 500.00,
      },
    ];

    // User selected 3 columns: BILLKEY, CUSTOMERNAME, TOTALBILLAMOUNT
    const userSelectedColumns = ['BILLKEY', 'CUSTOMERNAME', 'TOTALBILLAMOUNT'];

    exportMonthlyBillsToCsv(sampleRecords, 'test_subset', userSelectedColumns);
    const csvHeaders = (arrayToCsvBlob as any).mock.calls[0][1];
    const csvData = (arrayToCsvBlob as any).mock.calls[0][0];

    expect(csvHeaders).toEqual(['BILLKEY', 'CUSTOMERNAME', 'TOTALBILLAMOUNT']);
    expect(Object.keys(csvData[0])).toEqual(['BILLKEY', 'CUSTOMERNAME', 'TOTALBILLAMOUNT']);

    exportMonthlyBillsToXlsx(sampleRecords, 'test_subset', userSelectedColumns);
    const xlsxHeaders = (arrayToXlsxBlob as any).mock.calls[0][1];
    const xlsxData = (arrayToXlsxBlob as any).mock.calls[0][0];

    expect(xlsxHeaders).toEqual(['BILLKEY', 'CUSTOMERNAME', 'TOTALBILLAMOUNT']);
    expect(Object.keys(xlsxData[0])).toEqual(['BILLKEY', 'CUSTOMERNAME', 'TOTALBILLAMOUNT']);
  });
});
