import { describe, it, expect, vi, beforeEach } from 'vitest';
import { changePasswordAction } from '@/lib/auth-actions';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock auth
const mockGetSession = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSession: () => mockGetSession(),
  encrypt: vi.fn().mockResolvedValue('mock-encrypted'),
}));

// Mock db-queries
const mockGetStaffMemberForAuth = vi.fn();
const mockDbUpdateStaffMember = vi.fn();
const mockDbLogSecurityEvent = vi.fn();
const mockDbRevokeOtherStaffSessions = vi.fn();
const mockDbCreateNotification = vi.fn();

vi.mock('@/lib/db-queries', () => ({
  getStaffMemberForAuth: (...args: any[]) => mockGetStaffMemberForAuth(...args),
  dbUpdateStaffMember: (...args: any[]) => mockDbUpdateStaffMember(...args),
  dbLogSecurityEvent: (...args: any[]) => mockDbLogSecurityEvent(...args),
  dbRevokeOtherStaffSessions: (...args: any[]) => mockDbRevokeOtherStaffSessions(...args),
  dbCreateNotification: (...args: any[]) => mockDbCreateNotification(...args),
}));

describe('changePasswordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('returns error if fields are missing', async () => {
      const result = await changePasswordAction({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe('All fields are required.');
    });

    it('returns error if new password is shorter than 6 characters', async () => {
      const result = await changePasswordAction({
        currentPassword: 'current-pass',
        newPassword: '123',
        confirmPassword: '123',
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('at least 6 characters');
    });

    it('returns error if new password and confirmation do not match', async () => {
      const result = await changePasswordAction({
        currentPassword: 'current-pass',
        newPassword: 'password123',
        confirmPassword: 'different-password',
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('do not match');
    });

    it('returns error if new password is identical to current password', async () => {
      const result = await changePasswordAction({
        currentPassword: 'same-password123',
        newPassword: 'same-password123',
        confirmPassword: 'same-password123',
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('different from your current password');
    });
  });

  describe('session and authentication checks', () => {
    it('returns error if user is not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await changePasswordAction({
        currentPassword: 'old-password123',
        newPassword: 'new-password456',
        confirmPassword: 'new-password456',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('must be logged in');
    });

    it('returns error if current password is incorrect in DB', async () => {
      mockGetSession.mockResolvedValue({
        id: 'user-1',
        email: 'staff@aawsa.gov.et',
        role: 'Admin',
      });
      mockGetStaffMemberForAuth.mockResolvedValue(null);

      const result = await changePasswordAction({
        currentPassword: 'wrong-password',
        newPassword: 'new-password456',
        confirmPassword: 'new-password456',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Current password is incorrect.');
    });

    it('successfully updates password and creates security notification', async () => {
      mockGetSession.mockResolvedValue({
        id: 'user-1',
        email: 'staff@aawsa.gov.et',
        role: 'Admin',
        sessionId: 'session-123',
      });
      mockGetStaffMemberForAuth.mockResolvedValue({
        id: 'user-1',
        email: 'staff@aawsa.gov.et',
        role_name: 'Admin',
      });
      mockDbUpdateStaffMember.mockResolvedValue({
        id: 'user-1',
        email: 'staff@aawsa.gov.et',
      });
      mockDbRevokeOtherStaffSessions.mockResolvedValue([{ id: 'sess-old-1' }, { id: 'sess-old-2' }]);
      mockDbCreateNotification.mockResolvedValue({ id: 'notif-1' });

      const result = await changePasswordAction({
        currentPassword: 'correct-password',
        newPassword: 'new-secure-password789',
        confirmPassword: 'new-secure-password789',
        revokeOtherSessions: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('2 other active sessions signed out');
      expect(mockDbUpdateStaffMember).toHaveBeenCalledWith('staff@aawsa.gov.et', {
        password: 'new-secure-password789',
      });
      expect(mockDbRevokeOtherStaffSessions).toHaveBeenCalledWith('user-1', 'session-123');
      expect(mockDbCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Password Changed Successfully',
          sender_name: 'Security System',
        })
      );
      expect(mockDbLogSecurityEvent).toHaveBeenCalledWith(
        'Staff Password Changed',
        'staff@aawsa.gov.et',
        undefined,
        undefined,
        'info',
        expect.objectContaining({ staffId: 'user-1', role: 'Admin', revokedSessionsCount: 2 })
      );
    });
  });
});
