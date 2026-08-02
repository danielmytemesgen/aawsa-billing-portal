import * as React from 'react';
import { PERMISSIONS } from '@/lib/constants/auth';

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
   * Based purely on specific high-level permission.
   */
  const isManagement = permissions.has(PERMISSIONS.DASHBOARD_VIEW_ALL);

  return {
    currentUser,
    isStaff: !isManagement, // Basic distinction if requested, but routes drive access
    isReader: permissions.has(PERMISSIONS.DATA_ENTRY_ACCESS) && !isManagement,
    isStaffManagement: permissions.has(PERMISSIONS.STAFF_VIEW_ALL),
    isManagement,
    isAdminAreaUser: isManagement,
    branchId: currentUser?.branchId,
    branchName: currentUser?.branchName,
  } as const;
}
