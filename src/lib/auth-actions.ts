'use server';

import { cookies } from 'next/headers';
import { getStaffMemberForAuth } from './db-queries';
import { encrypt } from './auth';
import { redirect } from 'next/navigation';

export async function loginAction(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { success: false, message: 'Email and password are required.' };
    }

    const user = await getStaffMemberForAuth(email, password);

    if (!user) {
        return { success: false, message: 'Invalid email or password.' };
    }

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

    // Save the session in a cookie
    (await cookies()).set('session', session, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    return { success: true, user: sessionUser };
}

export async function logoutAction() {
    // Destroy the session
    (await cookies()).set('session', '', { expires: new Date(0) });
    redirect('/');
}
