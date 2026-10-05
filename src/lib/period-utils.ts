/**
 * Period Normalization Utilities
 *
 * Converts varying external billing period formats (e.g. from AAWSA central server)
 * into strict ISO standard `YYYY-MM` format required for database partitioning and deduplication.
 */

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

/**
 * Normalizes any billing period string into standard `YYYY-MM`.
 *
 * Supported inputs:
 *  - "2026-08" -> "2026-08"
 *  - "2026/08" -> "2026-08"
 *  - "2026.08" -> "2026-08"
 *  - "Aug-26" -> "2026-08"
 *  - "Aug-2026" -> "2026-08"
 *  - "August 2026" -> "2026-08"
 *  - "08/2026" -> "2026-08"
 *  - "08-2026" -> "2026-08"
 *  - null / empty / unrecognized -> Current UTC year-month, e.g. "2026-09"
 */
export function normalizeBillingPeriod(input?: string | null): string {
  if (!input || typeof input !== 'string') {
    return getCurrentUtcPeriod();
  }

  const raw = input.trim();
  if (!raw) return getCurrentUtcPeriod();

  // 1. Direct match: YYYY-MM
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const month = parseInt(raw.slice(5, 7), 10);
    if (month >= 1 && month <= 12) return raw;
  }

  // 2. YYYY/MM or YYYY.MM
  const yyyyMmMatch = raw.match(/^(\d{4})[/.](\d{1,2})$/);
  if (yyyyMmMatch) {
    const y = yyyyMmMatch[1];
    const m = parseInt(yyyyMmMatch[2], 10);
    if (m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}`;
    }
  }

  // 3. MM/YYYY or MM-YYYY
  const mmYyyyMatch = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (mmYyyyMatch) {
    const m = parseInt(mmYyyyMatch[1], 10);
    const y = mmYyyyMatch[2];
    if (m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}`;
    }
  }

  // 4. Textual month with year, e.g. "Aug-26", "Aug-2026", "August 2026", "2026-Aug"
  const cleaned = raw.toLowerCase().replace(/[,\s_]+/g, '-');
  const tokens = cleaned.split('-').filter(Boolean);

  let foundMonth: string | null = null;
  let foundYear: string | null = null;

  for (const token of tokens) {
    if (!foundMonth && MONTH_MAP[token]) {
      foundMonth = MONTH_MAP[token];
    } else if (/^\d{4}$/.test(token)) {
      foundYear = token;
    } else if (/^\d{2}$/.test(token) && !foundYear) {
      // e.g. "26" -> 2026
      foundYear = `20${token}`;
    }
  }

  if (foundMonth && foundYear) {
    return `${foundYear}-${foundMonth}`;
  }

  // Fallback: try parsing as a date
  const parsedDate = new Date(raw);
  if (!isNaN(parsedDate.getTime())) {
    const y = parsedDate.getUTCFullYear();
    const m = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  return getCurrentUtcPeriod();
}

/**
 * Validates whether a period string is in strict `YYYY-MM` format.
 */
export function isBilledPeriodValid(period?: string | null): boolean {
  if (!period || typeof period !== 'string') return false;
  if (!/^\d{4}-\d{2}$/.test(period)) return false;
  const m = parseInt(period.slice(5, 7), 10);
  return m >= 1 && m <= 12;
}

function getCurrentUtcPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
