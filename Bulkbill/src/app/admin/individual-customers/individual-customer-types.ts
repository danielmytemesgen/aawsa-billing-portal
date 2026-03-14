
import type { z } from "zod";
import type { baseIndividualCustomerDataSchema } from "@/app/admin/data-entry/customer-data-entry-types";
import type { PaymentStatus, CustomerType, SewerageConnection } from "@/lib/billing-calculations";

export const individualCustomerStatuses = ['Active', 'Inactive', 'Suspended', 'Pending Approval', 'Rejected'] as const;
export type IndividualCustomerStatus = (typeof individualCustomerStatuses)[number];

// This type represents the data structure for an individual customer entity.
// It combines the fields from the data entry schema with operational/billing fields.
// customerKeyNumber is now the primary identifier.
export type IndividualCustomer = z.infer<typeof baseIndividualCustomerDataSchema> & {
  // id: string; // Removed, customerKeyNumber is the PK
  status: IndividualCustomerStatus;
  paymentStatus: PaymentStatus;
  calculatedBill: number;
  branchId?: string; // New field for branch association
  created_at?: string | null;
  updated_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
};
