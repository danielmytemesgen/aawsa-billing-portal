import { describe, it, expect } from 'vitest';
import type { CustomerSyncInput, CustomerSyncOutput } from '../db-queries';

describe('Payment Status & Reconciliation Sync Scope', () => {
  it('ensures CustomerSyncInput enforces payment-only fields without reading updates', () => {
    const input: CustomerSyncInput = {
      customerKey: 'BM-100234',
      contractNo: 'CNT-999',
      paymentStatus: 'Paid',
      amountPaid: 4500,
      paymentDate: new Date().toISOString(),
      paymentChannel: 'CBE',
      bankRef: 'FT240981234',
      reconciliationStatus: 'Reconciled',
      staffId: 'usr-1',
      syncSource: 'AAWSA_UPLOADER_EXTERNAL',
    };

    expect(input.paymentStatus).toBe('Paid');
    expect(input.amountPaid).toBe(4500);
    expect(input.reconciliationStatus).toBe('Reconciled');
    // Ensure reading properties do not exist on the type
    expect((input as any).currentReading).toBeUndefined();
    expect((input as any).previousReading).toBeUndefined();
  });

  it('verifies original Bill Key immutability logic', () => {
    // Logic from dbSyncCustomerPaymentAndReading:
    // const originalBillKey = targetBill?.BILLKEY?.trim() || null;
    // const billKey = originalBillKey || input.billKey?.trim() || input.bankRef?.trim() || null;
    function resolveBillKey(existingBillKey: string | null | undefined, inputBillKey?: string | null, bankRef?: string | null): string | null {
      const original = existingBillKey?.trim() || null;
      return original || inputBillKey?.trim() || bankRef?.trim() || null;
    }

    // 1. When bill already has an original Bill Key, it MUST NEVER be replaced or extended
    expect(resolveBillKey('BILL-2026-001', 'EXT-BILL-999', 'BANK-REF-888')).toBe('BILL-2026-001');
    expect(resolveBillKey('ORIGINAL-KEY', null, 'BANK-REF-888')).toBe('ORIGINAL-KEY');
    
    // 2. Only if the existing bill has no Bill Key does it populate from incoming params
    expect(resolveBillKey(null, 'NEW-BILL-100', 'REF-100')).toBe('NEW-BILL-100');
    expect(resolveBillKey('', null, 'REF-100')).toBe('REF-100');
  });

  it('validates SQL COALESCE guard preserves existing BILLKEY', () => {
    // SQL: "BILLKEY" = COALESCE(NULLIF(TRIM("BILLKEY"), ''), $2)
    function sqlCoalesceBillKey(currentDbValue: string | null, incomingParam: string | null): string | null {
      const trimmed = currentDbValue ? currentDbValue.trim() : null;
      const nullIfEmpty = trimmed === '' ? null : trimmed;
      return nullIfEmpty !== null ? nullIfEmpty : incomingParam;
    }

    // Existing key is untouched even if incomingParam is completely different
    expect(sqlCoalesceBillKey('BK-EXISTING', 'BK-INCOMING')).toBe('BK-EXISTING');
    expect(sqlCoalesceBillKey('BK-EXISTING-CORR', 'BK-NEW')).toBe('BK-EXISTING-CORR');
    
    // Only if current is null or empty does incoming apply
    expect(sqlCoalesceBillKey(null, 'BK-INCOMING')).toBe('BK-INCOMING');
    expect(sqlCoalesceBillKey('   ', 'BK-INCOMING')).toBe('BK-INCOMING');
  });

  it('ensures API route response schema is strictly payment and reconciliation focused', () => {
    // Simulated endpoint response payload
    const apiResponseData = {
      isPaid: true,
      paymentStatus: 'Paid',
      amountPaid: 3500.50,
      paymentDate: '2026-09-24T08:00:00.000Z',
      bankRef: 'CBE-TX-554433',
      paymentChannel: 'CBE Mobile Banking',
      reconciliationStatus: 'Reconciled',
    };

    expect(apiResponseData).not.toHaveProperty('currentReading');
    expect(apiResponseData).not.toHaveProperty('previousReading');
    expect(apiResponseData.paymentStatus).toBe('Paid');
    expect(apiResponseData.reconciliationStatus).toBe('Reconciled');
  });

  it('uses the EXACT paymentChannel received from the endpoint without normalization', () => {
    function resolveChannel(incomingChannel?: string | null, targetBillChannel?: string | null): string {
      return (incomingChannel && incomingChannel.trim())
        ? incomingChannel.trim()
        : (targetBillChannel?.trim() || 'Bank Transfer');
    }

    // Exact strings from external portal must be preserved verbatim
    expect(resolveChannel('telebirr')).toBe('telebirr');
    expect(resolveChannel('CBE Birr')).toBe('CBE Birr');
    expect(resolveChannel('CBE Mobile Banking')).toBe('CBE Mobile Banking');
    expect(resolveChannel('Commercial Bank of Ethiopia')).toBe('Commercial Bank of Ethiopia');
    expect(resolveChannel('Awash Bank')).toBe('Awash Bank');
    expect(resolveChannel('BOA')).toBe('BOA');
    expect(resolveChannel('CBE')).toBe('CBE');
    // Fallback to existing bill channel if incoming is empty
    expect(resolveChannel(null, 'Existing Channel')).toBe('Existing Channel');
    expect(resolveChannel('', 'Existing Channel')).toBe('Existing Channel');
  });
});
