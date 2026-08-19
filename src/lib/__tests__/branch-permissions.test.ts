import { describe, expect, it } from 'vitest';
import { getEffectiveBranchId } from '../branch-permissions';
import { PERMISSIONS } from '../constants/auth';

describe('getEffectiveBranchId', () => {
  it('returns undefined when user has global view all permission (admin scope)', () => {
    const hasPermission = (p: string) => p === PERMISSIONS.CUSTOMERS_VIEW_ALL;
    const result = getEffectiveBranchId(hasPermission, 'customers', 'branch-123');
    expect(result).toBeUndefined();
  });

  it('returns assigned branch ID when user only has branch-scoped access', () => {
    const hasPermission = (p: string) => p === PERMISSIONS.CUSTOMERS_VIEW_BRANCH;
    const result = getEffectiveBranchId(hasPermission, 'customers', 'branch-123');
    expect(result).toBe('branch-123');
  });

  it('fails safe and returns non-matching sentinel UUID when branch-restricted user has no assigned branch ID', () => {
    const hasPermission = () => false;
    const result = getEffectiveBranchId(hasPermission, 'customers', undefined);
    expect(result).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('fails safe when branch-restricted user has "all" as branch ID', () => {
    const hasPermission = () => false;
    const result = getEffectiveBranchId(hasPermission, 'customers', 'all');
    expect(result).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('supports wildcard super-admin permission', () => {
    const hasPermission = (p: string) => p === '*';
    const result = getEffectiveBranchId(hasPermission, 'reports', 'branch-456');
    expect(result).toBeUndefined();
  });
});
