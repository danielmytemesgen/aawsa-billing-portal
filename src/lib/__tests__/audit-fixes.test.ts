import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStaffMemberForAuthAction } from '@/lib/actions';
import { getAllTicketsAction } from '@/lib/support-actions';
import { hashPassword, verifyPassword } from '@/lib/password-hash';

// Mock dependencies for testing
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
  encrypt: vi.fn().mockResolvedValue('mock-encrypted-jwt'),
  decrypt: vi.fn(),
}));

vi.mock('@/lib/db-queries', () => ({
  getStaffMemberForAuth: vi.fn(),
  dbGetStaffPermissions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/support-queries', () => ({
  dbGetAllTickets: vi.fn().mockResolvedValue([]),
}));

describe('Audit Security Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStaffMemberForAuthAction', () => {
    it('should reject requests missing email or password without querying db', async () => {
      const resWithoutPassword = await getStaffMemberForAuthAction('admin@aawsa.gov.et');
      expect(resWithoutPassword.data).toBeNull();
      expect(resWithoutPassword.error?.message).toContain('Email and password are required');

      const resWithoutEmail = await getStaffMemberForAuthAction('', 'secretPass');
      expect(resWithoutEmail.data).toBeNull();
      expect(resWithoutEmail.error?.message).toContain('Email and password are required');
    });

    it('should strip password from returned user object', async () => {
      const { getStaffMemberForAuth } = await import('@/lib/db-queries');
      (getStaffMemberForAuth as any).mockResolvedValue({
        id: 'user-123',
        email: 'staff@aawsa.gov.et',
        password: 'plaintext-leak-prevention',
        role_name: 'Staff',
      });

      const res = await getStaffMemberForAuthAction('staff@aawsa.gov.et', 'password123');
      expect(res.data).toBeDefined();
      expect((res.data as any)?.password).toBeUndefined();
    });

    it('should rate limit repeated login attempts for the same email', async () => {
      const email = 'bruteforce-target@aawsa.gov.et';
      // 5 allowed attempts
      for (let i = 0; i < 5; i++) {
        await getStaffMemberForAuthAction(email, 'wrongpass');
      }
      // 6th attempt should be blocked by rate limit
      const blockedRes = await getStaffMemberForAuthAction(email, 'wrongpass');
      expect(blockedRes.data).toBeNull();
      expect(blockedRes.error?.message).toContain('Too many login attempts');
    });
  });

  describe('getAllTicketsAction', () => {
    it('should reject unauthenticated requests with UNAUTHORIZED', async () => {
      const { getSession } = await import('@/lib/auth');
      (getSession as any).mockResolvedValue(null);

      const res = await getAllTicketsAction();
      expect(res.data).toBeNull();
      expect(res.error?.code).toBe('UNAUTHORIZED');
      expect(res.error?.message).toContain('Authentication required');
    });
  });

  describe('Password Hashing & Progressive Migration', () => {
    it('should hash password with scrypt format', () => {
      const plain = 'StrongPass@2026';
      const hash = hashPassword(plain);
      expect(hash.startsWith('scrypt:')).toBe(true);
      const parts = hash.split(':');
      expect(parts.length).toBe(3);
      expect(parts[1].length).toBe(32); // 16 bytes hex salt
    });

    it('should verify password against scrypt hash correctly', () => {
      const plain = 'StrongPass@2026';
      const hash = hashPassword(plain);
      
      const correct = verifyPassword(plain, hash);
      expect(correct.matched).toBe(true);
      expect(correct.needsUpgrade).toBe(false);

      const wrong = verifyPassword('WrongPassword123', hash);
      expect(wrong.matched).toBe(false);
      expect(wrong.needsUpgrade).toBe(false);
    });

    it('should identify legacy plaintext password and flag for upgrade', () => {
      const legacyPlain = 'LegacyPlainPass123';
      const verification = verifyPassword(legacyPlain, legacyPlain);
      expect(verification.matched).toBe(true);
      expect(verification.needsUpgrade).toBe(true);

      const mismatch = verifyPassword('WrongPass', legacyPlain);
      expect(mismatch.matched).toBe(false);
      expect(mismatch.needsUpgrade).toBe(false);
    });
  });
});
