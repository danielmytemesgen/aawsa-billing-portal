'use server'
import {
  dbCreateBranch,
  dbDeleteBranch,
  dbGetAllBranches,
  dbUpdateBranch,
  dbCreateIndividualCustomer,
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
  dbGetTariffByTypeAndDate,
  dbCreateTariff,
  dbUpdateTariff,
  dbCreateKnowledgeBaseArticle,
  dbUpdateKnowledgeBaseArticle,
  dbDeleteKnowledgeBaseArticle,
  dbGetAllKnowledgeBaseArticles,
  dbUpdateBillStatus,
  dbCreateBillWorkflowLog,
  dbGetBillWorkflowLogs as dbGetBillWorkflowLogsQuery,
  dbGetBillById as dbGetBillByIdQuery,
  dbGetCustomerById,
  dbGetBulkMeterById,
  dbGetBranchById,
  dbGetStaffPermissions,
  dbGetIndividualCustomerReadingsByCustomer,
  dbGetBulkMeterReadingsByMeter,
  dbCreateCustomerSession,
  dbRevokeCustomerSession,
  dbGetActiveCustomerSessions,
  dbIsCustomerSessionValid,
  dbLogCustomerPageView,
  dbCreateFaultCode,
  dbUpdateFaultCode,
  dbDeleteFaultCode,
  dbGetAllFaultCodes,
  dbGetFaultCodeById,
  dbGetBillsByCustomerId,
  dbGetBillsByBulkMeterId,
  dbGetAllRoutes,
  dbGetRouteByKey,
  dbCreateRoute,
  dbUpdateRoute,
  dbDeleteRoute,
  dbGetDashboardMetrics,
  dbGetTotalPaymentsForBill,
  dbGetDistinctBillingMonths,
  dbGetBillsByMonth,
  dbGetBillsWithBulkMeterInfoByMonth,
  dbGetMostRecentBillsForBulkMeters,
  dbGetRecycleBinItems,
  dbRestoreFromRecycleBin,
  dbPermanentlyDeleteFromRecycleBin,
} from './db-queries';

import { calculateBill, type CustomerType, type SewerageConnection } from './billing';
import { encrypt, getSession } from './auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getBillingPeriodStartDate, getBillingPeriodEndDate, calculateDueDate } from './billing-config';

import type { Database } from '@/types/db';

// Helper types to extract Row, Insert, and Update types from the database definition
type PublicTables = Database['public']['Tables'];

const generateBillKey = (billId: string) => {
  const idHex = (billId || "").replace(/-/g, '').substring(0, 8);
  const idNumeric = parseInt(idHex, 16);
  return isNaN(idNumeric) ? "BBPT-0000000000" : `BBPT-${String(idNumeric).padStart(10, '0')}`;
};

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
type TariffRow = PublicTables['tariffs']['Row'] & { effective_date: string; year?: number };
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

// Manually define FaultCode types since they are not in the generated Database type yet
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

const checkPermission = async (permission: string) => {
  const session = await getSession();
  if (!session || !session.id) {
    throw new Error('User not authenticated');
  }
  const permissions = session.permissions || [];

  // Granular RBAC: Check if the permission exists in the user's assigned permissions.
  // Bypass if user has 'bill:manage_all' and it's a bill-related permission
  if (permissions.includes('bill:manage_all') && permission.startsWith('bill:')) {
    return session;
  }

  if (!permissions.includes(permission)) {
    throw new Error(`Forbidden: Missing permission ${permission}`);
  }
  return session;
};

const verifyBillBranchAccess = async (billId: string, session: any) => {
  const perms = session.permissions || [];
  // Bypass branch filtering if user has 'bill:manage_all'
  if (perms.includes('bill:manage_all')) {
    return;
  }

  // Try to find the bill specifically within the user's branch
  const bill = await dbGetBillByIdQuery(billId, session.branchId);
  if (!bill) {
    throw new Error('Forbidden: Access to this bill is restricted to its own branch');
  }
  return bill;
};

export async function getBranchByIdAction(id: string) { return await wrap(() => dbGetBranchById(id)); }

export async function getAllBranchesAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    return await dbGetAllBranches();
  });
}
export async function createBranchAction(branch: BranchInsert) {
  return await wrap(async () => {
    await checkPermission('branches_create');
    const result = await dbCreateBranch(branch);
    await logSecurityEventAction({ event: 'Create Branch', details: { branch } });
    return result;
  });
}
export async function updateBranchAction(id: string, branch: BranchUpdate) {
  return await wrap(async () => {
    await checkPermission('branches_edit');
    const result = await dbUpdateBranch(id, branch);
    await logSecurityEventAction({ event: 'Update Branch', details: { id, updates: branch } });
    return result;
  });
}
export async function deleteBranchAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission('branches_delete');
    await dbDeleteBranch(id, session.id);
    await logSecurityEventAction({ event: 'Delete Branch', severity: 'Warning', details: { id } });
  });
}

export async function getAllCustomersAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms = session.permissions || [];

    const hasPerm = perms.includes('customers_view_all') ||
      perms.includes('customers_view_branch') ||
      perms.includes('dashboard_view_all') ||
      perms.includes('dashboard_view_branch');

    if (!hasPerm) {
      throw new Error('Forbidden: No customer permissions');
    }
    return await dbGetAllCustomers();
  });
}
export async function createCustomerAction(customer: IndividualCustomerInsert) {
  return await wrap(async () => {
    const session = await checkPermission('customers_create');
    // If user has restricted creation permission, it must be for their branch and pending approval
    if (session.permissions?.includes('customers_create_restricted')) {
      customer.branch_id = session.branchId || customer.branch_id;
      customer.status = 'Pending Approval';
    }
    const result = await dbCreateIndividualCustomer(customer);
    await logSecurityEventAction({
      event: 'Create Customer',
      customerKeyNumber: result.data?.customerKeyNumber,
      details: { customer }
    });
    return result;
  });
}
export async function updateCustomerAction(customerKeyNumber: string, customer: IndividualCustomerUpdate) {
  return await wrap(async () => {
    await checkPermission('customers_edit');
    const result = await dbUpdateCustomer(customerKeyNumber, customer);
    await logSecurityEventAction({
      event: 'Update Customer',
      customerKeyNumber,
      details: { updates: customer }
    });
    return result;
  });
}
export async function deleteCustomerAction(customerKeyNumber: string) {
  return await wrap(async () => {
    const session = await checkPermission('customers_delete');
    await dbDeleteCustomer(customerKeyNumber, session.id);
    await logSecurityEventAction({
      event: 'Delete Customer',
      severity: 'Warning',
      customerKeyNumber
    });
  });
}

export async function approveCustomerAction(customerKeyNumber: string) {
  return await wrap(async () => {
    const session = await checkPermission('customers_approve');
    const result = await dbUpdateCustomer(customerKeyNumber, {
      status: 'Active',
      approved_by: session.id,
      approved_at: new Date().toISOString()
    });
    await logSecurityEventAction({ event: 'Approve Customer', customerKeyNumber });
    return result;
  });
}

