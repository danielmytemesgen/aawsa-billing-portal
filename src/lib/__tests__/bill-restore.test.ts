import { describe, it, expect } from 'vitest';
import { buildBillReadingRestoreOperations, resolveReadingRestoreState } from '../bill-restore';

describe('resolveReadingRestoreState', () => {
  it('prefers bill readings when they are present', () => {
    const state = resolveReadingRestoreState({
      billPrevRead: 10,
      billCurrRead: 25,
      existingPrevRead: 5,
      existingCurrRead: 18,
      monthYear: '2025-01',
    });

    expect(state).toEqual({
      previousReading: 10,
      currentReading: 25,
      month: '2025-01',
    });
  });

  it('falls back to the month reading values when the bill values are missing', () => {
    const state = resolveReadingRestoreState({
      billPrevRead: null,
      billCurrRead: null,
      monthPrevRead: 12,
      monthCurrRead: 30,
      existingPrevRead: 8,
      existingCurrRead: 20,
      monthYear: '2025-02',
    });

    expect(state).toEqual({
      previousReading: 12,
      currentReading: 30,
      month: '2025-02',
    });
  });

  it('uses the current stored values as the last fallback', () => {
    const state = resolveReadingRestoreState({
      billPrevRead: null,
      billCurrRead: null,
      monthPrevRead: null,
      monthCurrRead: null,
      existingPrevRead: 9,
      existingCurrRead: 22,
      monthYear: '2025-03',
    });

    expect(state).toEqual({
      previousReading: 9,
      currentReading: 22,
      month: '2025-03',
    });
  });

  it('keeps the restore month aligned with the billing month when values come from the monthly reading record', () => {
    const state = resolveReadingRestoreState({
      billPrevRead: null,
      billCurrRead: null,
      monthPrevRead: 40,
      monthCurrRead: 70,
      existingPrevRead: 15,
      existingCurrRead: 55,
      monthYear: '2025-04',
    });

    expect(state).toEqual({
      previousReading: 40,
      currentReading: 70,
      month: '2025-04',
    });
  });

  it('builds restore operations for bulk meters and assigned individual readings', () => {
    const operations = buildBillReadingRestoreOperations(
      {
        CUSTOMERKEY: 'bulk-1',
        PREVREAD: null,
        CURRREAD: null,
        month_year: '2025-04',
      },
      [{ CUST_KEY: 'ind-1', PREVIOUS_READING: 5, METER_READING: 18 }]
    );

    expect(operations).toEqual([
      {
        entityType: 'bulk_meter',
        entityKey: 'bulk-1',
        previousReading: null,
        currentReading: null,
        month: '2025-04',
      },
      {
        entityType: 'individual_customer',
        entityKey: 'ind-1',
        previousReading: 5,
        currentReading: 18,
        month: '2025-04',
      },
    ]);
  });
});
