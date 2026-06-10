'use server';

import { cookies, headers } from 'next/headers';
import { getStaffMemberForAuth } from './db-queries';
import { encrypt } from './auth';
import { redirect } from 'next/navigation';
import { checkRateLimit, resetRateLimit } from './rate-limiter';

function isSecureRequest() {
    const requestHeaders = headers();
    const forwardedProto = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim();
    if (forwardedProto) {
        return forwardedProto === 'https';
    }

    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '';
    const configuredUrl = process.env.NEXTAUTH_URL || '';
    return configuredUrl.startsWith('https://') && !host.startsWith('localhost') && !host.startsWith('127.0.0.1');
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

    // Create the session
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
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

    const isSecure = isSecureRequest();

    // Save the session in a cookie
    (await cookies()).set('session', session, { expires, httpOnly: true, secure: isSecure });
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
    (await cookies()).set('session', '', { expires: new Date(0) });
    // Note: we intentionally do NOT call redirect() here.
    // Calling redirect() inside a server action that is invoked from a client component
    // causes Next.js to throw a NEXT_REDIRECT which, when offline, results in a
    // "TypeError: Failed to fetch" on the client. The client (app-shell.tsx)
    // is responsible for calling router.push('/') after this action resolves.
    return { success: true };
}