export async function rejectCustomerAction(customerKeyNumber: string) {
  return await wrap(async () => {
    const session = await checkPermission('customers_approve');
    const result = await dbUpdateCustomer(customerKeyNumber, {
      status: 'Rejected',
      approved_by: session.id,
      approved_at: new Date().toISOString()
    });
    await logSecurityEventAction({ event: 'Reject Customer', severity: 'Warning', customerKeyNumber });
    return result;
  });
}

export async function getCustomerByIdAction(customerKeyNumber: string) { return await wrap(() => dbGetCustomerById(customerKeyNumber)); }
export async function getAllBulkMetersAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms = session.permissions || [];

    const hasPerm = perms.includes('bulk_meters_view_all') ||
      perms.includes('bulk_meters_view_branch') ||
      perms.includes('dashboard_view_all') ||
      perms.includes('dashboard_view_branch');

    if (!hasPerm) {
      throw new Error('Forbidden: No bulk meter permissions');
    }
    return await dbGetAllBulkMeters();
  });
}
export async function getBulkMeterByIdAction(customerKeyNumber: string) { return await wrap(() => dbGetBulkMeterById(customerKeyNumber)); }
export async function createBulkMeterAction(bulkMeter: BulkMeterInsert) {
  return await wrap(async () => {
    const session = await checkPermission('bulk_meters_create');
    // If user has restricted creation permission, it must be for their branch and pending approval
    if (session.permissions?.includes('bulk_meters_create_restricted')) {
      bulkMeter.branch_id = session.branchId || bulkMeter.branch_id;
      bulkMeter.status = 'Pending Approval';
    }
    const result = await dbCreateBulkMeter(bulkMeter);
    await logSecurityEventAction({
      event: 'Create Bulk Meter',
      customerKeyNumber: bulkMeter.customerKeyNumber,
      details: { bulkMeter }
    });
    return result;
  });
}
export async function updateBulkMeterAction(customerKeyNumber: string, bulkMeter: BulkMeterUpdate) {
  return await wrap(async () => {
    await checkPermission('bulk_meters_edit');
    const result = await dbUpdateBulkMeter(customerKeyNumber, bulkMeter);
    await logSecurityEventAction({
      event: 'Update Bulk Meter',
      customerKeyNumber,
      details: { updates: bulkMeter }
    });
    return result;
  });
}
export async function deleteBulkMeterAction(customerKeyNumber: string) {
  return await wrap(async () => {
    const session = await checkPermission('bulk_meters_delete');
    await dbDeleteBulkMeter(customerKeyNumber, session.id);
    await logSecurityEventAction({
      event: 'Delete Bulk Meter',
      severity: 'Warning',
      customerKeyNumber
    });
  });
}

export async function approveBulkMeterAction(customerKeyNumber: string) {
  return await wrap(async () => {
    const session = await checkPermission('bulk_meters_approve');
    const result = await dbUpdateBulkMeter(customerKeyNumber, {
      status: 'Active',
      approved_by: session.id,
      approved_at: new Date().toISOString()
    });
    await logSecurityEventAction({
      event: 'Approve Bulk Meter',
      customerKeyNumber
    });
    return result;
  });
}

export async function rejectBulkMeterAction(customerKeyNumber: string) {
  return await wrap(async () => {
    const session = await checkPermission('bulk_meters_approve');
    const result = await dbUpdateBulkMeter(customerKeyNumber, {
      status: 'Rejected',
      approved_by: session.id,
      approved_at: new Date().toISOString()
    });
    await logSecurityEventAction({
      event: 'Reject Bulk Meter',
      severity: 'Warning',
      customerKeyNumber
    });
    return result;
  });
}

export async function getAllStaffMembersAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms = session.permissions || [];

    const hasStaffAccess = perms.includes('staff_view') ||
      perms.includes('staff_view_branch') ||
      perms.includes('dashboard_view_all') ||
      perms.includes('dashboard_view_branch');

    if (!hasStaffAccess) {
      throw new Error('Forbidden: No staff permissions');
    }
    return await dbGetAllStaffMembers();
  });
}
export async function createStaffMemberAction(staffMember: StaffMemberInsert) {
  return await wrap(async () => {
    await checkPermission('staff_create');
    const result = await dbCreateStaffMember(staffMember);
    await logSecurityEventAction({
      event: 'Create Staff Member',
      details: { staffMember }
    });
    return result;
  });
}
export async function updateStaffMemberAction(email: string, staffMember: StaffMemberUpdate) {
  return await wrap(async () => {
    await checkPermission('staff_edit');
    const result = await dbUpdateStaffMember(email, staffMember);
    await logSecurityEventAction({
      event: 'Update Staff Member',
      details: { email, updates: staffMember }
    });
    return result;
  });
}
export async function deleteStaffMemberAction(email: string) {
  return await wrap(async () => {
    const session = await checkPermission('staff_delete');
    await dbDeleteStaffMember(email, session.id);
    await logSecurityEventAction({
      event: 'Delete Staff Member',
      severity: 'Warning',
      details: { email }
    });
  });
}
export async function getStaffMemberForAuthAction(email: string, password?: string) { return await wrap(() => dbGetStaffMemberForAuth(email, password)); }

export async function getAllBillsAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms = session.permissions || [];

    const hasBillPerm = perms.includes('bill:manage_all') ||
      perms.includes('bill:view_branch') ||
      perms.some((p: string) => p.startsWith('bill:')) ||
      perms.includes('dashboard_view_all') ||
      perms.includes('dashboard_view_branch');

    if (!hasBillPerm) {
      throw new Error('Forbidden: No billing permissions');
    }

    // Apply branch filtering if they don't have global access
    const branchId = !perms.includes('bill:manage_all') ? session.branchId : undefined;

    return await dbGetAllBills(branchId);
  });
}
export async function createBillAction(bill: BillInsert) {
  return await wrap(async () => {
    const session = await checkPermission('bill:create');

    // Ensure accurate mappings if partial data provided
    if (bill.TOTALBILLAMOUNT !== undefined) {
      if (bill.THISMONTHBILLAMT === undefined || bill.THISMONTHBILLAMT === null) {
        bill.THISMONTHBILLAMT = bill.TOTALBILLAMOUNT;
      }
      if (bill.OUTSTANDINGAMT === undefined || bill.OUTSTANDINGAMT === null) {
        bill.OUTSTANDINGAMT = bill.balance_carried_forward || 0;
      }
      // Set TOTALBILLAMOUNT to Total Payable (Current + Outstanding)
      bill.TOTALBILLAMOUNT = (bill.THISMONTHBILLAMT || 0) + (bill.OUTSTANDINGAMT || 0);
    }

    const result = await dbCreateBill(bill);

    // Generate and update BILLKEY
    if (result && result.id) {
      const billKey = generateBillKey(result.id);
      await dbUpdateBill(result.id, { BILLKEY: billKey });
      result.BILLKEY = billKey; // Update returned object
    }

    await logSecurityEventAction({
      event: 'Create Bill',
      customerKeyNumber: bill.CUSTOMERKEY || undefined,
      details: { bill }
    });
    return result;
  });
}

