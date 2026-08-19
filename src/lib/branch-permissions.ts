import { PERMISSIONS } from './constants/auth';

/**
 * The feature domain used to look up the correct "view all" permission.
 */
export type BranchFeatureDomain =
  | 'dashboard'
  | 'customers'
  | 'bulk_meters'
  | 'meter_readings'
  | 'staff'
  | 'reports'
  | 'bills'
  | 'routes';

/**
 * Determines the effective branch scope for data access based on the user's permissions.
 *
 * - Returns `undefined` when the user has the `_view_all` permission for the given domain,
 *   meaning they can see data from ALL branches.
 * - Returns `userBranchId` when the user only has branch-scoped access, restricting the
 *   data to their own assigned branch.
 *
 * @param hasPermission  - The hasPermission function from usePermissions()
 * @param domain         - The feature area to check
 * @param userBranchId   - The user's assigned branch ID from localStorage
 * @returns undefined (all branches) or a branch ID string (restricted scope)
 */
export function getEffectiveBranchId(
  hasPermission: (permission: string) => boolean,
  domain: BranchFeatureDomain,
  userBranchId?: string | null
): string | undefined {
  // Super-admin wildcard — always sees everything
  if (hasPermission('*') || hasPermission('all') || hasPermission('admin')) {
    return undefined;
  }

  // Map each domain to its "view all branches" permission(s)
  const viewAllPermissions: Record<BranchFeatureDomain, string[]> = {
    dashboard: [PERMISSIONS.DASHBOARD_VIEW_ALL, 'dashboard_view_all', 'dashboard:view_all'],
    customers: [PERMISSIONS.CUSTOMERS_VIEW_ALL, 'customers_view_all', 'customers:view_all'],
    bulk_meters: [PERMISSIONS.BULK_METERS_VIEW_ALL, 'bulk_meters_view_all', 'bulk_meters:view_all'],
    meter_readings: [PERMISSIONS.METER_READINGS_VIEW_ALL, 'meter_readings_view_all', 'meter_readings:view_all'],
    staff: [PERMISSIONS.STAFF_VIEW_ALL, 'staff_view_all', 'staff:view_all'],
    reports: [PERMISSIONS.REPORTS_GENERATE_ALL, 'reports_generate_all', 'reports:generate_all'],
    bills: [PERMISSIONS.BILL_VIEW_ALL, 'bill:manage_all', 'bill_manage_all', 'bill:view_all'],
    routes: [PERMISSIONS.ROUTES_VIEW_ALL, 'routes_view_all', 'routes:view_all'],
  };

  const hasViewAll = viewAllPermissions[domain].some((p) => hasPermission(p));

  if (hasViewAll) {
    // User can see all branches — no branch filter
    return undefined;
  }

  // Restrict to the user's assigned branch
  if (userBranchId && userBranchId !== 'all') {
    return userBranchId;
  }

  // Branch-restricted user has no assigned branch -> return non-matching sentinel UUID to prevent leaking all branches
  return '00000000-0000-0000-0000-000000000000';
}

