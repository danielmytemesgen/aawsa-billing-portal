import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';
import { PERMISSIONS } from '@/lib/constants/auth';
import { createPermissionGuard, getRoutePermissionRule } from '@/lib/route-permissions';

const protectedRoutes = ['/admin', '/staff'];
const adminRoutes = ['/admin'];
const staffRoutes = ['/staff'];

const hasAny = (permissions: string[], ...perms: string[]) =>
  perms.some(p => permissions.includes(p));

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
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.tile.org https://veiethiopia.com https://www.shutterstock.com https://lh3.googleusercontent.com https://picsum.photos https://*.picsum.photos",
    // Connections: self + any https/wss (needed for Supabase, API calls, SW)
    "connect-src 'self' https: wss: blob:",
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
  const guard = createPermissionGuard(permissions);

  const isAdminRoute = adminRoutes.some(route => path.startsWith(route));
  const isStaffRoute = staffRoutes.some(route => path.startsWith(route));

  if (isAdminRoute && !guard.hasAdminAccess) {
    console.warn('middleware: permission denied', {
      path,
      reason: 'Admin route access without dashboard view permission',
      permissions,
      email: session?.email || 'Anonymous',
      branch: session?.branchName || session?.branch || 'N/A',
    });
    const redirect = NextResponse.redirect(new URL('/staff/dashboard', request.url));
    return setSecurityHeaders(redirect);
  }

  if (isStaffRoute && !role) {
    console.warn('middleware: permission denied', {
      path,
      reason: 'Staff route access without role assignment',
      permissions,
      email: session?.email || 'Anonymous',
      branch: session?.branchName || session?.branch || 'N/A',
    });
    const redirect = NextResponse.redirect(new URL('/', request.url));
    return setSecurityHeaders(redirect);
  }

  const dashboardFallback = isAdminRoute
    ? new URL('/admin/dashboard', request.url)
    : new URL('/staff/dashboard', request.url);

  const routeRule = getRoutePermissionRule(path, permissions);
  if (routeRule) {
    const hasAccess = routeRule.requiredPermissions
      ? guard.hasAllPermissions(routeRule.requiredPermissions)
      : guard.hasAnyPermission(routeRule.anyOf || []);

    if (!hasAccess) {
      const redirect = NextResponse.redirect(dashboardFallback);
      return setSecurityHeaders(redirect);
    }
  }

  const res = NextResponse.next();
  return setSecurityHeaders(res);
}

export const config = {
  matcher: '/:path*',
};
