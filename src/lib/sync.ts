import { db, getPendingReadings, markAsSyncing, markAsFailed, removeSyncedReading, queueOfflineReading, getPendingUploads, markUploadFailed, removeUpload, getDecryptedDeviceToken } from './offline-db';

/**
 * Send a single reading to the server.
 * Adjust the endpoint as needed for your backend.
 */
async function sendReading(reading: { id?: number; payload: any }) {
  try {
    const response = await fetch('/api/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reading.payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (reading.id !== undefined) {
      await removeSyncedReading(reading.id);
    }
    return true;
  } catch (e) {
    if (reading.id !== undefined) { await markAsFailed(reading.id, (e as Error).message); }
    return false;
  }
}

/**
 * Send a single upload (file) to the server.
 */
async function sendUpload(upload: { id?: number; blob?: Blob }) {
  try {
    if (!upload.blob) { return false; }
    const token = await (await import('./offline-db')).getDecryptedDeviceToken();
    const form = new FormData();
    form.append('file', upload.blob);
    const response = await fetch('/api/uploads', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (upload.id !== undefined) {
      await removeUpload(upload.id);
    }
    return true;
  } catch (e) {
    if (upload.id !== undefined) { await markUploadFailed(upload.id, (e as Error).message); }
    return false;
  }

}

/**
 * Process all pending reads and uploads.
 * Called when the client comes online or when a background sync fires.
 */
export async function syncPending() {
  // Process readings
  const pendingReadings = await getPendingReadings();
  for (const r of pendingReadings) {
    if (r.id !== undefined && r.id !== null) {
      await markAsSyncing(r.id);
    }
    await sendReading(r);
  }

  // Process uploads
  const pendingUploads = await getPendingUploads();
  for (const u of pendingUploads) {
    await sendUpload(u);
  }
}

// Optional: expose a way to manually trigger from UI
if (typeof window !== 'undefined') {
  (window as any).syncPending = syncPending;
  window.addEventListener('online', () => {
    syncPending().catch(console.error);
  });
}
