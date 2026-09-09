import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { PERMISSIONS } from '@/lib/constants/auth';

// Inline decrypt to avoid importing @/lib/session → @/lib/env → zod,
// which causes the Edge-runtime compiler to hang on startup.
async function decrypt(token: string): Promise<any> {
  const secret = process.env.SESSION_SECRET ||
    'a9f3c2e1b8d74f6a0e5c9b2d1f4a7e3c8b5d2f9a6e1c4b7d0f3a8e5c2b9d6f1';
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
  return payload;
}

const protectedRoutes = ['/admin', '/staff'];
const adminRoutes = ['/admin'];
const staffRoutes = ['/staff'];

const hasPerm = (permissions: string[], p: string) => permissions.includes('*') || permissions.includes('admin') || permissions.includes(p);
const hasAny = (permissions: string[], ...perms: string[]) => perms.some(p => hasPerm(permissions, p));

// ── BN-1 Fix: Live permissions cache ───────────────────────────────────────
// Caches live DB permissions per sessionId for 30 seconds to avoid a DB hit
// on every request while still catching role changes within half a minute.
const LIVE_PERM_CACHE_TTL_MS = 30_000;
const livePermCache = new Map<string, { perms: string[]; ts: number }>();

function getInternalOrigin(request: NextRequest): string {
  let origin = request.nextUrl.origin;
  if (origin.includes('0.0.0.0') || origin.includes('localhost')) {
    origin = origin.replace('0.0.0.0', '127.0.0.1').replace('localhost', '127.0.0.1');
  }
  return origin;
}

