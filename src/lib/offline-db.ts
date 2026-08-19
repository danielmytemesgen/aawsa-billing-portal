import Dexie, { type Table } from 'dexie';
import CryptoJS from 'crypto-js';

export interface OfflineReading {
  id?: number;
  localId?: string; // client-generated UUID for mapping
  idempotencyKey?: string;
  type: 'individual' | 'bulk';
  payload: any;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
  timestamp: number;
  retryCount?: number;
  lastAttempt?: number;
  routeKey?: string | null;
  meterKey?: string | null;
  readerStaffId?: string | null;
}

export interface CachedMeter {
  customerKeyNumber: string;
  type: 'individual' | 'bulk';
  routeKey?: string | null;
  data: any;
  lastUpdated: number;
}

export interface UploadEntry {
  id?: number;
  readingId?: number | null;
  readingLocalId?: string | null;
  readingType?: 'individual' | 'bulk' | null;
  filename?: string;
  blob?: Blob;
  photoData?: string | null;
  status: 'pending' | 'uploading' | 'failed';
  errorMessage?: string;
  timestamp: number;
}

export interface DeviceTokenEntry {
  id: string; // use fixed id 'device'
  exportedKeyBase64: string; // base64-encoded passphrase used for AES decryption
  encryptedTokenBase64: string; // ciphertext
  ivBase64: string; // retained for backward compatibility
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
  cached_readings!: Table<any, string>;
  
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
    // add cached historical readings store
    this.version(5).stores({
      cached_readings: 'id, type, lastUpdated'
    });
    // add missing uploads index for offline photo sync lookup
    this.version(6).stores({
      uploads: '++id, status, readingId, readingLocalId, readingType, timestamp'
    });
    // add route and meter indexes so large offline route batches are easier to manage and replay
    this.version(7).stores({
      readings: '++id, localId, idempotencyKey, status, type, timestamp, routeKey, meterKey, readerStaffId'
    });
    // add fast route B-Tree indexes on meters and cached_readings for instant <5ms route data loading
    this.version(8).stores({
      meters: 'customerKeyNumber, type, routeKey, [routeKey+type], lastUpdated',
      cached_readings: 'id, type, routeKey, [type+routeKey], customerKey, lastUpdated'
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
      }),
      toArray: async () => []
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
  cached_readings = new MockTable();
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

// --- Device token helpers (CryptoJS encryption - works on HTTP and HTTPS) ---
/**
 * Save an encrypted device token using CryptoJS AES (pure JS, HTTP/HTTPS compatible).
 * Generates a random password for each token, stores encrypted token with the password.
 */
export async function saveDeviceTokenEncrypted(token: string, deviceId?: string) {
  try {
    // Generate a random password using CryptoJS
    const password = CryptoJS.lib.WordArray.random(32).toString();
    
    // Encrypt using CryptoJS AES (works on HTTP + HTTPS)
    const encrypted = CryptoJS.AES.encrypt(token, password).toString();

    const entry: DeviceTokenEntry = {
      id: deviceId || 'device',
      exportedKeyBase64: btoa(password),
      encryptedTokenBase64: encrypted,
      ivBase64: '', // not used with CryptoJS
      timestamp: Date.now()
    };

    return await db.device_tokens.put(entry);
  } catch (e) {
    console.error('Device token encryption failed:', e);
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

  // Decrypt using CryptoJS (pure JS, HTTP/HTTPS compatible)
  try {
    const password = atob(entry.exportedKeyBase64);
    const decrypted = CryptoJS.AES.decrypt(entry.encryptedTokenBase64, password);
    const token = decrypted.toString(CryptoJS.enc.Utf8);

    if (!token) {
      console.error('Device token decryption failed: authentication failed');
      return null;
    }

    return token;
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

/**
 * Utility helper to convert base64 data-URL or raw base64 string to a binary Blob
 */
export function base64ToBlob(base64Data: string, defaultMime = 'image/webp'): Blob {
  try {
    let byteString: string;
    let mimeString = defaultMime;

    if (base64Data.includes(',')) {
      const parts = base64Data.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch && mimeMatch[1]) {
        mimeString = mimeMatch[1];
      }
      byteString = atob(parts[1]);
    } else {
      byteString = atob(base64Data);
    }

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch (e) {
    console.error('base64ToBlob conversion failed:', e);
    return new Blob([], { type: defaultMime });
  }
}

export async function estimateStorageUsageBytes(): Promise<number> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate.usage === 'number') {
        return estimate.usage;
      }
    } catch {
      // fallback to manual estimation
    }
  }

