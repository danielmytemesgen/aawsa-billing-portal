import Dexie, { type Table } from 'dexie';

export interface OfflineReading {
  id?: number;
  type: 'individual' | 'bulk';
  payload: any;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
  timestamp: number;
}

export interface CachedMeter {
  customerKeyNumber: string;
  type: 'individual' | 'bulk';
  data: any;
  lastUpdated: number;
}

export interface UploadEntry {
  id?: number;
  readingId?: number | null;
  filename?: string;
  blob?: Blob;
  status: 'pending' | 'uploading' | 'failed';
  errorMessage?: string;
  timestamp: number;
}

export interface DeviceTokenEntry {
  id: string; // use fixed id 'device'
  exportedKeyBase64: string; // raw AES-GCM key exported as base64
  encryptedTokenBase64: string; // ciphertext
  ivBase64: string;
  timestamp: number;
}

export class OfflineDB extends Dexie {
  readings!: Table<OfflineReading>;
  meters!: Table<CachedMeter>;
  uploads!: Table<UploadEntry>;
  device_tokens!: Table<DeviceTokenEntry, string>;

  constructor() {
    super('AAWSAReaderDB');
    this.version(1).stores({
      readings: '++id, status, type, timestamp',
      meters: 'customerKeyNumber, type, lastUpdated'
    });

    // upgrade to add uploads and device_tokens
    this.version(2).stores({
      uploads: '++id, status, readingId, timestamp',
      device_tokens: 'id'
    });
  }
}

export const db = new OfflineDB();

// --- Upload helpers ---
export async function queueUpload(filename: string, blob: Blob, readingId?: number | null) {
  return await db.uploads.add({
    filename,
    blob,
    readingId: readingId ?? null,
    status: 'pending',
    timestamp: Date.now()
  });
}

export async function getPendingUploads() {
  return await db.uploads.where('status').equals('pending').toArray();
}

export async function removeUpload(id: number) {
  return await db.uploads.delete(id);
}

export async function markUploadFailed(id: number, error: string) {
  return await db.uploads.update(id, { status: 'failed', errorMessage: error });
}

// --- Device token helpers (simple PoC encryption using Web Crypto) ---
/**
 * Save an encrypted device token. This generates an AES-GCM key (if needed),
 * encrypts the token and stores the exported key + ciphertext in `device_tokens` store.
 */
export async function saveDeviceTokenEncrypted(token: string) {
  // create key
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(token);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);

  const exportedKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
  const encryptedTokenBase64 = btoa(String.fromCharCode(...new Uint8Array(cipher)));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  const entry: DeviceTokenEntry = {
    id: 'device',
    exportedKeyBase64,
    encryptedTokenBase64,
    ivBase64,
    timestamp: Date.now()
  };

  return await db.device_tokens.put(entry);
}

export async function getDecryptedDeviceToken(): Promise<string | null> {
  const entry = await db.device_tokens.get('device');
  if (!entry) return null;

  try {
    const raw = Uint8Array.from(atob(entry.exportedKeyBase64), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', raw.buffer, 'AES-GCM', true, ['decrypt']);
    const iv = Uint8Array.from(atob(entry.ivBase64), c => c.charCodeAt(0));
    const cipher = Uint8Array.from(atob(entry.encryptedTokenBase64), c => c.charCodeAt(0));
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher.buffer);
    return new TextDecoder().decode(plainBuf as ArrayBuffer);
  } catch (e) {
    console.error('Device token decryption failed', e);
    return null;
  }
}

/**
 * Adds a reading to the offline queue.
 */
export async function queueOfflineReading(type: 'individual' | 'bulk', payload: any) {
  return await db.readings.add({
    type,
    payload,
    status: 'pending',
    timestamp: Date.now()
  });
}

/**
 * Gets all pending readings from the queue.
 */
export async function getPendingReadings() {
  return await db.readings.where('status').equals('pending').toArray();
}

/**
 * Marks a reading as syncing.
 */
export async function markAsSyncing(id: number) {
  return await db.readings.update(id, { status: 'syncing' });
}

/**
 * Marks a reading as failed with an error message.
 */
export async function markAsFailed(id: number, error: string) {
  return await db.readings.update(id, { status: 'failed', errorMessage: error });
}

/**
 * Deletes a reading after successful sync.
 */
export async function removeSyncedReading(id: number) {
  return await db.readings.delete(id);
}

/**
 * Caches meter data for offline use.
 */
export async function cacheMeters(meters: any[], type: 'individual' | 'bulk') {
  const cachedMeters: CachedMeter[] = meters.map(m => ({
    customerKeyNumber: m.customerKeyNumber,
    type,
    data: m,
    lastUpdated: Date.now()
  }));
  return await db.meters.bulkPut(cachedMeters);
}

/**
 * Retrieves cached meter data.
 */
export async function getCachedMeters(type: 'individual' | 'bulk') {
  return await db.meters.where('type').equals(type).toArray();
}

/**
 * Gets all failed readings from the queue.
 */
export async function getFailedReadings() {
  return await db.readings.where('status').equals('failed').toArray();
}

/**
 * Resets all failed readings to pending for retry.
 */
export async function resetFailedReadings() {
  const failed = await db.readings.where('status').equals('failed').toArray();
  for (const r of failed) {
    if (r.id) await db.readings.update(r.id, { status: 'pending', errorMessage: undefined });
  }
}

/**
 * Resets a single failed reading back to pending to retry syncing it.
 */
export async function resetSingleFailedReading(id: number) {
  return await db.readings.update(id, { status: 'pending', errorMessage: undefined });
}
