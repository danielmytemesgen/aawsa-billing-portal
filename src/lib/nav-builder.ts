import type { NavItemGroup, NavItem } from "@/components/layout/sidebar-nav";
import { PERMISSIONS } from "@/lib/constants/auth";

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
  branchName?: string;
  branchId?: string;
  name?: string;
}

export const buildSidebarNavItems = (user: UserProfile | null): NavItemGroup[] => {
  if (!user) return [];

  const permissions = new Set(user.permissions || []);
  const isWildcard = permissions.has('*') || permissions.has('all');

  const hasPermission = (p: string) => isWildcard || permissions.has(p);
  const hasAny = (...pList: string[]) => isWildcard || pList.some(p => permissions.has(p));

  const isGlobalManager = hasAny(
    PERMISSIONS.DASHBOARD_VIEW_ALL,
    PERMISSIONS.STAFF_VIEW_ALL,
    PERMISSIONS.BILL_VIEW_ALL,
    PERMISSIONS.SETTINGS_MANAGE
  );
  const isAdmin = isGlobalManager;

  const navItems: NavItemGroup[] = [];

  // 1. Purely permission-based Dashboard link
  let dashboardHref = isGlobalManager ? "/admin/dashboard" : "/staff/dashboard";
  if (hasPermission(PERMISSIONS.DASHBOARD_VIEW_ALL) && !hasPermission(PERMISSIONS.STAFF_VIEW)) {
    dashboardHref = '/admin/head-office-dashboard';
  } else if (hasPermission(PERMISSIONS.STAFF_VIEW) && !hasPermission(PERMISSIONS.BILL_VIEW_ALL)) {
    dashboardHref = isGlobalManager ? '/admin/staff-management-dashboard' : '/staff/staff-management-dashboard';
  }

  if (hasAny(
    PERMISSIONS.DASHBOARD_VIEW_ALL,
    PERMISSIONS.DASHBOARD_VIEW_BRANCH,
    PERMISSIONS.ROUTES_VIEW_ASSIGNED,
    PERMISSIONS.METER_READINGS_CREATE
  )) {
    navItems.push({
      items: [{ title: "Dashboard", href: dashboardHref, iconName: "LayoutDashboard" }]
    });
  }

  // 2. Field Reading & Route Operations (specifically for assigned readers)
  const canViewAssignedRoutes = hasPermission(PERMISSIONS.ROUTES_VIEW_ASSIGNED);
  const canRecordReadings = hasAny(
    PERMISSIONS.METER_READINGS_CREATE,
    PERMISSIONS.METER_READINGS_CREATE_BULK,
    PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL,
    PERMISSIONS.METER_READINGS_ADD_MANUAL,
    PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL,
    PERMISSIONS.METER_READINGS_UPLOAD_BULK
  );
  const canViewReadings = hasAny(
    PERMISSIONS.METER_READINGS_VIEW_ALL,
    PERMISSIONS.METER_READINGS_VIEW_BRANCH,
    PERMISSIONS.METER_READINGS_VIEW_INDIVIDUAL,
    PERMISSIONS.METER_READINGS_VIEW_BULK,
    PERMISSIONS.METER_READINGS_ANALYTICS_VIEW
  );
  const canViewProgress = hasPermission(PERMISSIONS.READER_PROGRESS_VIEW);

  const routeOpsItems: NavItem[] = [];
  if (canViewAssignedRoutes) {
    routeOpsItems.push({ title: "My Routes", href: "/staff/my-routes", iconName: "MapPin" });
  }
  if (canRecordReadings || canViewReadings) {
    routeOpsItems.push({
      title: "Meter Readings",
      href: isAdmin ? "/admin/meter-readings" : "/staff/meter-readings",
      iconName: "ClipboardList"
    });
  }
  if (canViewProgress) {
    routeOpsItems.push({ title: "Reader Monitoring", href: "/staff/reader-progress", iconName: "Activity" });
  }

  const canAccessMeterChange = hasAny(
    PERMISSIONS.METER_CHANGE_VIEW,
    PERMISSIONS.METER_CHANGE_CREATE,
    PERMISSIONS.METER_CHANGE_MANAGE
  );
  if (canAccessMeterChange) {
    routeOpsItems.push({
      title: "Meter Change",
      href: isAdmin ? "/admin/meter-change" : "/staff/meter-change",
      iconName: "RefreshCcw"
    });
  }

  const canManageRoutes = hasPermission(PERMISSIONS.ROUTES_VIEW_ALL)
    || hasPermission(PERMISSIONS.ROUTES_MANAGE)
    || hasPermission(PERMISSIONS.ROUTES_VIEW)
    || hasPermission(PERMISSIONS.ROUTES_VIEW_BRANCH)
    || hasPermission(PERMISSIONS.ROUTES_CREATE)
    || hasPermission(PERMISSIONS.ROUTES_UPDATE)
    || hasPermission(PERMISSIONS.ROUTES_DELETE);

  if (canManageRoutes) {
    routeOpsItems.push({ title: "Route Management", href: "/admin/routes", iconName: "Map" });
  }

  const canAccessOfflineMetrics = hasAny(
    PERMISSIONS.METER_READINGS_OFFLINE_METRICS,
    PERMISSIONS.READER_PROGRESS_VIEW,
    PERMISSIONS.ROUTES_VIEW_ALL,
    PERMISSIONS.METER_READINGS_VIEW_ALL,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_MANAGE
  );
  if (canAccessOfflineMetrics) {
    routeOpsItems.push({
      title: "Offline Metrics",
      href: "/admin/offline-metrics",
      iconName: "WifiOff"
    });
  }

  if (routeOpsItems.length > 0) {
    navItems.push({
      title: "Field Operations",
      iconName: "Compass",
      items: routeOpsItems
    });
  }

  // 3. Management (Branches, Staff)
  const managementItems: NavItem[] = [];
  if (hasPermission(PERMISSIONS.BRANCHES_VIEW)) {
    managementItems.push({ title: "Branch Management", href: isAdmin ? "/admin/branches" : "/staff/branches", iconName: "Building" });
  }
  if (hasPermission(PERMISSIONS.STAFF_VIEW) || hasPermission(PERMISSIONS.STAFF_VIEW_ALL) || hasPermission(PERMISSIONS.STAFF_VIEW_BRANCH)) {
    managementItems.push({ title: "Staff Management", href: isAdmin ? "/admin/staff-management" : "/staff/staff-management", iconName: "UserCog" });
  }

  if (managementItems.length > 0) {
    navItems.push({
      title: "Management",
      iconName: "Briefcase",
      items: managementItems
    });
  }

  // 4. Dedicated Bill Management Section
  const canAccessBillManagement = hasAny(
    PERMISSIONS.BILL_VIEW_ALL,
    PERMISSIONS.BILL_VIEW_BRANCH,
    PERMISSIONS.BILL_CREATE,
    PERMISSIONS.BILL_VIEW_DRAFTS,
    PERMISSIONS.BILL_VIEW_PENDING,
    PERMISSIONS.BILL_VIEW_APPROVED,
    PERMISSIONS.BILL_APPROVE,
    PERMISSIONS.BILL_VIEW_PAID,
    PERMISSIONS.BILL_VIEW_UNPAID,
    PERMISSIONS.BILL_VIEW_OVERDUE,
    PERMISSIONS.BILL_POST,
    PERMISSIONS.BILL_SEND,
    PERMISSIONS.BILL_REWORK,
    PERMISSIONS.BILL_UPDATE,
    PERMISSIONS.BILL_DELETE,
    PERMISSIONS.BILL_SUBMIT,
    PERMISSIONS.BILL_CORRECT,
    PERMISSIONS.BILL_CLOSE_CYCLE
  );
  if (canAccessBillManagement) {
    navItems.push({
      title: "Bill Management",
      iconName: "FileText",
      items: [{
        title: "Bill Management",
        href: isAdmin ? "/admin/bill-management" : "/staff/bill-management",
        iconName: "FileText",
      }]
    });
  }

  // 5. Dedicated Notifications Section
  const canAccessNotifications = hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW)
    || hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW_ALL);
  const canAccessSms = hasPermission('sms_send')
    || hasPermission(PERMISSIONS.NOTIFICATIONS_CREATE)
    || hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW)
    || hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW_ALL);

  const notifItems: NavItem[] = [];
  if (canAccessNotifications) {
    notifItems.push({
      title: "Notifications",
      href: isAdmin ? "/admin/notifications" : "/staff/notifications",
      iconName: "Bell",
      matcher: (path, href) => path === href || (path.startsWith(href + '/') && !path.startsWith(`${href}/sms`)),
    });
  }
  if (canAccessSms) {
    notifItems.push({
      title: "SMS Notifications",
      href: isAdmin ? "/admin/notifications/sms" : "/staff/notifications/sms",
      iconName: "MessageSquare",
    });
  }

  if (notifItems.length > 0) {
    navItems.push({
      title: "Notifications",
      iconName: "Bell",
      items: notifItems,
    });
  }

  // 6. Dedicated Tariff Management Section
  const canAccessTariffs = hasPermission(PERMISSIONS.TARIFFS_VIEW)
    || hasPermission(PERMISSIONS.TARIFFS_MANAGE);
  if (canAccessTariffs) {
    navItems.push({
      title: "Tariff Management",
      iconName: "LibraryBig",
      items: [{
        title: "Tariff Management",
        href: isAdmin ? "/admin/tariffs" : "/staff/tariffs",
        iconName: "LibraryBig",
      }]
    });
  }

  // 7. Dedicated Knowledge Base Section
  const canAccessKnowledgeBase = hasPermission(PERMISSIONS.KNOWLEDGE_BASE_MANAGE)
    || hasPermission(PERMISSIONS.KNOWLEDGE_BASE_VIEW);
  if (canAccessKnowledgeBase) {
    navItems.push({
      title: "Knowledge Base",
      iconName: "BookText",
      items: [{
        title: "Knowledge Base",
        href: isAdmin ? "/admin/knowledge-base" : "/staff/knowledge-base",
        iconName: "BookText",
      }]
    });
  }

  // 8. Dedicated Fault Codes Section
  const canViewFaultCodes = hasPermission(PERMISSIONS.SETTINGS_MANAGE)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL)
    || hasPermission(PERMISSIONS.DASHBOARD_VIEW_ALL)
    || hasPermission(PERMISSIONS.FAULT_CODES_VIEW)
    || hasPermission(PERMISSIONS.FAULT_CODES_MANAGE);

  if (canViewFaultCodes) {
    navItems.push({
      title: "Fault Codes",
      iconName: "AlertOctagon",
      items: [{
        title: "Fault Codes",
        href: isAdmin ? "/admin/fault-codes" : "/staff/fault-codes",
        iconName: "AlertOctagon",
      }]
    });
  }

  // 9. Dedicated Approvals Section
  const canAccessApprovals = hasPermission(PERMISSIONS.CUSTOMERS_APPROVE)
    || hasPermission(PERMISSIONS.BULK_METERS_APPROVE)
    || hasPermission(PERMISSIONS.BILL_APPROVE);

  if (canAccessApprovals) {
    navItems.push({
      title: "Approvals",
      iconName: "UserCheck",
      items: [{
        title: "Approvals",
        href: isAdmin ? "/admin/approvals" : "/staff/approvals",
        iconName: "UserCheck",
      }]
    });
  }

  // 10. Dedicated Roles & Permissions Section
  const canAccessRoles = hasPermission(PERMISSIONS.ROLES_VIEW) || hasPermission(PERMISSIONS.ROLES_MANAGE);
  if (canAccessRoles) {
    navItems.push({
      title: "Roles & Permissions",
      iconName: "ShieldCheck",
      items: [{
        title: "Roles & Permissions",
        href: isAdmin ? "/admin/roles-and-permissions" : "/staff/roles-and-permissions",
        iconName: "ShieldCheck",
      }]
    });
  }

  // 11. Dedicated Customer Support Section
  const canAccessSupport = hasAny(
    PERMISSIONS.SUPPORT_VIEW_ALL,
    PERMISSIONS.SUPPORT_VIEW_BRANCH,
    PERMISSIONS.SUPPORT_CREATE,
    PERMISSIONS.SUPPORT_ASSIGN,
    PERMISSIONS.SUPPORT_RESOLVE,
    PERMISSIONS.SUPPORT_MANAGE
  );

  if (canAccessSupport) {
    navItems.push({
      title: "Customer Support",
      iconName: "LifeBuoy",
      items: [{
        title: "Customer Support",
        href: hasPermission(PERMISSIONS.SUPPORT_VIEW_ALL) ? "/admin/support" : "/staff/support",
        iconName: "LifeBuoy",
      }]
    });
  }

  // 12. Customer & Metering
  const customerMeteringItems: NavItem[] = [];
  const canAccessBulkMeters = hasAny(
    PERMISSIONS.BULK_METERS_VIEW_ALL,
    PERMISSIONS.BULK_METERS_VIEW_BRANCH,
    PERMISSIONS.DATA_ENTRY_ACCESS,
    PERMISSIONS.BULK_METERS_CREATE,
    PERMISSIONS.BULK_METERS_CREATE_RESTRICTED,
    PERMISSIONS.BULK_METERS_UPDATE,
    PERMISSIONS.BULK_METERS_DELETE,
    PERMISSIONS.BULK_METERS_APPROVE,
    PERMISSIONS.BULK_METERS_MANAGE_CUSTOMERS,
    PERMISSIONS.BULK_METERS_EDIT_READINGS
  );
  if (canAccessBulkMeters) {
    customerMeteringItems.push({
      title: "Bulk Meters",
      href: isAdmin ? "/admin/bulk-meters" : "/staff/bulk-meters",
      iconName: "Gauge"
    });
  }

  const canAccessCustomers = hasAny(
    PERMISSIONS.CUSTOMERS_VIEW_ALL,
    PERMISSIONS.CUSTOMERS_VIEW_BRANCH,
    PERMISSIONS.DATA_ENTRY_ACCESS,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_CREATE_RESTRICTED,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.CUSTOMERS_DELETE,
    PERMISSIONS.CUSTOMERS_APPROVE
  );
  if (canAccessCustomers) {
    customerMeteringItems.push({
      title: "Individual Customers",
      href: isAdmin ? "/admin/individual-customers" : "/staff/individual-customers",
      iconName: "Users"
    });
  }

  if (customerMeteringItems.length > 0) {
    navItems.push({
      title: "Customer & Metering",
      iconName: "Gauge",
      items: customerMeteringItems
    });
  }

  // 13. Dedicated Data Entry Section
  const canAccessDataEntry = hasPermission(PERMISSIONS.DATA_ENTRY_ACCESS)
    || hasPermission(PERMISSIONS.CUSTOMERS_CREATE)
    || hasPermission(PERMISSIONS.BULK_METERS_CREATE)
    || hasPermission(PERMISSIONS.DATA_ENTRY_BULK_FORM)
    || hasPermission(PERMISSIONS.DATA_ENTRY_INDIVIDUAL_FORM)
    || hasPermission(PERMISSIONS.DATA_ENTRY_BULK_CSV)
    || hasPermission(PERMISSIONS.DATA_ENTRY_INDIVIDUAL_CSV);

  if (canAccessDataEntry) {
    navItems.push({
      title: "Data Entry",
      iconName: "FileEdit",
      items: [{
        title: "Data Entry",
        href: isAdmin ? "/admin/data-entry" : "/staff/data-entry",
        iconName: "FileText"
      }]
    });
  }

  // 14. Reports Section
  const reportsItems: NavItem[] = [];

  const canAccessGeneralReports = hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || hasPermission(PERMISSIONS.ROUTES_VIEW_ASSIGNED)
    || hasPermission(PERMISSIONS.METER_READINGS_ANALYTICS_VIEW);

  if (canAccessGeneralReports) {
    reportsItems.push({ title: "Reports", href: isAdmin ? "/admin/reports" : "/staff/reports", iconName: "BarChart2" });
  }

  const canViewPaidBillsReport = hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || hasPermission(PERMISSIONS.REPORT_LIST_OF_PAID_BILLS)
    || hasPermission(PERMISSIONS.REPORT_BRANCH_LIST_OF_PAID_BILLS)
    || hasPermission(PERMISSIONS.BILL_VIEW_PAID)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  if (canViewPaidBillsReport) {
    reportsItems.push({ title: "List Of Paid Bills", href: isAdmin ? "/admin/reports/paid-bills" : "/staff/reports/paid-bills", iconName: "CheckCircle2" });
  }

  const canViewSentBillsReport = hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || hasPermission(PERMISSIONS.REPORT_LIST_OF_SENT_BILLS)
    || hasPermission(PERMISSIONS.REPORT_BRANCH_LIST_OF_SENT_BILLS)
    || hasPermission(PERMISSIONS.BILL_SEND)
    || hasPermission(PERMISSIONS.BILL_POST)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  if (canViewSentBillsReport) {
    reportsItems.push({ title: "List Of Sent Bills", href: isAdmin ? "/admin/reports/sent-bills" : "/staff/reports/sent-bills", iconName: "Send" });
  }

  const canViewUnsettledBillsReport = hasPermission(PERMISSIONS.REPORT_LIST_OF_UNSETTLED_BILLS)
    || hasPermission(PERMISSIONS.REPORT_BRANCH_LIST_OF_UNSETTLED_BILLS)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || hasPermission(PERMISSIONS.BILL_VIEW_UNPAID)
    || hasPermission(PERMISSIONS.BILL_VIEW_OVERDUE)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  if (canViewUnsettledBillsReport) {
    reportsItems.push({ title: "List of Unsettled Bills", href: isAdmin ? "/admin/reports/unsettled-bills" : "/staff/reports/unsettled-bills", iconName: "FileClock" });
  }

  const canViewCorrectedBillsReport = hasPermission(PERMISSIONS.REPORT_LIST_OF_CORRECTED_BILLS)
    || hasPermission(PERMISSIONS.REPORT_BRANCH_LIST_OF_CORRECTED_BILLS)
    || hasPermission(PERMISSIONS.BILL_CORRECT_VIEW)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  if (canViewCorrectedBillsReport) {
    reportsItems.push({ title: "Corrected Bills", href: isAdmin ? "/admin/reports/corrected-bills" : "/staff/reports/corrected-bills", iconName: "FileDiff" });
  }

  const canViewReadingCorrectionsReport = hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL)
    || hasPermission(PERMISSIONS.METER_READINGS_VIEW_BRANCH)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  if (canViewReadingCorrectionsReport) {
    reportsItems.push({
      title: "Reading Corrections",
      href: isAdmin ? "/admin/reports/reading-corrections" : "/staff/reports/reading-corrections",
      iconName: "FileEdit"
    });
  }

  const canViewReadingClassificationReport = hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL)
    || hasPermission(PERMISSIONS.METER_READINGS_VIEW_BRANCH)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || hasPermission(PERMISSIONS.METER_READINGS_ANALYTICS_VIEW)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  if (canViewReadingClassificationReport) {
    reportsItems.push({
      title: "Reading Classification",
      href: isAdmin ? "/admin/reports/reading-classification" : "/staff/reports/reading-classification",
      iconName: "PieChart"
    });
  }

  const canViewGLReports = hasPermission(PERMISSIONS.REPORT_GL_AUDIT_VIEW)
    || hasPermission(PERMISSIONS.REPORT_GL_AUDIT_VIEW_ALL)
    || hasPermission(PERMISSIONS.REPORT_GL_AUDIT_VIEW_BRANCH)
    || hasPermission('report:gl_audit_view')
    || hasPermission('report:gl_audit_view_all')
    || hasPermission('report:gl_audit_view_branch');

  if (canViewGLReports) {
    reportsItems.push({
      title: "GL Reports & Audit",
      href: isAdmin ? "/admin/reports/gl-audit" : "/staff/reports/gl-audit",
      iconName: "Scale"
    });
  }

  const canViewCreditReports = hasPermission(PERMISSIONS.CREDIT_VIEW_ALL)
    || hasPermission(PERMISSIONS.CREDIT_VIEW_BRANCH)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  if (canViewCreditReports) {
    reportsItems.push({
      title: "Credit Note Report",
      href: isAdmin ? "/admin/reports/credit-notes" : "/staff/reports/credit-notes",
      iconName: "Wallet"
    });
  }

  const canViewDeliverySummaryReport = hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || hasPermission(PERMISSIONS.REPORT_LIST_OF_SENT_BILLS)
    || hasPermission(PERMISSIONS.REPORT_BRANCH_LIST_OF_SENT_BILLS)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  if (canViewDeliverySummaryReport) {
    reportsItems.push({
      title: "Delivery Summary Report",
      href: isAdmin ? "/admin/reports/delivery-summary" : "/staff/reports/delivery-summary",
      iconName: "Truck"
    });
  }

  const canViewBillingSummaryReport = hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || hasPermission(PERMISSIONS.REPORT_LIST_OF_PAID_BILLS)
    || hasPermission(PERMISSIONS.REPORT_LIST_OF_SENT_BILLS)
    || hasPermission(PERMISSIONS.REPORT_LIST_OF_UNSETTLED_BILLS)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  if (canViewBillingSummaryReport) {
    reportsItems.push({
      title: "Summary Report",
      href: isAdmin ? "/admin/reports/billing-summary" : "/staff/reports/billing-summary",
      iconName: "BarChart3"
    });
  }

  // Monthly Bill Export (CSV / XLSX) — Exclusively for Admin
  const canViewMonthlyBillExport = isAdmin && (
    hasPermission(PERMISSIONS.REPORT_MONTHLY_BILL_EXPORT)
    || hasPermission(PERMISSIONS.REPORTS_GENERATE_ALL)
    || hasPermission(PERMISSIONS.BILL_VIEW_ALL)
    || hasPermission('*')
    || hasPermission('admin')
  );

  if (canViewMonthlyBillExport) {
    reportsItems.push({
      title: "Monthly Bill Export",
      href: "/admin/reports/monthly-bill-export",
      iconName: "FileSpreadsheet"
    });
  }

  if (reportsItems.length > 0) {
    navItems.push({
      title: "Reports",
      iconName: "BarChart2",
      items: reportsItems
    });
  }

  // 15. System Settings
  const settingsItems: NavItem[] = [];
  if (hasPermission(PERMISSIONS.SETTINGS_VIEW) || hasPermission(PERMISSIONS.SETTINGS_MANAGE)) {
    settingsItems.push({ title: "Settings", href: isAdmin ? "/admin/settings" : "/staff/settings", iconName: "Settings" });
  }
  if (hasPermission(PERMISSIONS.SETTINGS_VIEW) || hasPermission(PERMISSIONS.SETTINGS_MANAGE) || hasPermission(PERMISSIONS.PROMOTIONS_MANAGE) || hasPermission(PERMISSIONS.PROMOTIONS_VIEW)) {
    settingsItems.push({ title: "Promotions", href: isAdmin ? "/admin/settings/promotions" : "/staff/settings/promotions", iconName: "Megaphone" });
  }
  if (hasPermission(PERMISSIONS.SETTINGS_MANAGE)) {
    settingsItems.push({ title: "Security Logs", href: "/admin/security-logs", iconName: "Shield" });
    settingsItems.push({ title: "Recycle Bin", href: "/admin/recycle-bin", iconName: "Trash2" });
    settingsItems.push({ title: "Database Backup", href: "/admin/backup", iconName: "Database" });
    settingsItems.push({ title: "System Maintenance", href: "/admin/maintenance", iconName: "Activity" });
  }

  if (settingsItems.length > 0) {
    navItems.push({
      title: "System",
      iconName: "Settings",
      items: settingsItems
    });
  }

  // 16. Dedicated User Manual Section
  const canAccessUserManual = hasPermission(PERMISSIONS.SETTINGS_VIEW)
    || hasPermission(PERMISSIONS.SETTINGS_MANAGE)
    || hasPermission(PERMISSIONS.KNOWLEDGE_BASE_VIEW);

  if (canAccessUserManual) {
    navItems.push({
      title: "User Manual",
      iconName: "BookOpen",
      items: [{
        title: "User Manual",
        href: isAdmin ? "/admin/user-manual" : "/staff/user-manual",
        iconName: "BookOpen",
      }]
    });
  }

  return navItems;
};

