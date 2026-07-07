export const PERMISSION_SYNC_STORAGE_KEY = 'aawsa_permissions_sync';
export const PERMISSION_SYNC_CHANNEL = 'aawsa-permissions';

export type PermissionSyncMessage = {
  type: 'permissions-updated';
  timestamp: string;
};

export function broadcastPermissionsUpdated() {
  if (typeof window === 'undefined') return;

  const payload: PermissionSyncMessage = {
    type: 'permissions-updated',
    timestamp: new Date().toISOString(),
  };

  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(PERMISSION_SYNC_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    }
  } catch (error) {
    console.warn('Permission sync broadcast failed', error);
  }

  try {
    localStorage.setItem(PERMISSION_SYNC_STORAGE_KEY, payload.timestamp);
  } catch (error) {
    console.warn('Permission sync storage update failed', error);
  }
}

export function subscribePermissionsSync(onUpdate: () => void) {
  if (typeof window === 'undefined') return () => {};

  let channel: BroadcastChannel | null = null;

  if ('BroadcastChannel' in window) {
    try {
      channel = new BroadcastChannel(PERMISSION_SYNC_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data?.type === 'permissions-updated') {
          onUpdate();
        }
      };
    } catch (error) {
      console.warn('Permission sync channel initialization failed', error);
    }
  }

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === PERMISSION_SYNC_STORAGE_KEY) {
      onUpdate();
    }
  };

  window.addEventListener('storage', handleStorageEvent);

  return () => {
    if (channel) {
      channel.close();
    }
    window.removeEventListener('storage', handleStorageEvent);
  };
}
