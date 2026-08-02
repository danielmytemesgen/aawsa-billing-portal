export interface CsvImportErrorOptions {
  rowNumber: number;
  entityLabel: string;
  reason: string;
  entityKey?: string;
  rowPrefix?: string;
}

export function formatCsvImportErrorMessage({
  rowNumber,
  entityLabel,
  reason,
  entityKey,
  rowPrefix = 'Row',
}: CsvImportErrorOptions): string {
  const base = `${rowPrefix} ${rowNumber}`;
  const entityRef = entityKey ? ` ${entityLabel} ${entityKey}` : ` ${entityLabel}`;
  return `${base}${entityRef}: ${reason}`;
}
