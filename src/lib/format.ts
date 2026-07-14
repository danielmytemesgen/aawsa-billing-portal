export function formatNumber(v: any, opts?: { dashForZero?: boolean }) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  if (opts?.dashForZero && n === 0) return '-';
  return n.toFixed(2);
}

export function formatInteger(v: any) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n)) : '-';
}
