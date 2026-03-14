import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';
import { ROLES, PERMISSIONS, isManagementRole } from '@/lib/constants/auth';

const protectedRoutes = ['/admin', '/staff'];
const adminRoutes = ['/admin'];
const staffRoutes = ['/staff'];

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

  // 1. Admin Route Protection (role OR permission-based)
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

  // 2. Granular Permission-Based Protection for Admin Sub-routes
  if (path.startsWith('/admin/roles-and-permissions') && !permissions.includes('permissions_view')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/branches') && !permissions.includes('branches_view')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/staff') && !isManagementRole(role) && !permissions.includes(PERMISSIONS.STAFF_VIEW)) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/customers') && !permissions.includes(PERMISSIONS.CUSTOMERS_VIEW_ALL) && !permissions.includes(PERMISSIONS.CUSTOMERS_VIEW_BRANCH)) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/bulk-meters') && !permissions.includes(PERMISSIONS.BULK_METERS_VIEW_ALL) && !permissions.includes(PERMISSIONS.BULK_METERS_VIEW_BRANCH)) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/tariffs') && !permissions.includes('tariffs_view')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/reports') && !permissions.includes(PERMISSIONS.REPORTS_GENERATE_ALL) && !permissions.includes(PERMISSIONS.REPORTS_GENERATE_BRANCH)) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/settings') && !permissions.includes(PERMISSIONS.SETTINGS_VIEW)) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/staff/:path*',
  ],
};
