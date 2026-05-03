
/**
 * Centralized Authentication and Authorization Constants
 */



export const PERMISSIONS = {
    // Dashboard
    DASHBOARD_VIEW_ALL: 'dashboard_view_all',
    DASHBOARD_VIEW_BRANCH: 'dashboard_view_branch',

    // Customers (Individual)
    CUSTOMERS_VIEW_ALL: 'customers_view_all',
    CUSTOMERS_VIEW_BRANCH: 'customers_view_branch',
    CUSTOMERS_CREATE: 'customers_create',
    CUSTOMERS_CREATE_RESTRICTED: 'customers_create_restricted',
    CUSTOMERS_UPDATE: 'customers_update',
    CUSTOMERS_DELETE: 'customers_delete',
    CUSTOMERS_APPROVE: 'customers_approve',

    // Bulk Meters
    BULK_METERS_VIEW_ALL: 'bulk_meters_view_all',
    BULK_METERS_VIEW_BRANCH: 'bulk_meters_view_branch',
    BULK_METERS_CREATE: 'bulk_meters_create',
    BULK_METERS_CREATE_RESTRICTED: 'bulk_meters_create_restricted',
    BULK_METERS_UPDATE: 'bulk_meters_update',
    BULK_METERS_DELETE: 'bulk_meters_delete',
    BULK_METERS_APPROVE: 'bulk_meters_approve',

    // Staff
    STAFF_VIEW: 'staff_view',
    STAFF_VIEW_ALL: 'staff_view_all',
    STAFF_VIEW_BRANCH: 'staff_view_branch',
    STAFF_CREATE: 'staff_create',
    STAFF_UPDATE: 'staff_update',
    STAFF_DELETE: 'staff_delete',

    // Branches
    BRANCHES_VIEW: 'branches_view',
    BRANCHES_CREATE: 'branches_create',
    BRANCHES_UPDATE: 'branches_update',
    BRANCHES_DELETE: 'branches_delete',

    // Roles & Permissions
    ROLES_VIEW: 'permissions_view',
    ROLES_MANAGE: 'settings_manage',

    // Settings
    SETTINGS_VIEW: 'settings_view',
    SETTINGS_MANAGE: 'settings_manage',

    // Reports
    REPORTS_GENERATE_ALL: 'reports_generate_all',
    REPORTS_GENERATE_BRANCH: 'reports_generate_branch',

    // Billing
    BILL_VIEW_ALL: 'bill:manage_all',
    BILL_VIEW_BRANCH: 'bill:view_branch',
    BILL_VIEW_DRAFTS: 'bill:view_drafts',
    BILL_VIEW_PENDING: 'bill:view_pending',
    BILL_VIEW_APPROVED: 'bill:view_approved',
    BILL_VIEW_PAID: 'bill:view_paid',
    BILL_VIEW_UNPAID: 'bill:view_awaiting_payment',
    BILL_VIEW_OVERDUE: 'bill:view_overdue',
    BILL_CREATE: 'bill:create',
    BILL_UPDATE: 'bill:update',
    BILL_DELETE: 'bill:delete',
    BILL_APPROVE: 'bill:approve',
    BILL_POST: 'bill:post',
    BILL_SEND: 'bill:send',
    BILL_REWORK: 'bill:rework',
    BILL_CLOSE_CYCLE: 'billing:close_cycle',

    // Meter Readings
    METER_READINGS_VIEW_ALL: 'meter_readings_view_all',
    METER_READINGS_VIEW_BRANCH: 'meter_readings_view_branch',
    METER_READINGS_CREATE: 'meter_readings_create',
    METER_READINGS_UPDATE: 'meter_readings_update',
    METER_READINGS_DELETE: 'meter_readings_delete',
    METER_READINGS_ANALYTICS_VIEW: 'meter_readings_analytics_view',

    // Data Entry
    DATA_ENTRY_ACCESS: 'data_entry_access',

    // Notifications
    NOTIFICATIONS_VIEW: 'notifications_view',
    NOTIFICATIONS_VIEW_ALL: 'notifications_view_all',
    NOTIFICATIONS_MANAGE: 'notifications_manage',
    NOTIFICATIONS_CREATE: 'notifications_create',

    // Knowledge Base
    KNOWLEDGE_BASE_VIEW: 'knowledge_base_view',
    KNOWLEDGE_BASE_MANAGE: 'knowledge_base_manage',

    // Routes
    ROUTES_VIEW_ALL: 'routes_view_all',
    ROUTES_VIEW_ASSIGNED: 'routes_view_assigned',
    ROUTES_MANAGE: 'settings_manage',

    // Fault Codes
    FAULT_CODES_VIEW: 'settings_view',
    FAULT_CODES_MANAGE: 'settings_manage',

    // Tariffs
    TARIFFS_VIEW: 'tariffs_view',
    TARIFFS_MANAGE: 'tariffs_manage',

    // Payments
    PAYMENTS_VIEW: 'payments_view',
    PAYMENTS_CREATE: 'payments_create',
    PAYMENTS_DELETE: 'payments_delete',
} as const;

export const BRANCHES = {
    HEAD_OFFICE: 'Head Office',
} as const;

