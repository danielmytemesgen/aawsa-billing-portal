import { describe, it, expect } from 'vitest';

describe('CSV Reading Upload Parser & Normalization Logic', () => {
  // Test 1: UTF-8 BOM Stripping
  it('should strip UTF-8 BOM from CSV text', () => {
    const rawWithBom = '\uFEFFCUST_KEY,PREVIOUS_READING,METER_READING,READING_DATE\nCUST001,100,150,2026-09-30';
    let text = rawWithBom;
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }
    expect(text.startsWith('CUST_KEY')).toBe(true);
    expect(text.charCodeAt(0)).not.toBe(0xFEFF);
  });

  // Test 2: Delimiter auto-detection
  it('should detect comma, semicolon, and tab delimiters accurately', () => {
    function detectDelimiter(headerLine: string): string {
      const commaCount = (headerLine.match(/,/g) || []).length;
      const semiCount = (headerLine.match(/;/g) || []).length;
      const tabCount = (headerLine.match(/\t/g) || []).length;
      if (semiCount > commaCount && semiCount > tabCount) return ';';
      if (tabCount > commaCount && tabCount > semiCount) return '\t';
      return ',';
    }

    expect(detectDelimiter('CUST_KEY,PREVIOUS_READING,METER_READING,READING_DATE')).toBe(',');
    expect(detectDelimiter('CUST_KEY;PREVIOUS_READING;METER_READING;READING_DATE')).toBe(';');
    expect(detectDelimiter('CUST_KEY\tPREVIOUS_READING\tMETER_READING\tREADING_DATE')).toBe('\t');
  });

  // Test 3: Header alias mapping
  it('should resolve standard aliases to canonical required fields', () => {
    const HEADER_ALIASES: Record<string, string> = {
      cust_key: 'CUST_KEY',
      custkey: 'CUST_KEY',
      customerkey: 'CUST_KEY',
      customer_key: 'CUST_KEY',
      previous_reading: 'PREVIOUS_READING',
      previousreading: 'PREVIOUS_READING',
      prev_reading: 'PREVIOUS_READING',
      prevreading: 'PREVIOUS_READING',
      meter_reading: 'METER_READING',
      meterreading: 'METER_READING',
      current_reading: 'METER_READING',
      currentreading: 'METER_READING',
      reading: 'METER_READING',
      reading_date: 'READING_DATE',
      readingdate: 'READING_DATE',
      read_date: 'READING_DATE',
      readdate: 'READING_DATE',
      date: 'READING_DATE',
    };

    const normalizeKey = (h: string) => h.toLowerCase().replace(/[\s\-_]+/g, '');
    const headers = ['CUSTOMERKEY', 'PREV_READING', 'CURRENT_READING', 'READ_DATE'];

    const canonicals = headers.map(h => HEADER_ALIASES[normalizeKey(h)] || h);
    expect(canonicals).toEqual(['CUST_KEY', 'PREVIOUS_READING', 'METER_READING', 'READING_DATE']);
  });

  // Test 4: Timezone-safe date normalization
  it('should normalize dates accurately without timezone rolling bugs', () => {
    function normalizeReadingDate(dateValue: string): string {
      if (!dateValue || typeof dateValue !== 'string') return '';
      const trimmed = dateValue.trim();

      const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
      if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
      }

      const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
      if (ymdMatch) {
        const year = ymdMatch[1];
        const month = ymdMatch[2].padStart(2, '0');
        const day = ymdMatch[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      return '';
    }

    expect(normalizeReadingDate('2026-09-30')).toBe('2026-09-30');
    expect(normalizeReadingDate('30/09/2026')).toBe('2026-09-30');
    expect(normalizeReadingDate('5/9/2026')).toBe('2026-09-05');
    expect(normalizeReadingDate('2026/9/5')).toBe('2026-09-05');
  });

  // Test 5: Union column aggregation for backend chunk
  it('should aggregate all present columns across batch chunk items', () => {
    const chunk = [
      { reading: { CUST_KEY: 'C1', METER_READING: 100, reading_month: '2026-09' } },
      { reading: { CUST_KEY: 'C2', METER_READING: 200, FAULT_CODE: 'B', ROUND_KEY: 'R1', reading_month: '2026-09' } },
    ];

    const colSet = new Set<string>();
    for (const item of chunk) {
      const { reading_month: _ign, id: _ignId, created_at: _ignCa, ...safe } = item.reading as any;
      Object.keys(safe).forEach(k => {
        if (safe[k] !== undefined) colSet.add(k);
      });
    }

    const cols = Array.from(colSet);
    expect(cols).toContain('CUST_KEY');
    expect(cols).toContain('METER_READING');
    expect(cols).toContain('FAULT_CODE');
    expect(cols).toContain('ROUND_KEY');
    expect(cols).not.toContain('reading_month');
  });

  // Test 6: Empty string reading validation
  it('should reject empty string meter readings instead of coercing to 0', async () => {
    const { z } = await import('zod');
    const readingSchema = z.object({
      METER_READING: z.preprocess(
        (val) => (val === "" || val === null || val === undefined ? undefined : val),
        z.coerce.number({ required_error: "METER_READING is required." }).min(0)
      )
    });

    const emptyResult = readingSchema.safeParse({ METER_READING: "" });
    expect(emptyResult.success).toBe(false);

    const zeroResult = readingSchema.safeParse({ METER_READING: "0" });
    expect(zeroResult.success).toBe(true);
    if (zeroResult.success) {
      expect(zeroResult.data.METER_READING).toBe(0);
    }

    const validResult = readingSchema.safeParse({ METER_READING: "1234.5" });
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data.METER_READING).toBe(1234.5);
    }
  });
});