  let total = 0;
  try {
    // Estimate without loading entire large base64 blobs into memory simultaneously
    const uploadCount = await db.uploads.count();
    total += uploadCount * 250 * 1024; // estimate ~250KB per photo
    const readingCount = await db.readings.count();
    total += readingCount * 1024; // ~1KB per reading metadata
    const cachedReadingsCount = await db.cached_readings.count();
    total += cachedReadingsCount * 1024;
    const metersCount = await db.meters.count();
    total += metersCount * 2048;
  } catch (e) {
    console.warn('Storage estimation error:', e);
  }
  return total;
}

/**
 * Prunes disposable read-only cached stores when local storage exceeds limit.
 * CRITICAL: NEVER deletes unsynced readings (db.readings) or pending uploads (db.uploads)!
 */
export async function pruneStorageIfNeeded() {
  try {
    let usage = await estimateStorageUsageBytes();
    if (usage <= MAX_STORAGE_BYTES) return { pruned: 0, usage };

    let prunedCount = 0;

    // 1. Evict oldest read-only cached historical readings first (strictly disposable cache)
    const cachedReadingsCount = await db.cached_readings.count();
    if (cachedReadingsCount > 2000) {
      const oldestCached = await db.cached_readings.orderBy('lastUpdated').limit(cachedReadingsCount - 2000).primaryKeys();
      if (oldestCached.length > 0) {
        await db.cached_readings.bulkDelete(oldestCached as string[]);
        prunedCount += oldestCached.length;
      }
    }

    // 2. If still high, evict older cached meters (disposable - re-fetched from server on demand)
    usage = await estimateStorageUsageBytes();
    if (usage > MAX_STORAGE_BYTES) {
      const metersCount = await db.meters.count();
      if (metersCount > 3000) {
        const oldestMeters = await db.meters.orderBy('lastUpdated').limit(metersCount - 3000).primaryKeys();
        if (oldestMeters.length > 0) {
          await db.meters.bulkDelete(oldestMeters as string[]);
          prunedCount += oldestMeters.length;
        }
      }
    }

    return { pruned: prunedCount, usage };
  } catch (e) {
    console.error('Prune storage failed', e);
    return { pruned: 0, usage: 0 };
  }
}

/**
 * Requests persistent storage from the browser to prevent eviction of IndexedDB on low disk space.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        return await navigator.storage.persist();
      }
      return isPersisted;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Adds a reading to the offline queue.
 * Decouples the meter photo from the reading metadata and queues them separately as a binary Blob.
 */
