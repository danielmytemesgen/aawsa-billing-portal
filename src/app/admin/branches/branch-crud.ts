import { dbGetAllBranches, dbCreateBranch, dbUpdateBranch, dbDeleteBranch } from '@/lib/db-queries';

interface Branch {
  id: string;
  name: string;
  location: string;
}

export async function createBranch(branch: Branch): Promise<Branch | null> {
  if (!branch.id || !branch.name || !branch.location) throw new Error('Branch data is incomplete.');
  return await dbCreateBranch(branch as any);
}

export async function getAllBranches(): Promise<Branch[] | null> {
  return await dbGetAllBranches();
}

export async function getBranchById(id: string): Promise<Branch | null> {
  const all = await dbGetAllBranches();
  return all.find((b: any) => b.id === id) ?? null;
}

export async function updateBranch(id: string, updatedBranch: Partial<Branch>): Promise<Branch | null> {
  return await dbUpdateBranch(id, updatedBranch as any);
}

export async function deleteBranch(id: string): Promise<boolean> {
  return await dbDeleteBranch(id);
}