export async function closeBillingCycleAction(payload: {
  bill: BillInsert;
  meterUpdate: {
    customerKeyNumber: string;
    previousReading: number;
    currentReading: number;
    outStandingbill: number;
    paymentStatus: string;
  };
}) {
  return await wrap(async () => {
    const session = await checkPermission('billing:close_cycle');

    // Verify meter branch if user doesn't have global access
    const perms = session.permissions || [];
    if (!perms.includes('bill:manage_all')) {
      const meter = await dbGetBulkMeterById(payload.meterUpdate.customerKeyNumber);
      if (!meter || meter.branch_id !== session.branchId) {
        throw new Error('Forbidden: This meter does not belong to your branch');
      }
    }

    // 1. Create the Bill
    const billToInsert = { ...payload.bill };
    // Ensure mappings for direct closure
    if (billToInsert.THISMONTHBILLAMT === undefined || billToInsert.THISMONTHBILLAMT === null) {
      billToInsert.THISMONTHBILLAMT = billToInsert.TOTALBILLAMOUNT;
    }
    if (billToInsert.OUTSTANDINGAMT === undefined || billToInsert.OUTSTANDINGAMT === null) {
      billToInsert.OUTSTANDINGAMT = billToInsert.balance_carried_forward || 0;
    }
    billToInsert.TOTALBILLAMOUNT = (billToInsert.THISMONTHBILLAMT || 0) + (billToInsert.OUTSTANDINGAMT || 0);

    const billResult = await dbCreateBill(billToInsert);

    // Generate and update BILLKEY
    if (billResult && billResult.id) {
      const billKey = generateBillKey(billResult.id);
      await dbUpdateBill(billResult.id, { BILLKEY: billKey });
      billResult.BILLKEY = billKey; // Update returned object
    }

    // 2. Update the Bulk Meter
    const meterResult = await dbUpdateBulkMeter(payload.meterUpdate.customerKeyNumber, {
      previousReading: payload.meterUpdate.previousReading,
      currentReading: payload.meterUpdate.currentReading,
      outStandingbill: payload.meterUpdate.outStandingbill as any,
      paymentStatus: payload.meterUpdate.paymentStatus as any,
    });

    // 3. Log Security Event
    await logSecurityEventAction({
      event: 'Close Billing Cycle',
      customerKeyNumber: payload.meterUpdate.customerKeyNumber,
      details: {
        billId: billResult.id,
        meterUpdate: payload.meterUpdate
      }
    });

    return { bill: billResult, meter: meterResult };
  });
}

export async function runBillingCycleAction(payload: {
  bulkMeterId: string;
  carryBalance: boolean;
  monthYear: string;
}) {
  return await wrap(async () => {
    const session = await checkPermission('billing:close_cycle');

    // 1. Fetch latest data
    const bulkMeter = await dbGetBulkMeterById(payload.bulkMeterId);
    if (!bulkMeter) throw new Error("Bulk meter not found");

    const customers = await dbGetAllCustomers();
    const associatedCustomers = customers.filter(c => c.assigned_bulk_meter_id === payload.bulkMeterId);

    // 2. Calculate Usage
    const bmUsage = (bulkMeter.current_reading ?? 0) - (bulkMeter.previous_reading ?? 0);
    const totalIndivUsage = associatedCustomers.reduce((sum, cust) => sum + ((cust.current_reading ?? 0) - (cust.previous_reading ?? 0)), 0);

    // Rule of 3 Adjustment
    let differenceUsageForCycle = bmUsage - totalIndivUsage;
    if (bmUsage < totalIndivUsage || differenceUsageForCycle <= 0) {
      differenceUsageForCycle = 3;
    } else if (differenceUsageForCycle === 1) {
      differenceUsageForCycle = 3;
    } else if (differenceUsageForCycle === 2) {
      differenceUsageForCycle = 3;
    }

    // 3. Calculate Bill
    const chargeGroup = (bulkMeter.charge_group || 'Non-domestic') as CustomerType;
    const sewerageConn = (bulkMeter.sewerage_connection || 'No') as SewerageConnection;

    const billBreakdown = await calculateBill(
      differenceUsageForCycle,
      chargeGroup,
      sewerageConn,
      bulkMeter.meter_size ?? 0.5,
      payload.monthYear
    );

    const balanceFromPreviousPeriods = bulkMeter.outStandingbill || 0;
    const totalPayableForCycle = billBreakdown.totalBill + balanceFromPreviousPeriods;

    // 4. Aging Calculation (FIFO based on historical bills, considering partial payments)
    const { calculateDebtAging } = await import('./billing-utils');
    const historicalBills = await dbGetBillsByBulkMeterId(payload.bulkMeterId);
    const { debit30, debit30_60, debit60 } = calculateDebtAging(balanceFromPreviousPeriods, historicalBills);


    const periodStartDate = getBillingPeriodStartDate(payload.monthYear);
    const periodEndDate = getBillingPeriodEndDate(payload.monthYear);
    const dueDate = calculateDueDate(periodEndDate);

    // 5. Create Bill
    const billInsert: BillInsert = {
      CUSTOMERKEY: bulkMeter.customerKeyNumber,
      bill_period_start_date: periodStartDate,
      bill_period_end_date: periodEndDate,
      month_year: payload.monthYear,
      PREVREAD: bulkMeter.previous_reading || 0,
      CURRREAD: bulkMeter.current_reading || 0,
      CONS: bmUsage,
      difference_usage: differenceUsageForCycle,
      THISMONTHBILLAMT: billBreakdown.totalBill,
      OUTSTANDINGAMT: balanceFromPreviousPeriods,
      TOTALBILLAMOUNT: totalPayableForCycle, // totalBill + balanceFromPreviousPeriods
      base_water_charge: billBreakdown.baseWaterCharge,
      maintenance_fee: billBreakdown.maintenanceFee,
      sanitation_fee: billBreakdown.sanitationFee,
      sewerage_charge: billBreakdown.sewerageCharge,
      meter_rent: billBreakdown.meterRent,
      vat_amount: billBreakdown.vatAmount,
      balance_carried_forward: balanceFromPreviousPeriods,
      debit_30: debit30,
      debit_30_60: debit30_60,
      debit_60: debit60,
      due_date: dueDate.toISOString(),
      payment_status: payload.carryBalance ? 'Unpaid' : 'Paid',
      status: 'Draft', // New cycles start as drafts
      bill_number: `BILL-${Date.now()}`
    };

    const billResult = await dbCreateBill(billInsert);
    if (billResult && billResult.id) {
      const billKey = generateBillKey(billResult.id);
      await dbUpdateBill(billResult.id, { BILLKEY: billKey });
    }

    // 6. Update Bulk Meter
    const newOutstandingBalance = payload.carryBalance ? totalPayableForCycle : 0;
    const meterUpdate: BulkMeterUpdate = {
      previousReading: bulkMeter.current_reading,
      outStandingbill: newOutstandingBalance as any,
      paymentStatus: payload.carryBalance ? 'Unpaid' as any : 'Paid' as any,
    };

    await dbUpdateBulkMeter(payload.bulkMeterId, meterUpdate);

    await logSecurityEventAction({
      event: 'Run Billing Cycle',
      customerKeyNumber: payload.bulkMeterId,
      details: {
        carryBalance: payload.carryBalance,
        monthYear: payload.monthYear,
        billId: billResult.id
      }
    });

    return { billId: billResult.id, success: true };
  });
}
export async function updateBillAction(id: string, bill: BillUpdate) {
  return await wrap(async () => {
    const session = await checkPermission('bill:update');
    await verifyBillBranchAccess(id, session);
    const result = await dbUpdateBill(id, bill);
    await logSecurityEventAction({
      event: 'Update Bill',
      details: { id, updates: bill }
    });
    return result;
  });
}
export async function deleteBillAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission('bill:delete');
    await verifyBillBranchAccess(id, session);
    await dbDeleteBill(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Bill',
      severity: 'Warning',
      details: { id }
    });
  });
}
export async function getBillByIdAction(id: string) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const role = session.role?.toLowerCase();
    const isTopManagement = ['admin', 'head office management'].includes(role);
    const branchId = !isTopManagement ? session.branchId : undefined;

    return await dbGetBillByIdQuery(id, branchId);
  });
}


