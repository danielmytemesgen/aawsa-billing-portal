// Pure, dependency-free helpers shared by the session-monitoring UI, query layer
// and unit tests. Kept side-effect free so the logic is testable in isolation.

import type { PageViewEntry } from '@/types/db';

// ---------------------------------------------------------------------------
// Session status derivation
// Mirrors the SQL CASE in db-queries.ts (USER_SESSION_STATUS_SQL): a session is
// active until ended; customers revoked without an end reason still count as
// revoked (pre-migration rows).
// ---------------------------------------------------------------------------

export interface SessionStatusRow {
    logout_time?: string | Date | null;
    session_end_reason?: string | null;
    user_type?: string;
    is_revoked?: boolean | null;
}

export function deriveSessionStatus(row: SessionStatusRow): string {
    if (row.logout_time) return row.session_end_reason || 'logged_out';
    if (row.user_type === 'customer' && row.is_revoked) return 'revoked';
    return 'active';
}

// ---------------------------------------------------------------------------
// Duration formatting (e.g. "1h 23m", "45s", "—")
// ---------------------------------------------------------------------------

export function formatDuration(seconds: number | null | undefined): string {
    if (seconds == null || Number.isNaN(Number(seconds))) return '—';
    const s = Math.max(0, Math.floor(Number(seconds)));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}

// ---------------------------------------------------------------------------
// Page-view entry helpers (legacy text[] name strings vs timestamped jsonb)
// ---------------------------------------------------------------------------

export function pageViewLabel(page: PageViewEntry): string {
    if (typeof page === 'string') return page;
    return page?.label || page?.path || 'Unknown page';
}

export function pageViewPath(page: PageViewEntry): string | null {
    if (typeof page === 'object' && page?.path) return page.path;
    return null;
}

export function pageViewTime(page: PageViewEntry): string | null {
    if (typeof page === 'object' && page?.viewed_at) return page.viewed_at;
    return null;
}

// ---------------------------------------------------------------------------
// UNION query filter builder (shared with dbGetUserSessions)
// ---------------------------------------------------------------------------

export interface UserSessionsFilterOptions {
    type?: 'staff' | 'customer';
    status?: string;
    branchName?: string; // exact match — branch isolation for non-management staff
    branch?: string;     // ILIKE — UI filter
    search?: string;     // ILIKE on user identifier
}

export const USER_SESSION_STATUS_SQL = `
    CASE
        WHEN s.logout_time IS NOT NULL THEN COALESCE(s.session_end_reason, 'logged_out')
        WHEN s.user_type = 'customer' AND s.is_revoked THEN 'revoked'
        ELSE 'active'
    END
`;

/**
 * Builds the WHERE clause + params for the unified sessions query.
 * Exported separately from the DB call so the filter semantics are unit-testable.
 */
export function buildUserSessionsFilters(options: UserSessionsFilterOptions = {}): {
    whereSql: string;
    params: any[];
} {
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (options.type) {
        whereClauses.push(`s.user_type = $${params.length + 1}`);
        params.push(options.type);
    }
    if (options.status) {
        whereClauses.push(`${USER_SESSION_STATUS_SQL} = $${params.length + 1}`);
        params.push(options.status);
    }
    if (options.branchName) {
        whereClauses.push(`s.branch_name = $${params.length + 1}`);
        params.push(options.branchName);
    }
    if (options.branch) {
        whereClauses.push(`s.branch_name ILIKE $${params.length + 1}`);
        params.push(`%${options.branch}%`);
    }
    if (options.search) {
        whereClauses.push(`s.user_identifier ILIKE $${params.length + 1}`);
        params.push(`%${options.search}%`);
    }

    return {
        whereSql: whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '',
        params,
    };
}
