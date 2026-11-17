import { describe, it, expect } from 'vitest';
import { getEffectiveBranchId, hasImpliedPermission, PERMISSION_IMPLICATIONS } from '../branch-permissions';
import { PERMISSIONS } from '../constants/auth';

describe('Branch Isolation & Negative Security Authorization Tests', () => {
  const BRANCH_A = 'branch-uuid-1111';
  const BRANCH_B = 'branch-uuid-2222';
  const SENTINEL_RESTRICTED_UUID = '00000000-0000-0000-0000-000000000000';

  describe('Cross-Branch Access Isolation', () => {
    it('restricts branch staff with only customers_view_branch to their own branch', () => {
      const perms = new Set<string>([PERMISSIONS.CUSTOMERS_VIEW_BRANCH]);
      const hasPermission = (p: string) => perms.has(p);

      const effectiveBranchId = getEffectiveBranchId(hasPermission, 'customers', BRANCH_A);
      expect(effectiveBranchId).toBe(BRANCH_A);
      expect(effectiveBranchId).not.toBe(BRANCH_B);
      expect(effectiveBranchId).not.toBeUndefined();
    });

    it('returns the non-matching sentinel UUID if a branch-restricted user has no assigned branch ID', () => {
      const perms = new Set<string>([PERMISSIONS.CUSTOMERS_VIEW_BRANCH]);
      const hasPermission = (p: string) => perms.has(p);

      // No branch assigned -> must NEVER default to undefined (all branches)
      const effectiveBranchId = getEffectiveBranchId(hasPermission, 'customers', null);
      expect(effectiveBranchId).toBe(SENTINEL_RESTRICTED_UUID);
    });

    it('denies all-branch access to branch users holding page-level invoice:view permission', () => {
      // Cashiers and tellers have invoice:view but belong to a specific branch
      const perms = new Set<string>([
        PERMISSIONS.INVOICE_VIEW,
        PERMISSIONS.INVOICE_PRINT,
        PERMISSIONS.INVOICE_CUSTOMER_STATEMENT,
      ]);
      const hasPermission = (p: string) => perms.has(p);

      const effectiveBranchId = getEffectiveBranchId(hasPermission, 'invoices', BRANCH_A);
      // Must NOT be undefined (which would leak all branches)
      expect(effectiveBranchId).toBe(BRANCH_A);
    });

    it('allows all-branch invoice access only to users with BILL_VIEW_ALL or INVOICE_BATCH', () => {
      const perms = new Set<string>([PERMISSIONS.INVOICE_BATCH]);
      const hasPermission = (p: string) => perms.has(p);

      const effectiveBranchId = getEffectiveBranchId(hasPermission, 'invoices', BRANCH_A);
      expect(effectiveBranchId).toBeUndefined();
    });
  });

  describe('Zero-Permission & Wildcard Edge Cases', () => {
    it('blocks zero-permission users and isolates them with sentinel UUID', () => {
      const perms = new Set<string>();
      const hasPermission = (p: string) => perms.has(p);

      const effectiveBranchId = getEffectiveBranchId(hasPermission, 'bills', null);
      expect(effectiveBranchId).toBe(SENTINEL_RESTRICTED_UUID);
    });

    it('always grants global view for wildcard *', () => {
      const perms = new Set(['*']);
      const hasPermission = (p: string) => perms.has(p);

      expect(getEffectiveBranchId(hasPermission, 'bulk_meters', BRANCH_A)).toBeUndefined();
      expect(getEffectiveBranchId(hasPermission, 'customers', BRANCH_A)).toBeUndefined();
      expect(getEffectiveBranchId(hasPermission, 'reports', BRANCH_A)).toBeUndefined();
    });

    it('always grants global view for wildcard all', () => {
      const perms = new Set(['all']);
      const hasPermission = (p: string) => perms.has(p);

      expect(getEffectiveBranchId(hasPermission, 'bills', BRANCH_A)).toBeUndefined();
    });
  });

  describe('Implied Permission Hierarchy Resolution', () => {
    it('automatically grants route CRUD operations to users with routes_manage', () => {
      const perms = new Set([PERMISSIONS.ROUTES_MANAGE]);

      expect(hasImpliedPermission(perms, PERMISSIONS.ROUTES_CREATE)).toBe(true);
      expect(hasImpliedPermission(perms, PERMISSIONS.ROUTES_UPDATE)).toBe(true);
      expect(hasImpliedPermission(perms, PERMISSIONS.ROUTES_DELETE)).toBe(true);
      expect(hasImpliedPermission(perms, PERMISSIONS.ROUTES_VIEW)).toBe(true);
    });

    it('automatically grants branch view when holding view_all for that domain', () => {
      const customerManagerPerms = new Set([PERMISSIONS.CUSTOMERS_VIEW_ALL]);
      expect(hasImpliedPermission(customerManagerPerms, PERMISSIONS.CUSTOMERS_VIEW_BRANCH)).toBe(true);

      const bulkMeterManagerPerms = new Set([PERMISSIONS.BULK_METERS_VIEW_ALL]);
      expect(hasImpliedPermission(bulkMeterManagerPerms, PERMISSIONS.BULK_METERS_VIEW_BRANCH)).toBe(true);
    });

    it('automatically grants invoice and bill draft access when holding BILL_VIEW_ALL', () => {
      const billManagerPerms = new Set([PERMISSIONS.BILL_VIEW_ALL]);

      expect(hasImpliedPermission(billManagerPerms, PERMISSIONS.BILL_VIEW_DRAFTS)).toBe(true);
      expect(hasImpliedPermission(billManagerPerms, PERMISSIONS.BILL_VIEW_PENDING)).toBe(true);
      expect(hasImpliedPermission(billManagerPerms, PERMISSIONS.BILL_VIEW_APPROVED)).toBe(true);
      expect(hasImpliedPermission(billManagerPerms, PERMISSIONS.INVOICE_VIEW)).toBe(true);
      expect(hasImpliedPermission(billManagerPerms, PERMISSIONS.INVOICE_BATCH)).toBe(true);
    });

    it('does not grant unrelated permissions through implication', () => {
      const routeManagerPerms = new Set([PERMISSIONS.ROUTES_MANAGE]);

      // Route manager should NOT have tariff or staff permissions
      expect(hasImpliedPermission(routeManagerPerms, PERMISSIONS.TARIFFS_VIEW)).toBe(false);
      expect(hasImpliedPermission(routeManagerPerms, PERMISSIONS.STAFF_DELETE)).toBe(false);
      expect(hasImpliedPermission(routeManagerPerms, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    });
  });
});
