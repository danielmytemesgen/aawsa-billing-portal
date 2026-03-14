

export type StaffStatus = 'Active' | 'Inactive' | 'On Leave';

export interface StaffMember {
  id: string;
  name: string;
  email: string; // This will be the login identifier, e.g., kality@aawsa.com
  password?: string; // Password for the staff member
  role: string; // Changed from enum to string to support dynamic roles from DB
  branchName: string; // The name of the branch
  branchId?: string; // The canonical ID of the branch
  status: StaffStatus;
  phone?: string; // Optional
  hireDate?: string; // Optional, ISO date string
  roleId?: number; // Added
  permissions?: string[]; // Added
}
