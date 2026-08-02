export type ObservabilityLevel = 'info' | 'warn' | 'error';

export interface ObservabilityContext {
  operation: string;
  details?: Record<string, unknown>;
  level?: ObservabilityLevel;
}

function serializeDetails(details?: Record<string, unknown>) {
  if (!details) return undefined;
  return Object.entries(details).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

export function logOperation({ operation, details, level = 'info' }: ObservabilityContext) {
  const payload = serializeDetails(details);
  const prefix = `[obs] ${operation}`;

  if (level === 'error') {
    console.error(prefix, payload);
    return;
  }

  if (level === 'warn') {
    console.warn(prefix, payload);
    return;
  }

  console.info(prefix, payload);
}
