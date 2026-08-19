import { describe, it, expect } from 'vitest';
import {
    deriveSessionStatus,
    formatDuration,
    pageViewLabel,
    pageViewPath,
    pageViewTime,
    buildUserSessionsFilters,
} from '@/lib/session-monitoring';

describe('deriveSessionStatus', () => {
    it('is active when nothing ended the session', () => {
        expect(deriveSessionStatus({})).toBe('active');
        expect(deriveSessionStatus({ logout_time: null, is_revoked: false, user_type: 'staff' })).toBe('active');
    });

    it('falls back to logged_out when ended without a reason (legacy rows)', () => {
        expect(deriveSessionStatus({ logout_time: '2026-08-14T10:00:00Z' })).toBe('logged_out');
    });

    it('returns the explicit end reason when set', () => {
        expect(deriveSessionStatus({ logout_time: 'x', session_end_reason: 'logout' })).toBe('logout');
        expect(deriveSessionStatus({ logout_time: 'x', session_end_reason: 'expired' })).toBe('expired');
        expect(deriveSessionStatus({ logout_time: 'x', session_end_reason: 'revoked' })).toBe('revoked');
        expect(deriveSessionStatus({ logout_time: 'x', session_end_reason: 'idle_timeout' })).toBe('idle_timeout');
    });

    it('treats a revoked customer without an end reason as revoked (pre-migration rows)', () => {
        expect(deriveSessionStatus({ user_type: 'customer', is_revoked: true, logout_time: null })).toBe('revoked');
    });

    it('does not treat a staff row as revoked via is_revoked', () => {
        expect(deriveSessionStatus({ user_type: 'staff', is_revoked: true, logout_time: null })).toBe('active');
    });
});

describe('formatDuration', () => {
    it('renders a dash for missing or invalid values', () => {
        expect(formatDuration(null)).toBe('—');
        expect(formatDuration(undefined)).toBe('—');
        expect(formatDuration(Number.NaN)).toBe('—');
    });

    it('formats seconds, minutes and hours', () => {
        expect(formatDuration(0)).toBe('0s');
        expect(formatDuration(45)).toBe('45s');
        expect(formatDuration(90)).toBe('1m 30s');
        expect(formatDuration(3600)).toBe('1h 0m');
        expect(formatDuration(5000)).toBe('1h 23m');
    });

    it('clamps negative values and floors fractions', () => {
        expect(formatDuration(-10)).toBe('0s');
        expect(formatDuration(1.9)).toBe('1s');
    });
});

describe('page view entry helpers', () => {
    it('passes through legacy string entries', () => {
        expect(pageViewLabel('Dashboard')).toBe('Dashboard');
        expect(pageViewPath('Dashboard')).toBeNull();
        expect(pageViewTime('Dashboard')).toBeNull();
    });

    it('extracts label, path and viewed_at from timestamped entries', () => {
        const entry = { path: '/admin/dashboard', label: 'Dashboard', viewed_at: '2026-08-14T10:00:00Z' };
        expect(pageViewLabel(entry)).toBe('Dashboard');
        expect(pageViewPath(entry)).toBe('/admin/dashboard');
        expect(pageViewTime(entry)).toBe('2026-08-14T10:00:00Z');
    });

    it('falls back to path when label is missing, and to a placeholder when both are', () => {
        expect(pageViewLabel({ path: '/admin/bills' })).toBe('/admin/bills');
        expect(pageViewLabel({})).toBe('Unknown page');
    });
});

describe('buildUserSessionsFilters', () => {
    it('returns an empty WHERE clause with no options', () => {
        const { whereSql, params } = buildUserSessionsFilters();
        expect(whereSql).toBe('');
        expect(params).toEqual([]);
    });

    it('filters by type', () => {
        const { whereSql, params } = buildUserSessionsFilters({ type: 'customer' });
        expect(whereSql).toContain('s.user_type = $1');
        expect(params).toEqual(['customer']);
    });

    it('filters by derived status using the CASE expression', () => {
        const { whereSql, params } = buildUserSessionsFilters({ status: 'revoked' });
        expect(whereSql).toContain("WHEN s.logout_time IS NOT NULL THEN COALESCE(s.session_end_reason, 'logged_out')");
        expect(whereSql).toContain("WHEN s.user_type = 'customer' AND s.is_revoked THEN 'revoked'");
        expect(whereSql).toMatch(/\= \$1$/);
        expect(params).toEqual(['revoked']);
    });

    it('supports exact branch isolation and ILIKE branch search', () => {
        const exact = buildUserSessionsFilters({ branchName: 'headoffice' });
        expect(exact.whereSql).toContain('s.branch_name = $1');
        expect(exact.params).toEqual(['headoffice']);

        const fuzzy = buildUserSessionsFilters({ branch: 'meg' });
        expect(fuzzy.whereSql).toContain('s.branch_name ILIKE $1');
        expect(fuzzy.params).toEqual(['%meg%']);
    });

    it('searches the user identifier with wildcards', () => {
        const { whereSql, params } = buildUserSessionsFilters({ search: 'admin@' });
        expect(whereSql).toContain('s.user_identifier ILIKE $1');
        expect(params).toEqual(['%admin@%']);
    });

    it('numbers placeholders correctly when multiple filters combine', () => {
        const { whereSql, params } = buildUserSessionsFilters({
            type: 'staff',
            status: 'active',
            branch: 'addis',
            search: 'a@b.com',
        });
        expect(params).toEqual(['staff', 'active', '%addis%', '%a@b.com%']);
        expect(whereSql).toContain('$1');
        expect(whereSql).toContain('$2');
        expect(whereSql).toContain('$3');
        expect(whereSql).toContain('$4');
    });
});
