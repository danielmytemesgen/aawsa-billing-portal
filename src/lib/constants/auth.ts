
/**
 * Centralized Authentication and Authorization Constants
 */

export const ROLES = {
    ADMIN: 'admin',
    HEAD_OFFICE_MANAGEMENT: 'head office management',
    STAFF_MANAGEMENT: 'staff management',
    STAFF: 'staff',
    READER: 'reader',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const PERMISSIONS = {
    DASHBOARD_VIEW_ALL: 'dashboard_view_all',
    CUSTOMERS_VIEW_ALL: 'customers_view_all',
    CUSTOMERS_VIEW_BRANCH: 'customers_view_branch',
    BULK_METERS_VIEW_ALL: 'bulk_meters_view_all',
    BULK_METERS_VIEW_BRANCH: 'bulk_meters_view_branch',
    STAFF_VIEW: 'staff_view',
    STAFF_CREATE: 'staff_create',
    STAFF_UPDATE: 'staff_update',
    STAFF_DELETE: 'staff_delete',
    BRANCHES_VIEW: 'branches_view',
    ROLES_VIEW: 'permissions_view', // Note: mapped from permissions_view for logic clarity
    SETTINGS_VIEW: 'settings_view',
    REPORTS_GENERATE_ALL: 'reports_generate_all',
    REPORTS_GENERATE_BRANCH: 'reports_generate_branch',
    METER_READINGS_ANALYTICS_VIEW: 'meter_readings_analytics_view',
} as const;

export const BRANCHES = {
    HEAD_OFFICE: 'Head Office',
} as const;

/**
 * Helper to check if a role is a management/admin-area role
 */
export const isManagementRole = (role: string | null | undefined): boolean => {
    if (!role) return false;
    const normalized = role.toLowerCase().trim();
    return (
        [ROLES.ADMIN, ROLES.HEAD_OFFICE_MANAGEMENT, ROLES.STAFF_MANAGEMENT].includes(normalized as any) ||
        normalized.includes('admin') ||
        normalized.includes('management')
    );
};
