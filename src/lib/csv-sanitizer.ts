/**
 * CSV Formula Injection Protection
 *
 * Spreadsheet applications (Excel, LibreOffice, Google Sheets) treat cells
 * starting with =, +, -, or @ as formulas.  An attacker can craft a CSV row
 * such as:  =CMD|' /C calc'!A0  which executes when a victim opens the export.
 *
 * This module sanitizes every cell value before it is persisted to the DB or
 * returned in an export to prevent CSV / formula injection attacks.
 *
 * References:
 *   - OWASP: https://owasp.org/www-community/attacks/CSV_Injection
 */

/** Characters that trigger formula evaluation in spreadsheet apps. */
const FORMULA_START_CHARS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitize a single CSV cell value.
 *
 * - Strips leading formula-trigger characters (=, +, -, @, tab, CR).
 * - Trims surrounding whitespace.
 * - Returns an empty string for null / undefined inputs.
 *
 * @param value - Raw cell value from a CSV row.
 * @returns     - Safe string value.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str = String(value).trim();

  // Strip all leading formula-trigger characters (could be stacked: =+=CMD...)
  while (str.length > 0 && FORMULA_START_CHARS.includes(str[0])) {
    str = str.slice(1).trimStart();
  }

  return str;
}

/**
 * Sanitize all string fields of a plain object record (shallow).
 * Numeric fields are intentionally left as numbers.
 *
 * @param record - A CSV row object with mixed-type values.
 * @returns      - A new object with all string values sanitized.
 */
export function sanitizeCsvRecord<T extends Record<string, unknown>>(record: T): T {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeCsvCell(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Sanitize an entire array of CSV row objects.
 *
 * @param records - Array of CSV row objects.
 * @returns       - Array with all string fields sanitized.
 */
export function sanitizeCsvRecords<T extends Record<string, unknown>>(records: T[]): T[] {
  return records.map(sanitizeCsvRecord);
}
