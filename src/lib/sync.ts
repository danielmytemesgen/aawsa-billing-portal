import {
  db,
  getPendingReadings,
  markAsSyncing,
  markAsFailed,
  removeSyncedReading,
  getPendingUploads,
  markUploadFailed,
  removeUpload,
} from "./offline-db";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;
const FETCH_TIMEOUT_MS = 30000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dispatchSyncProgress(detail: {
  syncing: boolean;
  success: number;
  failed: number;
  total: number;
}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sync-progress", { detail }));
    window.dispatchEvent(new CustomEvent("offline-queue-updated"));
  }
}

/**
 * Send a single reading to the server with retries and backoff.
 */
async function sendReadingWithRetry(reading: { id?: number; payload: any }): Promise<boolean> {
  let attempt = 0;
  let lastError = "Unknown error";

  while (attempt < MAX_RETRIES) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reading.payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (reading.id !== undefined) {
        await removeSyncedReading(reading.id);
      }
      return true;
    } catch (e: any) {
      clearTimeout(timeoutId);
      lastError = e?.name === "AbortError" ? "Request timeout (slow network)" : e?.message || "Network request failed";

      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        await delay(backoff);
      }
    }
  }

  if (reading.id !== undefined) {
    await markAsFailed(reading.id, `Failed after ${MAX_RETRIES} attempts: ${lastError}`);
  }
  return false;
}

/**
 * Send a single upload (file) to the server with retries and backoff.
 */
async function sendUploadWithRetry(upload: { id?: number; blob?: Blob }): Promise<boolean> {
  if (!upload.blob) return false;
  let attempt = 0;
  let lastError = "Unknown error";

  while (attempt < MAX_RETRIES) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const token = await (await import("./offline-db")).getDecryptedDeviceToken();
      const form = new FormData();
      form.append("file", upload.blob);

      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (upload.id !== undefined) {
        await removeUpload(upload.id);
      }
      return true;
    } catch (e: any) {
      clearTimeout(timeoutId);
      lastError = e?.name === "AbortError" ? "Upload timeout (slow network)" : e?.message || "Upload request failed";

      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        await delay(backoff);
      }
    }
  }

  if (upload.id !== undefined) {
    await markUploadFailed(upload.id, `Failed after ${MAX_RETRIES} attempts: ${lastError}`);
  }
  return false;
}

/**
 * Process all pending readings and uploads with progress updates.
 */
export async function syncPending() {
  const pendingReadings = await getPendingReadings();
  const pendingUploads = await getPendingUploads();
  const total = pendingReadings.length + pendingUploads.length;

  if (total === 0) {
    dispatchSyncProgress({ syncing: false, success: 0, failed: 0, total: 0 });
    return;
  }

  let successCount = 0;
  let failedCount = 0;

  dispatchSyncProgress({ syncing: true, success: 0, failed: 0, total });

  // Process readings
  for (const r of pendingReadings) {
    if (r.id !== undefined && r.id !== null) {
      await markAsSyncing(r.id);
    }
    const ok = await sendReadingWithRetry(r);
    if (ok) {
      successCount++;
    } else {
      failedCount++;
    }
    dispatchSyncProgress({ syncing: true, success: successCount, failed: failedCount, total });
  }

  // Process uploads
  for (const u of pendingUploads) {
    const ok = await sendUploadWithRetry(u);
    if (ok) {
      successCount++;
    } else {
      failedCount++;
    }
    dispatchSyncProgress({ syncing: true, success: successCount, failed: failedCount, total });
  }

  dispatchSyncProgress({ syncing: false, success: successCount, failed: failedCount, total });
}

// Expose manually and trigger on network reconnect
if (typeof window !== "undefined") {
  (window as any).syncPending = syncPending;
  window.addEventListener("online", () => {
    syncPending().catch(console.error);
  });
}
