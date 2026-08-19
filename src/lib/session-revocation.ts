// Node-runtime staff-session revocation check, used by getSession() so every
// server action and /api route rejects sessions that an admin has kicked out.
//
// NOTE: this module imports db-queries -> db -> pg, so it MUST NOT be imported
// from middleware/proxy (Edge runtime). Middleware uses its own fetch-based
// check against /api/session/revocation-status instead.

// sessionId -> timestamp (ms) of the last DB lookup. A 60s TTL keeps kick-out
// latency to <60s while avoiding a DB hit on every request.
const CACHE_TTL_MS = 60_000;
const revocationCache = new Map<string, number>();

export async function isStaffSessionRevoked(sessionId: string): Promise<boolean> {
    const now = Date.now();
    const lastChecked = revocationCache.get(sessionId);

    // Re-query when the cached answer is older than the TTL. Sessions are
    // looked up again within 60s of a kick-out, and cache entries are dropped
    // once their answer is stale — no unbounded growth for finished sessions.
    if (lastChecked !== undefined && now - lastChecked < CACHE_TTL_MS) {
        return false;
    }

    try {
        const { dbIsStaffSessionActive } = await import('./db-queries');
        const active = await dbIsStaffSessionActive(sessionId);
        // Only cache "active" results. If the session is revoked we must NOT
        // cache it, so the user gets logged out on their very next request.
        if (active) {
            revocationCache.set(sessionId, now);
        } else {
            revocationCache.delete(sessionId);
        }
        return !active;
    } catch (e) {
        // Fail-open: if the DB is unreachable, don't lock out legitimate users.
        console.warn('Failed to check staff session revocation:', e instanceof Error ? e.message : e);
        return false;
    }
}
