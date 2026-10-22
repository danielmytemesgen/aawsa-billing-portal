import * as XLSX from 'xlsx';

export const arrayToXlsxBlob = (data: any[], headers: string[], sheetName: string = 'Report'): Blob => {
  // Build AOA: header row + data rows
  const aoa: any[][] = [
    headers,
    ...data.map(row => headers.map(h => row[h] ?? '')),
  ];

  const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(aoa);

  // Force string type on text cells to prevent Excel auto-parsing
  // e.g. "2026-08" would be misread as a date serial; "MG" fine but coerce for safety
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;

      if (R === 0) {
        // Header row — bold
        cell.s = { font: { bold: true } } as any;
      } else {
        // Data rows — force string type for non-numeric text values
        if (typeof cell.v === 'string') {
          // Explicitly mark as string so Excel doesn't misparse dates/codes
          cell.t = 's';
        }
      }
    }
  }

  // Auto column widths
  const colWidths = headers.map((header, colIndex) => {
    let maxLength = (header || '').length;
    for (let R = 1; R < aoa.length; R++) {
      const val = aoa[R][colIndex];
      if (val != null) {
        maxLength = Math.max(maxLength, String(val).length);
      }
    }
    return { wch: Math.min(maxLength + 2, 60) };
  });
  ws['!cols'] = colWidths as any;

  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const arrayToCsvBlob = (data: any[], headers: string[]): Blob => {
  const headerRow = headers.join(',');
  const rows = data.map(row => {
    return headers.map(header => {
      const cellValue = row[header] === null || row[header] === undefined ? '' : row[header];
      const stringValue = String(cellValue);
      // Escape quotes and wrap in quotes if contains comma, quote or newline
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });

  const csvContent = [headerRow, ...rows].join('\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
};


export const downloadFile = (content: Blob, fileName: string) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};
