/**
 * Web Worker script for off-thread high-performance CSV processing.
 * Parses large CSV text files, normalizes headers, and sanitizes formula injection risks
 * without blocking the main browser UI rendering thread.
 */

const CSV_SPLIT_REGEX = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;

function sanitizeCsvField(value: any): any {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[=+\-@]/.test(trimmed)) {
      return `'${trimmed}`;
    }
    return trimmed;
  }
  return value;
}

function normalizeHeader(header: string): string {
  return header.trim().replace(/^\uFEFF/, '').replace(/[\s_-]+/g, '').toLowerCase();
}

self.onmessage = function (e: MessageEvent) {
  const { csvText, expectedHeaders } = e.data;
  
  try {
    const text = (csvText || '').replace(/\uFEFF/g, '');
    const rawLines = text.split(/\r\n|\n/);
    const lines = rawLines
      .map((line: string) => line.trim())
      .filter((line: string) => line !== "" && !line.startsWith('#'));

    if (lines.length < 2) {
      self.postMessage({ error: "CSV file must contain a header row and at least one data row." });
      return;
    }

    const headerLine = lines[0].split(CSV_SPLIT_REGEX).map((h: string) => h.trim().replace(/^"|"$/g, ''));
    const normalizedCSVHeaders = headerLine.map(normalizeHeader);
    const headerIndexMap: Record<string, number> = {};
    normalizedCSVHeaders.forEach((h: string, idx: number) => {
      headerIndexMap[h] = idx;
    });

    const parsedRows: Record<string, any>[] = [];
    const totalRows = lines.length - 1;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(CSV_SPLIT_REGEX).map((v: string) => v.trim().replace(/^"|"$/g, ''));
      const rowData: Record<string, any> = {};

      expectedHeaders.forEach((expectedHeader: string) => {
        const normH = normalizeHeader(expectedHeader);
        const csvIdx = headerIndexMap[normH];
        const rawVal = csvIdx !== undefined && csvIdx !== -1 ? (values[csvIdx] || undefined) : undefined;
        rowData[expectedHeader] = rawVal !== undefined ? sanitizeCsvField(rawVal) : undefined;
      });

      parsedRows.push(rowData);

      // Post progress every 1,000 rows
      if (i % 1000 === 0 || i === totalRows) {
        self.postMessage({ type: 'progress', percent: Math.round((i / totalRows) * 50) });
      }
    }

    self.postMessage({ type: 'complete', rows: parsedRows, totalRows });
  } catch (err: any) {
    self.postMessage({ type: 'error', error: err.message || 'Worker CSV processing failed.' });
  }
};
