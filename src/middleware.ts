import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants/auth';

const protectedRoutes = ['/admin', '/staff'];
const adminRoutes = ['/admin'];
const staffRoutes = ['/staff'];

const hasAny = (permissions: string[], ...perms: string[]) =>
  perms.some(p => permissions.includes(p));

function setSecurityHeaders(res: NextResponse) {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.tile.org",
    "connect-src 'self' https: wss:",
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-ancestors 'none'"
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Permissions-Policy', "geolocation=(self), camera=(), microphone=()");

  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return res;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Short-circuit static assets and service worker to avoid running full middleware
  const staticPrefixes = ['/_next/', '/favicon.ico', '/manifest.json', '/sw.js', '/public/', '/api/'];
  if (staticPrefixes.some(p => path === p || path.startsWith(p))) {
    const res = NextResponse.next();
    return setSecurityHeaders(res);
  }
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));

  const cookie = request.cookies.get('session')?.value;
  let session = null;
  if (cookie) {
    try {
      session = await decrypt(cookie);
    } catch (e) {
      // If session decryption fails, log minimally and continue as unauthenticated
      console.warn('middleware: failed to decrypt session cookie', e);
      session = null;
    }
  }

  // If route isn't protected, just continue and add security headers
  if (!isProtectedRoute) {
    const res = NextResponse.next();
    return setSecurityHeaders(res);
  }

  // Protected route: require valid session
  if (!session) {
    const redirect = NextResponse.redirect(new URL('/', request.url));
    return setSecurityHeaders(redirect);
  }

  const role = session.role?.toLowerCase()?.trim();
  const permissions: string[] = session.permissions || [];

  const isAdminRoute = adminRoutes.some(route => path.startsWith(route));
  const isStaffRoute = staffRoutes.some(route => path.startsWith(route));
  const hasAdminAccess = permissions.includes(PERMISSIONS.DASHBOARD_VIEW_ALL);

  if (isAdminRoute && !hasAdminAccess) {
    const redirect = NextResponse.redirect(new URL('/staff/dashboard', request.url));
    return setSecurityHeaders(redirect);
  }

  if (isStaffRoute && !role) {
    const redirect = NextResponse.redirect(new URL('/', request.url));
    return setSecurityHeaders(redirect);
  }

  const dashboardFallback = isAdminRoute
    ? new URL('/admin/dashboard', request.url)
    : new URL('/staff/dashboard', request.url);

  if (path.startsWith('/admin/roles-and-permissions') && !permissions.includes(PERMISSIONS.ROLES_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/security-logs') && !permissions.includes(PERMISSIONS.SETTINGS_MANAGE)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/recycle-bin') && !permissions.includes(PERMISSIONS.SETTINGS_MANAGE)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/maintenance') && !permissions.includes(PERMISSIONS.SETTINGS_MANAGE)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/settings') && !permissions.includes(PERMISSIONS.SETTINGS_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/tariffs') && !permissions.includes(PERMISSIONS.TARIFFS_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/reports') && !hasAny(permissions, PERMISSIONS.REPORTS_GENERATE_ALL, PERMISSIONS.REPORTS_GENERATE_BRANCH)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/branches') || path.startsWith('/staff/branches')) &&
    !permissions.includes(PERMISSIONS.BRANCHES_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/staff') || path.startsWith('/staff/staff')) &&
    !permissions.includes(PERMISSIONS.STAFF_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/individual-customers') || path.startsWith('/staff/individual-customers')) &&
    !hasAny(permissions, PERMISSIONS.CUSTOMERS_VIEW_ALL, PERMISSIONS.CUSTOMERS_VIEW_BRANCH)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/bulk-meters') || path.startsWith('/staff/bulk-meters')) &&
    !hasAny(permissions, PERMISSIONS.BULK_METERS_VIEW_ALL, PERMISSIONS.BULK_METERS_VIEW_BRANCH)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/approvals') || path.startsWith('/staff/approvals')) &&
    !permissions.includes(PERMISSIONS.CUSTOMERS_APPROVE)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/bill-management') || path.startsWith('/staff/bill-management')) &&
    !hasAny(permissions,
      PERMISSIONS.BILL_VIEW_ALL,
      PERMISSIONS.BILL_VIEW_BRANCH,
      PERMISSIONS.BILL_CREATE,
      PERMISSIONS.BILL_VIEW_DRAFTS,
      PERMISSIONS.BILL_VIEW_PENDING,
      PERMISSIONS.BILL_APPROVE,
      PERMISSIONS.BILL_VIEW_PAID,
      PERMISSIONS.BILL_VIEW_UNPAID,
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/meter-readings') || path.startsWith('/staff/meter-readings')) &&
    !hasAny(permissions, PERMISSIONS.METER_READINGS_VIEW_ALL, PERMISSIONS.METER_READINGS_VIEW_BRANCH, PERMISSIONS.METER_READINGS_CREATE)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/data-entry') || path.startsWith('/staff/data-entry')) &&
    !permissions.includes(PERMISSIONS.DATA_ENTRY_ACCESS)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/notifications') || path.startsWith('/staff/notifications')) &&
    !permissions.includes(PERMISSIONS.NOTIFICATIONS_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/knowledge-base') || path.startsWith('/staff/knowledge-base')) &&
    !hasAny(permissions, PERMISSIONS.KNOWLEDGE_BASE_VIEW, PERMISSIONS.KNOWLEDGE_BASE_MANAGE)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/staff/roles-and-permissions') && !permissions.includes(PERMISSIONS.ROLES_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/staff/tariffs') && !permissions.includes(PERMISSIONS.TARIFFS_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/staff/settings') && !permissions.includes(PERMISSIONS.SETTINGS_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/routes') || path.startsWith('/staff/my-routes')) &&
    !hasAny(permissions, PERMISSIONS.ROUTES_VIEW_ALL, PERMISSIONS.ROUTES_VIEW_ASSIGNED, PERMISSIONS.METER_READINGS_ANALYTICS_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/fault-codes') && !hasAny(permissions, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.BILL_VIEW_ALL, PERMISSIONS.DASHBOARD_VIEW_ALL)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/staff/reports') &&
    !hasAny(permissions,
      PERMISSIONS.REPORTS_GENERATE_ALL,
      PERMISSIONS.REPORTS_GENERATE_BRANCH,
      PERMISSIONS.ROUTES_VIEW_ASSIGNED,
      PERMISSIONS.METER_READINGS_ANALYTICS_VIEW
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  const res = NextResponse.next();
  return setSecurityHeaders(res);
}

export const config = {
  matcher: '/:path*',
};
