
import { createContext, useContext } from 'react';

export interface PermissionsContextType {
  permissions: Set<string>;
  hasPermission: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

export const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    // Return empty permissions instead of throwing during build/SSR if context is missing
    return {
      permissions: new Set<string>(),
      hasPermission: () => false,
      refreshPermissions: async () => { }
    };
  }
  return context;
}
