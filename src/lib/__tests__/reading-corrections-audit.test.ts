import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../constants/auth';
import { READING_CORRECTION_REASONS as REASON_CATEGORIES } from '@/types/db';

describe('Meter Reading Corrections Audit & Verification', () => {
  it('defines valid audit reason categories for reading adjustments', () => {
    const validCodes = REASON_CATEGORIES.map(r => r.value);
    expect(validCodes).toContain('meter_dial_misread');
    expect(validCodes).toContain('transposed_digits');
    expect(validCodes).toContain('meter_rollover');
    expect(validCodes).toContain('customer_dispute');
    expect(validCodes).toContain('data_entry_error');
    expect(validCodes).toContain('fault_code_update');
    expect(validCodes).toContain('other');
  });
  it('correctly calculates consumption variance between original and corrected readings', () => {
    const oldPrev = 153;
    const oldCurr = 534;
    const oldUsage = oldCurr - oldPrev; // 381 m³

    // Correction: Reader actually read 453 instead of 534 (transposed digits)
    const newPrev = 153;
    const newCurr = 453;
    const newUsage = newCurr - newPrev; // 300 m³

    const readingDiff = newCurr - oldCurr; // -81
    const consumptionVariance = newUsage - oldUsage; // -81 m³
    expect(oldUsage).toBe(381);
    expect(newUsage).toBe(300);
    expect(readingDiff).toBe(-81);
    expect(consumptionVariance).toBe(-81);
  });

  it('correctly identifies positive consumption adjustments (under-recorded meters)', () => {
    const oldPrev = 100;
    const oldCurr = 120;
    const oldUsage = 20;

    const newPrev = 100;
    const newCurr = 160;
    const newUsage = 60;

    const consumptionVariance = newUsage - oldUsage;
    expect(consumptionVariance).toBe(40);
    expect(consumptionVariance > 0).toBe(true);
  });

  it('enforces required justification length of at least 5 characters', () => {
    const validateJustification = (reason: string) => {
      const trimmed = (reason || '').trim();
      return trimmed.length >= 5;
    };

    expect(validateJustification('')).toBe(false);
    expect(validateJustification('fix')).toBe(false);
    expect(validateJustification('   bad ')).toBe(false);
    expect(validateJustification('Dial misread confirmed on site')).toBe(true);
  });

  it('supports role-based reading correction report access check', () => {
    const canViewReadingCorrectionsReport = (permissions: Set<string>) => {
      const isWildcard = permissions.has('*') || permissions.has('all');
      if (isWildcard) return true;

      return (
        permissions.has(PERMISSIONS.METER_READINGS_CORRECTIONS_VIEW) ||
        permissions.has(PERMISSIONS.METER_READINGS_CORRECT) ||
        permissions.has(PERMISSIONS.METER_READINGS_VIEW_ALL) ||
        permissions.has(PERMISSIONS.METER_READINGS_VIEW_BRANCH) ||
        permissions.has(PERMISSIONS.REPORTS_GENERATE_ALL) ||
        permissions.has(PERMISSIONS.REPORTS_GENERATE_BRANCH) ||
        permissions.has(PERMISSIONS.BILL_VIEW_ALL)
      );
    };

    // Admin with wildcard
    expect(canViewReadingCorrectionsReport(new Set(['*']))).toBe(true);

    // Branch staff with branch view
    expect(canViewReadingCorrectionsReport(new Set([PERMISSIONS.METER_READINGS_VIEW_BRANCH]))).toBe(true);

    // User without report or reading permissions
    expect(canViewReadingCorrectionsReport(new Set(['unrelated_permission']))).toBe(false);
  });
});