async function getLivePermissions(session: any, request: NextRequest): Promise<string[] | null> {
  const staffId = session?.id;
  if (!staffId) return null;
  const cacheKey = String(staffId);

  const now = Date.now();
  const cached = livePermCache.get(cacheKey);
  if (cached && now - cached.ts < LIVE_PERM_CACHE_TTL_MS) {
    return cached.perms;
  }

  try {
    const origin = getInternalOrigin(request);
    const res = await fetch(
      `${origin}/api/permissions/live?staffId=${encodeURIComponent(staffId)}`,
      {
        headers: {
          Accept: 'application/json',
          'x-internal-key': process.env.INTERNAL_API_KEY || 'aawsa-internal-secret-2026',
        },
        signal: AbortSignal.timeout(1500),
      }
    );
    if (!res.ok) return null; // fail-open: fall back to JWT permissions
    const data = await res.json();
    const perms: string[] = Array.isArray(data.permissions) ? data.permissions : [];
    livePermCache.set(cacheKey, { perms, ts: now });
    return perms;
  } catch (e) {
    return null; // fail-open
  }
}

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
    const origin = getInternalOrigin(request);
    const res = await fetch(
      `${origin}/api/session/revocation-status?sessionId=${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Accept: 'application/json',
          'x-internal-key': process.env.INTERNAL_API_KEY || 'aawsa-internal-secret-2026',
        },
        signal: AbortSignal.timeout(1500),
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
    return false;
  }
}

function setSecurityHeaders(res: NextResponse) {
  const isDev = process.env.NODE_ENV !== 'production';
  const csp = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.tile.org https://veiethiopia.com https://www.shutterstock.com https://lh3.googleusercontent.com https://picsum.photos https://*.picsum.photos https://*.freepik.com https://img.freepik.com https://*.unsplash.com https://images.unsplash.com",
    "connect-src 'self' http://127.0.0.1:* http://localhost:* https: ws: wss: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "object-src 'none'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Permissions-Policy', "geolocation=(self), camera=(), microphone=()");

  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_HSTS === 'true') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return res;
}

function getRoleDashboardFallback(permissions: string[], role: string, request: NextRequest): URL {
  const isGlobalAdmin = hasPerm(permissions, '*') || hasPerm(permissions, 'all') || hasPerm(permissions, PERMISSIONS.DASHBOARD_VIEW_ALL);
  
  if (isGlobalAdmin) {
    return new URL('/admin/dashboard', request.url);
  }
  if (hasPerm(permissions, PERMISSIONS.STAFF_VIEW) && !hasPerm(permissions, PERMISSIONS.BILL_VIEW_ALL)) {
    return new URL('/staff/staff-management-dashboard', request.url);
  }
  if (hasAny(permissions, 'routes_view_assigned', 'meter_readings_create_bulk', 'meter_readings_create_individual', PERMISSIONS.METER_READINGS_CREATE)) {
    return new URL('/staff/dashboard', request.url);
  }
  if (hasPerm(permissions, PERMISSIONS.DASHBOARD_VIEW_BRANCH)) {
    return new URL('/staff/dashboard', request.url);
  }
  if (hasAny(permissions, 
    PERMISSIONS.ROUTES_VIEW, 
    PERMISSIONS.ROUTES_VIEW_ALL, 
    PERMISSIONS.ROUTES_VIEW_BRANCH, 
    PERMISSIONS.ROUTES_VIEW_ASSIGNED, 
    PERMISSIONS.ROUTES_MANAGE, 
    PERMISSIONS.ROUTES_CREATE, 
    PERMISSIONS.ROUTES_UPDATE, 
    PERMISSIONS.ROUTES_DELETE, 
    PERMISSIONS.READER_PROGRESS_VIEW
  )) {
    return new URL('/staff/my-routes', request.url);
  }
  if (hasAny(permissions, 
    PERMISSIONS.DATA_ENTRY_ACCESS, 
    PERMISSIONS.CUSTOMERS_CREATE, 
    PERMISSIONS.BULK_METERS_CREATE, 
    PERMISSIONS.DATA_ENTRY_BULK_FORM, 
    PERMISSIONS.DATA_ENTRY_INDIVIDUAL_FORM, 
    PERMISSIONS.DATA_ENTRY_BULK_CSV, 
    PERMISSIONS.DATA_ENTRY_INDIVIDUAL_CSV
  )) {
    return new URL(isGlobalAdmin ? '/admin/data-entry' : '/staff/data-entry', request.url);
  }
  if (hasAny(permissions, PERMISSIONS.CUSTOMERS_VIEW_ALL, PERMISSIONS.CUSTOMERS_VIEW_BRANCH)) {
    return new URL(isGlobalAdmin ? '/admin/individual-customers' : '/staff/individual-customers', request.url);
  }
  if (hasAny(permissions, PERMISSIONS.BULK_METERS_VIEW_ALL, PERMISSIONS.BULK_METERS_VIEW_BRANCH)) {
    return new URL(isGlobalAdmin ? '/admin/bulk-meters' : '/staff/bulk-meters', request.url);
  }
  if (hasAny(permissions, PERMISSIONS.REPORTS_GENERATE_ALL, PERMISSIONS.REPORTS_GENERATE_BRANCH)) {
    return new URL(isGlobalAdmin ? '/admin/reports' : '/staff/reports', request.url);
  }
  if (hasAny(permissions, PERMISSIONS.BILL_VIEW_ALL, PERMISSIONS.BILL_VIEW_BRANCH, PERMISSIONS.BILL_VIEW_DRAFTS, PERMISSIONS.BILL_VIEW_PENDING)) {
    return new URL('/admin/bill-management', request.url);
  }
  if (hasAny(permissions, PERMISSIONS.SUPPORT_VIEW_ALL, PERMISSIONS.SUPPORT_VIEW_BRANCH, PERMISSIONS.SUPPORT_MANAGE, 'support:view_all', 'support:view_branch', 'support:manage')) {
    return new URL(isGlobalAdmin ? '/admin/support' : '/staff/support', request.url);
  }
  return new URL(isGlobalAdmin ? '/admin/dashboard' : '/staff/dashboard', request.url);
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
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
      console.warn('middleware: failed to decrypt session cookie', e);
      session = null;
    }
  }

  if (!isProtectedRoute) {
    const res = NextResponse.next();
    return setSecurityHeaders(res);
  }

  if (!session) {
    const redirect = NextResponse.redirect(new URL('/', request.url));
    return setSecurityHeaders(redirect);
  }

  if (session.sessionId && await isSessionRevoked(session, request)) {
    const redirect = NextResponse.redirect(new URL('/?kicked=1', request.url));
    redirect.cookies.delete('session');
    redirect.cookies.set('kicked_notice', '1', {
      path: '/',
      maxAge: 300,
      httpOnly: false,
      sameSite: 'lax',
    });
    return setSecurityHeaders(redirect);
  }

  const role = session.role?.toLowerCase()?.trim();
  // BN-1 fix: Prefer live DB permissions over stale JWT-embedded permissions.
  // Falls back to JWT permissions if the live fetch fails (fail-open).
  const livePerms = await getLivePermissions(session, request);
  const permissions: string[] = livePerms ?? (session.permissions || []);

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

  if ((path.startsWith('/admin/roles-and-permissions') || path.startsWith('/staff/roles-and-permissions')) &&
    !hasAny(permissions, PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.DASHBOARD_VIEW_ALL)) {
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
    !hasAny(permissions, PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.PROMOTIONS_MANAGE, PERMISSIONS.PROMOTIONS_VIEW)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/tariffs') || path.startsWith('/staff/tariffs')) &&
    !hasAny(permissions, PERMISSIONS.TARIFFS_VIEW, PERMISSIONS.TARIFFS_MANAGE)) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/reports') || path.startsWith('/staff/reports')) &&
    !hasAny(permissions,
      PERMISSIONS.REPORTS_GENERATE_ALL,
      PERMISSIONS.REPORTS_GENERATE_BRANCH,
      PERMISSIONS.ROUTES_VIEW_ASSIGNED,
      PERMISSIONS.METER_READINGS_ANALYTICS_VIEW,
      PERMISSIONS.REPORT_LIST_OF_PAID_BILLS,
      PERMISSIONS.REPORT_BRANCH_LIST_OF_PAID_BILLS,
      PERMISSIONS.REPORT_LIST_OF_SENT_BILLS,
      PERMISSIONS.REPORT_BRANCH_LIST_OF_SENT_BILLS,
      PERMISSIONS.REPORT_LIST_OF_UNSETTLED_BILLS,
      PERMISSIONS.REPORT_BRANCH_LIST_OF_UNSETTLED_BILLS,
      PERMISSIONS.BILL_VIEW_PAID,
      PERMISSIONS.BILL_SEND,
      PERMISSIONS.BILL_POST,
      PERMISSIONS.BILL_VIEW_UNPAID,
      PERMISSIONS.BILL_VIEW_OVERDUE,
      PERMISSIONS.BILL_VIEW_ALL,
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/branches') || path.startsWith('/staff/branches')) &&
    !hasAny(permissions,
      PERMISSIONS.BRANCHES_VIEW,
      PERMISSIONS.BRANCHES_CREATE,
      PERMISSIONS.BRANCHES_UPDATE,
      PERMISSIONS.BRANCHES_DELETE
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/staff') || path.startsWith('/staff/staff')) &&
    !hasAny(permissions,
      PERMISSIONS.STAFF_VIEW,
      PERMISSIONS.STAFF_VIEW_ALL,
      PERMISSIONS.STAFF_VIEW_BRANCH,
      PERMISSIONS.STAFF_CREATE,
      PERMISSIONS.STAFF_UPDATE,
      PERMISSIONS.STAFF_DELETE
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/individual-customers') || path.startsWith('/staff/individual-customers')) &&
    !hasAny(permissions,
      PERMISSIONS.CUSTOMERS_VIEW_ALL,
      PERMISSIONS.CUSTOMERS_VIEW_BRANCH,
      PERMISSIONS.DATA_ENTRY_ACCESS,
      PERMISSIONS.CUSTOMERS_CREATE,
      PERMISSIONS.CUSTOMERS_CREATE_RESTRICTED,
      PERMISSIONS.CUSTOMERS_UPDATE,
      PERMISSIONS.CUSTOMERS_DELETE,
      PERMISSIONS.CUSTOMERS_APPROVE
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/bulk-meters') || path.startsWith('/staff/bulk-meters')) &&
    !hasAny(permissions,
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
    )) {
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
      PERMISSIONS.BILL_CLOSE_CYCLE
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/meter-readings') || path.startsWith('/staff/meter-readings') || path.startsWith('/staff/reader-progress')) &&
    !hasAny(permissions,
      PERMISSIONS.METER_READINGS_VIEW_ALL,
      PERMISSIONS.METER_READINGS_VIEW_BRANCH,
      PERMISSIONS.METER_READINGS_VIEW_INDIVIDUAL,
      PERMISSIONS.METER_READINGS_VIEW_BULK,
      PERMISSIONS.METER_READINGS_CREATE,
      PERMISSIONS.METER_READINGS_CREATE_BULK,
      PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL,
      PERMISSIONS.METER_READINGS_ADD_MANUAL,
      PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL,
      PERMISSIONS.METER_READINGS_UPLOAD_BULK,
      PERMISSIONS.METER_READINGS_ANALYTICS_VIEW,
      'routes_view_assigned'
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/data-entry') || path.startsWith('/staff/data-entry')) &&
    !hasAny(permissions,
      PERMISSIONS.DATA_ENTRY_ACCESS,
      PERMISSIONS.CUSTOMERS_CREATE,
      PERMISSIONS.BULK_METERS_CREATE,
      PERMISSIONS.DATA_ENTRY_BULK_FORM,
      PERMISSIONS.DATA_ENTRY_INDIVIDUAL_FORM,
      PERMISSIONS.DATA_ENTRY_BULK_CSV,
      PERMISSIONS.DATA_ENTRY_INDIVIDUAL_CSV,
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if ((path.startsWith('/admin/notifications') || path.startsWith('/staff/notifications')) &&
    !hasPerm(permissions, PERMISSIONS.NOTIFICATIONS_VIEW)) {
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
      PERMISSIONS.ROUTES_VIEW,
      PERMISSIONS.ROUTES_VIEW_BRANCH,
      PERMISSIONS.ROUTES_VIEW_ASSIGNED,
      PERMISSIONS.ROUTES_MANAGE,
      PERMISSIONS.ROUTES_CREATE,
      PERMISSIONS.ROUTES_UPDATE,
      PERMISSIONS.ROUTES_DELETE,
      PERMISSIONS.METER_READINGS_CREATE,
      PERMISSIONS.METER_READINGS_CREATE_BULK,
      PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL,
      PERMISSIONS.READER_PROGRESS_VIEW,
      PERMISSIONS.METER_READINGS_ANALYTICS_VIEW,
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  // BN-4 fix: Include FAULT_CODES_VIEW/MANAGE in the fault-codes middleware guard,
  // and extend to /staff/fault-codes path
  if ((path.startsWith('/admin/fault-codes') || path.startsWith('/staff/fault-codes')) &&
    !hasAny(permissions,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.BILL_VIEW_ALL,
      PERMISSIONS.DASHBOARD_VIEW_ALL,
      PERMISSIONS.FAULT_CODES_VIEW,
      PERMISSIONS.FAULT_CODES_MANAGE,
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/admin/support') &&
    !hasAny(permissions,
      PERMISSIONS.SUPPORT_VIEW_ALL,
      PERMISSIONS.SUPPORT_MANAGE,
      'support:view_all',
      'support:manage',
      PERMISSIONS.DASHBOARD_VIEW_ALL
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  if (path.startsWith('/staff/support') &&
    !hasAny(permissions,
      PERMISSIONS.SUPPORT_VIEW_ALL,
      PERMISSIONS.SUPPORT_VIEW_BRANCH,
      PERMISSIONS.SUPPORT_CREATE,
      PERMISSIONS.SUPPORT_ASSIGN,
      PERMISSIONS.SUPPORT_RESOLVE,
      PERMISSIONS.SUPPORT_MANAGE,
      'support:view_all',
      'support:view_branch',
      'support:create',
      'support:assign',
      'support:resolve',
      'support:manage',
      PERMISSIONS.DASHBOARD_VIEW_ALL
    )) {
    const redirect = NextResponse.redirect(dashboardFallback);
    return setSecurityHeaders(redirect);
  }

  const res = NextResponse.next();
  return setSecurityHeaders(res);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes - prevents self-fetch deadlocks)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, manifest.json, sw.js
     * - image assets (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