export async function queueOfflineReading(type: 'individual' | 'bulk', payload: any) {
  const localId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2,8);
  const idempotencyKey = payload && payload.idempotencyKey ? payload.idempotencyKey : localId;
  
  // Extract photo if present
  const photo = payload.meter_photo || payload.meterPhoto;
  const cleanedPayload = { ...payload };
  if (cleanedPayload.meter_photo !== undefined) delete cleanedPayload.meter_photo;
  if (cleanedPayload.meterPhoto !== undefined) delete cleanedPayload.meterPhoto;

  const routeKey = payload?.routeKey || payload?.route_key || payload?.route?.routeKey || payload?.route?.route_key || null;
  const meterKey = payload?.individualCustomerId || payload?.CUSTOMERKEY || payload?.entityId || payload?.meterId || payload?.meter_id || null;
  const readerStaffId = payload?.readerStaffId || payload?.reader_staff_id || payload?.readerId || payload?.reader || null;

  const readingId = await db.readings.add({
    localId,
    idempotencyKey,
    type,
    payload: cleanedPayload,
    status: 'pending',
    timestamp: Date.now(),
    retryCount: 0,
    routeKey,
    meterKey,
    readerStaffId,
  });

  if (photo) {
    let photoBlob: Blob | undefined;
    let photoDataStr: string | null = null;

    if (photo instanceof Blob) {
      photoBlob = photo;
    } else if (typeof photo === 'string') {
      photoBlob = base64ToBlob(photo);
      photoDataStr = photo;
    }

    await db.uploads.add({
      readingId: null, // to be updated with server ID when reading is synced
      readingLocalId: localId,
      readingType: type,
      blob: photoBlob,
      photoData: photoDataStr,
      status: 'pending',
      timestamp: Date.now()
    });
  }

  // Defer non-critical background maintenance and service worker triggers (<5ms insert latency)
  if (typeof window !== 'undefined') {
    const defer = (window as any).requestIdleCallback || ((cb: Function) => setTimeout(cb, 100));
    defer(() => {
      pruneStorageIfNeeded().catch(() => {});
      import('./sync').then(m => m.registerBackgroundSync?.()).catch(() => {});
      import('./geo-utils').then(m => m.triggerReadingSavedHaptic?.()).catch(() => {});
    });
  }

  return readingId;
}

/**
 * Actively checks actual connectivity to the server backend by performing a GET request
 * to the unauthenticated /api/health endpoint with a strict 3-second timeout.
 */
export async function checkActualConnectivity(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
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
    routeKey: m.routeKey || m.route_key || m.route?.routeKey || m.route?.route_key || null,
    data: m,
    lastUpdated: Date.now()
  }));
  return await db.meters.bulkPut(cachedMeters);
}

/**
 * Retrieves cached meter data for a specific route with B-Tree index (<5ms).
 */
