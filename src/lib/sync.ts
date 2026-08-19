import { 
  db, 
  getPendingReadings, 
  markAsSyncing, 
  markAsFailed, 
  removeSyncedReading, 
  getPendingUploads, 
  markUploadFailed, 
  removeUpload, 
  getDecryptedDeviceToken,
  getSessionToken,
  base64ToBlob,
  checkActualConnectivity,
  UploadEntry
} from './offline-db';
import { uploadReadingPhotoAction } from './actions';

let isSyncInProgress = false;

/**
 * Send a batch of readings to the server via /api/offline-sync.
 */
async function sendReadingsBatch(readings: any[]): Promise<{ successCount: number; failedCount: number }> {
  if (readings.length === 0) return { successCount: 0, failedCount: 0 };

  for (const r of readings) {
    if (r.id !== undefined && r.id !== null) {
      await markAsSyncing(r.id);
    }
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const sessionToken = await getSessionToken();
      const deviceToken = await getDecryptedDeviceToken();
      const activeToken = sessionToken || deviceToken;
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }
    } catch {
      // Ignore token retrieval errors
    }

    const response = await fetch('/api/offline-sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ readings }),
    });


    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.results || [];
    let successCount = 0;
    let failedCount = 0;

    for (const res of results) {
      const matchLocalId = res.localId;
      const matchServerId = res.serverId;
      
      const readingRecord = readings.find(r => r.localId === matchLocalId || r.id === matchLocalId || r.id === res.id);
      const targetId = readingRecord?.id;

      if (res.success && targetId) {
        // Link server ID to any pending photo uploads with this local ID
        if (matchLocalId && matchServerId) {
          const pendingUpload = await db.uploads.where('readingLocalId').equals(String(matchLocalId)).first();
          if (pendingUpload && pendingUpload.id) {
            await db.uploads.update(pendingUpload.id, { readingId: matchServerId });
          }
        }

        await removeSyncedReading(targetId);
        successCount++;
      } else if (targetId) {
        await markAsFailed(targetId, res.message || 'Sync rejected by server');
        failedCount++;
      }
    }

    return { successCount, failedCount };
  } catch (e: any) {
    console.error('sendReadingsBatch failed:', e);
    for (const r of readings) {
      if (r.id !== undefined && r.id !== null) {
        await markAsFailed(r.id, e.message || 'Network error');
      }
    }
    return { successCount: 0, failedCount: readings.length };
  }
}

/**
 * Send a single upload (file/photo) to the server.
 */
async function sendUpload(upload: UploadEntry): Promise<boolean> {
  if (!upload.id) return false;

  try {
    // If linked to a readingId, use uploadReadingPhotoAction
    if (upload.readingId && (upload.photoData || upload.blob)) {
      let photoDataString = upload.photoData;
      if (!photoDataString && upload.blob) {
        photoDataString = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(upload.blob!);
        });
      }

      if (photoDataString) {
        const result = await uploadReadingPhotoAction(String(upload.readingId), photoDataString);
        if (result && !result.error) {
          await removeUpload(upload.id);
          return true;
        } else {
          const errorMsg = result?.error?.message || 'Photo upload failed';
          await markUploadFailed(upload.id, errorMsg);
          return false;
        }
      }
    }

    // Fallback: multipart FormData upload
    let fileBlob: Blob | undefined = upload.blob;
    if (!fileBlob && upload.photoData) {
      fileBlob = base64ToBlob(upload.photoData);
    }

    if (!fileBlob) {
      await markUploadFailed(upload.id, 'No photo data found in entry');
      return false;
    }

    const token = await getDecryptedDeviceToken();
    const form = new FormData();
    form.append('file', fileBlob, upload.filename || 'meter_reading.webp');
    if (upload.readingId) {
      form.append('readingId', String(upload.readingId));
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await removeUpload(upload.id);
    return true;
  } catch (e: any) {
    if (upload.id !== undefined) {
      await markUploadFailed(upload.id, e.message || 'Upload error');
    }
    return false;
  }
}

/**
 * Process all pending reads and uploads.
 * Called when the client comes online or when a background sync fires.
 */
export async function syncPending() {
  if (isSyncInProgress) return;
  const isOnline = await checkActualConnectivity();
  if (!isOnline) return;

  isSyncInProgress = true;
  try {
    // 1. Process pending readings in batch
    const pendingReadings = await getPendingReadings();
    if (pendingReadings.length > 0) {
      await sendReadingsBatch(pendingReadings);
    }

    // 2. Process pending uploads
    const pendingUploads = await getPendingUploads();
    for (const u of pendingUploads) {
      // Only upload photos that already have a resolved readingId (or photo without reading)
      if (u.readingId || !u.readingLocalId) {
        await sendUpload(u);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('offline-queue-updated'));
    }
  } catch (e) {
    console.error('syncPending execution failed:', e);
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Registers background sync with Service Worker if supported by browser.
 */
export async function registerBackgroundSync() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && 'sync' in registration) {
        await (registration as any).sync.register('offline-readings-sync');
      }
    } catch {
      // Ignore if unsupported or permission denied
    }
  }
}

// Expose a way to manually trigger or hook into online/sync events
if (typeof window !== 'undefined') {
  (window as any).syncPending = syncPending;
  window.addEventListener('online', () => {
    syncPending().catch(console.error);
  });
}

