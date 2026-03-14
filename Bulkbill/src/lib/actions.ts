'use server'
import {
  dbCreateBranch,
  dbDeleteBranch,
  dbGetAllBranches,
  dbUpdateBranch,
  dbCreateCustomer,
  dbDeleteCustomer,
  dbGetAllCustomers,
  dbUpdateCustomer,
  dbCreateBulkMeter,
  dbDeleteBulkMeter,
  dbGetAllBulkMeters,
  dbUpdateBulkMeter,
  dbCreateStaffMember,
  dbDeleteStaffMember,
  dbGetAllStaffMembers,
  dbUpdateStaffMember,
  getStaffMemberForAuth as dbGetStaffMemberForAuth,
  dbCreateBill,
  dbDeleteBill,
  dbGetAllBills,
  dbUpdateBill,
  dbCreateIndividualCustomerReading,
  dbDeleteIndividualCustomerReading,
  dbGetAllIndividualCustomerReadings,
  dbUpdateIndividualCustomerReading,
  dbCreateBulkMeterReading,
  dbDeleteBulkMeterReading,
  dbGetAllBulkMeterReadings,
  dbUpdateBulkMeterReading,
  dbCreatePayment,
  dbDeletePayment,
  dbGetAllPayments,
  dbUpdatePayment,
  dbCreateReportLog,
  dbDeleteReportLog,
  dbGetAllReportLogs,
  dbUpdateReportLog,
  dbCreateNotification,
  dbDeleteNotification,
  dbGetAllNotifications,
  dbUpdateNotification,
  dbGetAllRoles,
  dbCreateRole,
  dbGetAllPermissions,
  dbCreatePermission,
  dbUpdatePermission,
  dbDeletePermission,
  dbGetAllRolePermissions,
  dbRpcUpdateRolePermissions,
  dbGetAllTariffs,
  dbCreateTariff,
  dbUpdateTariff,
  dbCreateKnowledgeBaseArticle,
  dbUpdateKnowledgeBaseArticle,
  dbDeleteKnowledgeBaseArticle,
  dbGetAllKnowledgeBaseArticles,
} from './db-queries';

import { calculateBill, type CustomerType, type SewerageConnection } from './billing';

import type { Database } from '@/types/supabase';

// Helper types to extract Row, Insert, and Update types from the database definition
type PublicTables = Database['public']['Tables'];
type RoleRow = PublicTables['roles']['Row'];
type PermissionRow = PublicTables['permissions']['Row'];
type RolePermissionRow = PublicTables['role_permissions']['Row'];
type RoleInsert = PublicTables['roles']['Insert'];
type PermissionInsert = PublicTables['permissions']['Insert'];
type PermissionUpdate = PublicTables['permissions']['Update'];
type Branch = PublicTables['branches']['Row'];
type BulkMeterRow = PublicTables['bulk_meters']['Row'];
type IndividualCustomer = PublicTables['individual_customers']['Row'];
type StaffMember = PublicTables['staff_members']['Row'];
type Bill = PublicTables['bills']['Row'];
type IndividualCustomerReading = PublicTables['individual_customer_readings']['Row'];
type BulkMeterReading = PublicTables['bulk_meter_readings']['Row'];
type Payment = PublicTables['payments']['Row'];
type ReportLog = PublicTables['reports']['Row'];
type NotificationRow = PublicTables['notifications']['Row'];
type TariffRow = PublicTables['tariffs']['Row'];
type KnowledgeBaseArticleRow = PublicTables['knowledge_base_articles']['Row'];


type BranchInsert = PublicTables['branches']['Insert'];
type BranchUpdate = PublicTables['branches']['Update'];
type BulkMeterInsert = PublicTables['bulk_meters']['Insert'];
type BulkMeterUpdate = PublicTables['bulk_meters']['Update'];
type IndividualCustomerInsert = PublicTables['individual_customers']['Insert'];
type IndividualCustomerUpdate = PublicTables['individual_customers']['Update'];
type StaffMemberInsert = PublicTables['staff_members']['Insert'];
type StaffMemberUpdate = PublicTables['staff_members']['Update'];
type BillInsert = PublicTables['bills']['Insert'];
type BillUpdate = PublicTables['bills']['Update'];
type IndividualCustomerReadingInsert = PublicTables['individual_customer_readings']['Insert'];
type IndividualCustomerReadingUpdate = PublicTables['individual_customer_readings']['Update'];
type BulkMeterReadingInsert = PublicTables['bulk_meter_readings']['Insert'];
type BulkMeterReadingUpdate = PublicTables['bulk_meter_readings']['Update'];
type PaymentInsert = PublicTables['payments']['Insert'];
type PaymentUpdate = PublicTables['payments']['Update'];
type ReportLogInsert = PublicTables['reports']['Insert'];
type ReportLogUpdate = PublicTables['reports']['Update'];
type NotificationInsert = PublicTables['notifications']['Insert'];
type NotificationUpdate = PublicTables['notifications']['Update'];
type TariffInsert = PublicTables['tariffs']['Insert'];
type TariffUpdate = PublicTables['tariffs']['Update'];
type KnowledgeBaseArticleInsert = PublicTables['knowledge_base_articles']['Insert'];
type KnowledgeBaseArticleUpdate = PublicTables['knowledge_base_articles']['Update'];


