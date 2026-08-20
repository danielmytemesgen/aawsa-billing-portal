import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';
import { PERMISSIONS } from '@/lib/constants/auth';

const protectedRoutes = ['/admin', '/staff'];
const adminRoutes = ['/admin'];
const staffRoutes = ['/staff'];

const hasAny = (permissions: string[], ...perms: string[]) =>
  perms.some(p => permissions.includes(p));

// Kicked-out staff sessions: the Edge runtime can't import pg, so we ask the
// internal /api/session/revocation-status endpoint (which short-circuits in
// middleware and runs on Node). Results are cached 60s to avoid a fetch per
// request; revoked sessions are never cached so the next request logs them out.
const REVOKE_CACHE_TTL_MS = 60_000;
const revocationCache = new Map<string, number>();

async function isSessionRevoked(session: any, request: NextRequest): Promise<boolean> {
  const sessionId = session?.sessionId;
  if (!sessionId) return false;
  const now = Date.now();
  const lastChecked = revocationCache.get(sessionId);
  if (lastChecked !== undefined && now - lastChecked < REVOKE_CACHE_TTL_MS) {
    return false;
  }
  try {
    const res = await fetch(
      `${request.nextUrl.origin}/api/session/revocation-status?sessionId=${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Accept: 'application/json',
          // Shared secret: the status endpoint rejects requests without it.
          // Mirrors env.ts's dev default so dev and prod stay consistent.
          'x-internal-key': process.env.INTERNAL_API_KEY || 'aawsa-internal-secret-2026',
        },
      }
    );
    if (!res.ok) return false; // fail-open
    const data = await res.json();
    if (data.revoked) {
      revocationCache.delete(sessionId);
      return true;
    }
    revocationCache.set(sessionId, now);
    return false;
  } catch (e) {
    console.warn('Revocation check failed (fail-open):', e);
    return false;
  }
}

function setSecurityHeaders(res: NextResponse) {
  const isDev = process.env.NODE_ENV !== 'production';
  const csp = [
    "default-src 'self'",
    // Allow inline scripts (Next.js needs this) and eval in dev
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Images: self, data URIs, blob (for camera captures), and known remote hosts
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.tile.org https://veiethiopia.com https://www.shutterstock.com https://lh3.googleusercontent.com https://picsum.photos https://*.picsum.photos https://*.freepik.com https://img.freepik.com https://*.unsplash.com https://images.unsplash.com",
    // Connections: self + local dev ports + any https/wss (needed for Supabase, API calls, SW)
    "connect-src 'self' http://127.0.0.1:* http://localhost:* https: wss: blob:",
    // Fonts: self, data URIs, and Google Fonts CDN
    "font-src 'self' data: https://fonts.gstatic.com",
    "object-src 'none'",
    // Allow camera and media for meter photo capture
    "media-src 'self' blob:",
    // Workers need blob: for service worker
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Permissions-Policy', "geolocation=(self), camera=(), microphone=()");

  // Only enable HSTS in production if explicitly configured via environment variables
  // to avoid blocking HTTP-only local network/intranet deployments.
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_HSTS === 'true') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return res;
}

function getRoleDashboardFallback(permissions: string[], role: string, request: NextRequest): URL {
  const roleLower = role?.toLowerCase() || '';
  if (permissions.includes(PERMISSIONS.DASHBOARD_VIEW_ALL)) {
    return new URL(roleLower.includes('head office') ? '/admin/head-office-dashboard' : '/admin/dashboard', request.url);
  }
  if (permissions.includes(PERMISSIONS.STAFF_VIEW) && !permissions.includes(PERMISSIONS.BILL_VIEW_ALL)) {
    return new URL('/admin/staff-management-dashboard', request.url);
  }
  if (permissions.includes(PERMISSIONS.DASHBOARD_VIEW_BRANCH)) {
    return new URL('/admin/dashboard', request.url);
  }
  if (hasAny(permissions, 'routes_view', 'routes_view_all', 'routes_view_branch', 'routes_view_assigned', 'routes_manage', 'routes_create', 'routes_update', 'routes_delete', PERMISSIONS.METER_READINGS_CREATE, 'reader_progress_view')) {
    return new URL('/staff/my-routes', request.url);
  }
  if (hasAny(permissions, PERMISSIONS.DATA_ENTRY_ACCESS, PERMISSIONS.CUSTOMERS_CREATE, PERMISSIONS.BULK_METERS_CREATE, 'data_entry_bulk_form', 'data_entry_individual_form', 'data_entry_bulk_csv', 'data_entry_individual_csv')) {
    return new URL('/admin/data-entry', request.url);
  }
  if (hasAny(permissions, PERMISSIONS.CUSTOMERS_VIEW_ALL, PERMISSIONS.CUSTOMERS_VIEW_BRANCH)) {
    return new URL('/admin/individual-customers', request.url);
  }
  if (hasAny(permissions, PERMISSIONS.BULK_METERS_VIEW_ALL, PERMISSIONS.BULK_METERS_VIEW_BRANCH)) {
    return new URL('/admin/bulk-meters', request.url);
  }
  if (hasAny(permissions, PERMISSIONS.REPORTS_GENERATE_ALL, PERMISSIONS.REPORTS_GENERATE_BRANCH)) {
    return new URL('/admin/reports', request.url);
  }
  if (hasAny(permissions, PERMISSIONS.BILL_VIEW_ALL, PERMISSIONS.BILL_VIEW_BRANCH, PERMISSIONS.BILL_VIEW_DRAFTS, PERMISSIONS.BILL_VIEW_PENDING)) {
    return new URL('/admin/bill-management', request.url);
  }
  return new URL('/admin/dashboard', request.url);
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

  // Kick-out enforcement: a staff session whose row was revoked gets logged
  // out immediately (clear the cookie so the JWT dies in this browser too) and
  // lands on the login page with ?kicked=1 so the user sees an explanation.
  if (session.sessionId && await isSessionRevoked(session, request)) {
    const redirect = NextResponse.redirect(new URL('/?kicked=1', request.url));
    redirect.cookies.delete('session');
    redirect.cookies.set('kicked_notice', '1', {
      path: '/',
      maxAge: 300, // 5 min — long enough to survive the redirect + any reload
      httpOnly: false, // the login page reads it to show the notice
      sameSite: 'lax',
    });
    return setSecurityHeaders(redirect);
  }

  const role = session.role?.toLowerCase()?.trim();
  const permissions: string[] = session.permissions || [];

  if (!role && permissions.length === 0) {
    console.warn('middleware: permission denied', {
      path,
      reason: 'Protected route access without role or permissions assignment',
      email: session?.email || 'Anonymous',
    });
    const redirect = NextResponse.redirect(new URL('/', request.url));
    return setSecurityHeaders(redirect);
  }

  const dashboardFallback = getRoleDashboardFallback(permissions, role || '', request);

  // Granular, role-agnostic permission gates for all dashboard & system modules:

  if ((path.startsWith('/admin/roles-and-permissions') || path.startsWith('/staff/roles-and-permissions')) &&
    !permissions.includes(PERMISSIONS.ROLES_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/security-logs') &&
    !hasAny(permissions, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.DASHBOARD_VIEW_ALL)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/recycle-bin') &&
    !hasAny(permissions, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.DASHBOARD_VIEW_ALL)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/maintenance') &&
    !hasAny(permissions, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.DASHBOARD_VIEW_ALL)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/settings') || path.startsWith('/staff/settings')) &&
    !hasAny(permissions, PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_MANAGE, 'promotions_manage')) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/tariffs') || path.startsWith('/staff/tariffs')) &&
    !permissions.includes(PERMISSIONS.TARIFFS_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/reports') || path.startsWith('/staff/reports')) &&
    !hasAny(permissions,
      PERMISSIONS.REPORTS_GENERATE_ALL,
      PERMISSIONS.REPORTS_GENERATE_BRANCH,
      PERMISSIONS.ROUTES_VIEW_ASSIGNED,
      PERMISSIONS.METER_READINGS_ANALYTICS_VIEW
    )) {
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
    !hasAny(permissions, PERMISSIONS.CUSTOMERS_VIEW_ALL, PERMISSIONS.CUSTOMERS_VIEW_BRANCH, PERMISSIONS.DATA_ENTRY_ACCESS, PERMISSIONS.CUSTOMERS_CREATE)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/bulk-meters') || path.startsWith('/staff/bulk-meters')) &&
    !hasAny(permissions, PERMISSIONS.BULK_METERS_VIEW_ALL, PERMISSIONS.BULK_METERS_VIEW_BRANCH, PERMISSIONS.DATA_ENTRY_ACCESS, PERMISSIONS.BULK_METERS_CREATE)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/approvals') || path.startsWith('/staff/approvals')) &&
    !hasAny(permissions, PERMISSIONS.CUSTOMERS_APPROVE, PERMISSIONS.BULK_METERS_APPROVE, PERMISSIONS.BILL_APPROVE)) {
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
      PERMISSIONS.BILL_CLOSE_CYCLE
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/meter-readings') || path.startsWith('/staff/meter-readings') || path.startsWith('/staff/reader-progress')) &&
    !hasAny(permissions,
      PERMISSIONS.METER_READINGS_VIEW_ALL,
      PERMISSIONS.METER_READINGS_VIEW_BRANCH,
      PERMISSIONS.METER_READINGS_CREATE,
      PERMISSIONS.METER_READINGS_ANALYTICS_VIEW
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/data-entry') || path.startsWith('/staff/data-entry')) &&
    !hasAny(permissions, PERMISSIONS.DATA_ENTRY_ACCESS, PERMISSIONS.CUSTOMERS_CREATE, PERMISSIONS.BULK_METERS_CREATE)) {
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

  if ((path.startsWith('/admin/routes') || path.startsWith('/staff/my-routes')) &&
    !hasAny(permissions,
      PERMISSIONS.ROUTES_VIEW_ALL,
      PERMISSIONS.ROUTES_VIEW_ASSIGNED,
      PERMISSIONS.METER_READINGS_ANALYTICS_VIEW,
      'routes_view',
      'routes_view_branch',
      'routes_manage',
      'routes_create',
      'routes_update',
      'routes_delete',
      'meter_readings_create',
      'reader_progress_view'
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/fault-codes') &&
    !hasAny(permissions, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.BILL_VIEW_ALL, PERMISSIONS.DASHBOARD_VIEW_ALL)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  const res = NextResponse.next();
  return setSecurityHeaders(res);
}

export const config = {
  matcher: '/:path*',
};
