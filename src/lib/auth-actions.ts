'use server';

import { cookies, headers } from 'next/headers';
import { getStaffMemberForAuth } from './db-queries';
import { encrypt } from './auth';
import { redirect } from 'next/navigation';
import { checkRateLimit, resetRateLimit } from './rate-limiter';

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

    const user = await getStaffMemberForAuth(email, password);

    if (!user) {
        return { success: false, message: 'Invalid email or password.' };
    }

    // Successful login — clear the rate limit counter
    resetRateLimit(rateLimitKey);

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
    const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role_name,
        branchId: user.branch_id,
        permissions: user.permissions || [],
        expires,
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

    return { success: true, user: sessionUser };
}

export async function logoutAction() {
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
