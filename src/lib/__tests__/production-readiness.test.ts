import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, checkActionRateLimit, resetRateLimit } from '../rate-limiter';

describe('Production Readiness - Rate Limiter', () => {
  const testKey = 'test-staff-123';

  beforeEach(() => {
    resetRateLimit(testKey);
  });

  it('allows requests within limit', () => {
    const res1 = checkActionRateLimit(testKey, 3, 60000);
    expect(res1.allowed).toBe(true);

    const res2 = checkActionRateLimit(testKey, 3, 60000);
    expect(res2.allowed).toBe(true);

    const res3 = checkActionRateLimit(testKey, 3, 60000);
    expect(res3.allowed).toBe(true);
  });

  it('blocks and locks out requests exceeding maximum attempts', () => {
    // Max 2 attempts
    checkActionRateLimit(testKey, 2, 60000);
    checkActionRateLimit(testKey, 2, 60000);

    // 3rd attempt exceeds limit
    const resBlocked = checkActionRateLimit(testKey, 2, 60000);
    expect(resBlocked.allowed).toBe(false);
    expect(resBlocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets rate limit correctly', () => {
    checkActionRateLimit(testKey, 1, 60000);
    checkActionRateLimit(testKey, 1, 60000); // blocked
    resetRateLimit(testKey);

    const resFresh = checkActionRateLimit(testKey, 1, 60000);
    expect(resFresh.allowed).toBe(true);
  });
});
