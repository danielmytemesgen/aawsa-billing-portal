import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';

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

  const role = session.role?.toLowerCase();
  const permissions = session.permissions || [];

  // 1. Basic Role-Based Path Protection
  const isAdminRoute = adminRoutes.some(route => path.startsWith(route));
  const isStaffRoute = staffRoutes.some(route => path.startsWith(route));

  if (isAdminRoute && !['admin', 'head office management', 'staff management'].includes(role)) {
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
  if (path.startsWith('/admin/staff') && !['admin', 'staff management'].includes(role) && !permissions.includes('staff_view')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/customers') && !permissions.includes('customers_view_all') && !permissions.includes('customers_view_branch')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/bulk-meters') && !permissions.includes('bulk_meters_view_all') && !permissions.includes('bulk_meters_view_branch')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/tariffs') && !permissions.includes('tariffs_view')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/reports') && !permissions.includes('reports_generate_all') && !permissions.includes('reports_generate_branch')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (path.startsWith('/admin/settings') && !permissions.includes('settings_view')) {
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
