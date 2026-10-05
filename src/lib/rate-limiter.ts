/**
 * Rate Limiter Module
 *
 * Provides in-memory rate limiting for login endpoints, sensitive server actions,
 * and per-user operation throttling.
 *
 * For production deployments with multiple server instances, consider replacing
 * the in-memory store with a Redis-backed solution (e.g. ioredis + sliding window).
 */

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

const store = new Map<string, AttemptRecord>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;  // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minute lockout after max attempts

// ─── Login / Auth Rate Limiter ────────────────────────────────────────────────

/**
 * Check the rate limit for a given key (e.g. staff_login:<email>).
 * Defaults to 5 attempts per 15-minute window, then 15-minute lockout.
 */
export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = store.get(key);

  if (record) {
    if (record.lockedUntil && now < record.lockedUntil) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    if (now - record.firstAttemptAt > WINDOW_MS) {
      store.set(key, { count: 1, firstAttemptAt: now });
      return { allowed: true };
    }

    record.count += 1;

    if (record.count > MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_MS;
      store.set(key, record);
      const retryAfterSeconds = Math.ceil(LOCKOUT_MS / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    store.set(key, record);
    return { allowed: true };
  }

  store.set(key, { count: 1, firstAttemptAt: now });
  return { allowed: true };
}

/** Reset the rate limit counter for a key (e.g. after successful login). */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

// ─── Action Rate Limiter ──────────────────────────────────────────────────────

/**
 * Configurable rate limiter for sensitive actions (e.g. CSV batch upload,
 * meter reading imports).
 *
 * @param key         - Unique identifier for this action + actor combination.
 * @param maxAttempts - Maximum calls allowed within the window. Default: 10.
 * @param windowMs    - Rolling window in milliseconds. Default: 60 s.
 */
export function checkActionRateLimit(
  key: string,
  maxAttempts: number = 10,
  windowMs: number = 60 * 1000
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = store.get(key);

  if (record) {
    if (record.lockedUntil && now < record.lockedUntil) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    if (now - record.firstAttemptAt > windowMs) {
      store.set(key, { count: 1, firstAttemptAt: now });
      return { allowed: true };
    }

    record.count += 1;

    if (record.count > maxAttempts) {
      record.lockedUntil = now + windowMs;
      store.set(key, record);
      const retryAfterSeconds = Math.ceil(windowMs / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    store.set(key, record);
    return { allowed: true };
  }

  store.set(key, { count: 1, firstAttemptAt: now });
  return { allowed: true };
}

// ─── Per-User Rate Limiter ────────────────────────────────────────────────────

/**
 * Per-user, per-action rate limiter.
 *
 * Allows finer-grained throttling for individual staff members on specific
 * high-volume actions (e.g. bulk approve, mass export, correction submissions).
 *
 * Key format internally: `user:<userId>:action:<actionName>`
 *
 * @param userId   - Staff member UUID from the session.
 * @param action   - Action identifier (e.g. 'bulk-approve', 'bill-export').
 * @param maxCalls - Maximum allowed calls within the window. Default: 20.
 * @param windowMs - Rolling window in milliseconds. Default: 60 s.
 *
 * @example
 *   const check = checkUserRateLimit(session.id, 'bulk-approve', 5, 60_000);
 *   if (!check.allowed) throw new Error(`Rate limit hit. Retry in ${check.retryAfterSeconds}s`);
 */
export function checkUserRateLimit(
  userId: string,
  action: string,
  maxCalls: number = 20,
  windowMs: number = 60 * 1000
): { allowed: boolean; retryAfterSeconds?: number } {
  const key = `user:${userId}:action:${action}`;
  return checkActionRateLimit(key, maxCalls, windowMs);
}

/**
 * Reset the per-user rate limit for a specific action.
 * Useful after a successfully controlled bulk operation completes.
 */
export function resetUserRateLimit(userId: string, action: string): void {
  const key = `user:${userId}:action:${action}`;
  store.delete(key);
}

// ─── Store Maintenance ────────────────────────────────────────────────────────

// Periodically purge expired entries to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    const expired = now - record.firstAttemptAt > WINDOW_MS;
    const unlocked = !record.lockedUntil || now >= record.lockedUntil;
    if (expired && unlocked) {
      store.delete(key);
    }
  }
}, 60 * 1000);
