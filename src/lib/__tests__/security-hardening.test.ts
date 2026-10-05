import { describe, it, expect, afterEach } from 'vitest';
import { dbValidateApiKey } from '@/lib/db-queries';
import { bills } from '@/lib/schema';
import { checkActionRateLimit } from '@/lib/rate-limiter';

describe('Security Hardening & Double Checks', () => {
  const originalEnvKey = process.env.INTERNAL_API_KEY;

  afterEach(() => {
    if (originalEnvKey !== undefined) {
      process.env.INTERNAL_API_KEY = originalEnvKey;
    } else {
      delete process.env.INTERNAL_API_KEY;
    }
  });

  describe('dbValidateApiKey (Secret Hardening)', () => {
    it('should fail closed (return false) when INTERNAL_API_KEY is not configured', async () => {
      delete process.env.INTERNAL_API_KEY;
      const res = await dbValidateApiKey('aawsa-internal-secret-2026');
      expect(res).toBe(false);
    });

    it('should reject empty or null apiKey', async () => {
      process.env.INTERNAL_API_KEY = 'super-secret-key-2026';
      expect(await dbValidateApiKey('')).toBe(false);
    });

    it('should reject invalid keys when configured', async () => {
      process.env.INTERNAL_API_KEY = 'configured-secret-key';
      expect(await dbValidateApiKey('wrong-key')).toBe(false);
      expect(await dbValidateApiKey('aawsa-internal-secret-2026')).toBe(false);
    });

    it('should validate correctly when matching INTERNAL_API_KEY', async () => {
      process.env.INTERNAL_API_KEY = 'secure-production-key-abc-123';
      expect(await dbValidateApiKey('secure-production-key-abc-123')).toBe(true);
    });
  });

  describe('Drizzle Schema Soft-Delete Index & Columns', () => {
    it('should have deletedAt and deletedBy defined on bills table', () => {
      expect(bills.deletedAt).toBeDefined();
      expect(bills.deletedBy).toBeDefined();
    });
  });

  describe('Rate Limiter', () => {
    it('should block actions exceeding threshold within window', () => {
      const key = `test_action_rate_limit_${Date.now()}`;
      for (let i = 0; i < 5; i++) {
        const check = checkActionRateLimit(key, 5, 60);
        expect(check.allowed).toBe(true);
      }
      const blocked = checkActionRateLimit(key, 5, 60);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });
  });
});
