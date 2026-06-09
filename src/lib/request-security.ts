import { headers } from 'next/headers';

type HeaderSource = {
  get(name: string): string | null;
};

function readHeader(source: HeaderSource | undefined, name: string) {
  return source?.get(name) ?? headers().get(name);
}

export function isSecureRequest(source?: HeaderSource) {
  const proto = readHeader(source, 'x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (proto === 'https') return true;

  const forwarded = readHeader(source, 'forwarded')?.toLowerCase() || '';
  if (forwarded.includes('proto=https')) return true;

  const origin = readHeader(source, 'origin')?.toLowerCase() || readHeader(source, 'referer')?.toLowerCase() || '';
  if (origin.startsWith('https://')) return true;

  return false;
}