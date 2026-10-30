import { describe, it, expect } from 'vitest';
import { getEffectiveBranchId } from '../branch-permissions';
import { getRoutePermissionRule } from '../route-permissions';
import { PERMISSIONS } from '../constants/auth';

describe('GL Financial & Audit Report Permissions', () => {
  it('correctly maps route rules for /admin/reports/gl-audit and /staff/reports/gl-audit', () => {
    const ruleAdmin = getRoutePermissionRule('/admin/reports/gl-audit', []);
    const ruleStaff = getRoutePermissionRule('/staff/reports/gl-audit', []);

    expect(ruleAdmin).toBeDefined();
    expect(ruleStaff).toBeDefined();

    expect(ruleAdmin?.anyOf).toContain(PERMISSIONS.REPORT_GL_AUDIT_VIEW);
    expect(ruleAdmin?.anyOf).toContain(PERMISSIONS.REPORT_GL_AUDIT_VIEW_ALL);
    expect(ruleAdmin?.anyOf).toContain(PERMISSIONS.REPORT_GL_AUDIT_VIEW_BRANCH);
    expect(ruleAdmin?.anyOf).toContain('report:gl_audit_view');
    expect(ruleAdmin?.anyOf).toContain('report:gl_audit_view_all');
    expect(ruleAdmin?.anyOf).toContain('report:gl_audit_view_branch');
  });

  it('determines effective branch scope using gl_audit domain', () => {
    // User with view all branches permission: returns undefined (all branches)
    const hasViewAll = (p: string) => p === PERMISSIONS.REPORT_GL_AUDIT_VIEW_ALL;
    expect(getEffectiveBranchId(hasViewAll, 'gl_audit', 'branch-123')).toBeUndefined();

    // User with branch-scoped permission: returns their assigned branch
    const hasViewBranch = (p: string) => p === PERMISSIONS.REPORT_GL_AUDIT_VIEW_BRANCH;
    expect(getEffectiveBranchId(hasViewBranch, 'gl_audit', 'branch-123')).toBe('branch-123');

    // User without assigned branch gets sentinel UUID to prevent cross-branch leaks
    expect(getEffectiveBranchId(hasViewBranch, 'gl_audit', null)).toBe('00000000-0000-0000-0000-000000000000');
  });
});

