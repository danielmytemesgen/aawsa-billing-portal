import { describe, it, expect } from 'vitest';
import { PERMISSIONS } from '@/lib/constants/auth';
import { buildSidebarNavItems, type UserProfile } from '@/lib/nav-builder';
import { getCanonicalCategory } from '@/lib/roles-permissions-utils';

describe('Call Center RBAC & Navigation Suite', () => {
  it('defines all required Call Center permission tokens', () => {
    expect(PERMISSIONS.CALLCENTER_ACCESS).toBe('callcenter:access');
    expect(PERMISSIONS.CALLCENTER_VIEW_ALL).toBe('callcenter:view_all');
    expect(PERMISSIONS.CALLCENTER_VIEW_BRANCH).toBe('callcenter:view_branch');
    expect(PERMISSIONS.CALLCENTER_LOG_CALL).toBe('callcenter:log_call');
    expect(PERMISSIONS.CALLCENTER_DISPATCH_SMS).toBe('callcenter:dispatch_sms');
    expect(PERMISSIONS.CALLCENTER_SUPERVISOR).toBe('callcenter:supervisor');
  });

  it('renders Call Center sidebar group for Call Center Operator user', () => {
    const user: UserProfile = {
      id: 'agent-1',
      email: 'agent@aawsa.gov.et',
      role: 'Call Center Operator',
      permissions: [PERMISSIONS.CALLCENTER_ACCESS, PERMISSIONS.CALLCENTER_LOG_CALL],
    };

    const navItems = buildSidebarNavItems(user);
    const callCenterGroup = navItems.find((g) => g.title === 'Call Center');

    expect(callCenterGroup).toBeDefined();
    expect(callCenterGroup?.iconName).toBe('Headphones');
    expect(callCenterGroup?.items).toHaveLength(2);
    expect(callCenterGroup?.items[0].title).toBe('Caller 360° Console');
    expect(callCenterGroup?.items[1].title).toBe('Call Logs & History');
  });

  it('hides Call Center sidebar group for user without call center permissions', () => {
    const user: UserProfile = {
      id: 'reader-1',
      email: 'reader@aawsa.gov.et',
      role: 'Reader',
      permissions: [PERMISSIONS.METER_READINGS_CREATE],
    };

    const navItems = buildSidebarNavItems(user);
    const callCenterGroup = navItems.find((g) => g.title === 'Call Center');

    expect(callCenterGroup).toBeUndefined();
  });

  it('renders admin Call Center routes for global manager user', () => {
    const adminUser: UserProfile = {
      id: 'admin-1',
      email: 'admin@aawsa.gov.et',
      role: 'Admin',
      permissions: [PERMISSIONS.DASHBOARD_VIEW_ALL, PERMISSIONS.CALLCENTER_VIEW_ALL],
    };

    const navItems = buildSidebarNavItems(adminUser);
    const callCenterGroup = navItems.find((g) => g.title === 'Call Center');

    expect(callCenterGroup).toBeDefined();
    expect(callCenterGroup?.items[0].href).toBe('/admin/call-center');
    expect(callCenterGroup?.items[1].href).toBe('/admin/call-center/logs');
  });

  it('maps callcenter permissions to canonical category', () => {
    expect(getCanonicalCategory(null, 'callcenter:access')).toBe('Customer Support & Help Desk');
    expect(getCanonicalCategory(null, 'callcenter:log_call')).toBe('Customer Support & Help Desk');
    expect(getCanonicalCategory(null, 'callcenter:supervisor')).toBe('Customer Support & Help Desk');
  });
});
