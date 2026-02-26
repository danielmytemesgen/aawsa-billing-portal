"use client";

import * as React from 'react';

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

  const roleLower = (currentUser?.role || '').toLowerCase();

  return {
    currentUser,
    isStaff: roleLower === 'staff',
    isStaffManagement: roleLower === 'staff management',
    branchId: currentUser?.branchId,
    branchName: currentUser?.branchName,
  } as const;
}
