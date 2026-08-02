import * as React from 'react';
import { PERMISSIONS } from '@/lib/constants/auth';
import { getBranches, initializeBranches, getStaffMembers, initializeStaffMembers } from '@/lib/data-store';

export interface CurrentUser {
  id?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  branchName?: string;
  branchId?: string;
  branch?: string;
  name?: string;
}

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = React.useState<CurrentUser | null>(null);

  React.useEffect(() => {
    const readUser = async () => {
      const stored = localStorage.getItem('user');
      if (!stored) return setCurrentUser(null);
      try {
        let user: CurrentUser = JSON.parse(stored);

        // If branchName or branchId is missing, resolve asynchronously
        if ((!user.branchName || !user.branchId) && user.email) {
          try {
            await Promise.all([initializeBranches(), initializeStaffMembers()]);
            const staff = getStaffMembers().find(s => s.email.toLowerCase() === user.email?.toLowerCase());
            const branches = getBranches();

            let bName = user.branchName || user.branch || staff?.branchName;
            let bId = user.branchId || staff?.branchId;

            if (bName && !bId) {
              const b = branches.find(br => br.name.trim().toLowerCase() === bName?.trim().toLowerCase());
              if (b) bId = b.id;
            }
            if (bId && !bName) {
              const b = branches.find(br => br.id === bId);
              if (b) bName = b.name;
            }

            if (bName || bId) {
              user = { ...user, branchName: bName, branchId: bId };
              localStorage.setItem('user', JSON.stringify(user));
            }
          } catch (e) {
            console.warn('Failed to resolve missing user branch info', e);
          }
        }

        setCurrentUser(user);
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
    branchName: currentUser?.branchName || currentUser?.branch,
  } as const;
}
