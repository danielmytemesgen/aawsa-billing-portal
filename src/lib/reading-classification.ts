export type ReadingCategory = 'Increase' | 'Decrease' | 'Zero' | 'Fault';

export function classifyReadingCategory(
  previousReading: number | string,
  currentReading: number | string,
  faultCode?: string | null
): ReadingCategory {
  if (faultCode && faultCode.toString().trim() !== '') {
    return 'Fault';
  }

  const previous = Number(previousReading) || 0;
  const current = Number(currentReading) || 0;

  if (current === previous) {
    return 'Zero';
  }

  if (previous === 0) {
    return current === 0 ? 'Zero' : 'Increase';
  }

  const ratio = current / previous;

  if (ratio >= 1.5) {
    return 'Increase';
  }

  if (ratio <= 0.5) {
    return 'Decrease';
  }

  return 'Zero';
}
