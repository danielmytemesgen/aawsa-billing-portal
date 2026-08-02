
export type BranchStatus = 'Active' | 'Inactive';

export interface Branch {
  id: string;
  name: string;
  location: string;
  contactPerson?: string;
  contactPhone?: string;
  status: BranchStatus;
  // Add other relevant fields like:
  // managerId?: string;
  // numberOfStaff?: number;
  // establishedDate?: string;
}