export type { RoleRow, PermissionRow, RolePermissionRow, Branch, BulkMeterRow, IndividualCustomer, StaffMember, Bill, IndividualCustomerReading, BulkMeterReading, Payment, ReportLog, NotificationRow, BranchInsert, BranchUpdate, BulkMeterInsert, BulkMeterUpdate, IndividualCustomerInsert, IndividualCustomerUpdate, StaffMemberInsert, StaffMemberUpdate, BillInsert, BillUpdate, IndividualCustomerReadingInsert, IndividualCustomerReadingUpdate, BulkMeterReadingInsert, BulkMeterReadingUpdate, PaymentInsert, PaymentUpdate, ReportLogInsert, ReportLogUpdate, NotificationInsert, NotificationUpdate, TariffRow, TariffInsert, TariffUpdate, KnowledgeBaseArticleInsert, KnowledgeBaseArticleUpdate, KnowledgeBaseArticleRow };


const wrap = async <T>(fn: () => Promise<T>) => {
  try {
    const data = await fn();
    return { data, error: null } as any;
  } catch (e) {
    // Ensure the full error is serialized, not just a generic object
    const errorObject = e instanceof Error
      ? { name: e.name, message: e.message, stack: e.stack }
      : typeof e === 'object' && e !== null
        ? e
        : { message: String(e) };
    return { data: null, error: errorObject } as any;
  }
};

export async function getAllBranchesAction() { return await wrap(() => dbGetAllBranches()); }
export async function createBranchAction(branch: BranchInsert) { return await wrap(() => dbCreateBranch(branch)); }
export async function updateBranchAction(id: string, branch: BranchUpdate) { return await wrap(() => dbUpdateBranch(id, branch)); }
export async function deleteBranchAction(id: string) { return await wrap(() => dbDeleteBranch(id)); }

export async function getAllCustomersAction() { return await wrap(() => dbGetAllCustomers()); }
export async function createCustomerAction(customer: IndividualCustomerInsert) { return await wrap(() => dbCreateCustomer(customer)); }
export async function updateCustomerAction(customerKeyNumber: string, customer: IndividualCustomerUpdate) { return await wrap(() => dbUpdateCustomer(customerKeyNumber, customer)); }
export async function deleteCustomerAction(customerKeyNumber: string) { return await wrap(() => dbDeleteCustomer(customerKeyNumber)); }

export async function getAllBulkMetersAction() { return await wrap(() => dbGetAllBulkMeters()); }
export async function createBulkMeterAction(bulkMeter: BulkMeterInsert) { return await wrap(() => dbCreateBulkMeter(bulkMeter)); }
export async function updateBulkMeterAction(customerKeyNumber: string, bulkMeter: BulkMeterUpdate) { return await wrap(() => dbUpdateBulkMeter(customerKeyNumber, bulkMeter)); }
export async function deleteBulkMeterAction(customerKeyNumber: string) { return await wrap(() => dbDeleteBulkMeter(customerKeyNumber)); }

export async function getAllStaffMembersAction() { return await wrap(() => dbGetAllStaffMembers()); }
export async function createStaffMemberAction(staffMember: StaffMemberInsert) { return await wrap(() => dbCreateStaffMember(staffMember)); }
export async function updateStaffMemberAction(email: string, staffMember: StaffMemberUpdate) { return await wrap(() => dbUpdateStaffMember(email, staffMember)); }
export async function deleteStaffMemberAction(email: string) { return await wrap(() => dbDeleteStaffMember(email)); }
export async function getStaffMemberForAuthAction(email: string, password?: string) { return await wrap(() => dbGetStaffMemberForAuth(email, password)); }

export async function getAllBillsAction() { return await wrap(() => dbGetAllBills()); }
export async function createBillAction(bill: BillInsert) { return await wrap(() => dbCreateBill(bill)); }
export async function updateBillAction(id: string, bill: BillUpdate) { return await wrap(() => dbUpdateBill(id, bill)); }
export async function deleteBillAction(id: string) { return await wrap(() => dbDeleteBill(id)); }

export async function getAllIndividualCustomerReadingsAction() { return await wrap(() => dbGetAllIndividualCustomerReadings()); }
export async function createIndividualCustomerReadingAction(reading: IndividualCustomerReadingInsert) { return await wrap(() => dbCreateIndividualCustomerReading(reading)); }
export async function updateIndividualCustomerReadingAction(id: string, reading: IndividualCustomerReadingUpdate) { return await wrap(() => dbUpdateIndividualCustomerReading(id, reading)); }
export async function deleteIndividualCustomerReadingAction(id: string) { return await wrap(() => dbDeleteIndividualCustomerReading(id)); }

