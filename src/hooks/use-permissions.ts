
import { createContext, useContext } from 'react';
import { type Permission } from '@/lib/constants/auth';

export type PermissionCheck = Permission | (string & {});

export interface PermissionsContextType {
  permissions: Set<string>;
  hasPermission: (permission: PermissionCheck) => boolean;
  hasAnyPermission: (...permissions: PermissionCheck[]) => boolean;
  hasAllPermissions: (...permissions: PermissionCheck[]) => boolean;
  refreshPermissions: () => Promise<void>;
}

export const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[usePermissions] Called outside PermissionsContext.Provider — all checks will evaluate to false');
    }
    // Return safe default helpers instead of throwing during build/SSR if context is missing
    return {
      permissions: new Set<string>(),
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
      refreshPermissions: async () => { }
    };
  }
  return context;
}

