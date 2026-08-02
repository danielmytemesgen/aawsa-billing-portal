import { describe, it, expect } from 'vitest';
import { deriveMonthKey, getPartitionName } from '../partition-utils';

describe('partition utilities', () => {
  it('derives a YYYY-MM month key from a date string', () => {
    expect(deriveMonthKey('2024-03-15T10:00:00.000Z')).toBe('2024-03');
  });

  it('returns null for invalid dates', () => {
    expect(deriveMonthKey('not-a-date')).toBeNull();
  });

  it('builds a partition name using the table prefix and month key', () => {
    expect(getPartitionName('individual_customer_readings', '2024-03')).toBe('individual_customer_readings_2024_03');
  });
});
