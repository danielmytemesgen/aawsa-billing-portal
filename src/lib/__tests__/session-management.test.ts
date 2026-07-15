import { describe, it, expect } from 'vitest';
import { getSessionActionTitle, getSessionActionDescription } from '@/lib/session-management';

describe('session management helpers', () => {
  it('returns the expected label for signing out of the current browser', () => {
    expect(getSessionActionTitle('logout')).toBe('Sign out this browser');
  });

  it('returns the expected description for revoking device sessions', () => {
    expect(getSessionActionDescription('revoke')).toContain('Revoke');
  });
});
