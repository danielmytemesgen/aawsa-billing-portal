import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Automated Database Maintenance Sweep
// Prunes old transient logs, expired tokens, and stale metrics to prevent database bloat.
//
// Run periodically via cron or task scheduler, e.g.:
//   0 4 * * 0 cd /path/to/app && npm run logs-sweep >> logs/logs-sweep.log 2>&1

async function main() {
    const { query } = await import('../lib/db');

    console.log(`[Sweep] Starting database logs & metrics maintenance sweep (${new Date().toISOString()})...`);

    // 1. Prune offline_sync_metrics older than 30 days
    try {
        const rows = await query(
            `DELETE FROM offline_sync_metrics WHERE created_at < NOW() - INTERVAL '30 days' RETURNING id`
        );
        console.log(`[Sweep] Pruned ${rows.length} offline_sync_metrics older than 30 days.`);
    } catch (e: any) {
        console.warn('[Sweep] offline_sync_metrics cleanup skipped/failed:', e?.message || e);
    }

    // 2. Prune idempotency_keys older than 7 days
    try {
        const rows = await query(
            `DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '7 days' RETURNING id`
        );
        console.log(`[Sweep] Pruned ${rows.length} idempotency_keys older than 7 days.`);
    } catch (e: any) {
        console.warn('[Sweep] idempotency_keys cleanup skipped/failed:', e?.message || e);
    }

    // 3. Prune revoked device_tokens older than 60 days
    try {
        const rows = await query(
            `DELETE FROM device_tokens WHERE revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '60 days' RETURNING id`
        );
        console.log(`[Sweep] Pruned ${rows.length} revoked device_tokens older than 60 days.`);
    } catch (e: any) {
        console.warn('[Sweep] device_tokens cleanup skipped/failed:', e?.message || e);
    }

    // 4. Prune informational security_logs older than 60 days (retain warnings/critical for audit)
    try {
        const rows = await query(
            `DELETE FROM security_logs WHERE severity = 'info' AND created_at < NOW() - INTERVAL '60 days' RETURNING id`
        );
        console.log(`[Sweep] Pruned ${rows.length} informational security_logs older than 60 days.`);
    } catch (e: any) {
        console.warn('[Sweep] security_logs cleanup skipped/failed:', e?.message || e);
    }

    // 5. Prune revoked customer sessions older than 30 days
    try {
        const rows = await query(
            `DELETE FROM customer_sessions WHERE is_revoked = true AND (last_active_at < NOW() - INTERVAL '30 days' OR (last_active_at IS NULL AND created_at < NOW() - INTERVAL '30 days')) RETURNING id`
        );
        console.log(`[Sweep] Pruned ${rows.length} revoked customer sessions older than 30 days.`);
    } catch (e: any) {
        console.warn('[Sweep] customer_sessions cleanup skipped/failed:', e?.message || e);
    }

    // 6. Reset expired temporary staff role delegations
    try {
        const rows = await query(
            `UPDATE staff_members 
             SET temporary_role_id = NULL, temporary_role_expiry = NULL 
             WHERE temporary_role_expiry IS NOT NULL AND temporary_role_expiry < NOW() 
             RETURNING id`
        );
        console.log(`[Sweep] Cleared ${rows.length} expired temporary staff role delegations.`);
    } catch (e: any) {
        // Table columns might be absent in un-migrated setups; suppress gracefully
    }

    console.log(`[Sweep] Database logs & metrics maintenance completed successfully.`);
    process.exit(0);
}

main().catch((err) => {
    console.error('[Sweep] Database maintenance sweep failed with fatal error:', err);
    process.exit(1);
});
