import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { encrypt, decrypt } from "./session";
export { encrypt, decrypt };


export async function getSession(requestOrHeaders?: Request | NextRequest | Headers) {
  let token: string | undefined;

  // 1. Check Authorization header from provided request/headers if available
  if (requestOrHeaders) {
    let authHeader: string | null = null;
    if ('headers' in requestOrHeaders && typeof (requestOrHeaders as any).headers?.get === 'function') {
      authHeader = (requestOrHeaders as any).headers.get('authorization');
    } else if (typeof (requestOrHeaders as any).get === 'function') {
      authHeader = (requestOrHeaders as any).get('authorization');
    }
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  // 2. If no header from argument, check request headers from next/headers
  if (!token) {
    try {
      const reqHeaders = await headers();
      const authHeader = reqHeaders.get('authorization');
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.substring(7).trim();
      }
    } catch {
      // not in request context
    }
  }

  // 3. Check cookie (online web app)
  if (!token) {
    try {
      token = (await cookies()).get("session")?.value;
    } catch {
      // not in request context
    }
  }

  if (token) {
    try {
      const session = await decrypt(token);
      
      // If token is a device access token, verify staff member is still active
      if (session?.type === 'device' && session?.id) {
        return session;
      }

      // Reject sessions an admin has kicked out (staff_sessions row finalized).
      if (session?.sessionId) {
        const { isStaffSessionRevoked } = await import('./session-revocation');
        if (await isStaffSessionRevoked(session.sessionId)) {
          return null;
        }
      }

      // Dynamic RBAC: Load live permissions from database to ensure immediate effect on assign/unassign
      if (session?.id) {
        try {
          const { dbGetStaffPermissions } = await import('./db-queries');
          const livePerms = await dbGetStaffPermissions(session.id);
          if (Array.isArray(livePerms)) {
            session.permissions = livePerms;
          }
        } catch (permErr) {
          console.warn('Failed to load live permissions in getSession:', permErr);
        }
      }

      return session;
    } catch (e) {
      console.warn('Failed to decrypt session token:', e instanceof Error ? e.message : e);
      return null;
    }
  }

  // 4. Client-side offline fallback: retrieve encrypted token from IndexedDB
  if (typeof window !== 'undefined') {
    try {
      const { getSessionToken } = await import("./offline-db");
      const cachedToken = await getSessionToken();
      if (cachedToken) {
        const session = await decrypt(cachedToken);
        return session;
      }
    } catch (e) {
      console.error('Failed to decrypt offline session token in browser', e);
    }
  }

  return null;
}


export async function updateSession(request: NextRequest) {
    const session = request.cookies.get("session")?.value;
    if (!session) return;

    try {
        // Refresh the session so it doesn't expire
        const parsed = await decrypt(session);
        parsed.expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
        const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
        const isSecure = forwardedProto ? forwardedProto === 'https' : request.nextUrl.protocol === 'https:';
        const res = NextResponse.next();
        res.cookies.set({
            name: "session",
            value: await encrypt(parsed),
            httpOnly: true,
            secure: isSecure,
            expires: parsed.expires,
        });
        return res;
    } catch (e) {
        console.warn('Failed to decrypt session during update, clearing cookie:', e instanceof Error ? e.message : e);
        const res = NextResponse.next();
        res.cookies.delete("session");
        return res;
    }
}