export async function submitBillAction(id: string) {
  return await wrap(async () => {
    // Accept bill:submit OR bill:create (creator can always submit their own draft)
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const perms = session.permissions || [];

    if (!(perms.includes('bill:submit') || perms.includes('bill:create') || perms.includes('bill:manage_all'))) {
      throw new Error('Forbidden: Missing permission bill:submit or bill:create');
    }

    await verifyBillBranchAccess(id, session);

    const billRes = await dbGetBillByIdQuery(id);
    const currentStatus = billRes?.status || 'Draft';

    const updatedBill = await dbUpdateBillStatus(id, 'Pending');
    await dbCreateBillWorkflowLog({
      bill_id: id,
      from_status: currentStatus,
      to_status: 'Pending',
      changed_by: session.id
    });
    await logSecurityEventAction({
      event: 'Submit Bill',
      details: { id, from: currentStatus }
    });
    return updatedBill;
  });
}


export async function approveBillAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission('bill:approve');
    await verifyBillBranchAccess(id, session);

    const billRes = await dbGetBillByIdQuery(id);
    const currentStatus = billRes?.status || 'Pending';

    const approvalDate = new Date();
    const bill = await dbUpdateBillStatus(id, 'Approved', approvalDate, session.id);
    await dbCreateBillWorkflowLog({
      bill_id: id,
      from_status: currentStatus,
      to_status: 'Approved',
      changed_by: session.id
    });
    await logSecurityEventAction({
      event: 'Approve Bill',
      details: { id, from: currentStatus }
    });
    return bill;
  });
}

export async function rejectBillAction(id: string, reason: string) {
  return await wrap(async () => {
    const session = await checkPermission('bill:rework');
    await verifyBillBranchAccess(id, session);

    const billRes = await dbGetBillByIdQuery(id);
    const currentStatus = billRes?.status || 'Pending';

    const bill = await dbUpdateBillStatus(id, 'Rework');
    await dbCreateBillWorkflowLog({
      bill_id: id,
      from_status: currentStatus,
      to_status: 'Rework',
      changed_by: session.id,
      reason: reason
    });
    await logSecurityEventAction({
      event: 'Reject Bill',
      severity: 'Warning',
      details: { id, reason, from: currentStatus }
    });
    return bill;
  });
}

export async function postBillAction(id: string) {
  return await wrap(async () => {
    // Standardize: some UIs might call this 'send'
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const perms = session.permissions || [];

    if (!(perms.includes('bill:post') || perms.includes('bill:send') || perms.includes('bill:manage_all'))) {
      throw new Error('Forbidden: Missing permission bill:post or bill:send');
    }

    await verifyBillBranchAccess(id, session);
    const bill = await dbUpdateBillStatus(id, 'Posted');
    await dbCreateBillWorkflowLog({
      bill_id: id,
      from_status: 'Approved',
      to_status: 'Posted',
      changed_by: session.id
    });
    await logSecurityEventAction({
      event: 'Post Bill',
      details: { id }
    });
    return bill;
  });
}

export async function correctBillAction(id: string, reason: string) {
  return await wrap(async () => {
    const session = await checkPermission('bill:correct');
    await verifyBillBranchAccess(id, session);
    const bill = await dbUpdateBillStatus(id, 'Rework');
    await dbCreateBillWorkflowLog({
      bill_id: id,
      from_status: 'Posted',
      to_status: 'Rework',
      changed_by: session.id,
      reason: reason || 'Correction requested'
    });
    await logSecurityEventAction({
      event: 'Correct Bill',
      severity: 'Warning',
      details: { id, reason }
    });
    return bill;
  });
}

export async function getBillWorkflowLogsAction(billId: string) {
  return await wrap(() => dbGetBillWorkflowLogsQuery(billId));
}

export async function getAllIndividualCustomerReadingsAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const role = session.role?.toLowerCase();
    const perms = session.permissions || [];

    // Allow management roles to bypass
    const isManagement = ['admin', 'head office management', 'staff management'].includes(role);

    const hasPerm = isManagement ||
      ['reader', 'staff'].includes(role) ||
      perms.includes('meter_readings_view_all') ||
      perms.includes('meter_readings_view_branch') ||
      perms.includes('dashboard_view_all') ||
      perms.includes('dashboard_view_branch');

    if (!hasPerm) {
      throw new Error('Forbidden: No reading permissions');
    }
    return await dbGetAllIndividualCustomerReadings();
  });
}
export async function createIndividualCustomerReadingAction(reading: IndividualCustomerReadingInsert) {
  return await wrap(async () => {
    const result = await dbCreateIndividualCustomerReading(reading);
    await logSecurityEventAction({
      event: 'Create Indiv. Reading',
      customerKeyNumber: reading.individual_customer_id,
      details: { reading }
    });
    return result;
  });
}
export async function updateIndividualCustomerReadingAction(id: string, reading: IndividualCustomerReadingUpdate) {
  return await wrap(async () => {
    const result = await dbUpdateIndividualCustomerReading(id, reading);
    await logSecurityEventAction({
      event: 'Update Indiv. Reading',
      details: { id, updates: reading }
    });
    return result;
  });
}
export async function deleteIndividualCustomerReadingAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission('meter_readings_delete');
    await dbDeleteIndividualCustomerReading(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Indiv. Reading',
      severity: 'Warning',
      details: { id }
    });
  });
}

export async function getAllBulkMeterReadingsAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const role = session.role?.toLowerCase();
    const perms = session.permissions || [];

    // Allow management roles to bypass
    const isManagement = ['admin', 'head office management', 'staff management'].includes(role);

    const hasPerm = isManagement ||
      ['reader', 'staff'].includes(role) ||
      perms.includes('meter_readings_view_all') ||
      perms.includes('meter_readings_view_branch') ||
      perms.includes('dashboard_view_all') ||
      perms.includes('dashboard_view_branch');

    if (!hasPerm) {
      throw new Error('Forbidden: No reading permissions');
    }
    return await dbGetAllBulkMeterReadings();
  });
}
export async function createBulkMeterReadingAction(reading: BulkMeterReadingInsert) {
  return await wrap(async () => {
    const result = await dbCreateBulkMeterReading(reading);
    await logSecurityEventAction({
      event: 'Create Bulk Reading',
      customerKeyNumber: reading.CUSTOMERKEY,
      details: { reading }
    });
    return result;
  });
}
export async function updateBulkMeterReadingAction(id: string, reading: BulkMeterReadingUpdate) {
  return await wrap(async () => {
    const result = await dbUpdateBulkMeterReading(id, reading);
    await logSecurityEventAction({
      event: 'Update Bulk Reading',
      details: { id, updates: reading }
    });
    return result;
  });
}
export async function deleteBulkMeterReadingAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission('meter_readings_bulk_delete');
    await dbDeleteBulkMeterReading(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Bulk Reading',
      severity: 'Warning',
      details: { id }
    });
  });
}

export async function getAllPaymentsAction() { return await wrap(() => dbGetAllPayments()); }
export async function createPaymentAction(payment: PaymentInsert) {
  return await wrap(async () => {
    // 1. Create Payment
    const result = await dbCreatePayment(payment);

    // 2. Update Bill Status and Meter Balance
    if (payment.bill_id) {
      const totalPaid = await dbGetTotalPaymentsForBill(payment.bill_id);
      const bill = await dbGetBillByIdQuery(payment.bill_id);

      if (bill) {
        const billAmount = Number(bill.TOTALBILLAMOUNT || 0);
        const newPaymentStatus = totalPaid >= (billAmount - 0.01) ? 'Paid' : 'Unpaid';

        await dbUpdateBill(payment.bill_id, {
          amount_paid: totalPaid,
          payment_status: newPaymentStatus
        });

        // 3. Update Bulk Meter Balance if applicable
        if (bill.CUSTOMERKEY) {
          const bulkMeter = await dbGetBulkMeterById(bill.CUSTOMERKEY);
          if (bulkMeter) {
            // Subtract the new payment amount from the meter's outstanding balance
            const currentMeterBalance = Number(bulkMeter.outStandingbill || 0);
            const newMeterBalance = Math.max(0, currentMeterBalance - Number(payment.amount_paid));

            await dbUpdateBulkMeter(bill.CUSTOMERKEY, {
              outStandingbill: newMeterBalance as any,
              paymentStatus: newMeterBalance <= 0.01 ? 'Paid' as any : 'Unpaid' as any
            });
          }
        }
      }
    }

    await logSecurityEventAction({
      event: 'Create Payment',
      customerKeyNumber: payment.individual_customer_id || undefined,
      details: { payment }
    });
    return result;
  });
}
export async function updatePaymentAction(id: string, payment: PaymentUpdate) {
  return await wrap(async () => {
    const result = await dbUpdatePayment(id, payment);
    await logSecurityEventAction({
      event: 'Update Payment',
      details: { id, updates: payment }
    });
    return result;
  });
}
export async function deletePaymentAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission('payments_delete');
    // 1. Fetch payment to find associated bill/meter
    const payments = await dbGetAllPayments();
    const payment = payments.find((p: any) => p.id === id);

    if (payment && payment.bill_id) {
      const bill = await dbGetBillByIdQuery(payment.bill_id);
      if (bill && bill.CUSTOMERKEY) {
        const bulkMeter = await dbGetBulkMeterById(bill.CUSTOMERKEY);
        if (bulkMeter) {
          // Restore the meter's outstanding balance
          const currentMeterBalance = Number(bulkMeter.outStandingbill || 0);
          const restoredMeterBalance = currentMeterBalance + Number(payment.amount_paid);

          await dbUpdateBulkMeter(bill.CUSTOMERKEY, {
            outStandingbill: restoredMeterBalance as any,
            paymentStatus: restoredMeterBalance <= 0.01 ? 'Paid' as any : 'Unpaid' as any
          });
        }
      }
    }

    // 2. Delete the payment
    await dbDeletePayment(id, session.id);

    // 3. Update Bill Status if applicable
    if (payment && payment.bill_id) {
      const totalPaid = await dbGetTotalPaymentsForBill(payment.bill_id);
      const bill = await dbGetBillByIdQuery(payment.bill_id);
      if (bill) {
        const billAmount = Number(bill.TOTALBILLAMOUNT || 0);
        const newPaymentStatus = totalPaid >= (billAmount - 0.01) ? 'Paid' : 'Unpaid';
        await dbUpdateBill(payment.bill_id, {
          amount_paid: totalPaid,
          payment_status: newPaymentStatus
        });
      }
    }

    await logSecurityEventAction({
      event: 'Delete Payment',
      severity: 'Warning',
      details: { id }
    });
  });
}

export async function getAllReportLogsAction() { return await wrap(() => dbGetAllReportLogs()); }
export async function createReportLogAction(log: ReportLogInsert) {
  return await wrap(async () => {
    const result = await dbCreateReportLog(log);
    await logSecurityEventAction({
      event: 'Create Report',
      details: { log }
    });
    return result;
  });
}
export async function updateReportLogAction(id: string, log: ReportLogUpdate) {
  return await wrap(async () => {
    const result = await dbUpdateReportLog(id, log);
    await logSecurityEventAction({
      event: 'Update Report',
      details: { id, updates: log }
    });
    return result;
  });
}
export async function deleteReportLogAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission('reports_delete');
    await dbDeleteReportLog(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Report',
      severity: 'Warning',
      details: { id }
    });
  });
}

export async function getAllNotificationsAction() { return await wrap(() => dbGetAllNotifications()); }
export async function deleteNotificationAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission('notifications_delete');
    await dbDeleteNotification(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Notification',
      severity: 'Warning',
      details: { id }
    });
  });
}
export async function updateNotificationAction(id: string, notification: NotificationUpdate) {
  return await wrap(async () => {
    const result = await dbUpdateNotification(id, notification);
    await logSecurityEventAction({
      event: 'Update Notification',
      details: { id, updates: notification }
    });
    return result;
  });
}
export async function createNotificationAction(notification: NotificationInsert) {
  return await wrap(async () => {
    const result = await dbCreateNotification(notification);
    await logSecurityEventAction({
      event: 'Create Notification',
      details: { notification }
    });
    return result;
  });
}

