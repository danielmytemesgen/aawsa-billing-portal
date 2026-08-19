import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Nightly sweep for the session-monitoring feature (see docs/USER_SESSION_MONITORING_PLAN.md).
// Closes staff sessions that have been idle longer than the configured session
// duration (default 7200s = 2h, matching the hardcoded JWT ceiling). Customer
// sessions are deliberately NOT swept — they have no expiry policy today.
//
// Run nightly via cron/systemd, e.g.:
//   0 3 * * * cd /path/to/app && npm run session-sweep >> logs/session-sweep.log 2>&1

async function main() {
    const { dbSweepExpiredStaffSessions, dbGetSessionSettings } = await import('../lib/db-queries');

    let durationSeconds = 7200; // fallback: 2h JWT ceiling
    try {
        const settings = await dbGetSessionSettings();
        const configured = Number(settings?.session_duration_seconds);
        if (configured > 0 && Number.isFinite(configured)) {
            durationSeconds = configured;
        }
    } catch (e) {
        console.warn('Failed to read session settings, defaulting to 7200s:', e instanceof Error ? e.message : e);
    }

    const closed = await dbSweepExpiredStaffSessions(durationSeconds);
    const hours = Math.round((durationSeconds / 3600) * 10) / 10;
    console.log(`Session sweep: closed ${closed} expired staff session(s) idle > ${hours}h (${new Date().toISOString()})`);
    process.exit(0);
}

main().catch((err) => {
    console.error('Session sweep failed:', err);
    process.exit(1);
});
