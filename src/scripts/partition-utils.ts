export function deriveMonthKey(input: string | Date | null | undefined): string | null {
  if (!input) return null;

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getPartitionName(tableName: string, monthKey: string | null | undefined): string {
  if (!monthKey) return `${tableName}_default`;
  return `${tableName}_${monthKey.replace('-', '_')}`;
}