export async function getAllRolesAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const role = session.role?.toLowerCase();
    const perms = session.permissions || [];

    // Allow management roles to bypass
    const isManagement = ['admin', 'head office management', 'staff management'].includes(role);

    if (!isManagement && !perms.includes('permissions_view') && !['reader', 'staff'].includes(role)) {
      throw new Error('Forbidden: Missing permission permissions_view');
    }

    return await dbGetAllRoles();
  });
}
export async function createRoleAction(role: RoleInsert) {
  return await wrap(async () => {
    await checkPermission('permissions_edit');
    const result = await dbCreateRole(role);
    await logSecurityEventAction({
      event: 'Create Role',
      severity: 'Warning',
      details: { role }
    });
    return result;
  });
}
export async function getAllPermissionsAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const role = session.role?.toLowerCase();
    const perms = session.permissions || [];

    // Allow management roles to bypass
    const isManagement = ['admin', 'head office management', 'staff management'].includes(role);

    if (!isManagement && !perms.includes('permissions_view') && !['reader', 'staff'].includes(role)) {
      throw new Error('Forbidden: Missing permission permissions_view');
    }

    return await dbGetAllPermissions();
  });
}
export const createPermissionAction = async (permission: PermissionInsert) => await wrap(async () => {
  await checkPermission('permissions_edit');
  const result = await dbCreatePermission(permission);
  await logSecurityEventAction({
    event: 'Create Permission',
    severity: 'Warning',
    details: { permission }
  });
  return result;
});
export const updatePermissionAction = async (id: number, permission: PermissionUpdate) => await wrap(async () => {
  await checkPermission('permissions_edit');
  const result = await dbUpdatePermission(id, permission);
  await logSecurityEventAction({
    event: 'Update Permission',
    severity: 'Warning',
    details: { id, updates: permission }
  });
  return result;
});
export const deletePermissionAction = async (id: number) => await wrap(async () => {
  await checkPermission('permissions_edit');
  await dbDeletePermission(id);
  await logSecurityEventAction({
    event: 'Delete Permission',
    severity: 'Critical',
    details: { id }
  });
});
export async function getAllRolePermissionsAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const role = session.role?.toLowerCase();
    const perms = session.permissions || [];

    // Allow management roles to bypass
    const isManagement = ['admin', 'head office management', 'staff management'].includes(role);

    if (!isManagement && !perms.includes('permissions_view') && !['reader', 'staff'].includes(role)) {
      throw new Error('Forbidden: Missing permission permissions_view');
    }

    return await dbGetAllRolePermissions();
  });
}

export async function rpcUpdateRolePermissionsAction(roleId: number, permissionIds: number[]) {
  return await wrap(async () => {
    // 1. Check permission
    await checkPermission('permissions_edit');

    // 2. Perform DB update
    const result = await dbRpcUpdateRolePermissions(roleId, permissionIds);

    // 3. Log security event
    await logSecurityEventAction({
      event: 'Update Role Permissions',
      severity: 'Warning',
      details: { roleId, permissionIds }
    });

    // 4. Revalidate paths to clear caches
    revalidatePath('/admin/roles-and-permissions');
    revalidatePath('/staff/roles-and-permissions');

    return result;
  });
}


export async function getAllTariffsAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const role = session.role?.toLowerCase();
    const perms = session.permissions || [];

    // Allow management roles to bypass
    const isManagement = ['admin', 'head office management', 'staff management'].includes(role);

    if (!isManagement && !perms.includes('tariffs_view') && !['reader', 'staff'].includes(role)) {
      throw new Error('Forbidden: Missing permission tariffs_view');
    }

    return await dbGetAllTariffs();
  });
}
export async function createTariffAction(tariff: TariffInsert) {
  return await wrap(async () => {
    await checkPermission('tariffs_create');
    const result = await dbCreateTariff(tariff);
    await logSecurityEventAction({
      event: 'Create Tariff',
      severity: 'Critical',
      details: { tariff }
    });
    return result;
  });
}
export async function updateTariffAction(customerType: string, effectiveDate: string, tariff: TariffUpdate) {
  return await wrap(async () => {
    await checkPermission('tariffs_edit');
    // Capture current tariff for audit comparison
    const oldTariff = await dbGetTariffByTypeAndDate(customerType, effectiveDate);

    const result = await dbUpdateTariff(customerType, effectiveDate, tariff);

    await logSecurityEventAction({
      event: 'Update Tariff',
      severity: 'Critical',
      details: {
        customerType,
        effectiveDate,
        old_values: oldTariff,
        new_values: tariff
      }
    });
    return result;
  });
}

export async function getAllKnowledgeBaseArticlesAction() {
  return await wrap(async () => {
    await checkPermission('knowledge_base_view');
    return await dbGetAllKnowledgeBaseArticles();
  });
}
export async function createKnowledgeBaseArticleAction(article: KnowledgeBaseArticleInsert) {
  return await wrap(async () => {
    await checkPermission('knowledge_base_manage');
    const result = await dbCreateKnowledgeBaseArticle(article);
    await logSecurityEventAction({
      event: 'Create KB Article',
      details: { article }
    });
    return result;
  });
}
export async function updateKnowledgeBaseArticleAction(id: number, article: KnowledgeBaseArticleUpdate) {
  return await wrap(async () => {
    await checkPermission('knowledge_base_manage');
    const result = await dbUpdateKnowledgeBaseArticle(id, article);
    await logSecurityEventAction({
      event: 'Update KB Article',
      details: { id, updates: article }
    });
    return result;
  });
}
export async function deleteKnowledgeBaseArticleAction(id: number) {
  return await wrap(async () => {
    const session = await checkPermission('knowledge_base_manage');
    await dbDeleteKnowledgeBaseArticle(id, session.id);
    await logSecurityEventAction({
      event: 'Delete KB Article',
      severity: 'Warning',
      details: { id }
    });
  });
}

export async function calculateBillAction(
  consumption: number,
  customerType: CustomerType,
  sewerageConnection: SewerageConnection,
  meterSize: string | number,
  billingMonth: string,
  sewerageCONS?: number,
  baseWaterChargeCONS?: number
) {
  const size = typeof meterSize === 'string' ? parseFloat(meterSize) : meterSize;
  return await wrap(() => calculateBill(consumption, customerType, sewerageConnection, size || 0, billingMonth, sewerageCONS, baseWaterChargeCONS));
}

import { dbLogSecurityEvent } from './db-queries';

export interface LogOptions {
  event: string;
  severity?: 'Info' | 'Warning' | 'Critical';
  customerKeyNumber?: string;
  details?: any;
}

export async function logSecurityEventAction(options: LogOptions | string) {
  return await wrap(async () => {
    const session = await getSession();

    let event: string;
    let severity: 'Info' | 'Warning' | 'Critical' = 'Info';
    let details: any = {};
    let customerKeyNumber: string | undefined;

    if (typeof options === 'string') {
      event = options;
    } else {
      event = options.event;
      severity = options.severity || 'Info';
      details = options.details || {};
      customerKeyNumber = options.customerKeyNumber;
    }

    await dbLogSecurityEvent(
      event,
      session?.email || 'System',
      session?.branchName || 'N/A',
      undefined,
      severity,
      details,
      customerKeyNumber
    );
    return true;
  });
}

// =====================================================
// Customer Portal Actions
// =====================================================

export interface CustomerAuthResult {
  customer_key_number: string | null;
  name: string | null;
  email: string | null;
  phone_number: string | null;
  is_portal_enabled: boolean;
  success: boolean;
  message: string;
}

