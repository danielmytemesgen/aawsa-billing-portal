export type ReadingCategory = 'Increase' | 'Decrease' | 'Zero' | 'Fault';

/**
 * Classifies a water meter reading into standard AAWSA categories:
 * - 'Fault': Has an active fault code (e.g. meter broken, unreadable, stuck)
 * - 'Increase': Current reading is higher than previous reading (usage > 0)
 * - 'Decrease': Current reading is lower than previous reading (usage < 0)
 * - 'Zero': Current reading is equal to previous reading (usage === 0)
 */
export function classifyReadingCategory(
  previousReading: number | string,
  currentReading: number | string,
  faultCode?: string | null
): ReadingCategory {
  // 1. Fault code check
  if (faultCode && faultCode.toString().trim() !== '') {
    return 'Fault';
  }

  const previous = Number(previousReading) || 0;
  const current = Number(currentReading) || 0;

  // 2. Exact match check (Zero consumption)
  if (current === previous) {
    return 'Zero';
  }

  // 3. Positive consumption check
  if (current > previous) {
    return 'Increase';
  }

  // 4. Negative consumption check (meter reset / anomaly)
  return 'Decrease';
}
