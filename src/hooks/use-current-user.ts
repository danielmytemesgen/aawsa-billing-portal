import * as React from 'react';
import { PERMISSIONS } from '@/lib/constants/auth';
import { isReaderStaff } from '@/lib/meter-reading-permissions';

export interface CurrentUser {
  id?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  branchName?: string;
  branchId?: string;
  name?: string;
}

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = React.useState<CurrentUser | null>(null);

  React.useEffect(() => {
    const readUser = () => {
      const stored = localStorage.getItem('user');
      if (!stored) return setCurrentUser(null);
      try {
        setCurrentUser(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
        setCurrentUser(null);
      }
    };

    readUser();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'user') readUser();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('user-permissions-updated', readUser);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('user-permissions-updated', readUser);
    };
  }, []);

  const permissions = new Set(currentUser?.permissions || []);
  const isWildcard = permissions.has('*') || permissions.has('all');

  /**
   * Pure permission-driven evaluation.
   */
  const isManagement = isWildcard || permissions.has(PERMISSIONS.DASHBOARD_VIEW_ALL);
  const isStaffManagement = isWildcard || permissions.has(PERMISSIONS.STAFF_VIEW_ALL) || permissions.has(PERMISSIONS.STAFF_VIEW);
  const isReader = !isManagement && (permissions.has(PERMISSIONS.ROUTES_VIEW_ASSIGNED) || permissions.has(PERMISSIONS.METER_READINGS_CREATE));

  return {
    currentUser,
    isStaff: !isManagement,
    isReader,
    isStaffManagement,
    isManagement,
    isAdminAreaUser: isManagement,
    branchId: currentUser?.branchId,
    branchName: currentUser?.branchName,
    hasPermission: (p: string) => isWildcard || permissions.has(p),
    hasAnyPermission: (...pList: string[]) => isWildcard || pList.some(p => permissions.has(p)),
  } as const;
}

