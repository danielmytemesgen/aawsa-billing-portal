/**
 * action-types.ts
 *
 * Type-only exports extracted from actions.ts.
 * Next.js 'use server' files can only export async functions, so all types
 * and interfaces live here instead.
 */
import type { Database } from '@/types/db';

type PublicTables = Database['public']['Tables'];

// ── DB Row / Insert / Update aliases ───────────────────────────────────────
export type RoleRow = PublicTables['roles']['Row'];
export type PermissionRow = PublicTables['permissions']['Row'];
export type RolePermissionRow = PublicTables['role_permissions']['Row'];
export type Branch = PublicTables['branches']['Row'];
export type BulkMeterRow = PublicTables['bulk_meters']['Row'];
export type IndividualCustomer = PublicTables['individual_customers']['Row'];
export type StaffMember = PublicTables['staff_members']['Row'];
export type Bill = PublicTables['bills']['Row'];
export type IndividualCustomerReading = PublicTables['individual_customer_readings']['Row'];
export type BulkMeterReading = PublicTables['bulk_meter_readings']['Row'];
export type Payment = PublicTables['payments']['Row'];
export type ReportLog = PublicTables['reports']['Row'];
export type NotificationRow = PublicTables['notifications']['Row'];
export type TariffRow = PublicTables['tariffs']['Row'] & { effective_date: string; year?: number };
export type KnowledgeBaseArticleRow = PublicTables['knowledge_base_articles']['Row'];

export type BranchInsert = PublicTables['branches']['Insert'];
export type BranchUpdate = PublicTables['branches']['Update'];
export type BulkMeterInsert = PublicTables['bulk_meters']['Insert'];
export type BulkMeterUpdate = PublicTables['bulk_meters']['Update'];
export type IndividualCustomerInsert = PublicTables['individual_customers']['Insert'];
export type IndividualCustomerUpdate = PublicTables['individual_customers']['Update'];
export type StaffMemberInsert = PublicTables['staff_members']['Insert'];
export type StaffMemberUpdate = PublicTables['staff_members']['Update'];
export type BillInsert = PublicTables['bills']['Insert'];
export type BillUpdate = PublicTables['bills']['Update'];
export type IndividualCustomerReadingInsert = PublicTables['individual_customer_readings']['Insert'];
export type IndividualCustomerReadingUpdate = PublicTables['individual_customer_readings']['Update'];
export type BulkMeterReadingInsert = PublicTables['bulk_meter_readings']['Insert'];
export type BulkMeterReadingUpdate = PublicTables['bulk_meter_readings']['Update'];
export type PaymentInsert = PublicTables['payments']['Insert'];
export type PaymentUpdate = PublicTables['payments']['Update'];
export type ReportLogInsert = PublicTables['reports']['Insert'];
export type ReportLogUpdate = PublicTables['reports']['Update'];
export type NotificationInsert = PublicTables['notifications']['Insert'];
export type NotificationUpdate = PublicTables['notifications']['Update'];
export type TariffInsert = PublicTables['tariffs']['Insert'];
export type TariffUpdate = PublicTables['tariffs']['Update'];
export type KnowledgeBaseArticleInsert = PublicTables['knowledge_base_articles']['Insert'];
export type KnowledgeBaseArticleUpdate = PublicTables['knowledge_base_articles']['Update'];

// ── Misc helper types ───────────────────────────────────────────────────────
export type PendingReading = { id: number; payload: any };
export type PendingUpload = { id: number; blob: Blob };

// ── FaultCode (manually defined — not yet in generated DB types) ────────────
export interface FaultCodeRow {
  id: string;
  code: string;
  description: string | null;
  category: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FaultCodeInsert {
  id?: string;
  code: string;
  description?: string | null;
  category?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FaultCodeUpdate {
  code?: string;
  description?: string | null;
  category?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ── Route types ─────────────────────────────────────────────────────────────
export interface RouteRow {
  route_key: string;
  branch_id?: string | null;
  reader_id?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RouteInsert {
  route_key: string;
  branch_id?: string | null;
  reader_id?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RouteUpdate {
  route_key?: string;
  branch_id?: string | null;
  reader_id?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── Logging / Auth result types ─────────────────────────────────────────────
export interface LogOptions {
  event: string;
  severity?: 'info' | 'warning' | 'critical';
  customerKeyNumber?: string;
  details?: any;
}

export interface CustomerAuthResult {
  customer_key_number: string | null;
  name: string | null;
  email: string | null;
  phone_number: string | null;
  is_portal_enabled: boolean;
  success: boolean;
  message: string;
}
