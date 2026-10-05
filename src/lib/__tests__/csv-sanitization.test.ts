import { describe, it, expect } from 'vitest';
import { sanitizeCsvCell, sanitizeCsvRecord, sanitizeCsvRecords } from '../csv-sanitizer';

describe('sanitizeCsvCell', () => {
  // --- Formula injection vectors ---
  it('strips leading = (basic formula)', () => {
    expect(sanitizeCsvCell('=CMD|"/C calc"!A0')).toBe('CMD|"/C calc"!A0');
  });

  it('strips leading + (Lotus formula prefix)', () => {
    expect(sanitizeCsvCell('+1-2')).toBe('1-2');
  });

  it('strips leading - (negative formula trick)', () => {
    expect(sanitizeCsvCell('-2+3+cmd|" /C calc"!A0')).toBe('2+3+cmd|" /C calc"!A0');
  });

  it('strips leading @ (DDE function prefix)', () => {
    expect(sanitizeCsvCell('@SUM(A1:A10)')).toBe('SUM(A1:A10)');
  });

  it('strips leading tab then = (both are formula triggers)', () => {
    // Tab is stripped first, then the revealed = is also stripped
    expect(sanitizeCsvCell('\t=HYPERLINK("http://evil.com")')).toBe('HYPERLINK("http://evil.com")');
  });

  it('strips multiple stacked formula characters', () => {
    expect(sanitizeCsvCell('==+@cmd')).toBe('cmd');
  });

  it('strips leading = then re-checks for next formula char', () => {
    expect(sanitizeCsvCell('=+CMD')).toBe('CMD');
  });

  // --- Safe values (must pass through unchanged) ---
  it('leaves normal text unchanged', () => {
    expect(sanitizeCsvCell('John Doe')).toBe('John Doe');
  });

  it('leaves numeric strings unchanged', () => {
    expect(sanitizeCsvCell('12345.67')).toBe('12345.67');
  });

  it('leaves bill numbers unchanged', () => {
    expect(sanitizeCsvCell('BILL-2026-001234')).toBe('BILL-2026-001234');
  });

  it('leaves date strings unchanged', () => {
    expect(sanitizeCsvCell('2026-09-10')).toBe('2026-09-10');
  });

  it('leaves empty string unchanged', () => {
    expect(sanitizeCsvCell('')).toBe('');
  });

  // --- Edge cases ---
  it('returns empty string for null', () => {
    expect(sanitizeCsvCell(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeCsvCell(undefined)).toBe('');
  });

  it('converts number to string', () => {
    expect(sanitizeCsvCell(42)).toBe('42');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeCsvCell('  hello  ')).toBe('hello');
  });
});

describe('sanitizeCsvRecord', () => {
  it('sanitizes all string fields', () => {
    const record = {
      name: '=CMD|calc',
      amount: 1500,
      billKey: '+BILL-001',
      paymentDate: '2026-09-10',
    };
    const result = sanitizeCsvRecord(record);
    expect(result.name).toBe('CMD|calc');
    expect(result.amount).toBe(1500); // number untouched
    expect(result.billKey).toBe('BILL-001');
    expect(result.paymentDate).toBe('2026-09-10'); // safe date unchanged
  });

  it('handles empty record', () => {
    expect(sanitizeCsvRecord({})).toEqual({});
  });
});

describe('sanitizeCsvRecords', () => {
  it('sanitizes all records in an array', () => {
    const records = [
      { name: '=Hack', amount: 100 },
      { name: 'Safe Name', amount: 200 },
      { name: '@Evil', amount: 300 },
    ];
    const results = sanitizeCsvRecords(records);
    expect(results[0].name).toBe('Hack');
    expect(results[1].name).toBe('Safe Name');
    expect(results[2].name).toBe('Evil');
  });

  it('returns empty array for empty input', () => {
    expect(sanitizeCsvRecords([])).toEqual([]);
  });
});
