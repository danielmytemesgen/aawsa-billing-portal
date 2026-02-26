
import { createContext, useContext } from 'react';

export interface PermissionsContextType {
  permissions: Set<string>;
  hasPermission: (permission: string) => boolean;
}

export const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
