import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { encrypt, decrypt } from "./session";
import { isSecureRequest } from "./request-security";
export { encrypt, decrypt };

export async function getSession() {
  // Try cookie first (online)
  const sessionCookie = (await cookies()).get("session")?.value;
  if (sessionCookie) {
    try {
      return await decrypt(sessionCookie);
    } catch (e) {
      console.warn('Failed to decrypt online session cookie:', e instanceof Error ? e.message : e);
      return null;
    }
  }
  // Offline fallback: retrieve encrypted token from IndexedDB
  const { getSessionToken } = await import("./offline-db");
  const cachedToken = await getSessionToken();
  if (!cachedToken) return null;
  try {
    return await decrypt(cachedToken);
  } catch (e) {
    console.error('Failed to decrypt offline session token', e);
    return null;
  }
}

export async function updateSession(request: NextRequest) {
    const session = request.cookies.get("session")?.value;
    if (!session) return;

    try {
        // Refresh the session so it doesn't expire
        const parsed = await decrypt(session);
        parsed.expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
        const isSecure = isSecureRequest(request.headers);
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

