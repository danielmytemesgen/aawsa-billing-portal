import { PERMISSIONS } from '@/lib/constants/auth';

export interface RoutePermissionRule {
  match: (path: string) => boolean;
  requiredPermissions?: string[];
  anyOf?: string[];
  fallbackPath?: string;
}

export function createPermissionGuard(permissions: string[]) {
  const hasAnyPermission = (required: string[] = []) => required.some((permission) => permissions.includes(permission));
  const hasAllPermissions = (required: string[] = []) => required.every((permission) => permissions.includes(permission));

  return {
    hasAnyPermission,
    hasAllPermissions,
    hasAdminAccess: permissions.includes(PERMISSIONS.DASHBOARD_VIEW_ALL),
  };
}

export function getRoutePermissionRule(path: string, permissions: string[]) {
  const guard = createPermissionGuard(permissions);
  const rules: RoutePermissionRule[] = [
    {
      match: (currentPath) => currentPath.startsWith('/admin/roles-and-permissions'),
      requiredPermissions: [PERMISSIONS.ROLES_VIEW],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/security-logs'),
      requiredPermissions: [PERMISSIONS.SETTINGS_MANAGE],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/recycle-bin'),
      requiredPermissions: [PERMISSIONS.SETTINGS_MANAGE],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/maintenance'),
      requiredPermissions: [PERMISSIONS.SETTINGS_MANAGE],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/settings'),
      requiredPermissions: [PERMISSIONS.SETTINGS_VIEW],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/tariffs'),
      requiredPermissions: [PERMISSIONS.TARIFFS_VIEW],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/reports'),
      anyOf: [PERMISSIONS.REPORTS_GENERATE_ALL, PERMISSIONS.REPORTS_GENERATE_BRANCH],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/branches') || currentPath.startsWith('/staff/branches'),
      requiredPermissions: [PERMISSIONS.BRANCHES_VIEW],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/staff') || currentPath.startsWith('/staff/staff'),
      requiredPermissions: [PERMISSIONS.STAFF_VIEW],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/individual-customers') || currentPath.startsWith('/staff/individual-customers'),
      anyOf: [PERMISSIONS.CUSTOMERS_VIEW_ALL, PERMISSIONS.CUSTOMERS_VIEW_BRANCH],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/bulk-meters') || currentPath.startsWith('/staff/bulk-meters'),
      anyOf: [PERMISSIONS.BULK_METERS_VIEW_ALL, PERMISSIONS.BULK_METERS_VIEW_BRANCH],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/approvals') || currentPath.startsWith('/staff/approvals'),
      requiredPermissions: [PERMISSIONS.CUSTOMERS_APPROVE],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/bill-management') || currentPath.startsWith('/staff/bill-management'),
      anyOf: [
        PERMISSIONS.BILL_VIEW_ALL,
        PERMISSIONS.BILL_VIEW_BRANCH,
        PERMISSIONS.BILL_CREATE,
        PERMISSIONS.BILL_VIEW_DRAFTS,
        PERMISSIONS.BILL_VIEW_PENDING,
        PERMISSIONS.BILL_APPROVE,
        PERMISSIONS.BILL_VIEW_PAID,
        PERMISSIONS.BILL_VIEW_UNPAID,
      ],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/meter-readings') || currentPath.startsWith('/staff/meter-readings'),
      anyOf: [PERMISSIONS.METER_READINGS_VIEW_ALL, PERMISSIONS.METER_READINGS_VIEW_BRANCH, PERMISSIONS.METER_READINGS_CREATE],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/data-entry') || currentPath.startsWith('/staff/data-entry'),
      requiredPermissions: [PERMISSIONS.DATA_ENTRY_ACCESS],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/notifications') || currentPath.startsWith('/staff/notifications'),
      requiredPermissions: [PERMISSIONS.NOTIFICATIONS_VIEW],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/knowledge-base') || currentPath.startsWith('/staff/knowledge-base'),
      anyOf: [PERMISSIONS.KNOWLEDGE_BASE_VIEW, PERMISSIONS.KNOWLEDGE_BASE_MANAGE],
    },
    {
      match: (currentPath) => currentPath.startsWith('/staff/roles-and-permissions'),
      requiredPermissions: [PERMISSIONS.ROLES_VIEW],
    },
    {
      match: (currentPath) => currentPath.startsWith('/staff/tariffs'),
      requiredPermissions: [PERMISSIONS.TARIFFS_VIEW],
    },
    {
      match: (currentPath) => currentPath.startsWith('/staff/settings'),
      requiredPermissions: [PERMISSIONS.SETTINGS_VIEW],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/routes') || currentPath.startsWith('/staff/my-routes'),
      anyOf: [PERMISSIONS.ROUTES_VIEW_ALL, PERMISSIONS.ROUTES_VIEW_ASSIGNED, PERMISSIONS.METER_READINGS_ANALYTICS_VIEW],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/fault-codes'),
      anyOf: [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.BILL_VIEW_ALL, PERMISSIONS.DASHBOARD_VIEW_ALL],
    },
    {
      match: (currentPath) => currentPath.startsWith('/staff/reports'),
      anyOf: [PERMISSIONS.REPORTS_GENERATE_ALL, PERMISSIONS.REPORTS_GENERATE_BRANCH, PERMISSIONS.ROUTES_VIEW_ASSIGNED, PERMISSIONS.METER_READINGS_ANALYTICS_VIEW],
    },
  ];

  return rules.find((rule) => rule.match(path));
}
