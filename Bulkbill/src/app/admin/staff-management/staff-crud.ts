import { dbGetAllStaffMembers, dbCreateStaffMember, dbUpdateStaffMember, dbDeleteStaffMember } from '@/lib/db-queries';

export interface Staff {
  id: string;
  name: string;
  role: string;
  branchId: string;
}

export const createStaff = async (staff: Omit<Staff, 'id'>): Promise<Staff> => {
  if (!staff.name || !staff.role || !staff.branchId) throw new Error('Staff name, role, and branch ID are required.');
  return await dbCreateStaffMember(staff as any);
};

export const getAllStaff = async (): Promise<Staff[]> => {
  return await dbGetAllStaffMembers();
};

export const getStaffById = async (id: string): Promise<Staff | undefined> => {
  const all = await dbGetAllStaffMembers();
  return all.find((s: any) => s.id === id);
};

export const updateStaff = async (id: string, updatedStaff: Partial<Omit<Staff, 'id'>>): Promise<Staff | undefined> => {
  return await dbUpdateStaffMember(id, updatedStaff as any);
};

export const deleteStaff = async (id: string): Promise<boolean> => {
  return await dbDeleteStaffMember(id as any);
};

export const clearAllStaff = async (): Promise<void> => {
  // Not implemented for MySQL shim; implement if needed.
  return;
};