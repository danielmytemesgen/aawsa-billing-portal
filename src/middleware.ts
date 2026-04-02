import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';
import { ROLES, PERMISSIONS, isManagementRole } from '@/lib/constants/auth';

const protectedRoutes = ['/admin', '/staff'];
const adminRoutes = ['/admin'];
const staffRoutes = ['/staff'];

// Helper: check if any of the given permissions are present
const hasAny = (permissions: string[], ...perms: string[]) =>
  perms.some(p => permissions.includes(p));

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get('session')?.value;
  const session = cookie ? await decrypt(cookie).catch(() => null) : null;

  if (!session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const role = session.role?.toLowerCase()?.trim();
  const permissions: string[] = session.permissions || [];

  // ── 1. Top-level layout access ──────────────────────────────────────────────
  const isAdminRoute = adminRoutes.some(route => path.startsWith(route));
  const isStaffRoute = staffRoutes.some(route => path.startsWith(route));

  const hasAdminAccess =
    permissions.includes(PERMISSIONS.DASHBOARD_VIEW_ALL) ||
    isManagementRole(role);

  if (isAdminRoute && !hasAdminAccess) {
    return NextResponse.redirect(new URL('/staff/dashboard', request.url));
  }

  if (isStaffRoute && !role) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Determine redirect target based on layout
  const dashboardFallback = isAdminRoute
    ? new URL('/admin/dashboard', request.url)
    : new URL('/staff/dashboard', request.url);

  // ── 2. Admin-only sub-routes ─────────────────────────────────────────────────
  if (path.startsWith('/admin/roles-and-permissions') && !permissions.includes('permissions_view')) {
    return NextResponse.redirect(dashboardFallback);
  }
  if (path.startsWith('/admin/security-logs') && !permissions.includes('settings_manage')) {
    return NextResponse.redirect(dashboardFallback);
  }
  if (path.startsWith('/admin/recycle-bin') && !permissions.includes('settings_manage')) {
    return NextResponse.redirect(dashboardFallback);
  }
  if (path.startsWith('/admin/maintenance') && !permissions.includes('settings_manage')) {
    return NextResponse.redirect(dashboardFallback);
  }
  if (path.startsWith('/admin/settings') && !permissions.includes(PERMISSIONS.SETTINGS_VIEW)) {
    return NextResponse.redirect(dashboardFallback);
  }
  if (path.startsWith('/admin/tariffs') && !permissions.includes('tariffs_view')) {
    return NextResponse.redirect(dashboardFallback);
  }
  if (path.startsWith('/admin/reports') && !hasAny(permissions, PERMISSIONS.REPORTS_GENERATE_ALL, PERMISSIONS.REPORTS_GENERATE_BRANCH)) {
    return NextResponse.redirect(dashboardFallback);
  }

  // ── 3. Shared sub-routes (admin + staff) ─────────────────────────────────────

  // Branches
  if ((path.startsWith('/admin/branches') || path.startsWith('/staff/branches')) &&
    !permissions.includes('branches_view')) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Staff management
  if ((path.startsWith('/admin/staff') || path.startsWith('/staff/staff')) &&
    !isManagementRole(role) && !permissions.includes(PERMISSIONS.STAFF_VIEW)) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Individual customers
  if ((path.startsWith('/admin/individual-customers') || path.startsWith('/staff/individual-customers')) &&
    !hasAny(permissions, PERMISSIONS.CUSTOMERS_VIEW_ALL, PERMISSIONS.CUSTOMERS_VIEW_BRANCH)) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Bulk meters
  if ((path.startsWith('/admin/bulk-meters') || path.startsWith('/staff/bulk-meters')) &&
    !hasAny(permissions, PERMISSIONS.BULK_METERS_VIEW_ALL, PERMISSIONS.BULK_METERS_VIEW_BRANCH)) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Approvals
  if ((path.startsWith('/admin/approvals') || path.startsWith('/staff/approvals')) &&
    !permissions.includes('customers_approve')) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Bill management
  if ((path.startsWith('/admin/bill-management') || path.startsWith('/staff/bill-management')) &&
    !hasAny(permissions, 'bill:view_drafts', 'bill:approve', 'bill:create', 'bill:manage_all')) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Meter readings
  if ((path.startsWith('/admin/meter-readings') || path.startsWith('/staff/meter-readings')) &&
    !hasAny(permissions, 'meter_readings_view_all', 'meter_readings_view_branch', 'meter_readings_create')) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Data entry
  if ((path.startsWith('/admin/data-entry') || path.startsWith('/staff/data-entry')) &&
    !permissions.includes('data_entry_access')) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Notifications
  if ((path.startsWith('/admin/notifications') || path.startsWith('/staff/notifications')) &&
    !permissions.includes('notifications_view')) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Knowledge base
  if ((path.startsWith('/admin/knowledge-base') || path.startsWith('/staff/knowledge-base')) &&
    !permissions.includes('knowledge_base_manage')) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Routes management
  if ((path.startsWith('/admin/routes') || path.startsWith('/staff/my-routes')) &&
    !hasAny(permissions, 'routes_view_all', 'routes_view_assigned', PERMISSIONS.METER_READINGS_ANALYTICS_VIEW, 'settings_manage', 'meter_readings_view_all', 'staff_view')) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Fault codes
  if (path.startsWith('/admin/fault-codes') && !hasAny(permissions, 'settings_manage', 'bill:manage_all', PERMISSIONS.DASHBOARD_VIEW_ALL)) {
    return NextResponse.redirect(dashboardFallback);
  }

  // Staff reports
  if (path.startsWith('/staff/reports') &&
    !hasAny(permissions, PERMISSIONS.REPORTS_GENERATE_ALL, PERMISSIONS.REPORTS_GENERATE_BRANCH)) {
    return NextResponse.redirect(dashboardFallback);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/staff/:path*',
  ],
};
