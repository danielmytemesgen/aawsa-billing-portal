import { BulkMeter } from './bulk-meter-types';
import { dbCreateBulkMeter, dbGetAllBulkMeters, dbDeleteBulkMeter, dbUpdateBulkMeter } from '@/lib/db-queries';

export const createBulkMeter = async (bulkMeter: Omit<BulkMeter, 'id' | 'meterId'> & { meterId?: string }): Promise<BulkMeter> => {
  // Accept optional meterId for compatibility with migrated data; ensure location exists
  if (!bulkMeter.location) throw new Error('Location is required to create a bulk meter.');
  return await dbCreateBulkMeter(bulkMeter as any);
};

export const getBulkMeterById = async (id: number): Promise<BulkMeter | undefined> => {
  const all = await dbGetAllBulkMeters();
  return all.find((b: any) => b.id === id) as BulkMeter | undefined;
};

export const getAllBulkMeters = async (): Promise<BulkMeter[]> => {
  return await dbGetAllBulkMeters();
};
export const updateBulkMeter = async (id: string | number, updatedData: Partial<BulkMeter>): Promise<BulkMeter | undefined> => {
  return await dbUpdateBulkMeter(String(id), updatedData as any);
};

export const deleteBulkMeter = async (id: string | number): Promise<boolean> => {
  return await dbDeleteBulkMeter(String(id));
};