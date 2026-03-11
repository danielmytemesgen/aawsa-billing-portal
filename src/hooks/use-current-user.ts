import * as React from 'react';
import { ROLES, PERMISSIONS, isManagementRole } from '@/lib/constants/auth';

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
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const roleLower = (currentUser?.role || '').toLowerCase().trim();
  const permissions = new Set(currentUser?.permissions || []);

  /**
   * Robust check for management/admin-area access.
   * Priority 1: Specific high-level permission.
   * Priority 2: Identified management role name.
   */
  const isManagement =
    permissions.has(PERMISSIONS.DASHBOARD_VIEW_ALL) ||
    isManagementRole(roleLower);

  return {
    currentUser,
    isStaff: roleLower === ROLES.STAFF || roleLower === ROLES.READER || (!isManagement && roleLower !== ''),
    isReader: roleLower === ROLES.READER,
    isStaffManagement: roleLower === ROLES.STAFF_MANAGEMENT,
    isManagement,
    isAdminAreaUser: isManagement,
    branchId: currentUser?.branchId,
    branchName: currentUser?.branchName,
  } as const;
}
