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

export class OfflineDB extends Dexie {
  readings!: Table<OfflineReading>;
  meters!: Table<CachedMeter>;

  constructor() {
    super('AAWSAReaderDB');
    this.version(1).stores({
      readings: '++id, status, type, timestamp',
      meters: 'customerKeyNumber, type, lastUpdated'
    });
  }
}

export const db = new OfflineDB();

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