export async function getCustomerAccountAction(
  customerKeyNumber: string
): Promise<{ data: any | null; error: any }> {
  return await wrap(async () => {
    const dbCustomer = await dbGetCustomerById(customerKeyNumber);
    if (!dbCustomer) return null;

    // Map database fields to UI-expected fields for customer portal
    return {
      ...dbCustomer,
      meterNumber: dbCustomer.METER_KEY || dbCustomer.meterNumber,
      customerKeyNumber: dbCustomer.customerKeyNumber,
      name: dbCustomer.name,
      contractNumber: dbCustomer.contractNumber,
      meterSize: dbCustomer.meterSize,
      currentReading: dbCustomer.currentReading,
      previousReading: dbCustomer.previousReading,
      month: dbCustomer.month,
      specificArea: dbCustomer.specificArea,
      subCity: dbCustomer.subCity,
      woreda: dbCustomer.woreda,
      status: dbCustomer.status,
      customerType: dbCustomer.customerType,
      sewerageConnection: dbCustomer.sewerage_connection,
      charge_group: dbCustomer.charge_group || dbCustomer.customerType,
      email: dbCustomer.email,
      phone_number: dbCustomer.phone_number,
    };
  });
}

export async function getBulkMeterAccountAction(
  customerKeyNumber: string
): Promise<{ data: any | null; error: any }> {
  return await wrap(async () => {
    const dbBulkMeter = await dbGetBulkMeterById(customerKeyNumber);
    if (!dbBulkMeter) return null;

    // Map database fields to UI-expected fields for customer portal
    return {
      ...dbBulkMeter,
      meterNumber: dbBulkMeter.METER_KEY || dbBulkMeter.meterNumber,
      customerKeyNumber: dbBulkMeter.customerKeyNumber,
      name: dbBulkMeter.name,
      contractNumber: dbBulkMeter.contractNumber,
      meterSize: dbBulkMeter.meterSize,
      currentReading: dbBulkMeter.currentReading,
      previousReading: dbBulkMeter.previousReading,
      month: dbBulkMeter.month,
      specificArea: dbBulkMeter.specificArea,
      subCity: dbBulkMeter.subCity,
      woreda: dbBulkMeter.woreda,
      status: dbBulkMeter.status,
      sewerageConnection: dbBulkMeter.sewerage_connection,
      charge_group: dbBulkMeter.charge_group,
    };
  });
}

export async function getCustomerReadingsAction(
  customerKeyNumber: string
): Promise<{ data: IndividualCustomerReading[] | null; error: any }> {
  return await wrap(async () => {
    return await dbGetIndividualCustomerReadingsByCustomer(customerKeyNumber);
  });
}

// Route Server Actions
export async function getAllRoutesAction() {
  return await wrap(() => dbGetAllRoutes());
}

export async function createRouteAction(route: RouteInsert) {
  return await wrap(async () => {
    // Check for any of the authorized permissions
    const hasSettings = await checkPermission('settings_manage').then(() => true).catch(() => false);
    const hasMeterReadings = await checkPermission('meter_readings_view_all').then(() => true).catch(() => false);
    const hasStaffView = await checkPermission('staff_view').then(() => true).catch(() => false);

    if (!hasSettings && !hasMeterReadings && !hasStaffView) {
      throw new Error('Unauthorized: Insufficient permissions to create routes.');
    }
    const result = await dbCreateRoute(route);
    await logSecurityEventAction({ event: 'Create Route', details: { route } });
    return result;
  });
}

export async function updateRouteAction(routeKey: string, routeUpdates: RouteUpdate) {
  return await wrap(async () => {
    // Check for any of the authorized permissions
    const hasSettings = await checkPermission('settings_manage').then(() => true).catch(() => false);
    const hasMeterReadings = await checkPermission('meter_readings_view_all').then(() => true).catch(() => false);
    const hasStaffView = await checkPermission('staff_view').then(() => true).catch(() => false);

    if (!hasSettings && !hasMeterReadings && !hasStaffView) {
      throw new Error('Unauthorized: Insufficient permissions to update routes.');
    }
    const result = await dbUpdateRoute(routeKey, routeUpdates);
    await logSecurityEventAction({ event: 'Update Route', details: { routeKey, routeUpdates } });
    return result;
  });
}

export async function deleteRouteAction(routeKey: string) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    // Check for any of the authorized permissions
    const hasSettings = await checkPermission('settings_manage').then(() => true).catch(() => false);
    const hasMeterReadings = await checkPermission('meter_readings_view_all').then(() => true).catch(() => false);
    const hasStaffView = await checkPermission('staff_view').then(() => true).catch(() => false);

    if (!hasSettings && !hasMeterReadings && !hasStaffView) {
      throw new Error('Unauthorized: Insufficient permissions to delete routes.');
    }
    await dbDeleteRoute(routeKey, session.id);
    await logSecurityEventAction({ event: 'Delete Route', severity: 'Warning', details: { routeKey } });
  });
}

export async function getRouteByKeyAction(routeKey: string) {
  return await wrap(() => dbGetRouteByKey(routeKey));
}

export async function getBulkMeterReadingsAction(
  customerKeyNumber: string
): Promise<{ data: BulkMeterReading[] | null; error: any }> {
  return await wrap(async () => {
    return await dbGetBulkMeterReadingsByMeter(customerKeyNumber);
  });
}

export async function getCustomerBillsAction(
  customerKeyNumber: string
): Promise<{ data: any[] | null; error: any }> {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const hasManageAll = session.permissions?.includes('bill:manage_all');
    const branchId = !hasManageAll ? session.branchId : undefined;

    return await dbGetBillsByCustomerId(customerKeyNumber, branchId);
  });
}

export async function getBulkMeterBillsAction(
  customerKeyNumber: string
): Promise<{ data: any[] | null; error: any }> {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const isTopManagement = ['admin', 'head office management'].includes(session.role?.toLowerCase());
    const branchId = !isTopManagement ? session.branchId : undefined;

    return await dbGetBillsByBulkMeterId(customerKeyNumber, branchId);
  });
}

// =====================================================
// Customer Session Management Actions
// =====================================================

export async function createCustomerSessionAction(session: {
  customer_key_number: string;
  customer_type: string;
  ip_address?: string;
  device_name?: string;
  location?: string;
}) {
  return await wrap(async () => {
    const result = await dbCreateCustomerSession(session);
    await logSecurityEventAction({
      event: 'Customer Login',
      customerKeyNumber: session.customer_key_number,
      details: { device_name: session.device_name, location: session.location }
    });
    return result;
  });
}

export async function revokeCustomerSessionAction(sessionId: string) {
  return await wrap(async () => {
    const result = await dbRevokeCustomerSession(sessionId);
    await logSecurityEventAction({
      event: 'Customer Session Revoked',
      severity: 'Warning',
      details: { sessionId }
    });
    return result;
  });
}

export async function getActiveCustomerSessionsAction() {
  return await wrap(() => dbGetActiveCustomerSessions());
}

export async function validateCustomerSessionAction(sessionId: string) {
  return await wrap(() => dbIsCustomerSessionValid(sessionId));
}

export async function logCustomerPageViewAction(sessionId: string, pageName: string) {
  return await wrap(() => dbLogCustomerPageView(sessionId, pageName));
}

// =====================================================
// Fault Code Management Actions
// =====================================================

