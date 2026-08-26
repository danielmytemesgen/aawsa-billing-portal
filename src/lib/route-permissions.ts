import { PERMISSIONS } from '@/lib/constants/auth';

export interface RoutePermissionRule {
  match: (path: string) => boolean;
  requiredPermissions?: string[];
  anyOf?: string[];
  fallbackPath?: string;
}

export function createPermissionGuard(permissions: string[]) {
  const hasPerm = (p: string) => permissions.includes('*') || permissions.includes('admin') || permissions.includes('all') || permissions.includes(p);
  const hasAnyPermission = (required: string[] = []) => required.some((permission) => hasPerm(permission));
  const hasAllPermissions = (required: string[] = []) => required.every((permission) => hasPerm(permission));

  return {
    hasAnyPermission,
    hasAllPermissions,
    hasAdminAccess: hasPerm(PERMISSIONS.DASHBOARD_VIEW_ALL),
  };
}

export function getRoutePermissionRule(path: string, permissions: string[]) {
  const guard = createPermissionGuard(permissions);
  const rules: RoutePermissionRule[] = [
    {
      match: (currentPath) => currentPath.startsWith('/admin/roles-and-permissions') || currentPath.startsWith('/staff/roles-and-permissions'),
      anyOf: [PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.DASHBOARD_VIEW_ALL],
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
      match: (currentPath) => currentPath.startsWith('/admin/settings') || currentPath.startsWith('/staff/settings'),
      anyOf: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_MANAGE, 'promotions_manage'],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/tariffs') || currentPath.startsWith('/staff/tariffs'),
      anyOf: [PERMISSIONS.TARIFFS_VIEW, PERMISSIONS.TARIFFS_MANAGE],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/reports') || currentPath.startsWith('/staff/reports'),
      anyOf: [
        PERMISSIONS.REPORTS_GENERATE_ALL,
        PERMISSIONS.REPORTS_GENERATE_BRANCH,
        PERMISSIONS.ROUTES_VIEW_ASSIGNED,
        PERMISSIONS.METER_READINGS_ANALYTICS_VIEW,
        PERMISSIONS.REPORT_LIST_OF_PAID_BILLS,
        PERMISSIONS.REPORT_BRANCH_LIST_OF_PAID_BILLS,
        PERMISSIONS.REPORT_LIST_OF_SENT_BILLS,
        PERMISSIONS.REPORT_BRANCH_LIST_OF_SENT_BILLS,
        PERMISSIONS.BILL_VIEW_PAID,
        PERMISSIONS.BILL_SEND,
        PERMISSIONS.BILL_POST,
        PERMISSIONS.BILL_VIEW_UNPAID,
        PERMISSIONS.BILL_VIEW_OVERDUE,
        PERMISSIONS.BILL_VIEW_ALL,
      ],
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
      anyOf: [
        PERMISSIONS.CUSTOMERS_VIEW_ALL,
        PERMISSIONS.CUSTOMERS_VIEW_BRANCH,
        PERMISSIONS.DATA_ENTRY_ACCESS,
        PERMISSIONS.CUSTOMERS_CREATE
      ],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/bulk-meters') || currentPath.startsWith('/staff/bulk-meters'),
      anyOf: [
        PERMISSIONS.BULK_METERS_VIEW_ALL,
        PERMISSIONS.BULK_METERS_VIEW_BRANCH,
        PERMISSIONS.DATA_ENTRY_ACCESS,
        PERMISSIONS.BULK_METERS_CREATE
      ],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/approvals') || currentPath.startsWith('/staff/approvals'),
      anyOf: [
        PERMISSIONS.CUSTOMERS_APPROVE,
        PERMISSIONS.BULK_METERS_APPROVE,
        PERMISSIONS.BILL_APPROVE
      ],
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
        PERMISSIONS.BILL_CLOSE_CYCLE
      ],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/meter-readings') || currentPath.startsWith('/staff/meter-readings') || currentPath.startsWith('/staff/reader-progress'),
      anyOf: [
        PERMISSIONS.METER_READINGS_VIEW_ALL,
        PERMISSIONS.METER_READINGS_VIEW_BRANCH,
        PERMISSIONS.METER_READINGS_CREATE,
        PERMISSIONS.METER_READINGS_ANALYTICS_VIEW
      ],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/data-entry') || currentPath.startsWith('/staff/data-entry'),
      anyOf: [
        PERMISSIONS.DATA_ENTRY_ACCESS,
        PERMISSIONS.CUSTOMERS_CREATE,
        PERMISSIONS.BULK_METERS_CREATE,
        PERMISSIONS.DATA_ENTRY_BULK_FORM,
        PERMISSIONS.DATA_ENTRY_INDIVIDUAL_FORM,
        PERMISSIONS.DATA_ENTRY_BULK_CSV,
        PERMISSIONS.DATA_ENTRY_INDIVIDUAL_CSV,
      ],
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
      match: (currentPath) => currentPath.startsWith('/admin/routes') || currentPath.startsWith('/staff/my-routes'),
      anyOf: [
        PERMISSIONS.ROUTES_VIEW_ALL,
        PERMISSIONS.ROUTES_VIEW,
        PERMISSIONS.ROUTES_VIEW_BRANCH,
        PERMISSIONS.ROUTES_VIEW_ASSIGNED,
        PERMISSIONS.ROUTES_MANAGE,
        PERMISSIONS.ROUTES_CREATE,
        PERMISSIONS.ROUTES_UPDATE,
        PERMISSIONS.ROUTES_DELETE,
        PERMISSIONS.METER_READINGS_CREATE,
        PERMISSIONS.READER_PROGRESS_VIEW,
        PERMISSIONS.METER_READINGS_ANALYTICS_VIEW,
      ],
    },
    {
      match: (currentPath) => currentPath.startsWith('/admin/fault-codes') || currentPath.startsWith('/staff/fault-codes'),
      anyOf: [
        PERMISSIONS.SETTINGS_MANAGE,
        PERMISSIONS.BILL_VIEW_ALL,
        PERMISSIONS.DASHBOARD_VIEW_ALL,
        PERMISSIONS.FAULT_CODES_VIEW,
        PERMISSIONS.FAULT_CODES_MANAGE,
      ],
    },
  ];

  return rules.find((rule) => rule.match(path));
}
