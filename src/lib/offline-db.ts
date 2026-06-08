import Dexie, { type Table } from 'dexie';

export interface OfflineReading {
  id?: number;
  localId?: string; // client-generated UUID for mapping
  idempotencyKey?: string;
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

export interface SessionCache {
  id: string; // fixed id 'session'
  token: string; // encrypted JWT
  timestamp: number;
}

export interface CachedRoute {
  routeKey: string; // primary key
  data: any;
  lastUpdated: number;
}

export class OfflineDB extends Dexie {
  readings!: Table<OfflineReading>;
  meters!: Table<CachedMeter>;
  uploads!: Table<UploadEntry>;
  device_tokens!: Table<DeviceTokenEntry, string>;
  session!: Table<SessionCache, string>;
  routes!: Table<CachedRoute, string>;
  
  constructor() {
    super('AAWSAReaderDB');
    this.version(1).stores({
      readings: '++id, localId, idempotencyKey, status, type, timestamp',
      meters: 'customerKeyNumber, type, lastUpdated'
    });
    // upgrade to add uploads, device_tokens, and session
    this.version(2).stores({
      uploads: '++id, status, readingId, timestamp',
      device_tokens: 'id',
      session: 'id, token, timestamp'
    });
    // add sw cache store for tokens and small key/value data
    this.version(3).stores({
      sw_cache: 'key'
    });
    // add routes cache store
    this.version(4).stores({
      routes: 'routeKey, lastUpdated'
    });
  }
}

class MockTable {
  async put() {}
  async get() { return null; }
  async delete() {}
  async toArray() { return []; }
  async bulkPut() {}
  async add() {}
  async update() {}
  where() {
    return {
      equals: () => ({
        toArray: async () => []
      })
    };
  }
  orderBy() {
    return {
      toArray: async () => []
    };
  }
}

class MockDB {
  readings = new MockTable();
  meters = new MockTable();
  uploads = new MockTable();
  device_tokens = new MockTable();
  session = new MockTable();
  routes = new MockTable();
  table() {
    return new MockTable();
  }
}

export const db = typeof window !== 'undefined' ? new OfflineDB() : (new MockDB() as any);

// --- Route cache helpers ---
export async function cacheRoutes(routesData: any[]) {
  const entries: CachedRoute[] = routesData.map(r => ({
    routeKey: r.routeKey || r.route_key,
    data: r,
    lastUpdated: Date.now(),
  }));
  return await db.routes.bulkPut(entries);
}

export async function getCachedRoutes(): Promise<CachedRoute[]> {
  return await db.routes.toArray();
}

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
 * On HTTP (no crypto.subtle), silently skips encryption.
 */
export async function saveDeviceTokenEncrypted(token: string, deviceId?: string) {
  // Skip encryption on HTTP (crypto.subtle unavailable)
  if (!crypto.subtle) {
    return await db.device_tokens.put({
      id: deviceId || 'device',
      exportedKeyBase64: '',
      encryptedTokenBase64: btoa(token),
      ivBase64: '',
      timestamp: Date.now()
    });
  }

  try {
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
      id: deviceId || 'device',
      exportedKeyBase64,
      encryptedTokenBase64,
      ivBase64,
      timestamp: Date.now()
    };

    return await db.device_tokens.put(entry);
  } catch (e) {
    console.warn('Device token encryption failed:', e);
    // Fallback: store unencrypted (not ideal but better than crashing)
    return await db.device_tokens.put({
      id: deviceId || 'device',
      exportedKeyBase64: '',
      encryptedTokenBase64: btoa(token),
      ivBase64: '',
      timestamp: Date.now()
    });
  }
}

export async function saveSessionToken(token: string) {
  return await db.session.put({ id: 'session', token, timestamp: Date.now() });
}

export async function getSessionToken(): Promise<string | null> {
  const rec = await db.session.get('session');
  return rec ? rec.token : null;
}

export async function clearSessionToken() {
  return await db.session.delete('session');
}

export async function getDecryptedDeviceToken(): Promise<string | null> {
  const entry = await db.device_tokens.get('device');
  if (!entry) return null;

  // If no encryption key (HTTP context), return base64-decoded token
  if (!entry.exportedKeyBase64) {
    try {
      return atob(entry.encryptedTokenBase64);
    } catch (e) {
      console.error('Failed to decode unencrypted device token', e);
      return null;
    }
  }

  // Encrypted token — only decrypt if crypto.subtle is available
  if (!crypto.subtle) {
    console.warn('crypto.subtle unavailable; cannot decrypt device token');
    return null;
  }

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

// --- SW cache helpers ---
export async function setSWCache(key: string, value: any) {
  return await db.table('sw_cache').put({ key, value });
}

export async function getSWCache(key: string) {
  const rec = await db.table('sw_cache').get(key as any);
  return rec ? rec.value : null;
}

// --- Storage management / pruning ---
const MAX_STORAGE_BYTES = 100 * 1024 * 1024; // 100 MB

export async function estimateStorageUsageBytes(): Promise<number> {
  let total = 0;
  const uploads = await db.uploads.toArray();
  for (const u of uploads) {
    if (u.blob && (u.blob as any).size) total += (u.blob as any).size;
  }
  const readings = await db.readings.toArray();
  for (const r of readings) {
    total += JSON.stringify(r).length;
  }
  return total;
}

export async function pruneStorageIfNeeded() {
  try {
    let usage = await estimateStorageUsageBytes();
    if (usage <= MAX_STORAGE_BYTES) return { pruned: 0, usage };

    // Delete oldest uploads first
    const toDelete: number[] = [];
    const uploads = await db.uploads.orderBy('timestamp').toArray();
    for (const u of uploads) {
      if (!u.id) continue;
      toDelete.push(u.id);
      // approximate size
      usage -= ((u.blob && (u.blob as any).size) ? (u.blob as any).size : 0) + 200;
      if (usage <= MAX_STORAGE_BYTES) break;
    }

    for (const id of toDelete) {
      try { await db.uploads.delete(id); } catch (e) { /* ignore */ }
    }

    // If still over limit, delete oldest readings
    if (usage > MAX_STORAGE_BYTES) {
      const readings = await db.readings.orderBy('timestamp').toArray();
      for (const r of readings) {
        if (!r.id) continue;
        usage -= JSON.stringify(r).length;
        await db.readings.delete(r.id);
        if (usage <= MAX_STORAGE_BYTES) break;
      }
    }

    return { pruned: toDelete.length, usage };
  } catch (e) {
    console.error('Prune storage failed', e);
    return { pruned: 0, usage: 0 };
  }
}

/**
 * Adds a reading to the offline queue.
 */
export async function queueOfflineReading(type: 'individual' | 'bulk', payload: any) {
  const localId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2,8);
  const idempotencyKey = payload && payload.idempotencyKey ? payload.idempotencyKey : localId;
  return await db.readings.add({
    localId,
    idempotencyKey,
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
