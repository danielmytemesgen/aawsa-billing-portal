/**
 * Simple in-memory rate limiter for login endpoints.
 * Tracks attempts per key (IP or identifier) within a sliding window.
 * For production with multiple instances, replace with Redis-backed solution.
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

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const record = store.get(key);

    if (record) {
        // Check if currently locked out
        if (record.lockedUntil && now < record.lockedUntil) {
            const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
            return { allowed: false, retryAfterSeconds };
        }

        // Reset window if it has expired
        if (now - record.firstAttemptAt > WINDOW_MS) {
            store.set(key, { count: 1, firstAttemptAt: now });
            return { allowed: true };
        }

        // Increment attempt count
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

export function resetRateLimit(key: string): void {
    store.delete(key);
}

/**
 * Configurable rate limiter for sensitive actions (e.g. CSV batch upload, meter reading imports).
 * Default: 10 calls per minute.
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

// Periodically clean up expired entries to prevent memory leaks
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
