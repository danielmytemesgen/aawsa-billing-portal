/**
 * Enterprise Structured JSON Logger for AAWSA Billing Portal.
 * Formats logs as JSON in production for log aggregation (ELK, CloudWatch, Datadog),
 * with human-friendly readable formatting in local development.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogPayload {
  action?: string;
  staffId?: string;
  traceId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

function formatLog(level: LogLevel, message: string, payload?: LogPayload) {
  const isProd = process.env.NODE_ENV === 'production';
  const timestamp = new Date().toISOString();

  let errorDetails: unknown = undefined;
  if (payload?.error) {
    if (payload.error instanceof Error) {
      errorDetails = {
        message: payload.error.message,
        stack: payload.error.stack,
        name: payload.error.name,
      };
    } else {
      errorDetails = payload.error;
    }
  }

  const logObject: Record<string, unknown> = {
    timestamp,
    level,
    message,
  };

  if (payload?.action) logObject.action = payload.action;
  if (payload?.staffId) logObject.staffId = payload.staffId;
  if (payload?.traceId) logObject.traceId = payload.traceId;
  if (payload?.durationMs !== undefined) logObject.durationMs = payload.durationMs;
  if (payload?.metadata) logObject.metadata = payload.metadata;
  if (errorDetails !== undefined) logObject.error = errorDetails;

  if (isProd) {
    return JSON.stringify(logObject);
  }

  // Development readable format
  const badge = `[${level.toUpperCase()}]`;
  const actionTag = payload?.action ? `[${payload.action}]` : '';
  return `${timestamp} ${badge} ${actionTag} ${message}`;
}

export const logger = {
  debug(message: string, payload?: LogPayload) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog('debug', message, payload), payload?.metadata || '');
    }
  },
  info(message: string, payload?: LogPayload) {
    console.info(formatLog('info', message, payload));
  },
  warn(message: string, payload?: LogPayload) {
    console.warn(formatLog('warn', message, payload));
  },
  error(message: string, payload?: LogPayload) {
    console.error(formatLog('error', message, payload));
  },
};
