'use server';

import { cookies, headers } from 'next/headers';
import { decodeJwt } from 'jose';
import { getStaffMemberForAuth } from './db-queries';
import { encrypt } from './auth';
import { redirect } from 'next/navigation';
import { checkRateLimit, resetRateLimit } from './rate-limiter';

// Client device label derived from the User-Agent (coarse, no parsing lib needed)
function getDeviceName(userAgent: string): string | undefined {
    if (!userAgent) return undefined;
    const ua = userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|tablet/i.test(ua)) return 'Mobile/Tablet';
    if (/windows/i.test(ua)) return 'Windows';
    if (/macintosh|mac os/i.test(ua)) return 'macOS';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Other';
}

// Captures client metadata (IP + user agent) from request headers for session monitoring
async function getRequestMetadata(): Promise<{ ipAddress?: string; userAgent?: string }> {
    try {
        const requestHeaders = await headers();
        const ipAddress = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
            || requestHeaders.get('x-real-ip')?.trim()
            || undefined;
        const userAgent = requestHeaders.get('user-agent')?.trim() || undefined;
        return { ipAddress, userAgent };
    } catch (e) {
        return {};
    }
}

async function isSecureRequest() {
    const requestHeaders = await headers();
    const forwardedProto = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
    if (forwardedProto) {
        return forwardedProto === 'https';
    }

    const referer = requestHeaders.get('referer') || '';
    if (referer.startsWith('https://')) {
        return true;
    }

    const origin = requestHeaders.get('origin') || '';
    if (origin.startsWith('https://')) {
        return true;
    }

    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '';
    const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(\:\d+)?$/.test(host) || host.endsWith('.local');
    if (isLocalHost) {
        return false;
    }

    // Default to secure only when we are reasonably sure the request is HTTPS.
    return false;
}

export async function loginAction(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { success: false, message: 'Email and password are required.' };
    }

    // Rate limit by email to prevent brute force
    const rateLimitKey = `staff_login:${email.toLowerCase()}`;
    const { allowed, retryAfterSeconds } = checkRateLimit(rateLimitKey);
    if (!allowed) {
        return {
            success: false,
            message: `Too many login attempts. Please try again in ${Math.ceil((retryAfterSeconds ?? 900) / 60)} minutes.`
        };
    }

    // Capture client metadata before any branching (IP + UA for session monitoring / security events)
    const { ipAddress, userAgent } = await getRequestMetadata();

    const user = await getStaffMemberForAuth(email, password);

    if (!user) {
        // Security event: failed login. Volume is bounded by the rate limiter above.
        try {
            const { dbLogSecurityEvent } = await import('./db-queries');
            await dbLogSecurityEvent('Staff Login Failed', email, undefined, ipAddress, 'warning', {
                reason: 'Invalid email or password',
            });
        } catch (logError) {
            console.warn('Failed to log staff login failure:', logError);
        }
        return { success: false, message: 'Invalid email or password.' };
    }

    // Successful login — clear the rate limit counter
    resetRateLimit(rateLimitKey);

    // Create a staff_sessions row for login monitoring (login time, duration, pages viewed)
    let staffSessionId: string | undefined;
    let staffBranchName: string | undefined;
    try {
        const { dbCreateStaffSession } = await import('./db-queries');
        const created = await dbCreateStaffSession({
            staff_id: user.id,
            staff_email: user.email,
            role_name: user.role_name,
            branch_id: user.branch_id,
            ip_address: ipAddress,
            user_agent: userAgent,
            device_name: getDeviceName(userAgent || ''),
        });
        staffSessionId = created?.id;
        staffBranchName = created?.branch_name ?? undefined;
    } catch (sessionError) {
        // Session row creation must never block login — log and continue without monitoring
        console.error('Failed to create staff session row:', sessionError);
    }

        // Create the session — session duration can be configured in session settings
        let sessionDurationSeconds = 7200;
        try {
            const { dbGetSessionSettings } = await import('./db-queries');
            const settings = await dbGetSessionSettings();
            if (settings && settings.session_duration_seconds) {
                const s = Number(settings.session_duration_seconds);
                if (!isNaN(s) && s > 0) sessionDurationSeconds = s;
            } else if (settings && settings.session_duration_hours) {
                const h = Number(settings.session_duration_hours);
                if (!isNaN(h) && h > 0) sessionDurationSeconds = h * 3600;
            }
        } catch (_e) {
            // ignore and fall back to default
        }

        const expires = new Date(Date.now() + sessionDurationSeconds * 1000);
    const isAdmin = user.role_name?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'admin';
    const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role_name || user.role,
        branchId: user.branch_id,
        permissions: isAdmin ? ['*'] : (user.permissions || []),
        expires,
        sessionId: staffSessionId,
    };

    const session = await encrypt(sessionUser);

    const isSecure = await isSecureRequest();

    // Save the session in a cookie
    // path:'/' ensures the cookie is sent on every request (not just the current path).
    // sameSite:'lax' allows the cookie to be sent when navigating from external links
    // while still providing CSRF protection. This is required for server-IP deployments.
    (await cookies()).set('session', session, {
        expires,
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
    });
    // Cache the encrypted session token for offline use (dynamic import: IndexedDB is browser-only)
    try {
      const { saveSessionToken } = await import('./offline-db');
      await saveSessionToken(session);
    } catch (e) {
      // Running on the server — IndexedDB not available, skip silently
    }

    // Security event: successful login
    try {
      const { dbLogSecurityEvent } = await import('./db-queries');
      await dbLogSecurityEvent('Staff Login Success', user.email, staffBranchName, ipAddress, 'info', {
        sessionId: staffSessionId,
        device_name: getDeviceName(userAgent || ''),
      });
    } catch (logError) {
      console.warn('Failed to log staff login success:', logError);
    }

    return { success: true, user: sessionUser };
}

export async function logoutAction() {
    // Read the session id from the cookie (decodeJwt — no verify, so it also works
    // if the token is already expired at logout time) to finalize the staff session row.
    let payload: any = null;
    try {
        const cookieValue = (await cookies()).get('session')?.value;
        if (cookieValue) {
            payload = decodeJwt(cookieValue);
        }
    } catch (e) {
        // No session cookie or unreadable token — nothing to finalize
    }

    if (payload?.sessionId) {
        try {
            const { dbFinalizeStaffSession, dbLogSecurityEvent } = await import('./db-queries');
            await dbFinalizeStaffSession(payload.sessionId, 'logout');
            await dbLogSecurityEvent('Staff Logout', payload.email || undefined, undefined, undefined, 'info', {
                sessionId: payload.sessionId,
            });
        } catch (e) {
            console.warn('Failed to finalize staff session on logout:', e);
        }
    }

    // Destroy the session on server
    // path:'/' must match the path used when setting the cookie, otherwise the
    // browser will not delete it and the user will appear still logged in.
    (await cookies()).set('session', '', { expires: new Date(0), path: '/', httpOnly: true, sameSite: 'lax' });
    // Note: we intentionally do NOT call redirect() here.
    // Calling redirect() inside a server action that is invoked from a client component
    // causes Next.js to throw a NEXT_REDIRECT which, when offline, results in a
    // "TypeError: Failed to fetch" on the client. The client (app-shell.tsx)
    // is responsible for calling router.push('/') after this action resolves.
    return { success: true };
}