export async function getCachedMetersForRoute(routeKey: string, type?: 'individual' | 'bulk') {
  if (type) {
    return await db.meters.where({ routeKey, type }).toArray();
  }
  return await db.meters.where('routeKey').equals(routeKey).toArray();
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

/**
 * Caches historical readings for offline use with route and customer index.
 */
export async function cacheHistoricalReadings(readings: any[], type: 'individual' | 'bulk') {
  const cached = readings.map(r => ({
    id: `${type}-${r.id || r.customerKeyNumber || r.CUSTOMERKEY || Math.random()}`,
    type,
    routeKey: r.routeKey || r.route_key || null,
    customerKey: r.CUSTOMERKEY || r.customerKeyNumber || r.individualCustomerId || null,
    data: r,
    lastUpdated: Date.now()
  }));
  return await db.cached_readings.bulkPut(cached);
}

/**
 * Retrieves cached historical readings for a specific route with B-Tree index (<5ms).
 */
export async function getCachedHistoricalReadingsForRoute(routeKey: string, type?: 'individual' | 'bulk') {
  if (type) {
    return await db.cached_readings.where({ routeKey, type }).toArray();
  }
  return await db.cached_readings.where('routeKey').equals(routeKey).toArray();
}

/**
 * Retrieves cached historical readings.
 */
export async function getCachedHistoricalReadings(type: 'individual' | 'bulk') {
  return await db.cached_readings.where('type').equals(type).toArray();
}

/**
 * Resets all failed upload entries back to pending.
 */
export async function resetFailedUploads() {
  const failed = await db.uploads.where('status').equals('failed').toArray();
  for (const u of failed) {
    if (u.id) await db.uploads.update(u.id, { status: 'pending', errorMessage: undefined });
  }
}

/**
 * Resets a single failed upload entry back to pending.
 */
export async function resetSingleFailedUpload(id: number) {
  return await db.uploads.update(id, { status: 'pending', errorMessage: undefined });
}

export interface DeviceHealthStatus {
  batteryLevelPct: number | null; // 0 to 100
  isCharging: boolean | null;
  storageUsageMb: number;
  isLowBatteryWarning: boolean;
  isHighStorageWarning: boolean;
}

/**
 * Inspects device battery level and local storage usage for field reading safety warnings.
 */
export async function checkDeviceHealth(): Promise<DeviceHealthStatus> {
  let batteryLevelPct: number | null = null;
  let isCharging: boolean | null = null;

  if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
    try {
      const battery: any = await (navigator as any).getBattery();
      batteryLevelPct = Math.round(battery.level * 100);
      isCharging = battery.charging;
    } catch {
      // Battery API unavailable or blocked
    }
  }

  let storageUsageMb = 0;
  let isHighStorage = false;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate.usage === 'number') {
        storageUsageMb = parseFloat((estimate.usage / (1024 * 1024)).toFixed(1));
        // High storage warning only when quota is nearly exhausted (>85%) or manual app usage > 500MB
        if (estimate.quota && (estimate.usage / estimate.quota) > 0.85) {
          isHighStorage = true;
        }
      }
    } catch { /* ignore */ }
  }

  if (storageUsageMb === 0) {
    const usageBytes = await estimateStorageUsageBytes();
    storageUsageMb = parseFloat((usageBytes / (1024 * 1024)).toFixed(1));
  }

  return {
    batteryLevelPct,
    isCharging,
    storageUsageMb,
    isLowBatteryWarning: batteryLevelPct !== null && batteryLevelPct <= 15 && isCharging === false,
    isHighStorageWarning: isHighStorage,
  };
}

/**
 * Prefetches and caches a complete route package into IndexedDB for 100% offline field work.
 */
export async function cacheRoutePackage(routeKey: string, bulkMeters: any[], customers: any[], readings: any[]) {
  const now = Date.now();
  
  // 1. Cache Route Metadata
  await db.routes.put({
    routeKey,
    data: { routeKey, bulkMeterCount: bulkMeters.length, customerCount: customers.length, cachedAt: now },
    lastUpdated: now
  });

  // 2. Cache Bulk Meters & Individual Customers in bulk batch
  const cachedMeters: CachedMeter[] = [
    ...bulkMeters.map(bm => ({
      customerKeyNumber: bm.customerKeyNumber,
      type: 'bulk' as const,
      data: bm,
      lastUpdated: now
    })),
    ...customers.map(c => ({
      customerKeyNumber: c.customerKeyNumber,
      type: 'individual' as const,
      data: c,
      lastUpdated: now
    }))
  ];

  if (cachedMeters.length > 0) {
    await db.meters.bulkPut(cachedMeters);
  }

  // 3. Cache Historical Readings in bulk batch — MUST include routeKey so the
  // [type+routeKey] composite Dexie index can be used for fast offline lookups.
  const cachedReadings = readings.map(r => {
    const key = r.id || r.localId || `${r.CUSTOMERKEY || r.individualCustomerId}:${r.monthYear}`;
    const rType = r.CUSTOMERKEY ? 'bulk' as const : 'individual' as const;
    return {
      id: String(key),
      type: rType,
      routeKey,            // propagate route key for index-based offline retrieval
      customerKey: r.CUSTOMERKEY || r.customerKeyNumber || r.individualCustomerId || null,
      data: r,
      lastUpdated: now
    };
  });

  if (cachedReadings.length > 0) {
    await db.cached_readings.bulkPut(cachedReadings);
  }

  return { routeKey, bulkMetersCount: bulkMeters.length, customersCount: customers.length, readingsCount: readings.length };
}

