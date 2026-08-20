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

  const roleLower = (currentUser?.role || '').toLowerCase().trim();
  const permissions = new Set(currentUser?.permissions || []);

  /**
   * Robust check for management/admin-area access.
   * Based purely on specific high-level permission.
   */
  const isManagement = permissions.has(PERMISSIONS.DASHBOARD_VIEW_ALL);

  const isReader = !isManagement && isReaderStaff(currentUser);

  return {
    currentUser,
    isStaff: !isManagement, // Basic distinction if requested, but routes drive access
    isReader,
    isStaffManagement: permissions.has(PERMISSIONS.STAFF_VIEW_ALL) || roleLower.includes('management') || roleLower.includes('manager'),
    isManagement,
    isAdminAreaUser: isManagement,
    branchId: currentUser?.branchId,
    branchName: currentUser?.branchName,
  } as const;
}