export async function getAllFaultCodesAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const role = session.role?.toLowerCase();
    const perms = session.permissions || [];

    // Allow management roles to bypass
    const isManagement = ['admin', 'head office management', 'staff management'].includes(role);

    if (!isManagement && !perms.includes('settings_view') && !['reader', 'staff'].includes(role)) {
      throw new Error('Forbidden: Missing permission settings_view');
    }

    return await dbGetAllFaultCodes();
  });
}
export async function getFaultCodeByIdAction(id: string) { return await wrap(() => dbGetFaultCodeById(id)); }

export async function createFaultCodeAction(faultCode: FaultCodeInsert) {
  return await wrap(async () => {
    await checkPermission('settings_manage');
    const result = await dbCreateFaultCode(faultCode);
    await logSecurityEventAction({
      event: 'Create Fault Code',
      details: { faultCode }
    });
    return result;
  });
}

export async function updateFaultCodeAction(id: string, faultCode: FaultCodeUpdate) {
  return await wrap(async () => {
    await checkPermission('settings_manage');
    const result = await dbUpdateFaultCode(id, faultCode);
    await logSecurityEventAction({
      event: 'Update Fault Code',
      details: { id, updates: faultCode }
    });
    return result;
  });
}

export async function deleteFaultCodeAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission('settings_manage');
    await dbDeleteFaultCode(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Fault Code',
      severity: 'Warning',
      details: { id }
    });
  });
}

// =====================================================
// Recycle Bin Actions
// =====================================================

export async function getRecycleBinItemsAction() {
  return await wrap(async () => {
    await checkPermission('settings_view');
    return await dbGetRecycleBinItems();
  });
}

export async function restoreFromRecycleBinAction(recycleBinId: string) {
  return await wrap(async () => {
    const session = await checkPermission('settings_manage');
    const result = await dbRestoreFromRecycleBin(recycleBinId);
    await logSecurityEventAction({
      event: 'Restore from Recycle Bin',
      details: { recycleBinId }
    });
    revalidatePath('/admin/recycle-bin');
    return result;
  });
}

export async function permanentlyDeleteFromRecycleBinAction(recycleBinId: string) {
  return await wrap(async () => {
    const session = await checkPermission('settings_manage');
    const result = await dbPermanentlyDeleteFromRecycleBin(recycleBinId);
    await logSecurityEventAction({
      event: 'Permanently Delete from Recycle Bin',
      severity: 'Critical',
      details: { recycleBinId }
    });
    revalidatePath('/admin/recycle-bin');
    return result;
  });
}

// =====================================================

export async function getDashboardMetricsAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms = session.permissions || [];
    if (!perms.includes('dashboard_view_all') && !perms.includes('dashboard_view_branch')) {
      throw new Error('Forbidden: Missing dashboard permissions');
    }
    return await dbGetDashboardMetrics();
  });
}

export async function getLatestPermissionsAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    return await dbGetStaffPermissions(session.id);
  });
}

export async function getDistinctBillingMonthsAction() {
  try {
    const rows: any = await dbGetDistinctBillingMonths();
    const months = rows.map((r: any) => r.month_year || r.month).filter(Boolean);
    // Ensure uniqueness and sort DESC
    const uniqueMonths = Array.from(new Set(months)).sort().reverse();
    return { data: uniqueMonths };
  } catch (error) {
    console.error("Failed to fetch distinct months", error);
    return { error: "Failed to fetch distinct months" };
  }
}

export async function getBillsByMonthAction(monthYear: string) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const isTopManagement = ['admin', 'head office management'].includes(session.role?.toLowerCase());
    const branchId = !isTopManagement ? session.branchId : undefined;

    return await dbGetBillsWithBulkMeterInfoByMonth(monthYear, branchId);
  });
}

export async function getMostRecentBillsForBulkMetersAction(customerKeys: string[]) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const role = session.role?.toLowerCase();
    const isTopManagement = ['admin', 'head office management'].includes(role);
    const branchId = !isTopManagement ? session.branchId : undefined;

    return await dbGetMostRecentBillsForBulkMeters(customerKeys, branchId);
  });
}

export async function syncAllBillsAgingDebtAction() {
  return await wrap(async () => {
    const session = await checkPermission('billing:close_cycle');
    const role = session.role?.toLowerCase();
    const isTopManagement = ['admin', 'head office management'].includes(role);
    const branchId = !isTopManagement ? session.branchId : undefined;

    const bills = await dbGetAllBills(branchId);
    const { calculateDebtAging } = await import('./billing-utils');

    let count = 0;
    for (const bill of bills) {
      if (!bill.CUSTOMERKEY) continue;

      // Get all bills for this meter to reconstruct the history
      const historicalBills = await dbGetBillsByBulkMeterId(bill.CUSTOMERKEY, branchId);

      // Filter for bills that were created BEFORE this specific bill
      const olderBills = historicalBills.filter((b: any) => {
        const bDate = new Date(b.created_at || b.createdAt || 0);
        const billDate = new Date(bill.created_at || bill.createdAt || 0);
        return bDate.getTime() < billDate.getTime();
      }).sort((a: any, b: any) => {
        const aDate = new Date(a.created_at || a.createdAt || 0);
        const bDate = new Date(b.created_at || b.createdAt || 0);
        return bDate.getTime() - aDate.getTime(); // Most recent first
      });

      // DYNAMIC RECONSTRUCTION: Sum up unpaid portions of all older bills
      const reconstructedOutstanding = olderBills.reduce((sum: number, b: any) => {
        const monthlyAmt = (b.THISMONTHBILLAMT !== null && b.THISMONTHBILLAMT !== undefined)
          ? Number(b.THISMONTHBILLAMT)
          : Number(b.TOTALBILLAMOUNT);
        const unpaid = Math.max(0, monthlyAmt - Number(b.amount_paid || 0));
        return sum + unpaid;
      }, 0);

      const { debit30, debit30_60, debit60 } = calculateDebtAging(reconstructedOutstanding, olderBills);

      // Prepare updates
      const updates: any = {
        debit_30: debit30,
        debit_30_60: debit30_60,
        debit_60: debit60,
        OUTSTANDINGAMT: reconstructedOutstanding
      };

      // Ensure THISMONTHBILLAMT is correctly derived if missing
      const currentMonthBill = (bill.THISMONTHBILLAMT !== null && bill.THISMONTHBILLAMT !== undefined)
        ? Number(bill.THISMONTHBILLAMT)
        : Number(bill.TOTALBILLAMOUNT);

      if (bill.THISMONTHBILLAMT === null || bill.THISMONTHBILLAMT === undefined) {
        updates.THISMONTHBILLAMT = currentMonthBill;
      }

      // Update TOTALBILLAMOUNT to reflect the sum (Total Payable)
      updates.TOTALBILLAMOUNT = currentMonthBill + reconstructedOutstanding;

      await dbUpdateBill(bill.id, updates);
      count++;
    }

    revalidatePath('/admin/bulk-meters');
    revalidatePath('/admin/reports');
    return { success: true, updatedCount: count };
  });
}