export async function getAllBulkMeterReadingsAction() { return await wrap(() => dbGetAllBulkMeterReadings()); }
export async function createBulkMeterReadingAction(reading: BulkMeterReadingInsert) { return await wrap(() => dbCreateBulkMeterReading(reading)); }
export async function updateBulkMeterReadingAction(id: string, reading: BulkMeterReadingUpdate) { return await wrap(() => dbUpdateBulkMeterReading(id, reading)); }
export async function deleteBulkMeterReadingAction(id: string) { return await wrap(() => dbDeleteBulkMeterReading(id)); }

export async function getAllPaymentsAction() { return await wrap(() => dbGetAllPayments()); }
export async function createPaymentAction(payment: PaymentInsert) { return await wrap(() => dbCreatePayment(payment)); }
export async function updatePaymentAction(id: string, payment: PaymentUpdate) { return await wrap(() => dbUpdatePayment(id, payment)); }
export async function deletePaymentAction(id: string) { return await wrap(() => dbDeletePayment(id)); }

export async function getAllReportLogsAction() { return await wrap(() => dbGetAllReportLogs()); }
export async function createReportLogAction(log: ReportLogInsert) { return await wrap(() => dbCreateReportLog(log)); }
export async function updateReportLogAction(id: string, log: ReportLogUpdate) { return await wrap(() => dbUpdateReportLog(id, log)); }
export async function deleteReportLogAction(id: string) { return await wrap(() => dbDeleteReportLog(id)); }

export async function getAllNotificationsAction() { return await wrap(() => dbGetAllNotifications()); }
export async function deleteNotificationAction(id: string) { return await wrap(() => dbDeleteNotification(id)); }
export async function updateNotificationAction(id: string, notification: NotificationUpdate) { return await wrap(() => dbUpdateNotification(id, notification)); }
export async function createNotificationAction(notification: NotificationInsert) { return await wrap(() => dbCreateNotification(notification)); }

export async function getAllRolesAction() { return await wrap(() => dbGetAllRoles()); }
export async function createRoleAction(role: RoleInsert) { return await wrap(() => dbCreateRole(role)); }
export async function getAllPermissionsAction() { return await wrap(() => dbGetAllPermissions()); }
export const createPermissionAction = async (permission: PermissionInsert) => await wrap(() => dbCreatePermission(permission));
export const updatePermissionAction = async (id: number, permission: PermissionUpdate) => await wrap(() => dbUpdatePermission(id, permission));
export const deletePermissionAction = async (id: number) => await wrap(() => dbDeletePermission(id));
export async function getAllRolePermissionsAction() { return await wrap(() => dbGetAllRolePermissions()); }

export async function rpcUpdateRolePermissionsAction(roleId: number, permissionIds: number[]) {
  return await wrap(() => dbRpcUpdateRolePermissions(roleId, permissionIds));
}


export async function getAllTariffsAction() { return await wrap(() => dbGetAllTariffs()); }
export async function createTariffAction(tariff: TariffInsert) { return await wrap(() => dbCreateTariff(tariff)); }
export async function updateTariffAction(customerType: string, year: number, tariff: TariffUpdate) {
  return await wrap(() => dbUpdateTariff(customerType, year, tariff));
}

export async function getAllKnowledgeBaseArticlesAction() { return await wrap(() => dbGetAllKnowledgeBaseArticles()); }
export async function createKnowledgeBaseArticleAction(article: KnowledgeBaseArticleInsert) { return await wrap(() => dbCreateKnowledgeBaseArticle(article)); }
export async function updateKnowledgeBaseArticleAction(id: number, article: KnowledgeBaseArticleUpdate) { return await wrap(() => dbUpdateKnowledgeBaseArticle(id, article)); }
export async function deleteKnowledgeBaseArticleAction(id: number) { return await wrap(() => dbDeleteKnowledgeBaseArticle(id)); }

export async function calculateBillAction(
  consumption: number,
  customerType: CustomerType,
  sewerageConnection: SewerageConnection,
  meterSize: string | number,
  billingMonth: string,
  sewerageUsageM3?: number,
  baseWaterChargeUsageM3?: number
) {
  const size = typeof meterSize === 'string' ? parseFloat(meterSize) : meterSize;
  return await wrap(() => calculateBill(consumption, customerType, sewerageConnection, size || 0, billingMonth, sewerageUsageM3, baseWaterChargeUsageM3));
}

import { dbLogSecurityEvent } from './db-queries';

export async function logSecurityEventAction(event: string, staff_email?: string, branch_name?: string, ipAddress?: string) {
  return await wrap(async () => {
    await dbLogSecurityEvent(event, staff_email, branch_name, ipAddress);
    return true;
  });
}