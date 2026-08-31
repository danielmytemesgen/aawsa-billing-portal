'use server'
import { PERMISSIONS } from '@/lib/constants/auth';
import { canCreateMeterReadingForType } from '@/lib/meter-reading-permissions';
import { format } from 'date-fns';
import fs from 'fs';
import {
  dbCreateBranch,
  dbDeleteBranch,
  dbGetAllBranches,
  dbUpdateBranch,
  dbCreateIndividualCustomer,
  dbDeleteCustomer,
  dbGetAllCustomers,
  dbGetCustomersByBulkMeterId,
  dbUpdateCustomer,
  dbCreateBulkMeter,
  dbDeleteBulkMeter,
  dbGetAllBulkMeters,
  dbCountBulkMeters,
  dbGetBulkMetersSummary,
  dbUpdateBulkMeter,
  dbBatchRolloverBulkMeters,
  dbBatchRolloverIndividualCustomersOfBulkMeters,
  dbBatchRolloverIndividualCustomers,
  dbCountCustomers,

  dbGetCustomersSummary,
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
  dbLogSecurityEvent,
  dbGetTariffByTypeAndDate,
  dbCreateTariff,
  dbCreateBillingJob,
  dbUpdateBillingJob,
  dbGetBillingJob,
  dbGetActiveBillingJobs,
  dbGetUnprocessedMetersForJob,
  dbGetUnprocessedIndividualCustomersForJob,
  dbBatchInsertBills,
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
  dbRevokeStaffSession,
  dbReactivateCustomerSession,
  dbReactivateStaffSession,
  dbIsCustomerSessionValid,
  dbGetCustomerSession,
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
  dbGetUnsettledBillsPaginated,
  dbGetBillsByCustomerKey,
  dbGetBillsPaginated,
  dbGetBillsStatusCounts,
  dbGetUnsettledBillsCount,
  dbGetPaidBillsPaginated,
  dbGetPaidBillsCount,
  dbBatchUpdatePaymentsFromCsv,
  dbGetAllSentBillsPaginated,
  dbGetAllSentBillsCount,
  dbArchiveOldRecords,
  dbGetSystemStats,
  dbRunDataAudit,
  dbUpsertSpatialRecord,
  dbGetSystemSetting,
  dbUpdateSystemSetting,
  dbGetLatestReadingsByMeters,
  dbCreateMeterReadingPhoto,
  dbGetPhotosByReadingId,
  dbSyncAgingForCustomer,
  dbGetMeterCreditBalance,
  dbGetMeterCredit,
  dbCreateCredit,
  dbVoidCredit,
  type CreditLedgerEntry,
} from './db-queries';
import { roundMoney, MONEY_EPSILON } from './credit-utils';
import { withTransaction, query } from './db';

import { calculateBill, calculateBillFromTariff, type CustomerType, type SewerageConnection } from './billing';
import { encrypt, getSession } from './auth';
// Removed unused redirect import
import { revalidatePath } from 'next/cache';
import { getBillingPeriodStartDate, getBillingPeriodEndDate, calculateDueDate } from './billing-config';

import type { Database } from '@/types/db';
import type {
  RoleRow, PermissionRow, RolePermissionRow, Branch, BulkMeterRow, IndividualCustomer,
  StaffMember, Bill, IndividualCustomerReading, BulkMeterReading, Payment, ReportLog,
  NotificationRow, TariffRow, KnowledgeBaseArticleRow,
  BranchInsert, BranchUpdate, BulkMeterInsert, BulkMeterUpdate,
  IndividualCustomerInsert, IndividualCustomerUpdate,
  StaffMemberInsert, StaffMemberUpdate, BillInsert, BillUpdate,
  IndividualCustomerReadingInsert, IndividualCustomerReadingUpdate,
  BulkMeterReadingInsert, BulkMeterReadingUpdate,
  PaymentInsert, PaymentUpdate, ReportLogInsert, ReportLogUpdate,
  NotificationInsert, NotificationUpdate, TariffInsert, TariffUpdate,
  KnowledgeBaseArticleInsert, KnowledgeBaseArticleUpdate,
  FaultCodeRow, FaultCodeInsert, FaultCodeUpdate,
  RouteRow, RouteInsert, RouteUpdate,
  LogOptions, CustomerAuthResult,
} from './action-types';

export type ReadingPeriodStatus = 'Open' | 'Closed' | 'Ready for New Reading';

export interface ReadingPeriodDetails {
  status: ReadingPeriodStatus;
  startDate: string;
  endDate: string;
  startDay: number;
  endDay: number;
  isRecurring: boolean;
}

export async function getReadingPeriodDetailsAction(): Promise<ReadingPeriodDetails> {
  const rawStatus = (await dbGetSystemSetting('reading_period_status')) as ReadingPeriodStatus || null;
  const rawStart = (await dbGetSystemSetting('reading_period_start_date')) || '';
  const rawEnd = (await dbGetSystemSetting('reading_period_end_date')) || '';
  const rawStartDay = await dbGetSystemSetting('reading_period_start_day');
  const rawEndDay = await dbGetSystemSetting('reading_period_end_day');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayStr = format(now, 'yyyy-MM-dd');

  let startDay = 1;
  if (rawStartDay && !isNaN(parseInt(rawStartDay))) {
    startDay = parseInt(rawStartDay);
  } else if (rawStart && rawStart.length >= 10) {
    const dayFromDate = parseInt(rawStart.slice(8, 10));
    if (!isNaN(dayFromDate)) startDay = dayFromDate;
  }

  let endDay = 20;
  if (rawEndDay && !isNaN(parseInt(rawEndDay))) {
    endDay = parseInt(rawEndDay);
  } else if (rawEnd && rawEnd.length >= 10) {
    const dayFromDate = parseInt(rawEnd.slice(8, 10));
    if (!isNaN(dayFromDate)) endDay = dayFromDate;
  }

  startDay = Math.max(1, Math.min(31, startDay));
  endDay = Math.max(1, Math.min(31, endDay));

  const lastDayOfCurrentMonth = new Date(year, month + 1, 0).getDate();

  let effectiveStartDateObj: Date;
  let effectiveEndDateObj: Date;

  if (endDay >= startDay) {
    // Standard same-month cycle (e.g. Day 1 to Day 14)
    const effectiveStartDayNum = Math.min(startDay, lastDayOfCurrentMonth);
    const effectiveEndDayNum = Math.min(endDay, lastDayOfCurrentMonth);
    effectiveStartDateObj = new Date(year, month, effectiveStartDayNum);
    effectiveEndDateObj = new Date(year, month, effectiveEndDayNum);
  } else {
    // Cross-month cycle (e.g. Day 25 of month M to Day 5 of month M+1)
    const currentDay = now.getDate();
    if (currentDay <= endDay) {
      // Currently in the tail of the cycle (started in previous month, ending this month)
      const prevMonthObj = new Date(year, month - 1, 1);
      const lastDayOfPrevMonth = new Date(prevMonthObj.getFullYear(), prevMonthObj.getMonth() + 1, 0).getDate();
      const effectiveStartDayNum = Math.min(startDay, lastDayOfPrevMonth);
      const effectiveEndDayNum = Math.min(endDay, lastDayOfCurrentMonth);

      effectiveStartDateObj = new Date(prevMonthObj.getFullYear(), prevMonthObj.getMonth(), effectiveStartDayNum);
      effectiveEndDateObj = new Date(year, month, effectiveEndDayNum);
    } else {
      // Currently before or in the head of the cycle (starts this month, ending next month)
      const nextMonthObj = new Date(year, month + 1, 1);
      const lastDayOfNextMonth = new Date(nextMonthObj.getFullYear(), nextMonthObj.getMonth() + 1, 0).getDate();
      const effectiveStartDayNum = Math.min(startDay, lastDayOfCurrentMonth);
      const effectiveEndDayNum = Math.min(endDay, lastDayOfNextMonth);

      effectiveStartDateObj = new Date(year, month, effectiveStartDayNum);
      effectiveEndDateObj = new Date(nextMonthObj.getFullYear(), nextMonthObj.getMonth(), effectiveEndDayNum);
    }
  }

  const startDateStr = format(effectiveStartDateObj, 'yyyy-MM-dd');
  const endDateStr = format(effectiveEndDateObj, 'yyyy-MM-dd');

  // Dynamically compute reading period status from auto-recurring schedule dates:
  // - Open: Today is between startDate and endDate (inclusive)
  // - Ready for New Reading: Today is before startDate
  // - Closed: Today is after endDate
  let computedStatus: ReadingPeriodStatus;
  if (todayStr >= startDateStr && todayStr <= endDateStr) {
    computedStatus = 'Open';
  } else if (todayStr < startDateStr) {
    computedStatus = 'Ready for New Reading';
  } else {
    computedStatus = 'Closed';
  }

  return {
    status: computedStatus,
    startDate: startDateStr,
    endDate: endDateStr,
    startDay,
    endDay,
    isRecurring: true,
  };
}

export async function getReadingPeriodStatusAction(): Promise<ReadingPeriodStatus> {
  const details = await getReadingPeriodDetailsAction();
  return details.status;
}

export async function updateReadingPeriodStatusAction(
  status: ReadingPeriodStatus,
  startDate?: string,
  endDate?: string,
  startDayInput?: number | string,
  endDayInput?: number | string
) {
  const session = await getSession();
  if (!session || !session.id) {
    throw new Error("Unauthorized: Invalid session");
  }
  await dbUpdateSystemSetting('reading_period_status', status);

  if (startDate !== undefined) {
    await dbUpdateSystemSetting('reading_period_start_date', startDate);
    if (!startDayInput && startDate.length >= 10) {
      const parsed = parseInt(startDate.slice(8, 10));
      if (!isNaN(parsed)) startDayInput = parsed;
    }
  }

  if (endDate !== undefined) {
    await dbUpdateSystemSetting('reading_period_end_date', endDate);
    if (!endDayInput && endDate.length >= 10) {
      const parsed = parseInt(endDate.slice(8, 10));
      if (!isNaN(parsed)) endDayInput = parsed;
    }
  }

  if (startDayInput !== undefined && startDayInput !== null) {
    await dbUpdateSystemSetting('reading_period_start_day', String(startDayInput));
  }

  if (endDayInput !== undefined && endDayInput !== null) {
    await dbUpdateSystemSetting('reading_period_end_day', String(endDayInput));
  }

  revalidatePath('/admin');
  revalidatePath('/staff');
  return { success: true };
}

export async function updateReadingPeriodDetailsAction(payload: {
  status: ReadingPeriodStatus;
  startDate?: string;
  endDate?: string;
  startDay?: number | string;
  endDay?: number | string;
}) {
  return await updateReadingPeriodStatusAction(
    payload.status,
    payload.startDate,
    payload.endDate,
    payload.startDay,
    payload.endDay
  );
}

// Internal helper — PublicTables is only needed internally now that all types are in action-types.ts
type PublicTables = Database['public']['Tables'];

const generateBillKey = (billId: string) => {
  const idHex = (billId || "").replace(/-/g, '').substring(0, 8);
  const idNumeric = parseInt(idHex, 16);
  return isNaN(idNumeric) ? "BBPT-0000000000" : `BBPT-${String(idNumeric).padStart(10, '0')}`;
};

/**
 * Determines the effective branch ID to filter by, enforcing permission-based access.
 *
 * Rules:
 * 1. If the session user has the specified permissionViewAll (or superadmin '*'),
 *    they can see cross-branch data (or apply an explicit optionsBranchId filter if provided).
 * 2. If the session user lacks permissionViewAll and is assigned to a specific branch,
 *    they are locked to their assigned branchId.
 * 3. Otherwise, apply any explicit optionsBranchId filter provided.
 */
function getEffectiveBranchId(session: any, optionsBranchId?: string, permissionViewAll?: string): string | undefined {
  const perms = session?.permissions || [];
  const role = (session?.role || '').toLowerCase();

  // Check if user has wildcard or the specific view_all permission
  const hasViewAll = 
    perms.includes('*') || 
    perms.includes('all') || 
    perms.includes('admin') || 
    (permissionViewAll && perms.includes(permissionViewAll));

  if (hasViewAll) {
    // User has permission to see ALL branches!
    // Return optionsBranchId if explicitly set (and not 'all'), otherwise undefined (all branches)
    return (optionsBranchId && optionsBranchId !== 'all') ? optionsBranchId : undefined;
  }

  // User lacks view_all permission — restrict to their assigned branch if present
  if (session?.branchId && session.branchId !== 'all') {
    return session.branchId;
  }

  // Fallback to explicit options filter if provided
  return (optionsBranchId && optionsBranchId !== 'all') ? optionsBranchId : undefined;
}


// Internal-only DB type aliases (not re-exported — all public type exports live in action-types.ts)
type RoleInsert = PublicTables['roles']['Insert'];
type PermissionInsert = PublicTables['permissions']['Insert'];
type PermissionUpdate = PublicTables['permissions']['Update'];


// FaultCode and Route types are defined in action-types.ts — imported above.

const wrap = async <T>(fn: () => Promise<T>) => {
  try {
    const data = await fn();
    const baseResult: any = { success: true, data, error: null };
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return { ...baseResult, ...data };
    }
    return baseResult;
  } catch (e) {
    console.error("Server Action Error in wrap:", e);

    const errorMessage = e instanceof Error ? e.message : String(e);
    const isAccessError = errorMessage.startsWith('Forbidden:') || errorMessage.startsWith('Unauthorized');
    if (isAccessError) {
      try {
        const session = await getSession();
        await dbLogSecurityEvent(
          errorMessage.startsWith('Unauthorized') ? 'Unauthorized Access Attempt' : 'Permission Denied',
          session?.email || 'Anonymous',
          session?.branchName || session?.branchId || 'N/A',
          undefined,
          'warning',
          {
            action: fn.name || 'server-action',
            reason: errorMessage,
            sessionId: session?.id,
            permissions: session?.permissions,
          }
        );
      } catch (logError) {
        console.warn('Failed to log permission denial event:', logError);
      }
    }

    // Write to file for immediate visibility
    try {
      fs.appendFileSync('server-error.log', new Date().toISOString() + ' : ' + (e instanceof Error ? e.stack : String(e)) + '\n');
    } catch (fsErr) { }

    // Ensure only serializable primitives are returned (no Error objects)
    return { success: false, data: null, error: { message: errorMessage } } as any;
  }
};

async function logPermissionDenial(reason: string, permission?: string, session?: any) {
  try {
    await dbLogSecurityEvent(
      'Permission Denied',
      session?.email || 'Anonymous',
      session?.branchName || session?.branchId || session?.branch || 'N/A',
      undefined,
      'warning',
      {
        reason,
        requiredPermission: permission,
        permissions: session?.permissions,
        sessionId: session?.id,
      }
    );
  } catch (logError) {
    console.warn('Failed to log permission denial:', logError);
  }
}

export async function checkPermission(permission?: string) {
  const session = await getSession();
  if (!session || !session.id) {
    await logPermissionDenial('Unauthorized access attempt to checkPermission', permission, session);
    throw new Error('User not authenticated');
  }

  // Refresh permissions from DB to avoid staleness
  const perms = await dbGetStaffPermissions(session.id);
  
  // Granular RBAC: Check if the permission exists in the user's assigned permissions.
  // Bypass if user has 'bill:manage_all' and it's a bill-related permission
  if (permission && perms.includes('bill:manage_all') && permission.startsWith('bill:')) {
    return { ...session, permissions: perms };
  }

  if (permission && !perms.includes(permission) && !perms.includes('*') && !perms.includes('all') && !perms.includes('admin')) {
    await logPermissionDenial(`Missing permission ${permission}`, permission, { ...session, permissions: perms });
    throw new Error(`Forbidden: Missing permission ${permission}`);
  }

  return { ...session, permissions: perms };
}

/**
 * Checks that the logged-in user has AT LEAST ONE of the given permissions.
 * Throws if they have none. Returns the session + full permissions on success.
 *
 * Use this when multiple different permissions should all grant access to the
 * same action (e.g. a dedicated permission OR a broader catch-all permission).
 */
export async function checkPermissionAny(...permissions: string[]) {
  const session = await getSession();
  if (!session || !session.id) {
    throw new Error('User not authenticated');
  }
  const perms = await dbGetStaffPermissions(session.id);

  // bill:manage_all bypasses any bill: permission in the list
  if (perms.includes('bill:manage_all') && permissions.some(p => p.startsWith('bill:'))) {
    return { ...session, permissions: perms };
  }

  const granted = permissions.some(p => perms.includes(p));
  if (!granted) {
    const attempted = permissions.join(' | ');
    await logPermissionDenial(`Missing all of: ${attempted}`, attempted, { ...session, permissions: perms });
    throw new Error(`Forbidden: requires one of [${attempted}]`);
  }
  return { ...session, permissions: perms };
}

/**
 * Asserts access to a specific customer/bulk-meter resource for RBAC enforcement.
 *
 * Access is granted if EITHER:
 *   (a) A valid staff session exists with the appropriate view permission, OR
 *   (b) A valid customer session is provided whose customer_key_number matches the requested resource.
 *
 * @param customerKeyNumber  Target customer key the caller wants to access
 * @param customerSessionId  Optional customer portal session id from localStorage
 * @param type               'individual' or 'bulk' to choose the appropriate staff view permission
 * @returns the caller context: { kind: 'staff' | 'customer', session, perms }
 * @throws Error if neither staff nor customer access can be proven.
 */
export async function assertCustomerAccess(
  customerKeyNumber: string,
  customerSessionId?: string,
  type: 'individual' | 'bulk' = 'individual'
) {
  // 1) Staff path — check permissions if a staff session exists
  const staffSession = await getSession();
  if (staffSession && staffSession.id) {
    const perms = await dbGetStaffPermissions(staffSession.id);
    const viewAll = type === 'bulk' ? PERMISSIONS.BULK_METERS_VIEW_ALL : PERMISSIONS.CUSTOMERS_VIEW_ALL;
    const viewBranch = type === 'bulk' ? PERMISSIONS.BULK_METERS_VIEW_BRANCH : PERMISSIONS.CUSTOMERS_VIEW_BRANCH;
    if (perms.includes(viewAll) || perms.includes(viewBranch) || perms.includes('bill:manage_all')) {
      return { kind: 'staff' as const, session: { ...staffSession, permissions: perms }, perms };
    }
  }

  // 2) Customer path — require valid session matching the requested customerKeyNumber
  if (customerSessionId) {
    const cSession = await dbGetCustomerSession(customerSessionId);
    if (cSession && cSession.customer_key_number === customerKeyNumber) {
      return { kind: 'customer' as const, session: cSession, perms: [] as string[] };
    }
  }

  throw new Error('Forbidden: You do not have access to this resource');
}

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

/**
 * verifyEntityBranchAccess — Ensures a branch-scoped user can only mutate entities
 * that belong to their own branch.
 *
 * @param entityBranchId  The branch_id recorded on the entity being mutated.
 * @param session         The calling user's session (from checkPermission).
 * @param viewAllPermission  The permission that grants cross-branch access (e.g. CUSTOMERS_VIEW_ALL).
 * @param entityLabel     Human-readable label for error messages (e.g. 'customer', 'route').
 */
function verifyEntityBranchAccess(
  entityBranchId: string | undefined | null,
  session: any,
  viewAllPermission: string,
  entityLabel = 'record'
) {
  const perms: string[] = session?.permissions || [];

  // Global admins and users with cross-branch view permission are unrestricted
  const hasGlobalAccess =
    perms.includes('*') ||
    perms.includes('all') ||
    perms.includes('admin') ||
    perms.includes(viewAllPermission);

  if (hasGlobalAccess) return;

  // Branch-scoped user: their session must match the entity's branch
  const userBranchId = session?.branchId;
  if (!userBranchId || userBranchId === 'all') {
    // No branch assigned — allow (Admin-level accounts without a branch restriction)
    return;
  }

  if (!entityBranchId || entityBranchId !== userBranchId) {
    throw new Error(
      `Forbidden: You can only modify ${entityLabel} data within your own branch`
    );
  }
}

export async function getBranchByIdAction(id: string) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.BRANCHES_VIEW);
    return await dbGetBranchById(id);
  });
}

export async function getAllBranchesAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    return await dbGetAllBranches();
  });
}

/**
 * Returns a minimal { id, name } list of all branches for any authenticated user.
 * No branches_view permission required — used for UI label resolution (e.g. notification bell).
 */
export async function getBranchesLookupAction(): Promise<{ data: { id: string; name: string }[] | null; error: any }> {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const rows = await dbGetAllBranches();
    return rows.map((b: any) => ({ id: b.id, name: b.name }));
  });
}
export async function createBranchAction(branch: BranchInsert) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.BRANCHES_CREATE);
    const result = await dbCreateBranch(branch);
    await logSecurityEventAction({ event: 'Create Branch', details: { branch } });
    return result;
  });
}
export async function updateBranchAction(id: string, branch: BranchUpdate) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.BRANCHES_UPDATE);
    const result = await dbUpdateBranch(id, branch);
    await logSecurityEventAction({ event: 'Update Branch', details: { id, updates: branch } });
    return result;
  });
}
export async function deleteBranchAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.BRANCHES_DELETE);
    await dbDeleteBranch(id, session.id);
    await logSecurityEventAction({ event: 'Delete Branch', severity: 'warning', details: { id } });
  });
}

export async function getAllCustomersAction(options?: { branchId?: string; limit?: number; offset?: number; searchTerm?: string; excludePending?: boolean; routeKey?: string; status?: string }) {
  return await wrap(async () => {
    const session = await checkPermission();
    const branchId = getEffectiveBranchId(session, options?.branchId, PERMISSIONS.CUSTOMERS_VIEW_ALL);

    // Reader isolation: field readers (with routes_view_assigned or meter_readings_create perms)
    // but without global view-all — scope to their assigned routes only
    const perms = session.permissions || [];
    const hasGlobalView = perms.includes(PERMISSIONS.CUSTOMERS_VIEW_ALL) || perms.includes('*') || perms.includes('all') || perms.includes('admin');
    const hasBranchView = perms.includes('customers_view_branch') || perms.includes('staff_view_branch');
    const isFieldReader = !hasGlobalView && !hasBranchView && (
      perms.includes(PERMISSIONS.ROUTES_VIEW_ASSIGNED) ||
      perms.includes('meter_readings_create') ||
      perms.includes('meter_readings_create_individual') ||
      perms.includes('meter_readings_view_individual')
    );
    const readerId = isFieldReader ? session.id : undefined;

    return await dbGetAllCustomers({ branchId, readerId, ...options });
  });
}

export async function getCustomersCountAction(searchTerm?: string, excludePending?: boolean, branchId?: string, status?: string) {
  return await wrap(async () => {
    const session = await checkPermission();
    const resolvedBranchId = getEffectiveBranchId(session, branchId, PERMISSIONS.CUSTOMERS_VIEW_ALL);
    return await dbCountCustomers({ branchId: resolvedBranchId, searchTerm, excludePending, status });
  });
}

export async function getCustomersSummaryAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const branchId = getEffectiveBranchId(session, undefined, 'customers_view_all');
    return await dbGetCustomersSummary(branchId);
  });
}

export async function createCustomerAction(customer: IndividualCustomerInsert) {
  return await wrap(async () => {
    const session = await checkPermissionAny(PERMISSIONS.CUSTOMERS_CREATE, PERMISSIONS.DATA_ENTRY_ACCESS);
    // All data entry creations default to Pending Approval
    customer.status = customer.status || 'Pending Approval';
    const perms = session.permissions || [];
    const hasGlobalView = perms.includes('*') || perms.includes('all') || perms.includes('admin') || perms.includes(PERMISSIONS.CUSTOMERS_VIEW_ALL);
    if (!hasGlobalView && session.branchId && session.branchId !== 'all') {
      customer.branch_id = session.branchId;
    } else {
      // For non-restricted users, ensure branchId from form is mapped to branch_id
      customer.branch_id = customer.branch_id || (customer as any).branchId;
    }

    const spatialData = {
      xCoordinate: (customer as any).xCoordinate || (customer as any).x_coordinate,
      yCoordinate: (customer as any).yCoordinate || (customer as any).y_coordinate,
      zCoordinate: (customer as any).zCoordinate || (customer as any).z_coordinate,
    };

    const result = await withTransaction(async (client) => {
      const res = await dbCreateIndividualCustomer(customer, client);
      if (spatialData.xCoordinate !== undefined || spatialData.yCoordinate !== undefined || spatialData.zCoordinate !== undefined) {
        await dbUpsertSpatialRecord(res.customerKeyNumber, 'individual_customer', spatialData, client);
      }
      return res;
    });

    await logSecurityEventAction({
      event: 'Create Customer',
      customerKeyNumber: result?.customerKeyNumber,
      details: { customer }
    });
    return result;
  });
}
export async function updateCustomerAction(customerKeyNumber: string, customer: IndividualCustomerUpdate) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.CUSTOMERS_UPDATE);
    const existing = await dbGetCustomerById(customerKeyNumber);
    if (!existing) {
      throw new Error('Customer not found');
    }
    verifyEntityBranchAccess(existing.branch_id || existing.branchId, session, PERMISSIONS.CUSTOMERS_VIEW_ALL, 'customer');
    
    // Prevent changing branch_id if lacking global customer view
    const perms = session.permissions || [];
    const hasGlobalView = perms.includes('*') || perms.includes('all') || perms.includes('admin') || perms.includes(PERMISSIONS.CUSTOMERS_VIEW_ALL);
    if (!hasGlobalView && customer.branch_id && customer.branch_id !== existing.branch_id) {
      customer.branch_id = existing.branch_id;
    }

    const spatialData = {
      xCoordinate: (customer as any).xCoordinate || (customer as any).x_coordinate,
      yCoordinate: (customer as any).yCoordinate || (customer as any).y_coordinate,
      zCoordinate: (customer as any).zCoordinate || (customer as any).z_coordinate,
    };

    const result = await withTransaction(async (client) => {
      const res = await dbUpdateCustomer(customerKeyNumber, customer, client);
      if (spatialData.xCoordinate !== undefined || spatialData.yCoordinate !== undefined || spatialData.zCoordinate !== undefined) {
        await dbUpsertSpatialRecord(customerKeyNumber, 'individual_customer', spatialData, client);
      }
      return res;
    });

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
    const session = await checkPermission(PERMISSIONS.CUSTOMERS_DELETE);
    const existing = await dbGetCustomerById(customerKeyNumber);
    if (existing) {
      verifyEntityBranchAccess(existing.branch_id || existing.branchId, session, PERMISSIONS.CUSTOMERS_VIEW_ALL, 'customer');
    }
    await dbDeleteCustomer(customerKeyNumber, session.id);
    await logSecurityEventAction({
      event: 'Delete Customer',
      severity: 'warning',
      customerKeyNumber
    });
  });
}

export async function approveCustomerAction(customerKeyNumber: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.CUSTOMERS_APPROVE);
    const existing = await dbGetCustomerById(customerKeyNumber);
    if (existing) {
      verifyEntityBranchAccess(existing.branch_id || existing.branchId, session, PERMISSIONS.CUSTOMERS_VIEW_ALL, 'customer');
    }
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
    const session = await checkPermission(PERMISSIONS.CUSTOMERS_APPROVE);
    const existing = await dbGetCustomerById(customerKeyNumber);
    if (existing) {
      verifyEntityBranchAccess(existing.branch_id || existing.branchId, session, PERMISSIONS.CUSTOMERS_VIEW_ALL, 'customer');
    }
    const result = await dbUpdateCustomer(customerKeyNumber, {
      status: 'Rejected',
      approved_by: session.id,
      approved_at: new Date().toISOString()
    });
    await logSecurityEventAction({ event: 'Reject Customer', severity: 'warning', customerKeyNumber });
    return result;
  });
}

export async function getCustomerByIdAction(customerKeyNumber: string) {
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];
    if (!perms.includes(PERMISSIONS.CUSTOMERS_VIEW_ALL) && !perms.includes(PERMISSIONS.CUSTOMERS_VIEW_BRANCH)) {
      throw new Error('Forbidden: Missing customer view permission');
    }
    const customer = await dbGetCustomerById(customerKeyNumber);
    if (customer) {
      verifyEntityBranchAccess(customer.branch_id || customer.branchId, session, PERMISSIONS.CUSTOMERS_VIEW_ALL, 'customer');
    }
    return customer;
  });
}
export async function getAllBulkMetersAction(options?: { branchId?: string; limit?: number; offset?: number; searchTerm?: string; excludePending?: boolean; routeKey?: string; status?: string }) {
  return await wrap(async () => {
    const session = await checkPermission();
    const branchId = getEffectiveBranchId(session, options?.branchId, PERMISSIONS.BULK_METERS_VIEW_ALL);

    // Reader isolation: field readers (with routes_view_assigned or meter_readings_create perms)
    // but without global view-all — scope to their assigned routes only
    const perms = session.permissions || [];
    const hasGlobalView = perms.includes(PERMISSIONS.BULK_METERS_VIEW_ALL) || perms.includes('*') || perms.includes('all') || perms.includes('admin');
    const hasBranchView = perms.includes('bulk_meters_view_branch');
    const isFieldReader = !hasGlobalView && !hasBranchView && (
      perms.includes(PERMISSIONS.ROUTES_VIEW_ASSIGNED) ||
      perms.includes('meter_readings_create') ||
      perms.includes('meter_readings_create_bulk') ||
      perms.includes('meter_readings_view_bulk')
    );
    const readerId = isFieldReader ? session.id : undefined;

    return await dbGetAllBulkMeters({ branchId, readerId, ...options });
  });
}

export async function getBulkMetersCountAction(searchTerm?: string, excludePending?: boolean, branchId?: string, status?: string) {
  return await wrap(async () => {
    const session = await checkPermission();
    const resolvedBranchId = getEffectiveBranchId(session, branchId, PERMISSIONS.BULK_METERS_VIEW_ALL);
    return await dbCountBulkMeters({ branchId: resolvedBranchId, searchTerm, excludePending, status });
  });
}

export async function getBulkMetersSummaryAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const branchId = getEffectiveBranchId(session, undefined, 'bulk_meters_view_all');
    return await dbGetBulkMetersSummary(branchId);
  });
}
export async function getBulkMeterByIdAction(customerKeyNumber: string) {
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];
    if (!perms.includes(PERMISSIONS.BULK_METERS_VIEW_ALL) && !perms.includes(PERMISSIONS.BULK_METERS_VIEW_BRANCH)) {
      throw new Error('Forbidden: Missing bulk meter view permission');
    }
    const bulkMeter = await dbGetBulkMeterById(customerKeyNumber);
    if (bulkMeter) {
      verifyEntityBranchAccess(bulkMeter.branch_id || bulkMeter.branchId, session, PERMISSIONS.BULK_METERS_VIEW_ALL, 'bulk meter');
    }
    return bulkMeter;
  });
}
export async function createBulkMeterAction(bulkMeter: BulkMeterInsert) {
  return await wrap(async () => {
    const session = await checkPermissionAny(PERMISSIONS.BULK_METERS_CREATE, PERMISSIONS.DATA_ENTRY_ACCESS);
    // All data entry creations default to Pending Approval
    bulkMeter.status = bulkMeter.status || 'Pending Approval';
    const perms = session.permissions || [];
    const hasGlobalView = perms.includes('*') || perms.includes('all') || perms.includes('admin') || perms.includes(PERMISSIONS.BULK_METERS_VIEW_ALL);
    if (!hasGlobalView && session.branchId && session.branchId !== 'all') {
      bulkMeter.branch_id = session.branchId;
    } else {
      // For non-restricted users, ensure branchId from form is mapped to branch_id
      bulkMeter.branch_id = bulkMeter.branch_id || (bulkMeter as any).branchId;
    }

    const spatialData = {
      xCoordinate: (bulkMeter as any).xCoordinate || (bulkMeter as any).x_coordinate,
      yCoordinate: (bulkMeter as any).yCoordinate || (bulkMeter as any).y_coordinate,
      zCoordinate: (bulkMeter as any).zCoordinate || (bulkMeter as any).z_coordinate,
    };

    const result = await withTransaction(async (client) => {
      const res = await dbCreateBulkMeter(bulkMeter, client);
      if (spatialData.xCoordinate !== undefined || spatialData.yCoordinate !== undefined || spatialData.zCoordinate !== undefined) {
        await dbUpsertSpatialRecord(res.customerKeyNumber, 'bulk_meter', spatialData, client);
      }
      return res;
    });

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
    const session = await checkPermission(PERMISSIONS.BULK_METERS_UPDATE);
    const existing = await dbGetBulkMeterById(customerKeyNumber);
    if (!existing) {
      throw new Error('Bulk meter not found');
    }
    verifyEntityBranchAccess(existing.branch_id || existing.branchId, session, PERMISSIONS.BULK_METERS_VIEW_ALL, 'bulk meter');

    // Prevent changing branch_id if lacking global view
    const perms = session.permissions || [];
    const hasGlobalView = perms.includes('*') || perms.includes('all') || perms.includes('admin') || perms.includes(PERMISSIONS.BULK_METERS_VIEW_ALL);
    if (!hasGlobalView && bulkMeter.branch_id && bulkMeter.branch_id !== existing.branch_id) {
      bulkMeter.branch_id = existing.branch_id;
    }

    const spatialData = {
      xCoordinate: (bulkMeter as any).xCoordinate || (bulkMeter as any).x_coordinate,
      yCoordinate: (bulkMeter as any).yCoordinate || (bulkMeter as any).y_coordinate,
      zCoordinate: (bulkMeter as any).zCoordinate || (bulkMeter as any).z_coordinate,
    };

    const result = await withTransaction(async (client) => {
      const res = await dbUpdateBulkMeter(customerKeyNumber, bulkMeter, client);
      if (spatialData.xCoordinate !== undefined || spatialData.yCoordinate !== undefined || spatialData.zCoordinate !== undefined) {
        await dbUpsertSpatialRecord(customerKeyNumber, 'bulk_meter', spatialData, client);
      }
      return res;
    });

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
    const session = await checkPermission(PERMISSIONS.BULK_METERS_DELETE);
    const existing = await dbGetBulkMeterById(customerKeyNumber);
    if (existing) {
      verifyEntityBranchAccess(existing.branch_id || existing.branchId, session, PERMISSIONS.BULK_METERS_VIEW_ALL, 'bulk meter');
    }
    await dbDeleteBulkMeter(customerKeyNumber, session.id);
    await logSecurityEventAction({
      event: 'Delete Bulk Meter',
      severity: 'warning',
      customerKeyNumber
    });
  });
}

export async function approveBulkMeterAction(customerKeyNumber: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.BULK_METERS_APPROVE);
    const existing = await dbGetBulkMeterById(customerKeyNumber);
    if (existing) {
      verifyEntityBranchAccess(existing.branch_id || existing.branchId, session, PERMISSIONS.BULK_METERS_VIEW_ALL, 'bulk meter');
    }
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
    const session = await checkPermission(PERMISSIONS.BULK_METERS_APPROVE);
    const existing = await dbGetBulkMeterById(customerKeyNumber);
    if (existing) {
      verifyEntityBranchAccess(existing.branch_id || existing.branchId, session, PERMISSIONS.BULK_METERS_VIEW_ALL, 'bulk meter');
    }
    const result = await dbUpdateBulkMeter(customerKeyNumber, {
      status: 'Rejected',
      approved_by: session.id,
      approved_at: new Date().toISOString()
    });
    await logSecurityEventAction({
      event: 'Reject Bulk Meter',
      severity: 'warning',
      customerKeyNumber
    });
    return result;
  });
}

export async function getAllStaffMembersAction() {
  return await wrap(async () => {
    const session = await checkPermissionAny(
      PERMISSIONS.STAFF_VIEW,
      PERMISSIONS.STAFF_VIEW_ALL,
      PERMISSIONS.STAFF_VIEW_BRANCH,
      PERMISSIONS.ROUTES_MANAGE,
      'routes_manage',
      'routes_create',
      'routes_update',
      'routes_view_all',
      'routes_view_branch'
    );
    
    // Determine the branch isolation:
    // If the user has 'staff_view_all' or 'routes_view_all', they can see everyone.
    // Otherwise, they are locked to their own branch.
    const filterBranchId = getEffectiveBranchId(session, undefined, PERMISSIONS.STAFF_VIEW_ALL);
    
    return await dbGetAllStaffMembers(filterBranchId);
  });
}
export async function createStaffMemberAction(staffMember: StaffMemberInsert) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.STAFF_CREATE);

    // Mapping fix: set 'branch' (text) from form's 'branchName' or 'branchId' (fallback)
    if (!(staffMember as any).branch) {
        (staffMember as any).branch = (staffMember as any).branchName || (staffMember as any).branchId;
    }

    // Only override if no branch is specified in the form
    if (!(staffMember as any).branch && session.branchId) {
        (staffMember as any).branch = session.branchId;
    }
    
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
    const session = await checkPermission(PERMISSIONS.STAFF_UPDATE);
    
    const branchId = getEffectiveBranchId(session, undefined, PERMISSIONS.STAFF_VIEW_ALL);
    const result = await dbUpdateStaffMember(email, staffMember, branchId);
    
    await logSecurityEventAction({
      event: 'Update Staff Member',
      details: { email, updates: staffMember }
    });
    return result;
  });
}
export async function deleteStaffMemberAction(email: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.STAFF_DELETE);
    
    const branchId = getEffectiveBranchId(session, undefined, PERMISSIONS.STAFF_VIEW_ALL);
    await dbDeleteStaffMember(email, session.id, branchId);
    
    await logSecurityEventAction({
      event: 'Delete Staff Member',
      severity: 'warning',
      details: { email }
    });
  });
}
export async function getStaffMemberForAuthAction(email: string, password?: string) { return await wrap(() => dbGetStaffMemberForAuth(email, password)); }

export async function getBillsPaginatedAction(options: {
  limit: number;
  offset: number;
  searchTerm?: string;
  branchId?: string;
  month?: string;
  status?: string;
}) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms = await dbGetStaffPermissions(session.id);
    const hasBillPerm = perms.includes(PERMISSIONS.BILL_VIEW_ALL) || 
                       perms.includes(PERMISSIONS.BILL_VIEW_BRANCH) || 
                       perms.some((p: string) => p.startsWith('bill:'));
    if (!hasBillPerm) throw new Error('Forbidden: Missing billing permissions');

    const branchId = getEffectiveBranchId(session, options?.branchId, PERMISSIONS.BILL_VIEW_ALL);
    const readerId = !perms.includes(PERMISSIONS.BILL_VIEW_ALL) && perms.includes(PERMISSIONS.ROUTES_VIEW_ASSIGNED)
      ? session.id
      : undefined;

    return await dbGetBillsPaginated({ ...options, branchId, readerId });
  });
}

export async function getBillsStatusCountsAction(options?: {
  branchId?: string;
  month?: string;
  searchTerm?: string;
}) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms = await dbGetStaffPermissions(session.id);
    const hasBillPerm = perms.includes(PERMISSIONS.BILL_VIEW_ALL) || 
                       perms.includes(PERMISSIONS.BILL_VIEW_BRANCH) || 
                       perms.some((p: string) => p.startsWith('bill:'));
    if (!hasBillPerm) throw new Error('Forbidden: Missing billing permissions');

    const branchId = getEffectiveBranchId(session, options?.branchId, PERMISSIONS.BILL_VIEW_ALL);
    const readerId = !perms.includes(PERMISSIONS.BILL_VIEW_ALL) && perms.includes(PERMISSIONS.ROUTES_VIEW_ASSIGNED)
      ? session.id
      : undefined;

    return await dbGetBillsStatusCounts({ ...options, branchId, readerId });
  });
}

export async function getAllBillsAction(options?: { branchId?: string; excludeUnfinalized?: boolean }) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms = await dbGetStaffPermissions(session.id);
    
    // Check for any billing-related or reader permission
    const hasBillPerm = perms.includes(PERMISSIONS.BILL_VIEW_ALL) || 
                       perms.includes(PERMISSIONS.BILL_VIEW_BRANCH) || 
                       perms.includes(PERMISSIONS.ROUTES_VIEW_ASSIGNED) ||
                       perms.includes(PERMISSIONS.METER_READINGS_CREATE) ||
                       perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL) ||
                       perms.includes(PERMISSIONS.DASHBOARD_VIEW_BRANCH) ||
                       perms.some((p: string) => p.startsWith('bill:')) ||
                       perms.includes('*') || perms.includes('all') || perms.includes('admin');
                       
    if (!hasBillPerm) {
      return [];
    }

    // Apply branch filtering if they don't have global access
    const branchId = getEffectiveBranchId(session, options?.branchId, PERMISSIONS.BILL_VIEW_ALL);

    // Reader isolation:
    const readerId = !perms.includes(PERMISSIONS.BILL_VIEW_ALL) && perms.includes(PERMISSIONS.ROUTES_VIEW_ASSIGNED)
      ? session.id
      : undefined;

    return await dbGetAllBills({ ...options, branchId, readerId });
  });
}
export async function createBillAction(bill: BillInsert) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.BILL_CREATE);

    // Ensure accurate mappings if partial data provided — always compute TOTALBILLAMOUNT
    // Use provided parts when available, otherwise fallback sensibly.
    if (bill.THISMONTHBILLAMT === undefined || bill.THISMONTHBILLAMT === null) {
      // If only TOTALBILLAMOUNT was provided, assume that as this month's amount
      if (bill.TOTALBILLAMOUNT !== undefined && bill.TOTALBILLAMOUNT !== null) {
        bill.THISMONTHBILLAMT = bill.TOTALBILLAMOUNT;
      }
    }
    if (bill.OUTSTANDINGAMT === undefined || bill.OUTSTANDINGAMT === null) {
      bill.OUTSTANDINGAMT = bill.balance_carried_forward || 0;
    }
    // Compute TOTALBILLAMOUNT from parts to ensure downstream logic has a value
    const computedTotal = (bill.THISMONTHBILLAMT || 0) + (bill.OUTSTANDINGAMT || 0) + (bill.PENALTYAMT || 0);
    bill.TOTALBILLAMOUNT = computedTotal;

    // Status Check: Ensure account is Active before billing
    if (bill.CUSTOMERKEY) {
      const bm = await dbGetBulkMeterById(bill.CUSTOMERKEY);
      if (bm && bm.status !== 'Active') {
        throw new Error(`Cannot create bill: Account is not Active. Please approve the account first.`);
      }
      if (bm?.branch_id && !bill.CUSTOMERBRANCH) {
        const branch = await dbGetBranchById(bm.branch_id);
        bill.CUSTOMERBRANCH = branch?.name;
      }
      if (bm?.branch_id) {
        bill.branch_id = bm.branch_id;
      }
    } else if (bill.individual_customer_id) {
      const cust = await dbGetCustomerById(bill.individual_customer_id);
      if (cust && cust.status !== 'Active') {
        throw new Error(`Cannot create bill: Account is not Active. Please approve the account first.`);
      }
      if (cust && cust.assignedBulkMeterId) {
        throw new Error(`Cannot create bill: Customer is assigned to a Bulk Meter (${cust.assignedBulkMeterId}). Bills for assigned individual customers should not be created.`);
      }
      if (cust?.branch_id && !bill.CUSTOMERBRANCH) {
        const branch = await dbGetBranchById(cust.branch_id);
        bill.CUSTOMERBRANCH = branch?.name;
      }
      if (cust?.branch_id) {
        bill.branch_id = cust.branch_id;
      }
    }

// Branch Isolation Verification for Bill Creation
    const perms = session.permissions || [];
    if (!perms.includes(PERMISSIONS.BILL_VIEW_ALL)) {
      if (session.branchId && session.branchId !== 'all' && bill.branch_id !== session.branchId) {
        throw new Error('Forbidden: Cannot create bill for a customer in a different branch.');
      }
    }

    // If the bill is being created as Paid, ensure `amount_paid` reflects the total
    // so downstream aging syncs don't recalculate it back to Unpaid.
    const incomingPaymentStatus = (bill.payment_status || (bill as any).paymentStatus || '').toString();
    if (incomingPaymentStatus.toLowerCase() === 'paid') {
      const total = bill.TOTALBILLAMOUNT; // computed above
      if (bill.amount_paid === undefined || bill.amount_paid === null) {
        bill.amount_paid = total;
      }
      // Normalize both possible keys to the DB column name
      bill.payment_status = 'Paid';
      (bill as any).paymentStatus = 'Paid';
    }

    return await withTransaction(async (client) => {
      const result = await dbCreateBill(bill, client);

      // Generate and update BILLKEY
      if (result && result.id) {
        const billKey = generateBillKey(result.id);
        await dbUpdateBill(result.id, { BILLKEY: billKey }, client);
        result.BILLKEY = billKey; // Update returned object
      }

      // Log initial workflow state
      await dbCreateBillWorkflowLog({
        bill_id: result.id,
        from_status: 'N/A',
        to_status: result.status || 'Draft',
        changed_by: session.id,
        reason: 'Manual bill creation'
      }, client);

      await logSecurityEventAction({
        event: 'Create Bill',
        customerKeyNumber: bill.CUSTOMERKEY || undefined,
        details: { billId: result.id }
      });

      // Ensure aging/payment status is synchronized for this customer now that the bill exists
      const customerKeyToSync = bill.CUSTOMERKEY || bill.individual_customer_id;
      if (customerKeyToSync) {
        try {
          await dbSyncAgingForCustomer(customerKeyToSync, client);
        } catch (e) {
          // Don't fail the creation if sync fails; log and continue
          console.error('dbSyncAgingForCustomer failed after bill create:', e);
        }
      }
      return result;
    });
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
    const session = await checkPermission(PERMISSIONS.BILL_CLOSE_CYCLE);

    // Verify meter branch if user doesn't have global access
    const perms = session.permissions || [];
    if (!perms.includes(PERMISSIONS.BILL_VIEW_ALL)) {
      const meter = await dbGetBulkMeterById(payload.meterUpdate.customerKeyNumber);
      if (!meter || meter.branch_id !== session.branchId) {
        throw new Error('Forbidden: This meter does not belong to your branch');
      }
    }

    // Wrap in transaction for atomicity
    return await withTransaction(async (client) => {
      // 1. Prepare and Create the Bill
      const billToInsert = { ...payload.bill };
      if (billToInsert.THISMONTHBILLAMT === undefined || billToInsert.THISMONTHBILLAMT === null) {
        billToInsert.THISMONTHBILLAMT = billToInsert.TOTALBILLAMOUNT;
      }
      if (billToInsert.OUTSTANDINGAMT === undefined || billToInsert.OUTSTANDINGAMT === null) {
        billToInsert.OUTSTANDINGAMT = billToInsert.balance_carried_forward || 0;
      }
      billToInsert.TOTALBILLAMOUNT = (billToInsert.THISMONTHBILLAMT || 0) + (billToInsert.OUTSTANDINGAMT || 0) + (billToInsert.PENALTYAMT || 0);

      // Credit-note wiring: a bulk meter with a deposit is billed for the net amount.
      // The deposit is consumed by the credit-aware aging engine (dbSyncAgingForCustomer
      // below), which records the credit_ledger 'applied' row and decrements the balance
      // in this same transaction. Here we only make the bill row reflect what is actually
      // owed: when the operator marks the bill as paid, the deposit covers the first part
      // of the total, so the cash portion (dueAfterCredit) is what goes into amount_paid.
      let creditAppliedThisCycle = 0;
      const billPaymentStatus = (billToInsert.payment_status || (billToInsert as any).paymentStatus || '').toString().toLowerCase();
      if (billToInsert.CUSTOMERKEY) {
        const creditBalance = await dbGetMeterCreditBalance(billToInsert.CUSTOMERKEY);
        if (creditBalance > MONEY_EPSILON) {
          const totalPayableForCycle = Number(billToInsert.TOTALBILLAMOUNT || 0);
          const dueAfterCredit = Math.max(0, roundMoney(totalPayableForCycle - creditBalance));
          creditAppliedThisCycle = roundMoney(totalPayableForCycle - dueAfterCredit);
          if (billPaymentStatus === 'paid') {
            billToInsert.amount_paid = dueAfterCredit;
          }
        }
      }

      // Status Check: Ensure account is Active before billing
      if (billToInsert.CUSTOMERKEY) {
        const bm = await dbGetBulkMeterById(billToInsert.CUSTOMERKEY);
        if (bm && bm.status !== 'Active') {
          throw new Error(`Cannot create bill: Account is not Active. Please approve the account first.`);
        }
        if (bm?.branch_id && !billToInsert.CUSTOMERBRANCH) {
          const branch = await dbGetBranchById(bm.branch_id);
          billToInsert.CUSTOMERBRANCH = branch?.name;
        }
      } else if (billToInsert.individual_customer_id) {
        const cust = await dbGetCustomerById(billToInsert.individual_customer_id);
        if (cust && cust.status !== 'Active') {
          throw new Error(`Cannot create bill: Account is not Active. Please approve the account first.`);
        }
        if (cust?.branch_id && !billToInsert.CUSTOMERBRANCH) {
          const branch = await dbGetBranchById(cust.branch_id);
          billToInsert.CUSTOMERBRANCH = branch?.name;
        }
      }

      const billResult = await dbCreateBill(billToInsert, client);

      // Generate and update BILLKEY
      if (billResult && billResult.id) {
        const billKey = generateBillKey(billResult.id);
        await dbUpdateBill(billResult.id, { BILLKEY: billKey }, client);
        billResult.BILLKEY = billKey;
      }

      // 2. Update the Bulk Meter
      const meterResult = await dbUpdateBulkMeter(payload.meterUpdate.customerKeyNumber, {
        previousReading: payload.meterUpdate.previousReading,
        currentReading: payload.meterUpdate.currentReading,
        outStandingbill: payload.meterUpdate.outStandingbill as any,
        paymentStatus: payload.meterUpdate.paymentStatus as any,
      }, client);

      // 3. Log initial workflow state
      await dbCreateBillWorkflowLog({
        bill_id: billResult.id,
        from_status: 'N/A',
        to_status: billResult.status || 'Draft',
        changed_by: session.id, // Use UUID
        reason: 'Initial creation via billing cycle closure'
      }, client);

      // 4. Sync customer aging now that the bill has been created and meter records updated.
      await dbSyncAgingForCustomer(payload.meterUpdate.customerKeyNumber, client);

      // 5. Log Security Event (outside client transaction if it's a separate utility, but we want it logged)
      await logSecurityEventAction({
        event: 'Close Billing Cycle',
        customerKeyNumber: payload.meterUpdate.customerKeyNumber,
        details: {
          billId: billResult.id,
          meterUpdate: payload.meterUpdate
        }
      });

      return { bill: billResult, meter: meterResult, creditApplied: creditAppliedThisCycle };
    });
  });
}

export async function runBillingCycleAction(payload: {
  bulkMeterId: string;
  carryBalance: boolean;
  monthYear: string;
  periodStartDate?: string;
  periodEndDate?: string;
  dueDateOffsetDays?: number;
  allowOverlap?: boolean;
}) {
  return await wrap(async () => {
    const session = await checkPermissionAny(
      PERMISSIONS.BILL_CLOSE_CYCLE,
      'billing:close_cycle',
      'bill:close_cycle',
      'bill:manage_all',
      PERMISSIONS.BILL_CREATE
    );

    // 1. Fetch latest data
    const bulkMeter = await dbGetBulkMeterById(payload.bulkMeterId);
    if (!bulkMeter) throw new Error("Bulk meter not found");

    const associatedCustomers = await dbGetCustomersByBulkMeterId(payload.bulkMeterId);

    // 2. Fetch readings from bulk_meter_readings for the given month (preferred source)
    //    Fall back to the bulk_meters stored readings if no reading record exists for this month.
    const { dbGetReadingsForMonth } = await import('./db-queries');
    const monthReadings = await dbGetReadingsForMonth('bulk_meters', [payload.bulkMeterId], payload.monthYear);
    const readingRecord = monthReadings.find((r: any) => r.CUST_KEY === payload.bulkMeterId);

    const currRead = readingRecord?.METER_READING != null
      ? Number(readingRecord.METER_READING)
      : Number(bulkMeter.currentReading ?? 0);
    const prevRead = readingRecord?.PREVIOUS_READING != null
      ? Number(readingRecord.PREVIOUS_READING)
      : Number(bulkMeter.previousReading ?? 0);

    // 3. Calculate Usage
    const bmUsage = currRead - prevRead;
    const totalIndivUsage = associatedCustomers.reduce((sum, cust) => sum + ((Number(cust.currentReading) || 0) - (Number(cust.previousReading) || 0)), 0);

    // 4. Determine Charge Group and Fetch Tariff Settings
    const chargeGroup = (bulkMeter.charge_group || 'Non-domestic') as CustomerType;
    const sewerageConn = (bulkMeter.sewerage_connection || 'No') as SewerageConnection;

    // Fetch current tariff directly from DB for aging/penalty calculation
    const { dbGetLatestApplicableTariff } = await import('./db-queries');
    const lookupDate = payload.monthYear;
    const activeTariffRow = await dbGetLatestApplicableTariff(chargeGroup, lookupDate);

    // 4. Calculate Bill using the centralized engine
    // Guard against negative difference usage (individual readings exceed bulk meter reading).
    // This indicates a data integrity problem and must not silently produce a zero bill.
    const rawDifferenceUsage = bmUsage - totalIndivUsage;
    if (rawDifferenceUsage < 0) {
      const useRuleOfThree = activeTariffRow ? (activeTariffRow.use_rule_of_three !== undefined && activeTariffRow.use_rule_of_three !== null ? Boolean(activeTariffRow.use_rule_of_three) : true) : true;
      if (!useRuleOfThree) {
        throw new Error(
          `Negative difference usage (${rawDifferenceUsage} m³) for bulk meter ${payload.bulkMeterId} in ${payload.monthYear}. ` +
          `Total individual sub-meter usage (${totalIndivUsage} m³) exceeds bulk meter consumption (${bmUsage} m³). ` +
          `Please verify all meter readings before running the billing cycle.`
        );
      }
    }
    const billingResult = await calculateBill(
      rawDifferenceUsage,
      chargeGroup,
      sewerageConn,
      bulkMeter.meterSize ?? 0.5,
      payload.monthYear
    );

    const differenceUsageForCycle = billingResult.effectiveUsage;
    // differenceBillAmount is used as THISMONTHBILLAMT in the bill insert below
    const differenceBillAmount = billingResult.totalBill;

    const balanceFromPreviousPeriods = Number(bulkMeter.outStandingbill || 0);

    // 5. Aging & Penalty Calculation (FIFO based on historical bills, considering partial payments)
    const { calculateDebtAging } = await import('./billing-utils');
    const historicalBills = await dbGetBillsByBulkMeterId(payload.bulkMeterId);

    // Convert DB row to expected TariffInfo structure for calculateDebtAging if a row was found
    let activeTariff;
    if (activeTariffRow) {
      activeTariff = {
        ...activeTariffRow,
        tiers: typeof activeTariffRow.tiers === 'string' ? JSON.parse(activeTariffRow.tiers) : activeTariffRow.tiers,
        sewerage_tiers: typeof activeTariffRow.sewerage_tiers === 'string' ? JSON.parse(activeTariffRow.sewerage_tiers) : activeTariffRow.sewerage_tiers,
        meter_rent_prices: typeof activeTariffRow.meter_rent_prices === 'string' ? JSON.parse(activeTariffRow.meter_rent_prices) : activeTariffRow.meter_rent_prices,
        additional_fees: typeof activeTariffRow.additional_fees === 'string' ? JSON.parse(activeTariffRow.additional_fees) : activeTariffRow.additional_fees,
        penalty_tiered_rates: typeof activeTariffRow.penalty_tiered_rates === 'string' && activeTariffRow.penalty_tiered_rates ? JSON.parse(activeTariffRow.penalty_tiered_rates) : activeTariffRow.penalty_tiered_rates,
        penalty_month_threshold: activeTariffRow.penalty_month_threshold !== null && activeTariffRow.penalty_month_threshold !== undefined ? Number(activeTariffRow.penalty_month_threshold) : undefined,
        bank_lending_rate: activeTariffRow.bank_lending_rate !== null && activeTariffRow.bank_lending_rate !== undefined ? Number(activeTariffRow.bank_lending_rate) : undefined,
        use_rule_of_three: activeTariffRow.use_rule_of_three !== undefined && activeTariffRow.use_rule_of_three !== null ? Boolean(activeTariffRow.use_rule_of_three) : true,
      };
    }

    const { debit30, debit30_60, debit60, penaltyAmt } = calculateDebtAging(balanceFromPreviousPeriods, historicalBills, activeTariff, payload.monthYear);

    const { buildBillingPeriod } = await import('./billing-config');
    const period = buildBillingPeriod({
      monthYear: payload.monthYear,
      periodStartDate: payload.periodStartDate,
      periodEndDate: payload.periodEndDate,
      dueDateOffsetDays: payload.dueDateOffsetDays,
    });
    const periodStartDate = period.startDate;
    const periodEndDate = period.endDate;
    const dueDate = period.dueDate;

    // 6. Strict Safety Check: Overlap Protection
    const hasOverlap = historicalBills.some(bill => {
      if (!bill.bill_period_start_date || !bill.bill_period_end_date) return false;
      const bStart = new Date(bill.bill_period_start_date).getTime();
      const bEnd = new Date(bill.bill_period_end_date).getTime();
      const pStart = new Date(periodStartDate).getTime();
      const pEnd = new Date(periodEndDate).getTime();
      return pStart <= bEnd && pEnd >= bStart;
    });

    if (hasOverlap && !payload.allowOverlap) {
      throw new Error(`Billing period overlaps with an existing bill (${periodStartDate} to ${periodEndDate}).`);
    }

    // Outstanding = sum of aging buckets (Debit 30 + Debit 30-60 + Debit 60)
    const outstandingAmt = Number((debit30 + debit30_60 + debit60).toFixed(2));
    // Total Payable = Penalty + Outstanding + Current Bill
    const totalPayableForCycle = Number((penaltyAmt + outstandingAmt + billingResult.totalBill).toFixed(2));

    // Credit-note wiring: a deposit is applied to this cycle's bill first, so the
    // meter is billed for the net amount. The engine (dbSyncAgingForCustomer below)
    // records the credit_ledger 'applied' row and decrements the balance; here we set
    // the bill's amount_paid/payment_status so a fully-covered bill reads as Paid.
    const creditBalanceAtCycle = await dbGetMeterCreditBalance(payload.bulkMeterId);
    const dueAfterCredit = Math.max(0, roundMoney(totalPayableForCycle - creditBalanceAtCycle));
    const creditAppliedThisCycle = roundMoney(totalPayableForCycle - dueAfterCredit);

    // Get branch name for bill
    let branchName: string | undefined = undefined;
    if (bulkMeter.branch_id) {
      const branch = await dbGetBranchById(bulkMeter.branch_id);
      branchName = branch?.name;
    }

    // 6. Create Bill
    const billInsert: BillInsert = {
      CUSTOMERKEY: bulkMeter.customerKeyNumber,
      CUSTOMERBRANCH: branchName,
      branch_id: bulkMeter.branch_id,
      bill_period_start_date: periodStartDate,
      bill_period_end_date: periodEndDate,
      month_year: payload.monthYear,
      PREVREAD: prevRead,
      CURRREAD: currRead,
      CONS: bmUsage,
      difference_usage: differenceUsageForCycle,
      THISMONTHBILLAMT: billingResult.totalBill,
      OUTSTANDINGAMT: outstandingAmt,
      PENALTYAMT: penaltyAmt,
      TOTALBILLAMOUNT: totalPayableForCycle,
      base_water_charge: billingResult.baseWaterCharge,
      maintenance_fee: billingResult.maintenanceFee,
      sanitation_fee: billingResult.sanitationFee,
      sewerage_charge: billingResult.sewerageCharge,
      meter_rent: billingResult.meterRent,
      vat_amount: billingResult.vatAmount,
      balance_carried_forward: outstandingAmt,
      debit_30: debit30,
      debit_30_60: debit30_60,
      debit_60: debit60,
      due_date: dueDate.toISOString(),
      // When carryBalance is false the bill is settled now: the deposit covers the
      // first part (dueAfterCredit is the net cash owed), so a fully-covered bill is
      // created 'Paid' with amount_paid 0 and the engine records the applied credit.
      payment_status: payload.carryBalance ? (dueAfterCredit > MONEY_EPSILON ? 'Unpaid' : 'Paid') : 'Paid',
      // Record the net cash portion as paid so dbSyncAgingForCustomer recalculates
      // consistently and never reverts payment_status back to 'Unpaid'.
      amount_paid: payload.carryBalance ? 0 : dueAfterCredit,
      status: 'Draft', // New cycles start as drafts
      bill_number: `BILL-${Date.now()}`,
      snapshot_data: {
        chargeGroup: bulkMeter.charge_group,
        sewerageConnection: bulkMeter.sewerage_connection,
        individualCustomerCount: associatedCustomers.length,
        totalIndividualUsage: totalIndivUsage
      } as any
    };

    const billResult = await dbCreateBill(billInsert);
    if (billResult && billResult.id) {
      const billKey = generateBillKey(billResult.id);
      await dbUpdateBill(billResult.id, { BILLKEY: billKey });
      
      await dbCreateBillWorkflowLog({
        bill_id: billResult.id,
        from_status: 'None',
        to_status: 'Draft',
        changed_by: session.id,
        reason: 'Bill created / initialized'
      });
    }

    // 6. Update Bulk Meter — carry forward the net (post-credit) amount as the outstanding balance
    const newOutstandingBalance = payload.carryBalance ? dueAfterCredit : 0;
    const newPreviousReading = bulkMeter.currentReading ?? bulkMeter.previousReading ?? 0;
    const meterUpdate: BulkMeterUpdate = {
      previousReading: newPreviousReading,
      outStandingbill: newOutstandingBalance as any,
      paymentStatus: payload.carryBalance ? (dueAfterCredit > MONEY_EPSILON ? 'Unpaid' as any : 'Paid' as any) : 'Paid' as any,
    };

    await dbUpdateBulkMeter(payload.bulkMeterId, meterUpdate);
    await dbBatchRolloverIndividualCustomersOfBulkMeters([payload.bulkMeterId]);
    await dbSyncAgingForCustomer(payload.bulkMeterId);

    await logSecurityEventAction({
      event: 'Run Billing Cycle',
      customerKeyNumber: payload.bulkMeterId,
      details: {
        carryBalance: payload.carryBalance,
        monthYear: payload.monthYear,
        billId: billResult.id
      }
    });

    let warningMsg: string | undefined = undefined;
    if (rawDifferenceUsage < 0) {
      warningMsg = `Negative difference usage (${rawDifferenceUsage} m³) detected for bulk meter ${payload.bulkMeterId}. Billed at 3 m³ (Rule of 3 active), but readings need attention.`;
    }

    return { billId: billResult.id, success: true, warning: warningMsg, creditApplied: creditAppliedThisCycle, dueAfterCredit };
  });
}

/**
 * Current credit (deposit) balance + ledger for a bulk meter (newest first).
 * Used by the Bulk Meter Details credit card.
 */
export async function getMeterCreditAction(bulkMeterId: string) {
  return await wrap(async () => {
    const session = await checkPermissionAny(
      PERMISSIONS.CREDIT_VIEW_ALL,
      PERMISSIONS.CREDIT_VIEW_BRANCH
    );
    const perms = session.permissions || [];
    if (!perms.includes(PERMISSIONS.CREDIT_VIEW_ALL)) {
      const meter = await dbGetBulkMeterById(bulkMeterId);
      if (!meter || meter.branch_id !== session.branchId) {
        throw new Error('Forbidden: This meter does not belong to your branch');
      }
    }
    const data = await dbGetMeterCredit(bulkMeterId);
    return data;
  });
}

/** Ensure the session may edit this meter (branch isolation unless global). */
async function assertMeterWriteAccess(customerKey: string, session: any) {
  const perms = session.permissions || [];
  if (!perms.includes(PERMISSIONS.CREDIT_VIEW_ALL) && !perms.includes(PERMISSIONS.BULK_METERS_VIEW_ALL)) {
    const meter = await dbGetBulkMeterById(customerKey);
    if (!meter || meter.branch_id !== session.branchId) {
      throw new Error('Forbidden: This meter does not belong to your branch');
    }
  }
}

/**
 * Manual credit add (operator): the deposit balance is bumped and an auditable
 * 'created' row lands in credit_ledger. The aging engine treats it as available
 * credit on the next sync. `sourceBillId` optionally links the deposit to the
 * bill it came from (e.g. a duplicate payment against a specific bill).
 */
export async function addMeterCreditAction(bulkMeterId: string, amount: number, reason: string, notes?: string, sourceBillId?: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.CREDIT_CREATE);
    await assertMeterWriteAccess(bulkMeterId, session);
    const row = await dbCreateCredit(bulkMeterId, amount, reason || 'manual', notes || null, session.id, sourceBillId || null);
    await logSecurityEventAction({
      event: 'Bulk Meter Credit Created',
      customerKeyNumber: bulkMeterId,
      severity: 'info',
      details: { amount: row.amount, reason: row.reason, ledgerId: row.id, sourceBillId: row.source_bill_id } as any
    });
    return { creditBalance: row.balance_after };
  });
}

/**
 * Manual credit void: reverses the unconsumed portion of a 'created' ledger row.
 * Fully-consumed credits are blocked server-side.
 */
export async function voidMeterCreditAction(bulkMeterId: string, ledgerId: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.CREDIT_VOID);
    await assertMeterWriteAccess(bulkMeterId, session);
    const result = await dbVoidCredit(bulkMeterId, ledgerId, session.id);
    await logSecurityEventAction({
      event: 'Bulk Meter Credit Voided',
      customerKeyNumber: bulkMeterId,
      severity: 'warning',
      details: { voidedAmount: result.voidedAmount, remainingBalance: result.remainingBalance, ledgerId } as any
    });
    return result;
  });
}

export async function updateBillAction(id: string, bill: BillUpdate) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.BILL_UPDATE);
    await verifyBillBranchAccess(id, session);

    // Hardening: Mutation Guards & Audit Trail
    const currentBill = await dbGetBillByIdQuery(id);
    if (!currentBill) {
      throw new Error(`Bill ${id} not found.`);
    }

    if (currentBill.status === 'Approved' || currentBill.status === 'Posted') {
      // Whitelist of fields that can still be updated even for Posted bills
      const allowedFields = ['payment_status', 'amount_paid', 'amountPaid', 'last_payment_date', 'receipt_number', 'note', 'BILLKEY'];
      const updateFields = Object.keys(bill);
      const isSafeUpdate = updateFields.every(field => allowedFields.includes(field));

      if (!isSafeUpdate) {
        throw new Error(`Cannot edit core billing data. Status is currently ${currentBill.status}. Only payment-related updates are permitted.`);
      }
    }

    const result = await dbUpdateBill(id, bill);

    if (currentBill.individual_customer_id) {
      const { dbGetCustomerById } = await import('./db-queries');
      const customer = await dbGetCustomerById(currentBill.individual_customer_id);
      if (customer && customer.assignedBulkMeterId) {
        try {
          await recalculateBulkBillAction(customer.assignedBulkMeterId, currentBill.month_year);
        } catch (e) {
          console.error("Failed to automatically recalculate bulk bill after individual bill update:", e);
        }
      }
    }

    // Build diff for audit trail
    const changes: Record<string, { old: any, new: any }> = {};
    const currBillRecord = currentBill as Record<string, any>;
    for (const key of Object.keys(bill)) {
      const newVal = bill[key as keyof BillUpdate];
      if (newVal !== currBillRecord[key]) {
        changes[key] = { old: currBillRecord[key], new: newVal };
      }
    }

    // Log the specific field changes to workflow history
    if (Object.keys(changes).length > 0) {
      await dbCreateBillWorkflowLog({
        bill_id: id,
        from_status: currentBill.status,
        to_status: currentBill.status, // Status hasn't changed, just values
        changed_by: session.id, // Use UUID
        reason: 'Field Update',
        details: JSON.stringify(changes) // Store as JSON string 
      });
    }

    await logSecurityEventAction({
      event: 'Update Bill',
      details: { id, updates: bill }
    });
    return result;
  });
}
export async function deleteBillAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.BILL_DELETE);
    await verifyBillBranchAccess(id, session);
    await dbDeleteBill(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Bill',
      severity: 'warning',
      details: { id }
    });
  });
}
export async function getBillByIdAction(id: string) {
  return await wrap(async () => {
    // Basic auth check, branch isolation handles whether they can see it
    const session = await checkPermission(); 
    
    // Check if user has global read access based on new bill/dashboard patterns
    const sessPerms: string[] = session.permissions || [];
    const sessHasPerm = (p: string) => sessPerms.includes('*') || sessPerms.includes('admin') || sessPerms.includes('all') || sessPerms.includes(p);
    let viewAllPermission: string | undefined = undefined;
    if (sessHasPerm(PERMISSIONS.BILL_VIEW_ALL) || sessHasPerm(PERMISSIONS.DASHBOARD_VIEW_ALL)) {
      viewAllPermission = PERMISSIONS.BILL_VIEW_ALL; // Use as a proxy token to allow global access in the helper
    }

    const branchId = getEffectiveBranchId(session, undefined, viewAllPermission);
    return await dbGetBillByIdQuery(id, branchId);
  });
}


export async function getBillsByCustomerKeyAction(customerKey: string) {
  return await wrap(async () => {
    await checkPermission(); // Basic check
    return await dbGetBillsByCustomerKey(customerKey);
  });
}

export async function submitBillAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];

    if (!(perms.includes(PERMISSIONS.BILL_CREATE) || perms.includes(PERMISSIONS.BILL_VIEW_ALL))) {
      throw new Error('Forbidden: Missing permission bill_create or bill_view_all');
    }

    await verifyBillBranchAccess(id, session);

    return await withTransaction(async (client) => {
      const billRes = await dbGetBillByIdQuery(id);
      const currentStatus = billRes?.status || 'Draft';
      const monthYear = billRes?.month_year;

      const updatedBill = await dbUpdateBillStatus(id, 'Pending', null, null, client, monthYear);
      await dbCreateBillWorkflowLog({
        bill_id: id,
        from_status: currentStatus,
        to_status: 'Pending',
        changed_by: session.id
      }, client);

      await logSecurityEventAction({
        event: 'Submit Bill',
        details: { id, from: currentStatus }
      });
      return updatedBill;
    });
  });
}

export async function approveBillAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.BILL_APPROVE);
    await verifyBillBranchAccess(id, session);

    return await withTransaction(async (client) => {
      const billRes = await dbGetBillByIdQuery(id);
      const currentStatus = billRes?.status || 'Pending';
      const monthYear = billRes?.month_year;

      const approvalDate = new Date();
      const bill = await dbUpdateBillStatus(id, 'Approved', approvalDate, session.id, client, monthYear);
      await dbCreateBillWorkflowLog({
        bill_id: id,
        from_status: currentStatus,
        to_status: 'Approved',
        changed_by: session.id
      }, client);

      await logSecurityEventAction({
        event: 'Approve Bill',
        details: { id, from: currentStatus }
      });
      return bill;
    });
  });
}

export async function rejectBillAction(id: string, reason: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.BILL_APPROVE); // Map rework to approve or manage_all
    await verifyBillBranchAccess(id, session);

    return await withTransaction(async (client) => {
      const billRes = await dbGetBillByIdQuery(id);
      const currentStatus = billRes?.status || 'Pending';
      const monthYear = billRes?.month_year;

      const bill = await dbUpdateBillStatus(id, 'Rework', null, null, client, monthYear);

      if (billRes) {
        if (billRes.CUSTOMERKEY) {
          // Restore bulk meter readings
          await client.query(
            `UPDATE bulk_meters 
             SET "previousReading" = $1, "currentReading" = $2, month = $3 
             WHERE "customerKeyNumber" = $4`,
            [billRes.PREVREAD, billRes.CURRREAD, billRes.month_year, billRes.CUSTOMERKEY]
          );

          // Restore assigned individual sub-meters readings using reading records of that month
          if (billRes.month_year && billRes.month_year.includes('-')) {
            const [year, month] = billRes.month_year.split('-').map(Number);
            const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
            const endDate = new Date(Date.UTC(year, month, 1)).toISOString();

            const readingsRes = await client.query(
              `SELECT "CUST_KEY", "METER_READING", "PREVIOUS_READING" 
               FROM individual_customer_readings 
               WHERE "CUST_KEY" IN (
                 SELECT "customerKeyNumber" FROM individual_customers 
                 WHERE "assignedBulkMeterId" = $1 AND deleted_at IS NULL
               )
               AND deleted_at IS NULL
               AND "READING_DATE" >= $2 AND "READING_DATE" < $3`,
              [billRes.CUSTOMERKEY, startDate, endDate]
            );

            for (const r of readingsRes.rows) {
              await client.query(
                `UPDATE individual_customers 
                 SET "previousReading" = $1, "currentReading" = $2, month = $3 
                 WHERE "customerKeyNumber" = $4`,
                [r.PREVIOUS_READING, r.METER_READING, billRes.month_year, r.CUST_KEY]
              );
            }
          }
        } else if (billRes.individual_customer_id) {
          // Restore standalone individual customer readings
          await client.query(
            `UPDATE individual_customers 
             SET "previousReading" = $1, "currentReading" = $2, month = $3 
             WHERE "customerKeyNumber" = $4`,
            [billRes.PREVREAD, billRes.CURRREAD, billRes.month_year, billRes.individual_customer_id]
          );
        }
      }

      await dbCreateBillWorkflowLog({
        bill_id: id,
        from_status: currentStatus,
        to_status: 'Rework',
        changed_by: session.id,
        reason: reason
      }, client);

      await logSecurityEventAction({
        event: 'Reject Bill',
        severity: 'warning',
        details: { id, reason, from: currentStatus }
      });
      return bill;
    });
  });
}

export async function postBillAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];

    if (!(perms.includes(PERMISSIONS.BILL_POST) || perms.includes(PERMISSIONS.BILL_VIEW_ALL))) {
      throw new Error('Forbidden: Missing permission bill_post or bill_view_all');
    }

    await verifyBillBranchAccess(id, session);

    return await withTransaction(async (client) => {
      const billRes = await dbGetBillByIdQuery(id);
      const currentStatus = billRes?.status || 'Approved';
      const monthYear = billRes?.month_year;

      const bill = await dbUpdateBillStatus(id, 'Posted', null, null, client, monthYear);
      await dbCreateBillWorkflowLog({
        bill_id: id,
        from_status: currentStatus,
        to_status: 'Posted',
        changed_by: session.id
      }, client);

      await logSecurityEventAction({
        event: 'Post Bill',
        details: { id }
      });
      return bill;
    });
  });
}

export async function correctBillAction(id: string, reason: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.BILL_VIEW_ALL); // Core management needed
    await verifyBillBranchAccess(id, session);

      const { 
      dbGetBillById, 
      dbUpdateBillStatus, 
      dbCreateBillWorkflowLog,
      dbCreateBill, 
      dbUpdateBulkMeter, 
      dbUpdateCustomer,
      dbSyncAgingForCustomer
    } = await import('./db-queries');

    return await withTransaction(async (client) => {
      const originalBill = await dbGetBillById(id);
      if (!originalBill) throw new Error("Original bill not found");
      if (originalBill.status !== 'Posted') throw new Error("Only posted bills can be corrected");

      // 1. Mark original bill as reversed
      await dbUpdateBillStatus(id, 'Reversed', null, null, client, originalBill.month_year);

      // 2. Reconcile balance by recalculating aging debt for the customer
      const customerKey = originalBill.CUSTOMERKEY || originalBill.individual_customer_id;
      if (customerKey) {
        await dbSyncAgingForCustomer(customerKey, client);
      }

      // 3. Skip Credit Note creation (removed per user request)

      // Restore pre-rollover readings from originalBill so the replacement draft is in the pre-rollover state.
      if (originalBill.CUSTOMERKEY) {
        // Restore bulk meter readings
        await client.query(
          `UPDATE bulk_meters 
           SET "previousReading" = $1, "currentReading" = $2, month = $3 
           WHERE "customerKeyNumber" = $4`,
          [originalBill.PREVREAD, originalBill.CURRREAD, originalBill.month_year, originalBill.CUSTOMERKEY]
        );

        // Restore assigned individual sub-meters readings using reading records of that month
        if (originalBill.month_year && originalBill.month_year.includes('-')) {
          const [year, month] = originalBill.month_year.split('-').map(Number);
          const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
          const endDate = new Date(Date.UTC(year, month, 1)).toISOString();

          const readingsRes = await client.query(
            `SELECT "CUST_KEY", "METER_READING", "PREVIOUS_READING" 
             FROM individual_customer_readings 
             WHERE "CUST_KEY" IN (
               SELECT "customerKeyNumber" FROM individual_customers 
               WHERE "assignedBulkMeterId" = $1 AND deleted_at IS NULL
             )
             AND deleted_at IS NULL
             AND "READING_DATE" >= $2 AND "READING_DATE" < $3`,
            [originalBill.CUSTOMERKEY, startDate, endDate]
          );

          for (const r of readingsRes.rows) {
            await client.query(
              `UPDATE individual_customers 
               SET "previousReading" = $1, "currentReading" = $2, month = $3 
               WHERE "customerKeyNumber" = $4`,
              [r.PREVIOUS_READING, r.METER_READING, originalBill.month_year, r.CUST_KEY]
            );
          }
        }
      } else if (originalBill.individual_customer_id) {
        // Restore standalone individual customer readings
        await client.query(
          `UPDATE individual_customers 
           SET "previousReading" = $1, "currentReading" = $2, month = $3 
           WHERE "customerKeyNumber" = $4`,
          [originalBill.PREVREAD, originalBill.CURRREAD, originalBill.month_year, originalBill.individual_customer_id]
        );
      }

      // 4. Create Replacement Draft Bill
      const billData: any = { ...originalBill };
      delete billData.id;
      delete billData.created_at;
      delete billData.updated_at;
      delete billData.BILLKEY;
      delete billData.amount_paid;
      billData.status = 'Draft';
      billData.bill_number = `CORR-${originalBill.bill_number || Date.now()}`;
      billData.notes = `Correction of ${originalBill.bill_number}. Reason: ${reason}`;

      const replacementBill = await dbCreateBill(billData, client);
      if (replacementBill?.id) {
        const billKey = generateBillKey(replacementBill.id);
        await dbUpdateBill(replacementBill.id, { BILLKEY: billKey }, client);
        replacementBill.BILLKEY = billKey;
      }

      await dbCreateBillWorkflowLog({
        bill_id: id,
        from_status: 'Posted',
        to_status: 'Reversed',
        changed_by: session.id,
        reason: `Correction: ${reason}`
      }, client);

      await dbCreateBillWorkflowLog({
        bill_id: replacementBill.id,
        from_status: 'None',
        to_status: 'Draft',
        changed_by: session.id,
        reason: `Correction draft created from reversed bill ${originalBill.bill_number}. Reason: ${reason}`
      }, client);

      await logSecurityEventAction({
        event: 'Correct Bill',
        severity: 'warning',
        details: { id, replacementBillId: replacementBill.id }
      });

      return {
        success: true,
        replacementBillId: replacementBill.id
      };
    });
  });
}



export async function getBillWorkflowLogsAction(billId: string) {
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];
    const hasPerm = perms.includes(PERMISSIONS.BILL_VIEW_ALL) ||
      perms.includes(PERMISSIONS.BILL_VIEW_BRANCH) ||
      perms.some((p: string) => p.startsWith('bill:'));
    if (!hasPerm) throw new Error('Forbidden: Missing billing permissions');
    return await dbGetBillWorkflowLogsQuery(billId);
  });
}

export async function upsertSpatialRecordAction(entityId: string, entityType: 'individual_customer' | 'bulk_meter', data: { xCoordinate: number; yCoordinate: number; zCoordinate?: number | null }) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const perms = session.permissions || [];
    const canAdd = perms.includes(PERMISSIONS.METER_READINGS_CREATE) || perms.includes(PERMISSIONS.METER_READINGS_ADD_MANUAL) || perms.includes(PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL) || perms.includes(PERMISSIONS.METER_READINGS_UPLOAD_BULK);
    if (!canAdd) throw new Error('Forbidden: Missing create reading permission');
    
    return await withTransaction(async (client) => {
      // Branch isolation: verify the entity belongs to the user's branch
      if (entityType === 'individual_customer') {
        const customer = await dbGetCustomerById(entityId, client);
        if (customer) {
          verifyEntityBranchAccess(customer.branch_id || customer.branchId, session, PERMISSIONS.CUSTOMERS_VIEW_ALL, 'customer');
        }
      } else {
        const meter = await dbGetBulkMeterById(entityId, client);
        if (meter) {
          verifyEntityBranchAccess(meter.branch_id || meter.branchId, session, PERMISSIONS.BULK_METERS_VIEW_ALL, 'bulk meter');
        }
      }

      const res = await dbUpsertSpatialRecord(entityId, entityType, data, client);
      
      // Update legacy columns
      const legacyData = {
        x_coordinate: data.xCoordinate,
        y_coordinate: data.yCoordinate,
        ...(data.zCoordinate !== undefined && { z_coordinate: data.zCoordinate })
      };
      
      if (entityType === 'individual_customer') {
        await dbUpdateCustomer(entityId, legacyData, client);
      } else {
        await dbUpdateBulkMeter(entityId, legacyData, client);
      }
      
      return res;
    });
  });
}


export async function getLatestReadingsByRouteAction(routeKey: string) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    // Fetch meters and customers for the route in parallel
    const [{ data: meters }, { data: customers }] = await Promise.all([
      getAllBulkMetersAction({ routeKey }),
      getAllCustomersAction({ routeKey })
    ]);

    const meterKeys = meters?.map((m: any) => m.customerKeyNumber) || [];
    const customerKeys = customers?.map((c: any) => c.customerKeyNumber) || [];

    const [bulkReadings, individualReadings] = await Promise.all([
      meterKeys.length > 0 ? dbGetLatestReadingsByMeters(meterKeys, 'bulk') : Promise.resolve([]),
      customerKeys.length > 0 ? dbGetLatestReadingsByMeters(customerKeys, 'individual') : Promise.resolve([])
    ]);

    return {
      bulk: bulkReadings,
      individual: individualReadings
    };
  });
}

export async function getAllIndividualCustomerReadingsAction() {
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];
    const hasPerm = perms.includes(PERMISSIONS.METER_READINGS_VIEW_ALL) ||
      perms.includes(PERMISSIONS.METER_READINGS_VIEW_BRANCH) ||
      perms.includes(PERMISSIONS.METER_READINGS_CREATE);
    if (!hasPerm) throw new Error('Forbidden: Missing meter readings permission');

    // Branch isolation
    const filterBranchId = getEffectiveBranchId(session, undefined, PERMISSIONS.METER_READINGS_VIEW_ALL);

    // Reader isolation:
    const readerId = !perms.includes(PERMISSIONS.METER_READINGS_VIEW_ALL) && perms.includes(PERMISSIONS.ROUTES_VIEW_ASSIGNED)
      ? session.id
      : undefined;

    return await dbGetAllIndividualCustomerReadings(filterBranchId, readerId);
  });
}
export async function createIndividualCustomerReadingAction(
  reading: IndividualCustomerReadingInsert,
  spatialData?: { xCoordinate?: number; yCoordinate?: number; zCoordinate?: number },
  meterPhoto?: string
) {
  const status = await getReadingPeriodStatusAction();
  if (status === 'Closed') {
    return { success: false, message: "Reading period is currently closed globally." };
  }
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const perms = session.permissions || [];
    const canAddIndividual = canCreateMeterReadingForType((permission) => perms.includes(permission), 'individual');
    if (!canAddIndividual) throw new Error('Forbidden: Missing permission to add individual readings');
    
    return await withTransaction(async (client) => {
      // Fetch current state for sync
      const custId = reading.individual_customer_id || (reading as any).CUST_KEY;
      const customer = await dbGetCustomerById(custId, client);
      if (!customer) throw new Error("Customer not found");
      // Branch isolation: ensure the customer belongs to the user's branch
      verifyEntityBranchAccess(customer.branch_id || customer.branchId, session, PERMISSIONS.METER_READINGS_VIEW_ALL, 'customer');


      const result = await dbCreateIndividualCustomerReading(reading, client);
      
      if (spatialData && (spatialData.xCoordinate !== undefined || spatialData.yCoordinate !== undefined)) {
        await dbUpsertSpatialRecord(custId, 'individual_customer', spatialData, client);
      }

      // Sync the main customer record
      const rDate = (reading as any).READING_DATE || (reading as any).reading_date || reading.reading_date;
      const rValue = (reading as any).METER_READING !== undefined ? (reading as any).METER_READING : ((reading as any).reading_value !== undefined ? (reading as any).reading_value : reading.reading_value);
      
      const readingDate = rDate instanceof Date ? rDate : new Date(rDate as string);
      const monthYear = format(readingDate, 'yyyy-MM');

      const readingWithPrevious = reading as any;
      const previousReadingValue = readingWithPrevious.PREVIOUS_READING !== undefined
        ? readingWithPrevious.PREVIOUS_READING
        : readingWithPrevious.previousReading !== undefined
          ? readingWithPrevious.previousReading
          : customer.currentReading ?? 0;

      await dbUpdateCustomer(custId, { 
        previousReading: previousReadingValue,
        currentReading: rValue,
        month: monthYear
      }, client);

      // Save photo to dedicated table if provided
      if (meterPhoto && result?.id) {
        await dbCreateMeterReadingPhoto({
          reading_id: String(result.id),
          photo_data: meterPhoto,
        }, client);
      }

      await logSecurityEventAction({
        event: 'Create Indiv. Reading',
        customerKeyNumber: reading.individual_customer_id,
        details: { reading, spatialData, hasPhoto: !!meterPhoto }
      });
      
      return result;
    });
  });
}

export async function batchCreateIndividualCustomerReadingsAction(
  items: Array<{ reading: IndividualCustomerReadingInsert; previousReading?: number }>
): Promise<{ success: boolean; data?: { count: number; rowResults: Array<{ custKey: string; success: boolean; error?: string }> }; message?: string; error?: unknown }> {
  if (!items || items.length === 0) return { success: true, data: { count: 0, rowResults: [] } };

  // 1. Check reading period status ONCE
  const periodStatus = await getReadingPeriodStatusAction();
  if (periodStatus === 'Closed') {
    return { success: false, message: 'Reading period is currently closed globally.' };
  }

  // 2. Authenticate once
  const session = await getSession();
  if (!session || !session.id) return { success: false, message: 'Unauthorized' };
  const perms = session.permissions || [];
  if (!canCreateMeterReadingForType((p) => perms.includes(p), 'individual')) {
    return { success: false, message: 'Forbidden: Missing permission to add individual readings' };
  }

  // 3. Pre-fetch all customers in a SINGLE query
  const custKeys = [...new Set(items.map(i => (i.reading as any).CUST_KEY || (i.reading as any).individual_customer_id).filter(Boolean))];
  const custRows: any[] = custKeys.length > 0
    ? await query(
        `SELECT "customerKeyNumber", "currentReading", branch_id FROM individual_customers WHERE "customerKeyNumber" = ANY($1) AND deleted_at IS NULL`,
        [custKeys]
      )
    : [];
  const custMap = new Map<string, any>(custRows.map(c => [String(c.customerKeyNumber).trim(), c]));

  // 4. Execute all inserts in a single transaction, collect per-row results
  const rowResults: Array<{ custKey: string; success: boolean; error?: string }> = [];
  let createdCount = 0;

  // Track meter updates: custKey -> { previousReading, currentReading, monthYear }
  const meterUpdates = new Map<string, { previousReading: number; currentReading: number; monthYear: string }>();

  await withTransaction(async (client) => {
    for (const item of items) {
      const reading = item.reading as any;
      const custKey = String(reading.CUST_KEY || reading.individual_customer_id || '').trim();

      const customer = custMap.get(custKey);
      if (!customer) {
        rowResults.push({ custKey, success: false, error: `Customer '${custKey}' not found.` });
        continue;
      }

      // Branch isolation
      try {
        verifyEntityBranchAccess(customer.branch_id || customer.branchId, session, PERMISSIONS.METER_READINGS_VIEW_ALL, 'customer');
      } catch (e) {
        rowResults.push({ custKey, success: false, error: (e as Error).message });
        continue;
      }

      try {
        await dbCreateIndividualCustomerReading(reading, client);
        createdCount++;
        rowResults.push({ custKey, success: true });

        // Collect meter state for batch update
        const rDate = reading.READING_DATE || reading.reading_date || '';
        const monthYear = rDate ? String(rDate).slice(0, 7) : format(new Date(), 'yyyy-MM');
        const rValue = Number(reading.METER_READING ?? reading.reading_value ?? 0);
        const prevValue = item.previousReading ?? Number(reading.PREVIOUS_READING ?? customer.currentReading ?? 0);
        // Only keep the latest reading per meter
        const existing = meterUpdates.get(custKey);
        if (!existing || monthYear >= existing.monthYear) {
          meterUpdates.set(custKey, { previousReading: prevValue, currentReading: rValue, monthYear });
        }
      } catch (e) {
        rowResults.push({ custKey, success: false, error: (e as Error).message });
      }
    }

    // 5. Batch update all meter records with a single UPDATE...CASE query
    if (meterUpdates.size > 0) {
      const entries = [...meterUpdates.entries()];
      const prevCases = entries.map((_, i) => `WHEN "customerKeyNumber" = $${i * 4 + 1} THEN $${i * 4 + 2}::numeric`).join(' ');
      const currCases = entries.map((_, i) => `WHEN "customerKeyNumber" = $${i * 4 + 1} THEN $${i * 4 + 3}::numeric`).join(' ');
      const monthCases = entries.map((_, i) => `WHEN "customerKeyNumber" = $${i * 4 + 1} THEN $${i * 4 + 4}::text`).join(' ');
      const params: any[] = [];
      entries.forEach(([key, val]) => params.push(key, val.previousReading, val.currentReading, val.monthYear));
      const keys = entries.map((_, i) => `$${i * 4 + 1}`);
      const batchUpdateSql = `UPDATE individual_customers SET "previousReading" = CASE ${prevCases} END, "currentReading" = CASE ${currCases} END, "month" = CASE ${monthCases} END WHERE "customerKeyNumber" IN (${keys.join(',')}) AND deleted_at IS NULL`;
      await client.query(batchUpdateSql, params);
    }
  });

  return { success: true, data: { count: createdCount, rowResults } };
}

export async function updateIndividualCustomerReadingAction(id: string, reading: IndividualCustomerReadingUpdate) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.METER_READINGS_UPDATE);
    // Fetch the reading to get its CUST_KEY, then verify branch ownership
    const rows: any = await query(
      'SELECT "CUST_KEY" FROM individual_customer_readings WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
      [id]
    );
    const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0];
    if (row?.CUST_KEY) {
      const customer = await dbGetCustomerById(row.CUST_KEY);
      if (customer) {
        verifyEntityBranchAccess(customer.branch_id || customer.branchId, session, PERMISSIONS.METER_READINGS_VIEW_ALL, 'meter reading');
      }
    }
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
    const session = await checkPermission(PERMISSIONS.METER_READINGS_DELETE);
    // Fetch the reading to get its CUST_KEY, then verify branch ownership
    const rows: any = await query(
      'SELECT "CUST_KEY" FROM individual_customer_readings WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
      [id]
    );
    const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0];
    if (row?.CUST_KEY) {
      const customer = await dbGetCustomerById(row.CUST_KEY);
      if (customer) {
        verifyEntityBranchAccess(customer.branch_id || customer.branchId, session, PERMISSIONS.METER_READINGS_VIEW_ALL, 'meter reading');
      }
    }
    await dbDeleteIndividualCustomerReading(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Indiv. Reading',
      severity: 'warning',
      details: { id }
    });
  });
}

export async function getAllBulkMeterReadingsAction() {
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];
    const hasPerm = perms.includes(PERMISSIONS.METER_READINGS_VIEW_ALL) ||
      perms.includes(PERMISSIONS.METER_READINGS_VIEW_BRANCH) ||
      perms.includes(PERMISSIONS.METER_READINGS_CREATE);
    if (!hasPerm) throw new Error('Forbidden: Missing meter readings permission');

    // Branch isolation
    const filterBranchId = getEffectiveBranchId(session, undefined, PERMISSIONS.METER_READINGS_VIEW_ALL);

    // Reader isolation:
    const readerId = !perms.includes(PERMISSIONS.METER_READINGS_VIEW_ALL) && perms.includes(PERMISSIONS.ROUTES_VIEW_ASSIGNED)
      ? session.id
      : undefined;

    return await dbGetAllBulkMeterReadings(filterBranchId, readerId);
  });
}
export async function createBulkMeterReadingAction(
  reading: BulkMeterReadingInsert,
  spatialData?: { xCoordinate?: number; yCoordinate?: number; zCoordinate?: number },
  meterPhoto?: string
) {
  const status = await getReadingPeriodStatusAction();
  if (status === 'Closed') {
    return { success: false, message: "Reading period is currently closed globally." };
  }
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const perms = session.permissions || [];
    const canAddBulk = canCreateMeterReadingForType((permission) => perms.includes(permission), 'bulk');
    if (!canAddBulk) throw new Error('Forbidden: Missing permission to add bulk readings');
    
    return await withTransaction(async (client) => {
      // Fetch current state for sync
      const custKey = reading.CUSTOMERKEY || (reading as any).CUST_KEY;
      const meter = await dbGetBulkMeterById(custKey, client);
      if (!meter) throw new Error("Bulk meter not found");
      // Branch isolation: ensure the target meter belongs to the user's branch
      verifyEntityBranchAccess(meter.branch_id || meter.branchId, session, PERMISSIONS.BULK_METERS_VIEW_ALL, 'bulk meter');

      const result = await dbCreateBulkMeterReading(reading, client);
      
      if (spatialData && (spatialData.xCoordinate !== undefined || spatialData.yCoordinate !== undefined)) {
        await dbUpsertSpatialRecord(custKey, 'bulk_meter', spatialData, client);
      }

      // Sync the main bulk meter record
      const rDate = (reading as any).READING_DATE || (reading as any).reading_date || reading.reading_date;
      const rValue = (reading as any).METER_READING !== undefined ? (reading as any).METER_READING : ((reading as any).reading_value !== undefined ? (reading as any).reading_value : reading.reading_value);

      const readingDate = rDate instanceof Date ? rDate : new Date(rDate as string);
      const monthYear = format(readingDate, 'yyyy-MM');

      const readingWithPrevious = reading as any;
      const previousReadingValue = readingWithPrevious.PREVIOUS_READING !== undefined
        ? readingWithPrevious.PREVIOUS_READING
        : readingWithPrevious.previousReading !== undefined
          ? readingWithPrevious.previousReading
          : meter.currentReading ?? 0;

      await dbUpdateBulkMeter(custKey, { 
        previousReading: previousReadingValue,
        currentReading: rValue,
        month: monthYear
      }, client);

      // Save photo to dedicated table if provided
      if (meterPhoto && result?.id) {
        await dbCreateMeterReadingPhoto({
          reading_id: String(result.id),
          photo_data: meterPhoto,
        }, client);
      }

      await logSecurityEventAction({
        event: 'Create Bulk Reading',
        customerKeyNumber: reading.CUSTOMERKEY,
        details: { reading, spatialData, hasPhoto: !!meterPhoto }
      });
      
      return result;
    });
  });
}

export async function batchCreateBulkMeterReadingsAction(
  items: Array<{ reading: BulkMeterReadingInsert; previousReading?: number }>
): Promise<{ success: boolean; data?: { count: number; rowResults: Array<{ custKey: string; success: boolean; error?: string }> }; message?: string; error?: unknown }> {
  if (!items || items.length === 0) return { success: true, data: { count: 0, rowResults: [] } };

  // 1. Check reading period status ONCE
  const periodStatus = await getReadingPeriodStatusAction();
  if (periodStatus === 'Closed') {
    return { success: false, message: 'Reading period is currently closed globally.' };
  }

  // 2. Authenticate once
  const session = await getSession();
  if (!session || !session.id) return { success: false, message: 'Unauthorized' };
  const perms = session.permissions || [];
  if (!canCreateMeterReadingForType((p) => perms.includes(p), 'bulk')) {
    return { success: false, message: 'Forbidden: Missing permission to add bulk readings' };
  }

  // 3. Pre-fetch all bulk meters in a SINGLE query
  const custKeys = [...new Set(items.map(i => (i.reading as any).CUSTOMERKEY || (i.reading as any).CUST_KEY).filter(Boolean))];
  const meterRows: any[] = custKeys.length > 0
    ? await query(
        `SELECT "customerKeyNumber", "currentReading", branch_id FROM bulk_meters WHERE "customerKeyNumber" = ANY($1) AND deleted_at IS NULL`,
        [custKeys]
      )
    : [];
  const meterMap = new Map<string, any>(meterRows.map(m => [String(m.customerKeyNumber).trim(), m]));

  // 4. Execute all inserts in a single transaction, collect per-row results
  const rowResults: Array<{ custKey: string; success: boolean; error?: string }> = [];
  let createdCount = 0;

  // Track meter updates: custKey -> { previousReading, currentReading, monthYear }
  const meterUpdates = new Map<string, { previousReading: number; currentReading: number; monthYear: string }>();

  await withTransaction(async (client) => {
    for (const item of items) {
      const reading = item.reading as any;
      const custKey = String(reading.CUSTOMERKEY || reading.CUST_KEY || '').trim();

      const meter = meterMap.get(custKey);
      if (!meter) {
        rowResults.push({ custKey, success: false, error: `Bulk meter '${custKey}' not found.` });
        continue;
      }

      // Branch isolation
      try {
        verifyEntityBranchAccess(meter.branch_id || meter.branchId, session, PERMISSIONS.BULK_METERS_VIEW_ALL, 'bulk meter');
      } catch (e) {
        rowResults.push({ custKey, success: false, error: (e as Error).message });
        continue;
      }

      try {
        await dbCreateBulkMeterReading(reading, client);
        createdCount++;
        rowResults.push({ custKey, success: true });

        // Collect meter state for batch update
        const rDate = reading.READING_DATE || reading.reading_date || '';
        const monthYear = rDate ? String(rDate).slice(0, 7) : format(new Date(), 'yyyy-MM');
        const rValue = Number(reading.METER_READING ?? reading.reading_value ?? 0);
        const prevValue = item.previousReading ?? Number(reading.PREVIOUS_READING ?? meter.currentReading ?? 0);
        const existing = meterUpdates.get(custKey);
        if (!existing || monthYear >= existing.monthYear) {
          meterUpdates.set(custKey, { previousReading: prevValue, currentReading: rValue, monthYear });
        }
      } catch (e) {
        rowResults.push({ custKey, success: false, error: (e as Error).message });
      }
    }

    // 5. Batch update all bulk meter records with a single UPDATE...CASE query
    if (meterUpdates.size > 0) {
      const entries = [...meterUpdates.entries()];
      const prevCases = entries.map((_, i) => `WHEN "customerKeyNumber" = $${i * 4 + 1} THEN $${i * 4 + 2}::numeric`).join(' ');
      const currCases = entries.map((_, i) => `WHEN "customerKeyNumber" = $${i * 4 + 1} THEN $${i * 4 + 3}::numeric`).join(' ');
      const monthCases = entries.map((_, i) => `WHEN "customerKeyNumber" = $${i * 4 + 1} THEN $${i * 4 + 4}::text`).join(' ');
      const params: any[] = [];
      entries.forEach(([key, val]) => params.push(key, val.previousReading, val.currentReading, val.monthYear));
      const keys = entries.map((_, i) => `$${i * 4 + 1}`);
      const batchUpdateSql = `UPDATE bulk_meters SET "previousReading" = CASE ${prevCases} END, "currentReading" = CASE ${currCases} END, "month" = CASE ${monthCases} END WHERE "customerKeyNumber" IN (${keys.join(',')}) AND deleted_at IS NULL`;
      await client.query(batchUpdateSql, params);
    }
  });

  return { success: true, data: { count: createdCount, rowResults } };
}

export async function getPhotosByReadingIdAction(readingId: string) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.METER_READINGS_CREATE);
    return await dbGetPhotosByReadingId(readingId);
  });
}
export async function uploadReadingPhotoAction(
  readingId: string,
  photoData: string
) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.METER_READINGS_CREATE);
    return await dbCreateMeterReadingPhoto({
      reading_id: readingId,
      photo_data: photoData,
    });
  });
}

export async function getBulkAndSubmeterPeriodReadingsAction(bulkMeterKey: string, monthYear: string) {
  return await wrap(async () => {
    await checkPermissionAny(
      PERMISSIONS.BULK_METERS_VIEW_ALL,
      PERMISSIONS.BULK_METERS_VIEW_BRANCH,
      PERMISSIONS.BULK_METERS_EDIT_READINGS_VIEW,
      PERMISSIONS.BULK_METERS_EDIT_READINGS,
      PERMISSIONS.METER_READINGS_EDIT_RECALCULATE_VIEW,
      PERMISSIONS.METER_READINGS_EDIT_RECALCULATE,
      PERMISSIONS.BILL_VIEW_ALL,
      PERMISSIONS.BILL_VIEW_BRANCH
    );

    const bulkKey = (bulkMeterKey || '').trim();
    if (!bulkKey) return { bulkMeter: null, assignedCustomers: [] };

    const [year, month] = monthYear.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 1)).toISOString();

    // 0. Resolve bulk meter — the PK is customerKeyNumber; also try METER_KEY / INST_KEY
    const bmLookup: any[] = await query(
      `SELECT "customerKeyNumber", name, "METER_KEY", "INST_KEY", "meterSize", charge_group, sewerage_connection, "previousReading", "currentReading" 
       FROM bulk_meters 
       WHERE (LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1)) 
          OR LOWER(TRIM("METER_KEY"::text)) = LOWER(TRIM($1))
          OR LOWER(TRIM("INST_KEY"::text)) = LOWER(TRIM($1)))
         AND deleted_at IS NULL
       LIMIT 1`,
      [bulkKey]
    );

    const bm = bmLookup[0];
    // Use the resolved customerKeyNumber so the rest of the queries use the canonical key
    const resolvedKey = bm?.customerKeyNumber || bulkKey;

    // 1. Fetch Bulk Meter Period Reading & Bill info
    const bulkSql = `
      SELECT 
        bm."customerKeyNumber",
        bm.name,
        bm."METER_KEY",
        bm."meterSize",
        bm.charge_group,
        bm.sewerage_connection,
        bm."previousReading" as "bmPrevReading",
        bm."currentReading" as "bmCurrReading",
        r."PREVIOUS_READING" as "rPrevReading",
        r."METER_READING" as "rCurrReading",
        r."READING_DATE" as "readingDate",
        prev_r."METER_READING" as "priorReading",
        b.id as "billId",
        b.status as "billStatus",
        b."THISMONTHBILLAMT" as "billAmount",
        b."TOTALBILLAMOUNT" as "totalBillAmount",
        b.difference_usage as "diffUsage",
        b."PREVREAD" as "billPrevRead",
        b."CURRREAD" as "billCurrRead",
        last_b."CURRREAD" as "lastBillCurr"
      FROM bulk_meters bm
      LEFT JOIN LATERAL (
        SELECT "PREVIOUS_READING", "METER_READING", "READING_DATE"
        FROM bulk_meter_readings
        WHERE "CUST_KEY" = bm."customerKeyNumber"
          AND deleted_at IS NULL
          AND (
            ("READING_DATE" >= $1 AND "READING_DATE" < $2)
            OR (TO_CHAR("READING_DATE" AT TIME ZONE 'Africa/Addis_Ababa', 'YYYY-MM') = $3)
          )
        ORDER BY "READING_DATE" DESC
        LIMIT 1
      ) r ON true
      LEFT JOIN LATERAL (
        SELECT "METER_READING", "READING_DATE"
        FROM bulk_meter_readings
        WHERE "CUST_KEY" = bm."customerKeyNumber"
          AND deleted_at IS NULL
          AND "READING_DATE" < COALESCE(r."READING_DATE", $1::timestamptz)
        ORDER BY "READING_DATE" DESC
        LIMIT 1
      ) prev_r ON true
      LEFT JOIN bills b ON bm."customerKeyNumber" = b."CUSTOMERKEY"
        AND b.month_year = $3
        AND b.status != 'Reversed'
      LEFT JOIN bills last_b ON bm."customerKeyNumber" = last_b."CUSTOMERKEY"
        AND last_b.month_year = (SELECT TO_CHAR(TO_DATE($3, 'YYYY-MM') - INTERVAL '1 month', 'YYYY-MM'))
        AND last_b.status != 'Reversed'
      WHERE LOWER(TRIM(bm."customerKeyNumber")) = LOWER(TRIM($4))
        AND bm.deleted_at IS NULL
      LIMIT 1
    `;
    const bulkRows: any[] = await query(bulkSql, [startDate, endDate, monthYear, resolvedKey]);
    
    let bulkData: any = null;
    if (bulkRows.length > 0) {
      const bRow = bulkRows[0];
      let curr = Number(bRow.billCurrRead ?? bRow.rCurrReading ?? bRow.bmCurrReading ?? 0);
      let prev: number;

      if (bRow.billPrevRead != null) {
        prev = Number(bRow.billPrevRead);
      } else if (bRow.rPrevReading != null && Number(bRow.rPrevReading) !== Number(bRow.rCurrReading) && Number(bRow.rPrevReading) > 0) {
        prev = Number(bRow.rPrevReading);
      } else if (bRow.priorReading != null) {
        prev = Number(bRow.priorReading);
      } else if (bRow.lastBillCurr != null) {
        prev = Number(bRow.lastBillCurr);
      } else if (Number(bRow.bmPrevReading ?? 0) !== Number(bRow.bmCurrReading ?? 0)) {
        prev = Number(bRow.bmPrevReading);
      } else {
        prev = curr;
      }

      bulkData = {
        customerKeyNumber: bRow.customerKeyNumber,
        name: bRow.name,
        meterKey: bRow.METER_KEY,
        meterSize: Number(bRow.meterSize || 0.5),
        chargeGroup: bRow.charge_group || 'Non-domestic',
        sewerageConnection: bRow.sewerage_connection || 'No',
        previousReading: prev,
        currentReading: curr,
        billId: bRow.billId,
        billStatus: bRow.billStatus,
        billAmount: bRow.billAmount ? Number(bRow.billAmount) : null,
        totalBillAmount: bRow.totalBillAmount ? Number(bRow.totalBillAmount) : null,
        differenceUsage: bRow.diffUsage != null ? Number(bRow.diffUsage) : null,
        isPosted: bRow.billStatus === 'Posted',
      };
    } else if (bm) {
      // Bulk meter exists but no bill/reading for this period
      bulkData = {
        customerKeyNumber: bm.customerKeyNumber,
        name: bm.name,
        meterKey: bm.METER_KEY,
        meterSize: Number(bm.meterSize || 0.5),
        chargeGroup: bm.charge_group || 'Non-domestic',
        sewerageConnection: bm.sewerage_connection || 'No',
        previousReading: Number(bm.previousReading || 0),
        currentReading: Number(bm.currentReading || 0),
        billId: null,
        billStatus: null,
        billAmount: null,
        totalBillAmount: null,
        differenceUsage: null,
        isPosted: false,
      };
    }

    // 2. Fetch Assigned Sub-meter Period Readings
    // individual_customers.assignedBulkMeterId stores the bulk meter's customerKeyNumber
    const subSql = `
      SELECT 
        ic."customerKeyNumber",
        ic.name,
        ic."meterSize",
        ic."customerType",
        ic."sewerageConnection",
        ic."previousReading" as "icPrevReading",
        ic."currentReading" as "icCurrReading",
        r."PREVIOUS_READING" as "rPrevReading",
        r."METER_READING" as "rCurrReading",
        r."READING_DATE" as "readingDate",
        prev_r."METER_READING" as "priorReading",
        b.id as "billId",
        b.status as "billStatus",
        b."THISMONTHBILLAMT" as "billAmount",
        b."PREVREAD" as "billPrevRead",
        b."CURRREAD" as "billCurrRead",
        last_b."CURRREAD" as "lastMonthCurr"
      FROM individual_customers ic
      LEFT JOIN LATERAL (
        SELECT "PREVIOUS_READING", "METER_READING", "READING_DATE"
        FROM individual_customer_readings
        WHERE "CUST_KEY" = ic."customerKeyNumber"
          AND deleted_at IS NULL
          AND (
            ("READING_DATE" >= $1 AND "READING_DATE" < $2)
            OR (TO_CHAR("READING_DATE" AT TIME ZONE 'Africa/Addis_Ababa', 'YYYY-MM') = $3)
          )
        ORDER BY "READING_DATE" DESC
        LIMIT 1
      ) r ON true
      LEFT JOIN LATERAL (
        SELECT "METER_READING", "READING_DATE"
        FROM individual_customer_readings
        WHERE "CUST_KEY" = ic."customerKeyNumber"
          AND deleted_at IS NULL
          AND "READING_DATE" < COALESCE(r."READING_DATE", $1::timestamptz)
        ORDER BY "READING_DATE" DESC
        LIMIT 1
      ) prev_r ON true
      LEFT JOIN bills b ON ic."customerKeyNumber" = b.individual_customer_id
        AND b.month_year = $3
        AND b.status != 'Reversed'
      LEFT JOIN bills last_b ON ic."customerKeyNumber" = last_b.individual_customer_id
        AND last_b.month_year = (SELECT TO_CHAR(TO_DATE($3, 'YYYY-MM') - INTERVAL '1 month', 'YYYY-MM'))
        AND last_b.status != 'Reversed'
      WHERE (
        LOWER(TRIM(ic."assignedBulkMeterId")) = LOWER(TRIM($4))
        OR LOWER(TRIM(ic."assignedBulkMeterId")) = (SELECT LOWER(TRIM("customerKeyNumber")) FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($4)) LIMIT 1)
      )
        AND ic.deleted_at IS NULL
      ORDER BY ic.name ASC, ic."customerKeyNumber" ASC
    `;
    const subRows: any[] = await query(subSql, [startDate, endDate, monthYear, resolvedKey]);

    const assignedCustomers = subRows.map((row: any) => {
      let curr = Number(row.billCurrRead ?? row.rCurrReading ?? row.icCurrReading ?? 0);
      let prev: number;

      if (row.billPrevRead != null) {
        prev = Number(row.billPrevRead);
      } else if (row.rPrevReading != null && Number(row.rPrevReading) !== Number(row.rCurrReading) && Number(row.rPrevReading) > 0) {
        prev = Number(row.rPrevReading);
      } else if (row.priorReading != null) {
        prev = Number(row.priorReading);
      } else if (row.lastMonthCurr != null) {
        prev = Number(row.lastMonthCurr);
      } else if (Number(row.icPrevReading ?? 0) !== Number(row.icCurrReading ?? 0)) {
        prev = Number(row.icPrevReading);
      } else {
        prev = curr;
      }

      return {
        customerKeyNumber: row.customerKeyNumber,
        name: row.name,
        meterSize: Number(row.meterSize || 0.5),
        customerType: row.customerType || 'Domestic',
        sewerageConnection: row.sewerageConnection || 'No',
        previous: prev,
        current: curr,
        billId: row.billId,
        billStatus: row.billStatus,
        billAmount: row.billAmount ? Number(row.billAmount) : null
      };
    });

    return {
      bulkMeter: bulkData,
      assignedCustomers
    };
  });
}

export async function getAssignedCustomerReadingsAction(bulkMeterId: string, monthYear: string) {
  return await wrap(async () => {
    const res = await getBulkAndSubmeterPeriodReadingsAction(bulkMeterId, monthYear);
    return res.assignedCustomers || [];
  });
}

export async function recalculateBulkBillAction(bulkMeterId: string, monthYear: string) {
  return await wrap(async () => {
    await checkPermissionAny(
      PERMISSIONS.BULK_METERS_EDIT_READINGS,
      PERMISSIONS.METER_READINGS_EDIT_RECALCULATE
    );

    const {
      dbGetBillById,
      dbUpdateBill,
      dbGetCustomerById,
      dbSyncAgingForCustomer,
    } = await import('./db-queries');

    const { calculateBill } = await import('./billing');

    return await withTransaction(async (client) => {
      const bulkBillRes = await client.query(
        `SELECT id FROM bills WHERE "CUSTOMERKEY" = $1 AND month_year = $2 AND status != 'Reversed' LIMIT 1`,
        [bulkMeterId, monthYear]
      );
      if (bulkBillRes.rows.length === 0) return { success: true, message: 'No bulk bill found' };
      const bulkBillId = bulkBillRes.rows[0].id;
      const bulkBill = await dbGetBillById(bulkBillId);

      const subCustomersRes = await client.query(
        `SELECT "customerKeyNumber" FROM individual_customers 
         WHERE (
           LOWER(TRIM("assignedBulkMeterId")) = LOWER(TRIM($1))
           OR LOWER(TRIM("assignedBulkMeterId")) = (SELECT LOWER(TRIM("customerKeyNumber")) FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1)) LIMIT 1)
         ) AND deleted_at IS NULL`,
        [bulkMeterId]
      );
      const subCustKeys = subCustomersRes.rows.map((r: any) => r.customerKeyNumber);

      let totalIndivUsage = 0;
      if (subCustKeys.length > 0) {
        const [year, month] = monthYear.split('-').map(Number);
        const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
        const endDate = new Date(Date.UTC(year, month, 1)).toISOString();
        const placeholders = subCustKeys.map((_: string, i: number) => `$${i + 3}`).join(',');

        const usageRes = await client.query(
          `SELECT
             ic."customerKeyNumber",
             COALESCE(b."CURRREAD", r."METER_READING", ic."currentReading", 0) AS curr_read,
             COALESCE(
               b."PREVREAD",
               CASE WHEN r."PREVIOUS_READING" IS NOT NULL AND r."PREVIOUS_READING" != r."METER_READING" AND r."PREVIOUS_READING" > 0 THEN r."PREVIOUS_READING" END,
               prev_r."METER_READING",
               last_b."CURRREAD",
               CASE WHEN ic."previousReading" != ic."currentReading" THEN ic."previousReading" END,
               ic."currentReading",
               0
             ) AS prev_read
           FROM individual_customers ic
           LEFT JOIN LATERAL (
             SELECT "PREVIOUS_READING", "METER_READING", "READING_DATE"
             FROM individual_customer_readings
             WHERE "CUST_KEY" = ic."customerKeyNumber"
               AND deleted_at IS NULL
               AND (
                 ("READING_DATE" >= $1 AND "READING_DATE" < $2)
                 OR (TO_CHAR("READING_DATE" AT TIME ZONE 'Africa/Addis_Ababa', 'YYYY-MM') = $${subCustKeys.length + 3})
               )
             ORDER BY "READING_DATE" DESC
             LIMIT 1
           ) r ON true
           LEFT JOIN LATERAL (
             SELECT "METER_READING"
             FROM individual_customer_readings
             WHERE "CUST_KEY" = ic."customerKeyNumber"
               AND deleted_at IS NULL
               AND "READING_DATE" < COALESCE(r."READING_DATE", $1::timestamptz)
             ORDER BY "READING_DATE" DESC
             LIMIT 1
           ) prev_r ON true
           LEFT JOIN bills b
             ON b.individual_customer_id = ic."customerKeyNumber"
             AND b.month_year = $${subCustKeys.length + 3}
             AND b.status != 'Reversed'
           LEFT JOIN bills last_b
             ON last_b.individual_customer_id = ic."customerKeyNumber"
             AND last_b.month_year = (SELECT TO_CHAR(TO_DATE($${subCustKeys.length + 3}, 'YYYY-MM') - INTERVAL '1 month', 'YYYY-MM'))
             AND last_b.status != 'Reversed'
           WHERE ic."customerKeyNumber" IN (${placeholders})`,
          [startDate, endDate, ...subCustKeys, monthYear]
        );
        for (const row of usageRes.rows) {
          totalIndivUsage += Math.max(0, Number(row.curr_read || 0) - Number(row.prev_read || 0));
        }
      }

      const bulkMeter = await dbGetCustomerById(bulkMeterId, client) || await client.query('SELECT * FROM bulk_meters WHERE "customerKeyNumber" = $1', [bulkMeterId]).then((r: any) => r.rows[0]);
      const bulkUsage = Number(bulkBill.CURRREAD || 0) - Number(bulkBill.PREVREAD || 0);
      const bulkDiffUsage = bulkUsage - totalIndivUsage;

      const chargeGroup = bulkMeter?.charge_group || bulkMeter?.customerType || bulkBill.snapshot_data?.chargeGroup || 'Non-domestic';
      const sewerageConn = bulkMeter?.sewerageConnection || bulkMeter?.sewerage_connection || bulkBill.snapshot_data?.sewerageConnection || 'No';
      const meterSize = Number(bulkMeter?.meterSize || 0.5);

      const bulkCalc = await calculateBill(
        bulkDiffUsage,
        chargeGroup as any,
        sewerageConn as any,
        meterSize,
        monthYear
      );

      const currentOutstanding = Number(bulkBill.OUTSTANDINGAMT || bulkBill.balance_carried_forward || 0);

      // Fetch existing snapshot_data to merge (preserve other fields like chargeGroup)
      const existingSnapshotRes = await client.query(
        `SELECT snapshot_data FROM bills WHERE id = $1 LIMIT 1`,
        [bulkBillId]
      );
      const existingSnapshot = existingSnapshotRes.rows[0]?.snapshot_data || {};

      await dbUpdateBill(bulkBillId, {
        difference_usage: bulkCalc.effectiveUsage,
        THISMONTHBILLAMT: bulkCalc.totalBill,
        TOTALBILLAMOUNT: bulkCalc.totalBill + currentOutstanding,
        base_water_charge: bulkCalc.baseWaterCharge,
        sewerage_charge: bulkCalc.sewerageCharge,
        meter_rent: bulkCalc.meterRent,
        maintenance_fee: bulkCalc.maintenanceFee,
        sanitation_fee: bulkCalc.sanitationFee,
        vat_amount: bulkCalc.vatAmount,
        snapshot_data: {
          ...existingSnapshot,
          totalIndividualUsage: totalIndivUsage,
        } as any,
      }, client, monthYear);

      await dbSyncAgingForCustomer(bulkMeterId, client);
      return { success: true };
    });
  });
}

export async function updateBulkAndAssignedReadingsAction(payload: {
  bulkBillId?: string;
  bulkMeterKey?: string;
  monthYear?: string;
  bulkCurrRead: number;
  bulkPrevRead: number;
  assignedUpdates: Array<{
    customerKeyNumber: string;
    currRead: number;
    prevRead: number;
  }>;
}) {
  return await wrap(async () => {
    const session = await checkPermissionAny(
      PERMISSIONS.BULK_METERS_EDIT_READINGS,
      PERMISSIONS.METER_READINGS_EDIT_RECALCULATE
    );
    
    const {
      dbGetBillById,
      dbUpdateBill,
      dbGetCustomerById,
      dbUpdateBulkMeter,
      dbSyncAgingForCustomer,
      dbCreateBillWorkflowLog,
    } = await import('./db-queries');

    const { calculateBill } = await import('./billing');

    return await withTransaction(async (client) => {
      let bulkBill: any = null;
      let bulkMeterId = payload.bulkMeterKey;
      let monthYear = payload.monthYear;

      if (payload.bulkBillId) {
        bulkBill = await dbGetBillById(payload.bulkBillId);
        if (bulkBill) {
          monthYear = bulkBill.month_year;
          bulkMeterId = bulkBill.CUSTOMERKEY;
          if (bulkBill.status === 'Posted') {
            throw new Error("Cannot directly edit readings on a Posted bill. Please use 'Bill Correction' to reverse and create an auditable replacement draft.");
          }
        }
      }

      if (!bulkMeterId) throw new Error("Bulk meter identifier is required");
      if (!monthYear) throw new Error("Billing month is required");

      const [year, month] = monthYear.split('-').map(Number);
      const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
      const endDate = new Date(Date.UTC(year, month, 1)).toISOString();
      const midMonthDate = new Date(Date.UTC(year, month - 1, 15)).toISOString();

      // 1. Update individual customer readings
      if (payload.assignedUpdates.length > 0) {
        for (const update of payload.assignedUpdates) {
          const custId = update.customerKeyNumber;

          // Upsert reading record
          const readingRes = await client.query(
            `SELECT id FROM individual_customer_readings 
             WHERE "CUST_KEY" = $1 AND deleted_at IS NULL
             AND "READING_DATE" >= $2 AND "READING_DATE" < $3 LIMIT 1`,
            [custId, startDate, endDate]
          );
          
          if (readingRes.rows.length > 0) {
            await client.query(
              `UPDATE individual_customer_readings 
               SET "METER_READING" = $1, "PREVIOUS_READING" = $2 
               WHERE id = $3`,
              [update.currRead, update.prevRead, readingRes.rows[0].id]
            );
          } else {
            await client.query(
              `INSERT INTO individual_customer_readings 
               ("CUST_KEY", "METER_READING", "PREVIOUS_READING", "READING_DATE") 
               VALUES ($1, $2, $3, $4)`,
              [custId, update.currRead, update.prevRead, midMonthDate]
            );
          }

          // Update individual_customers table
          await client.query(
            `UPDATE individual_customers 
             SET "previousReading" = $1, "currentReading" = $2, month = $3 
             WHERE "customerKeyNumber" = $4`,
            [update.prevRead, update.currRead, monthYear, custId]
          );

          // Update non-Posted bills if any
          const indivUsage = Math.max(0, update.currRead - update.prevRead);
          await client.query(
            `UPDATE bills 
             SET "CURRREAD" = $1, "PREVREAD" = $2, "CONS" = $3
             WHERE individual_customer_id = $4 AND month_year = $5 AND status NOT IN ('Posted', 'Reversed', 'Void', 'Deleted')`,
            [update.currRead, update.prevRead, indivUsage, custId, monthYear]
          );
        }
      }

      // 2. Recalculate bulk difference
      const subCustomersRes = await client.query(
        `SELECT "customerKeyNumber" FROM individual_customers 
         WHERE (
           LOWER(TRIM("assignedBulkMeterId")) = LOWER(TRIM($1))
           OR LOWER(TRIM("assignedBulkMeterId")) = (SELECT LOWER(TRIM("customerKeyNumber")) FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1)) LIMIT 1)
         ) AND deleted_at IS NULL`,
        [bulkMeterId]
      );
      const subCustKeys = subCustomersRes.rows.map((r: any) => r.customerKeyNumber);

      let totalIndivUsage = 0;
      if (subCustKeys.length > 0) {
        const placeholders = subCustKeys.map((_: string, i: number) => `$${i + 3}`).join(',');
        const usageRes = await client.query(
          `SELECT
             ic."customerKeyNumber",
             COALESCE(b."CURRREAD", r."METER_READING", ic."currentReading", 0) AS curr_read,
             COALESCE(
               b."PREVREAD",
               CASE WHEN r."PREVIOUS_READING" IS NOT NULL AND r."PREVIOUS_READING" != r."METER_READING" AND r."PREVIOUS_READING" > 0 THEN r."PREVIOUS_READING" END,
               prev_r."METER_READING",
               last_b."CURRREAD",
               CASE WHEN ic."previousReading" != ic."currentReading" THEN ic."previousReading" END,
               ic."currentReading",
               0
             ) AS prev_read
           FROM individual_customers ic
           LEFT JOIN LATERAL (
             SELECT "PREVIOUS_READING", "METER_READING", "READING_DATE"
             FROM individual_customer_readings
             WHERE "CUST_KEY" = ic."customerKeyNumber"
               AND deleted_at IS NULL
               AND (
                 ("READING_DATE" >= $1 AND "READING_DATE" < $2)
                 OR (TO_CHAR("READING_DATE" AT TIME ZONE 'Africa/Addis_Ababa', 'YYYY-MM') = $${subCustKeys.length + 3})
               )
             ORDER BY "READING_DATE" DESC
             LIMIT 1
           ) r ON true
           LEFT JOIN LATERAL (
             SELECT "METER_READING"
             FROM individual_customer_readings
             WHERE "CUST_KEY" = ic."customerKeyNumber"
               AND deleted_at IS NULL
               AND "READING_DATE" < COALESCE(r."READING_DATE", $1::timestamptz)
             ORDER BY "READING_DATE" DESC
             LIMIT 1
           ) prev_r ON true
           LEFT JOIN bills b
             ON b.individual_customer_id = ic."customerKeyNumber"
             AND b.month_year = $${subCustKeys.length + 3}
             AND b.status != 'Reversed'
           LEFT JOIN bills last_b
             ON last_b.individual_customer_id = ic."customerKeyNumber"
             AND last_b.month_year = (SELECT TO_CHAR(TO_DATE($${subCustKeys.length + 3}, 'YYYY-MM') - INTERVAL '1 month', 'YYYY-MM'))
             AND last_b.status != 'Reversed'
           WHERE ic."customerKeyNumber" IN (${placeholders})`,
          [startDate, endDate, ...subCustKeys, monthYear]
        );
        for (const row of usageRes.rows) {
          totalIndivUsage += Math.max(0, Number(row.curr_read || 0) - Number(row.prev_read || 0));
        }
      }

      const bulkMeter = await dbGetCustomerById(bulkMeterId, client) || await client.query('SELECT * FROM bulk_meters WHERE "customerKeyNumber" = $1', [bulkMeterId]).then((r: any) => r.rows[0]);
      const bulkUsage = payload.bulkCurrRead - payload.bulkPrevRead;
      const bulkDiffUsage = bulkUsage - totalIndivUsage;

      const bulkReadingRes = await client.query(
        `SELECT id FROM bulk_meter_readings WHERE "CUST_KEY" = $1 AND deleted_at IS NULL
         AND "READING_DATE" >= $2 AND "READING_DATE" < $3 LIMIT 1`,
        [bulkMeterId, startDate, endDate]
      );
      if (bulkReadingRes.rows.length > 0) {
        await client.query(
          `UPDATE bulk_meter_readings SET "METER_READING" = $1, "PREVIOUS_READING" = $2 WHERE id = $3`,
          [payload.bulkCurrRead, payload.bulkPrevRead, bulkReadingRes.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO bulk_meter_readings ("CUST_KEY", "METER_READING", "PREVIOUS_READING", "READING_DATE") 
           VALUES ($1, $2, $3, $4)`,
          [bulkMeterId, payload.bulkCurrRead, payload.bulkPrevRead, midMonthDate]
        );
      }

      await dbUpdateBulkMeter(bulkMeterId, {
        previousReading: payload.bulkPrevRead,
        currentReading: payload.bulkCurrRead,
        month: monthYear
      }, client);

      const targetBillId = payload.bulkBillId || (
        await client.query(
          `SELECT id FROM bills WHERE "CUSTOMERKEY" = $1 AND month_year = $2 AND status NOT IN ('Posted', 'Reversed', 'Void', 'Deleted') LIMIT 1`,
          [bulkMeterId, monthYear]
        ).then((r: any) => r.rows[0]?.id)
      );

      if (targetBillId) {
        const currentBillRecord = bulkBill || await dbGetBillById(targetBillId);
        const chargeGroup = bulkMeter?.charge_group || bulkMeter?.customerType || currentBillRecord?.snapshot_data?.chargeGroup || 'Non-domestic';
        const sewerageConn = bulkMeter?.sewerageConnection || bulkMeter?.sewerage_connection || currentBillRecord?.snapshot_data?.sewerageConnection || 'No';
        const meterSize = Number(bulkMeter?.meterSize || 0.5);

        const bulkCalc = await calculateBill(
          bulkDiffUsage,
          chargeGroup as any,
          sewerageConn as any,
          meterSize,
          monthYear
        );

        const currentOutstanding = Number(currentBillRecord?.OUTSTANDINGAMT || currentBillRecord?.balance_carried_forward || 0);

        const existingSnapshotRes = await client.query(
          `SELECT snapshot_data FROM bills WHERE id = $1 LIMIT 1`,
          [targetBillId]
        );
        const existingSnapshot = existingSnapshotRes.rows[0]?.snapshot_data || {};

        await dbUpdateBill(targetBillId, {
          CURRREAD: payload.bulkCurrRead,
          PREVREAD: payload.bulkPrevRead,
          CONS: Math.max(0, bulkUsage),
          difference_usage: bulkCalc.effectiveUsage,
          THISMONTHBILLAMT: bulkCalc.totalBill,
          TOTALBILLAMOUNT: bulkCalc.totalBill + currentOutstanding,
          base_water_charge: bulkCalc.baseWaterCharge,
          sewerage_charge: bulkCalc.sewerageCharge,
          meter_rent: bulkCalc.meterRent,
          maintenance_fee: bulkCalc.maintenanceFee,
          sanitation_fee: bulkCalc.sanitationFee,
          vat_amount: bulkCalc.vatAmount,
          snapshot_data: {
            ...existingSnapshot,
            totalIndividualUsage: totalIndivUsage,
          } as any,
        }, client, monthYear);

        await dbCreateBillWorkflowLog({
          bill_id: targetBillId,
          from_status: currentBillRecord?.status || 'Draft',
          to_status: currentBillRecord?.status || 'Draft',
          changed_by: session.id,
          reason: `Meter readings updated. Bulk reading: ${currentBillRecord?.PREVREAD}/${currentBillRecord?.CURRREAD} -> ${payload.bulkPrevRead}/${payload.bulkCurrRead}`
        }, client);
      }

      await dbSyncAgingForCustomer(bulkMeterId, client);
      return { success: true };
    });
  });
}

export async function updateBulkMeterReadingAction(id: string, reading: BulkMeterReadingUpdate) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.METER_READINGS_UPDATE);
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
    const session = await checkPermission(PERMISSIONS.METER_READINGS_DELETE);
    await dbDeleteBulkMeterReading(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Bulk Reading',
      severity: 'warning',
      details: { id }
    });
  });
}

export async function getAllPaymentsAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms: string[] = session.permissions || [];

    const hasPerm = perms.includes('*') || perms.includes('admin') || perms.includes('all') ||
      perms.includes(PERMISSIONS.PAYMENTS_VIEW) || perms.includes(PERMISSIONS.BILL_VIEW_ALL);

    if (!hasPerm) {
      throw new Error('Forbidden: No payment permissions');
    }

    // Branch isolation: Only if they have view_all (via BILL_VIEW_ALL or specific) do they see everything.
    const filterBranchId = getEffectiveBranchId(session, undefined, PERMISSIONS.BILL_VIEW_ALL);
    return await dbGetAllPayments(filterBranchId);
  });
}
export async function createPaymentAction(payment: PaymentInsert) {
    return await wrap(async () => {
      await checkPermission(PERMISSIONS.PAYMENTS_CREATE);
      // 1. Create Payment
      const result = await dbCreatePayment(payment);

    // 2. Sync Aging Debt and Updates
    if (payment.bill_id) {
      const bill = await dbGetBillByIdQuery(payment.bill_id);
      if (bill) {
        const customerKey = bill.CUSTOMERKEY || bill.individual_customer_id;
        if (customerKey) {
            await dbSyncAgingForCustomer(customerKey);
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
    await checkPermission(PERMISSIONS.PAYMENTS_CREATE); // Assume same for now
    
    // Fetch payment to get bill_id
    const payments = await dbGetAllPayments();
    const existingPayment = payments.find((p: any) => p.id === id);

    const result = await dbUpdatePayment(id, payment);

    let customerKeyToSync = null;
    if (existingPayment && existingPayment.bill_id) {
      const bill = await dbGetBillByIdQuery(existingPayment.bill_id);
      if (bill) {
         customerKeyToSync = bill.CUSTOMERKEY || bill.individual_customer_id;
      }
    }

    if (customerKeyToSync) {
        await dbSyncAgingForCustomer(customerKeyToSync);
    }

    await logSecurityEventAction({
      event: 'Update Payment',
      details: { id, updates: payment }
    });
    return result;
  });
}
export async function deletePaymentAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.PAYMENTS_DELETE);
    // 1. Fetch payment to find associated bill/meter
    const payments = await dbGetAllPayments();
    const payment = payments.find((p: any) => p.id === id);

    let customerKeyToSync = null;
    if (payment && payment.bill_id) {
      const bill = await dbGetBillByIdQuery(payment.bill_id);
      if (bill) {
         customerKeyToSync = bill.CUSTOMERKEY || bill.individual_customer_id;
      }
    }

    // 2. Delete the payment
    await dbDeletePayment(id, session.id);

    // 3. Sync Aging Debt and Updates
    if (customerKeyToSync) {
        await dbSyncAgingForCustomer(customerKeyToSync);
    }

    await logSecurityEventAction({
      event: 'Delete Payment',
      severity: 'warning',
      details: { id }
    });
  });
}

export async function getAllReportLogsAction() {
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];
    if (!perms.includes(PERMISSIONS.REPORTS_GENERATE_ALL) && !perms.includes(PERMISSIONS.REPORTS_GENERATE_BRANCH)) {
      throw new Error('Forbidden: Missing reports permission');
    }

    // Branch isolation
    const filterBranchId = getEffectiveBranchId(session, undefined, PERMISSIONS.REPORTS_GENERATE_ALL);
    return await dbGetAllReportLogs(filterBranchId);
  });
}
export async function createReportLogAction(log: ReportLogInsert) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH); // Min permission to log
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
    await checkPermission(PERMISSIONS.REPORTS_GENERATE_BRANCH);
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
    const session = await checkPermission(PERMISSIONS.REPORTS_GENERATE_ALL); // Admin-level
    await dbDeleteReportLog(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Report',
      severity: 'warning',
      details: { id }
    });
  });
}

export async function getAllNotificationsAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms: string[] = session.permissions || [];
    const hasPerm = perms.includes('*') || perms.includes('admin') || perms.includes('all') ||
      perms.includes(PERMISSIONS.NOTIFICATIONS_VIEW) || perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL) || perms.includes(PERMISSIONS.DASHBOARD_VIEW_BRANCH);

    if (!hasPerm) {
      throw new Error('Forbidden: No notification permissions');
    }

    // Branch isolation: If not admin/management, filter by branchId
    const filterBranchId = getEffectiveBranchId(session, undefined, PERMISSIONS.DASHBOARD_VIEW_ALL);
    return await dbGetAllNotifications(filterBranchId);
  });
}
export async function deleteNotificationAction(id: string) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.NOTIFICATIONS_MANAGE);
    await dbDeleteNotification(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Notification',
      severity: 'warning',
      details: { id }
    });
  });
}
export async function updateNotificationAction(id: string, notification: NotificationUpdate) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.NOTIFICATIONS_VIEW); 
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
    // System-generated notifications (e.g. system logs, audit events) do not require manual permission gating
    if (notification.sender_name !== "System") {
      await checkPermission(PERMISSIONS.NOTIFICATIONS_MANAGE);
    }
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
    return await dbGetAllRoles();
  });
}
export async function createRoleAction(role: RoleInsert) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.ROLES_MANAGE);
    const result = await dbCreateRole(role);
    await logSecurityEventAction({
      event: 'Create Role',
      severity: 'warning',
      details: { role }
    });
    return result;
  });
}
export async function getAllPermissionsAction() {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.ROLES_VIEW);
    return await dbGetAllPermissions();
  });
}
export async function createPermissionAction(permission: PermissionInsert) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.ROLES_MANAGE);
    const result = await dbCreatePermission(permission);
    await logSecurityEventAction({
      event: 'Create Permission',
      severity: 'warning',
      details: { permission }
    });
    return result;
  });
}
export async function updatePermissionAction(id: number, permission: PermissionUpdate) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.ROLES_MANAGE);
    const result = await dbUpdatePermission(id, permission);
    await logSecurityEventAction({
      event: 'Update Permission',
      severity: 'warning',
      details: { id, updates: permission }
    });
    return result;
  });
}
export async function deletePermissionAction(id: number) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.ROLES_MANAGE);
    await dbDeletePermission(id);
    await logSecurityEventAction({
      event: 'Delete Permission',
      severity: 'critical',
      details: { id }
    });
  });
}
export async function getAllRolePermissionsAction() {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.ROLES_VIEW);
    return await dbGetAllRolePermissions();
  });
}

export async function rpcUpdateRolePermissionsAction(roleId: number, permissionIds: number[]) {
  return await wrap(async () => {
    // 1. Check permission
    await checkPermission(PERMISSIONS.ROLES_MANAGE);

    // 2. Perform DB update
    const result = await dbRpcUpdateRolePermissions(roleId, permissionIds);

    // 3. Log security event
    await logSecurityEventAction({
      event: 'Update Role Permissions',
      severity: 'warning',
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
    await checkPermission(PERMISSIONS.TARIFFS_VIEW);
    return await dbGetAllTariffs();
  });
}

/**
 * Returns all tariffs for reference data (publicly available to all authenticated users)
 * This is used for background calculations on the dashboard.
 */
export async function getPublicTariffsAction() {
  return await wrap(async () => {
    // Only require authentication, not TARIFFS_VIEW admin permission
    await getSession();
    return await dbGetAllTariffs();
  });
}
export async function createTariffAction(tariff: TariffInsert) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.TARIFFS_MANAGE);
    const result = await dbCreateTariff(tariff);
    await logSecurityEventAction({
      event: 'Create Tariff',
      severity: 'critical',
      details: { tariff }
    });
    return result;
  });
}
export async function updateTariffAction(customerType: string, effectiveDate: string, tariff: TariffUpdate, allowHistoricalEdit: boolean = false) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.TARIFFS_MANAGE);

    // Normalize the effectiveDate so comparisons match how dates are stored (YYYY-MM -> last day of month)
    let lookupDate = effectiveDate;
    if (effectiveDate && effectiveDate.length === 7 && effectiveDate.includes('-')) {
      const [year, month] = effectiveDate.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      lookupDate = `${effectiveDate}-${lastDay}`;
    }

    // Check if the tariff is the latest version. Historical versions are read-only
    // unless the caller explicitly requests a historical edit via `allowHistoricalEdit`.
    const allCustomerTariffs = await dbGetAllTariffs();
    const relevantTariffs = allCustomerTariffs
      .filter(t => t.customer_type === customerType && t.effective_date)
      .map(t => {
        const d = t.effective_date!;
        return d instanceof Date
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          : String(d);
      })
      .sort((a, b) => b.localeCompare(a)); // Descending order

    if (relevantTariffs.length > 0 && lookupDate < relevantTariffs[0] && !allowHistoricalEdit) {
      throw new Error('Forbidden: Cannot modify a historical tariff version. Only the latest active tariff can be edited.');
    }

    // Capture current tariff for audit comparison. Try both the exact incoming date
    // and a month-end canonicalized variant so we reliably locate the DB row.
    const oldTariffInitial = await dbGetTariffByTypeAndDate(customerType, effectiveDate);
    let oldTariff = oldTariffInitial;
    if (!oldTariff) {
      // compute month-end alternative and try again
      if (effectiveDate && effectiveDate.includes('-')) {
        const [y, m] = effectiveDate.split('-').map(Number);
        const lastDay = new Date(y, m || 1, 0).getDate();
        const alt = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        oldTariff = await dbGetTariffByTypeAndDate(customerType, alt);
      }
    }

    const result = await dbUpdateTariff(customerType, lookupDate, tariff);

    if (!result) {
      throw new Error('Update failed: tariff row not found for provided effective date.');
    }

    await logSecurityEventAction({
      event: 'Update Tariff',
      severity: 'critical',
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
    await checkPermission(PERMISSIONS.KNOWLEDGE_BASE_VIEW);
    return await dbGetAllKnowledgeBaseArticles();
  });
}

/**
 * Returns all published knowledge base articles for any authenticated user.
 * No knowledge_base_view permission required — used by the support chatbot
 * which is mounted globally for all staff and admin users.
 */
export async function getPublicKnowledgeBaseArticlesAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    return await dbGetAllKnowledgeBaseArticles();
  });
}
export async function createKnowledgeBaseArticleAction(article: KnowledgeBaseArticleInsert) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.KNOWLEDGE_BASE_MANAGE);
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
    await checkPermission(PERMISSIONS.KNOWLEDGE_BASE_MANAGE);
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
    const session = await checkPermission(PERMISSIONS.KNOWLEDGE_BASE_MANAGE);
    await dbDeleteKnowledgeBaseArticle(id, session.id);
    await logSecurityEventAction({
      event: 'Delete KB Article',
      severity: 'warning',
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
  baseWaterChargeCONS?: number,
  customerKey?: string
) {
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];
    const hasPerm = perms.includes('*') || perms.includes('admin') || perms.includes('all') ||
      perms.includes(PERMISSIONS.BILL_CREATE) ||
      perms.includes(PERMISSIONS.BILL_VIEW_ALL) ||
      perms.includes(PERMISSIONS.BILL_VIEW_BRANCH) ||
      perms.includes(PERMISSIONS.TARIFFS_VIEW) ||
      perms.includes(PERMISSIONS.TARIFFS_MANAGE);
    if (!hasPerm) throw new Error('Forbidden: Missing billing/tariff permission to calculate bills');
    const size = typeof meterSize === 'string' ? parseFloat(meterSize) : meterSize;

    let finalConsumption = consumption;
    if (customerKey) {
      const bulkRes: any[] = await query(
        'SELECT "customerKeyNumber" FROM bulk_meters WHERE "customerKeyNumber" = $1 AND deleted_at IS NULL',
        [customerKey]
      );
      if (bulkRes.length > 0) {
        const subCustomersRes: any[] = await query(
          'SELECT "customerKeyNumber" FROM individual_customers WHERE "assignedBulkMeterId" = $1 AND deleted_at IS NULL',
          [customerKey]
        );
        const subCustKeys = subCustomersRes.map((r: any) => r.customerKeyNumber);

        if (subCustKeys.length > 0) {
          const [year, month] = billingMonth.split('-').map(Number);
          const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
          const endDate = new Date(Date.UTC(year, month, 1)).toISOString();
          const placeholders = subCustKeys.map((_, i) => `$${i + 3}`).join(',');
          
          const usageRes: any[] = await query(
            `SELECT
               COALESCE(r."METER_READING", b."CURRREAD", ic."currentReading", 0) AS curr_read,
               COALESCE(r."PREVIOUS_READING", b."PREVREAD", ic."previousReading", 0) AS prev_read
             FROM individual_customers ic
             LEFT JOIN individual_customer_readings r
               ON r."CUST_KEY" = ic."customerKeyNumber"
               AND r.deleted_at IS NULL
               AND r."READING_DATE" >= $1 AND r."READING_DATE" < $2
             LEFT JOIN bills b
               ON b.individual_customer_id = ic."customerKeyNumber"
               AND b.month_year = $${subCustKeys.length + 3}
               AND b.status != 'Reversed'
             WHERE ic."customerKeyNumber" IN (${placeholders})`,
            [startDate, endDate, ...subCustKeys, billingMonth]
          );

          let totalIndivUsage = 0;
          for (const row of usageRes) {
            totalIndivUsage += (Number(row.curr_read || 0) - Number(row.prev_read || 0));
          }
          finalConsumption = consumption - totalIndivUsage;
        }
      }
    }

    return await calculateBill(finalConsumption, customerType, sewerageConnection, size || 0, billingMonth, sewerageCONS, baseWaterChargeCONS);
  });
}

// LogOptions is defined and exported from action-types.ts — imported at the top.

export async function logSecurityEventAction(options: LogOptions | string) {
  return await wrap(async () => {
    const session = await getSession();

    let event: string;
    let severity: 'info' | 'warning' | 'critical' = 'info';
    let details: any = {};
    let customerKeyNumber: string | undefined;

    if (typeof options === 'string') {
      event = options;
    } else {
      event = options.event;
      severity = (options.severity?.toLowerCase() as any) || 'info';
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

// CustomerAuthResult is defined and exported from action-types.ts — imported at the top.

export async function getCustomerAccountAction(
  customerKeyNumber: string,
  customerSessionId?: string
): Promise<{ data: any | null; error: any }> {
  return await wrap(async () => {
    // Determine caller: staff with perm, valid customer session, or login-lookup.
    const staffSession = await getSession();
    let isStaffOrOwner = false;

    if (staffSession && staffSession.id) {
      const perms = await dbGetStaffPermissions(staffSession.id);
      if (perms.includes(PERMISSIONS.CUSTOMERS_VIEW_ALL) || perms.includes(PERMISSIONS.CUSTOMERS_VIEW_BRANCH)) {
        isStaffOrOwner = true;
      }
    } else if (customerSessionId) {
      const cSession = await dbGetCustomerSession(customerSessionId);
      if (cSession && cSession.customer_key_number === customerKeyNumber) {
        isStaffOrOwner = true;
      }
    }

    const dbCustomer = await dbGetCustomerById(customerKeyNumber);
    if (!dbCustomer) return null;

    // Login-lookup path: expose ONLY minimal fields needed to verify account and complete login.
    if (!isStaffOrOwner) {
      return {
        customerKeyNumber: dbCustomer.customerKeyNumber,
        name: dbCustomer.name,
        status: dbCustomer.status,
        customerType: dbCustomer.customerType,
        email: dbCustomer.email,
        phone_number: dbCustomer.phone_number,
      };
    }

    // Full data only for authorised callers
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
  customerKeyNumber: string,
  customerSessionId?: string
): Promise<{ data: any | null; error: any }> {
  return await wrap(async () => {
    const staffSession = await getSession();
    let isStaffOrOwner = false;

    if (staffSession && staffSession.id) {
      const perms = await dbGetStaffPermissions(staffSession.id);
      if (perms.includes(PERMISSIONS.BULK_METERS_VIEW_ALL) || perms.includes(PERMISSIONS.BULK_METERS_VIEW_BRANCH)) {
        isStaffOrOwner = true;
      }
    } else if (customerSessionId) {
      const cSession = await dbGetCustomerSession(customerSessionId);
      if (cSession && cSession.customer_key_number === customerKeyNumber) {
        isStaffOrOwner = true;
      }
    }

    const dbBulkMeter = await dbGetBulkMeterById(customerKeyNumber);
    if (!dbBulkMeter) return null;

    if (!isStaffOrOwner) {
      return {
        customerKeyNumber: dbBulkMeter.customerKeyNumber,
        name: dbBulkMeter.name,
        status: dbBulkMeter.status,
      };
    }

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
  customerKeyNumber: string,
  customerSessionId?: string
): Promise<{ data: IndividualCustomerReading[] | null; error: any }> {
  return await wrap(async () => {
    await assertCustomerAccess(customerKeyNumber, customerSessionId, 'individual');
    return await dbGetIndividualCustomerReadingsByCustomer(customerKeyNumber);
  });
}

// Route Server Actions
export async function getAllRoutesAction(options?: { branchId?: string }) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const perms = session.permissions || [];
    const isSuperAdmin = perms.includes('*') || perms.includes('all') || perms.includes('admin');

    if (!perms.includes(PERMISSIONS.ROUTES_VIEW_ALL) && 
        !perms.includes(PERMISSIONS.ROUTES_VIEW_ASSIGNED) && 
        !perms.includes(PERMISSIONS.ROUTES_VIEW_BRANCH) &&
        !perms.includes('routes_view') &&
        !perms.includes('routes_manage') &&
        !perms.includes('routes_create') &&
        !perms.includes('routes_update') &&
        !perms.includes('routes_delete') &&
        !perms.includes('meter_readings_create_bulk') &&
        !perms.includes('meter_readings_create_individual') &&
        !perms.includes('meter_readings_create') &&
        !perms.includes(PERMISSIONS.METER_READINGS_ANALYTICS_VIEW) &&
        !isSuperAdmin) {
      throw new Error('Forbidden: Missing route view permissions');
    }
    
    const canViewAll = perms.includes(PERMISSIONS.ROUTES_VIEW_ALL) || isSuperAdmin;
    const canViewBranch = perms.includes(PERMISSIONS.ROUTES_VIEW_BRANCH) || perms.includes('routes_manage') || perms.includes('routes_view');

    // Determine branch isolation:
    const branchId = getEffectiveBranchId(session, options?.branchId, PERMISSIONS.ROUTES_VIEW_ALL);
    
    // Reader isolation: If user is a field reader (lacks global/branch management), check by readerId
    const readerId = (!canViewAll && !canViewBranch) ? session.id : undefined;

    return await dbGetAllRoutes(branchId, readerId);
  });
}

export async function createRouteAction(route: RouteInsert) {
  return await wrap(async () => {
    const session = await checkPermissionAny(
      PERMISSIONS.ROUTES_MANAGE,
      'routes_create',
      'routes_manage'
    );

    const dbPayload: any = {
      route_key: (route as any).route_key || (route as any).routeKey,
      branch_id: (route as any).branch_id || (route as any).branchId || null,
      reader_id: (route as any).reader_id || (route as any).readerId || null,
      description: (route as any).description || null,
      status: (route as any).status || 'Active',
    };

    // Enforce branch creation rules if lacking global oversight
    const routePerms: string[] = session.permissions || [];
    const hasRoutesGlobal = routePerms.includes('*') || routePerms.includes('admin') || routePerms.includes('all') || routePerms.includes('routes_view_all');
    if (!hasRoutesGlobal && session.branchId && session.branchId !== 'all') {
      dbPayload.branch_id = session.branchId;
    }

    const result = await dbCreateRoute(dbPayload);
    await logSecurityEventAction({ event: 'Create Route', details: { route: dbPayload } });
    return result;
  });
}

export async function updateRouteAction(routeKey: string, routeUpdates: RouteUpdate) {
  return await wrap(async () => {
    const session = await checkPermissionAny(
      PERMISSIONS.ROUTES_MANAGE,
      'routes_update',
      'routes_manage'
    );
    const existingRoute = await dbGetRouteByKey(routeKey);
    if (existingRoute) {
      verifyEntityBranchAccess(existingRoute.branch_id, session, PERMISSIONS.ROUTES_VIEW_ALL, 'route');
    }

    const dbUpdates: any = {};
    if ((routeUpdates as any).route_key || (routeUpdates as any).routeKey) {
      dbUpdates.route_key = (routeUpdates as any).route_key || (routeUpdates as any).routeKey;
    }
    if ((routeUpdates as any).branch_id !== undefined || (routeUpdates as any).branchId !== undefined) {
      dbUpdates.branch_id = (routeUpdates as any).branch_id !== undefined ? (routeUpdates as any).branch_id : (routeUpdates as any).branchId;
    }
    if ((routeUpdates as any).reader_id !== undefined || (routeUpdates as any).readerId !== undefined) {
      dbUpdates.reader_id = (routeUpdates as any).reader_id !== undefined ? (routeUpdates as any).reader_id : (routeUpdates as any).readerId;
    }
    if ((routeUpdates as any).description !== undefined) {
      dbUpdates.description = (routeUpdates as any).description;
    }
    if ((routeUpdates as any).status !== undefined) {
      dbUpdates.status = (routeUpdates as any).status;
    }

    // Prevent changing branch_id if lacking global route view
    const perms = session.permissions || [];
    const hasGlobalView = perms.includes('*') || perms.includes('all') || perms.includes('admin') || perms.includes(PERMISSIONS.ROUTES_VIEW_ALL);
    if (!hasGlobalView && dbUpdates.branch_id && existingRoute && dbUpdates.branch_id !== existingRoute.branch_id) {
      dbUpdates.branch_id = existingRoute.branch_id;
    }

    const result = await dbUpdateRoute(routeKey, dbUpdates);
    await logSecurityEventAction({ event: 'Update Route', details: { routeKey, routeUpdates: dbUpdates } });
    return result;
  });
}

export async function deleteRouteAction(routeKey: string) {
  return await wrap(async () => {
    const session = await checkPermissionAny(
      PERMISSIONS.ROUTES_MANAGE,
      'routes_delete',
      'routes_manage'
    );
    const existingRoute = await dbGetRouteByKey(routeKey);
    if (existingRoute) {
      verifyEntityBranchAccess(existingRoute.branch_id, session, PERMISSIONS.ROUTES_VIEW_ALL, 'route');
    }
    await dbDeleteRoute(routeKey, session.id);
    await logSecurityEventAction({ event: 'Delete Route', severity: 'warning', details: { routeKey } });
  });
}

export async function getRouteByKeyAction(routeKey: string) {
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];
    if (!perms.includes(PERMISSIONS.ROUTES_VIEW_ALL) && 
        !perms.includes(PERMISSIONS.ROUTES_VIEW_ASSIGNED) && 
        !perms.includes(PERMISSIONS.METER_READINGS_ANALYTICS_VIEW)) {
      throw new Error('Forbidden: Missing route view permissions');
    }
    return await dbGetRouteByKey(routeKey);
  });
}

export async function getBulkMeterReadingsAction(
  customerKeyNumber: string,
  customerSessionId?: string
): Promise<{ data: BulkMeterReading[] | null; error: any }> {
  return await wrap(async () => {
    await assertCustomerAccess(customerKeyNumber, customerSessionId, 'bulk');
    return await dbGetBulkMeterReadingsByMeter(customerKeyNumber);
  });
}

export async function getCustomerBillsAction(
  customerKeyNumber: string,
  excludeUnfinalized: boolean = true,
  customerSessionId?: string
): Promise<{ data: any[] | null; error: any }> {
  return await wrap(async () => {
    const ctx = await assertCustomerAccess(customerKeyNumber, customerSessionId, 'individual');
    // For staff without bill:manage_all, restrict to their branch
    let branchId: string | undefined;
    if (ctx.kind === 'staff') {
      const hasManageAll = ctx.perms.includes('bill:manage_all');
      branchId = hasManageAll ? undefined : (ctx.session as any).branchId;
    }
    return await dbGetBillsByCustomerId(customerKeyNumber, branchId, excludeUnfinalized);
  });
}

export async function getBulkMeterBillsAction(
  customerKeyNumber: string,
  excludeUnfinalized: boolean = true,
  customerSessionId?: string
): Promise<{ data: any[] | null; error: any }> {
  return await wrap(async () => {
    const ctx = await assertCustomerAccess(customerKeyNumber, customerSessionId, 'bulk');
    let branchId: string | undefined;
    if (ctx.kind === 'staff') {
      const hasManageAll = ctx.perms.includes('bill:manage_all') || ctx.perms.includes('bulk_meters_view_all');
      branchId = hasManageAll ? undefined : (ctx.session as any).branchId;
    }
    return await dbGetBillsByBulkMeterId(customerKeyNumber, branchId, excludeUnfinalized);
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
    // Permission check: Verify caller has authority to create customer sessions
    // Staff with settings_manage can create sessions for any customer in their branch
    // Customers can only create their own sessions (handled by customer portal)
    const staffSession = await getSession();
    if (staffSession && staffSession.id) {
      // Caller is staff - verify they have permission
      await checkPermission(PERMISSIONS.SETTINGS_MANAGE);
    } else {
      // No staff session - only customers can proceed
      // This is typically called from customer portal auth flow
      // But we still need to rate-limit or track - for now just log
    }

    // Verify the customer actually exists and is Active before issuing a session.
    let customer: any = null;
    if (session.customer_type === 'bulk') {
      customer = await dbGetBulkMeterById(session.customer_key_number);
    } else {
      customer = await dbGetCustomerById(session.customer_key_number);
    }
    if (!customer) {
      throw new Error('Customer not found');
    }
    if (customer.status !== 'Active') {
      throw new Error('Customer account is not active');
    }

    const result = await dbCreateCustomerSession(session);
    await logSecurityEventAction({
      event: 'Customer Login',
      customerKeyNumber: session.customer_key_number,
      details: { device_name: session.device_name, location: session.location }
    });
    return result;
  });
}

export async function revokeCustomerSessionAction(sessionId: string, reason: 'revoked' | 'logout' = 'revoked') {
  return await wrap(async () => {
    // Either an admin/staff with settings perm, or the owning customer may revoke.
    const staffSession = await getSession();
    let authorized = false;
    if (staffSession && staffSession.id) {
      const perms = await dbGetStaffPermissions(staffSession.id);
      const wildcard = perms.includes('*') || perms.includes('admin') || perms.includes('all');
      if (wildcard || perms.includes(PERMISSIONS.SETTINGS_MANAGE) || perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL)) {
        authorized = true;
      }
    }
    if (!authorized) {
      const target = await dbGetCustomerSession(sessionId);
      if (target) authorized = true;
    }
    if (!authorized) throw new Error('Forbidden: Missing permission to revoke session');

    const result = await dbRevokeCustomerSession(sessionId, reason);
    await logSecurityEventAction({
      event: reason === 'logout' ? 'Customer Logout' : 'Customer Session Revoked',
      severity: reason === 'logout' ? 'info' : 'warning',
      details: { sessionId }
    });
    return result;
  });
}

/**
 * Admin kick-out for either a staff or a customer session, from the unified
 * User Sessions tab. Gated on SETTINGS_MANAGE / DASHBOARD_VIEW_ALL.
 */
export async function revokeUserSessionAction(userType: 'staff' | 'customer', sessionId: string) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const perms = session.permissions || [];
    const canRevoke = perms.includes('*') || perms.includes('admin') || perms.includes('all') ||
      perms.includes(PERMISSIONS.SETTINGS_MANAGE) || perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL);
    if (!canRevoke) {
      throw new Error('Forbidden: Missing permission to revoke sessions');
    }

    if (userType === 'staff') {
      const result = await dbRevokeStaffSession(sessionId, 'revoked');
      if (!result) throw new Error('Session is already ended — nothing to kick out.');
      await logSecurityEventAction({
        event: 'Staff Session Revoked',
        severity: 'warning',
        details: { sessionId, revoked_by: session.email },
      });
      return result;
    }

    const result = await dbRevokeCustomerSession(sessionId, 'revoked');
    if (!result) throw new Error('Session not found — nothing to kick out.');
    await logSecurityEventAction({
      event: 'Customer Session Revoked',
      severity: 'warning',
      details: { sessionId, revoked_by: session.email },
    });
    return result;
  });
}

export async function validateCustomerSessionAction(sessionId: string) {
  // Reads its own session id as credential — validation is inherent to the call.
  return await wrap(() => dbIsCustomerSessionValid(sessionId));
}

/**
 * Admin undo for an ended staff/customer session, from the unified User
 * Sessions tab. Mirrors revokeUserSessionAction: same permission gate, and
 * logs a security event. Gated on SETTINGS_MANAGE / DASHBOARD_VIEW_ALL.
 */
export async function reactivateUserSessionAction(userType: 'staff' | 'customer', sessionId: string) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const perms = session.permissions || [];
    if (!perms.includes(PERMISSIONS.SETTINGS_MANAGE) && !perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL)) {
      throw new Error('Forbidden: Missing permission to reactivate sessions');
    }

    if (userType === 'staff') {
      const result = await dbReactivateStaffSession(sessionId);
      if (!result) throw new Error('Session is already active or not found.');
      await logSecurityEventAction({
        event: 'Staff Session Reactivated',
        severity: 'info',
        details: { sessionId, reactivated_by: session.email },
      });
      return result;
    }

    const result = await dbReactivateCustomerSession(sessionId);
    if (!result) throw new Error('Session is already active or not found.');
    await logSecurityEventAction({
      event: 'Customer Session Reactivated',
      severity: 'info',
      details: { sessionId, reactivated_by: session.email },
    });
    return result;
  });
}

export async function logCustomerPageViewAction(sessionId: string, pageName: string, path?: string) {
  return await wrap(async () => {
    // The sessionId IS the credential here — the single UPDATE validates the
    // session (is_revoked=false) while appending the timestamped page view and
    // throttling the heartbeat, so we don't write twice per page view.
    const logged = await dbLogCustomerPageView(sessionId, pageName, path);
    if (!logged) throw new Error('Invalid or revoked customer session');
    return { success: true };
  });
}

// =====================================================
// Fault Code Management Actions
// =====================================================

export async function getAllFaultCodesAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const perms = session.permissions || [];
    const hasPerm = perms.includes(PERMISSIONS.FAULT_CODES_VIEW) || 
                   perms.includes(PERMISSIONS.METER_READINGS_CREATE) ||
                   perms.includes(PERMISSIONS.METER_READINGS_VIEW_BRANCH) ||
                   perms.includes(PERMISSIONS.METER_READINGS_VIEW_ALL);

    if (!hasPerm) {
      throw new Error('Forbidden: No permissions to view fault codes');
    }
    return await dbGetAllFaultCodes();
  });
}

/**
 * Returns all fault codes (publicly available to all authenticated users)
 */
export async function getPublicFaultCodesAction() {
  return await wrap(async () => {
    await getSession();
    return await dbGetAllFaultCodes();
  });
}
export async function getFaultCodeByIdAction(id: string) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    return await dbGetFaultCodeById(id);
  });
}

export async function createFaultCodeAction(faultCode: FaultCodeInsert) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.FAULT_CODES_MANAGE);
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
    await checkPermission(PERMISSIONS.FAULT_CODES_MANAGE);
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
    const session = await checkPermission(PERMISSIONS.FAULT_CODES_MANAGE);
    await dbDeleteFaultCode(id, session.id);
    await logSecurityEventAction({
      event: 'Delete Fault Code',
      severity: 'warning',
      details: { id }
    });
  });
}

// =====================================================
// Recycle Bin Actions
// =====================================================

export async function getRecycleBinItemsAction() {
  return await wrap(async () => {
    const session = await checkPermission();
    
    const perms: string[] = session.permissions || [];
    const hasPerm = perms.includes('dashboard_view_all') || perms.includes('settings_view') || perms.includes('settings_manage');

    if (!hasPerm) {
      throw new Error('Forbidden: No settings permissions');
    }

    // Branch isolation using our standard helper token `dashboard_view_all`
    const viewAllToken = perms.includes('dashboard_view_all') ? 'dashboard_view_all' : undefined;
    const filterBranchId = getEffectiveBranchId(session, undefined, viewAllToken);
    
    return await dbGetRecycleBinItems(filterBranchId);
  });
}

export async function restoreFromRecycleBinAction(recycleBinId: string) {
  return await wrap(async () => {
    await checkPermission('settings_manage');
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
    await checkPermission('settings_manage');
    const result = await dbPermanentlyDeleteFromRecycleBin(recycleBinId);
    await logSecurityEventAction({
      event: 'Permanently Delete from Recycle Bin',
      severity: 'critical',
      details: { recycleBinId }
    });
    revalidatePath('/admin/recycle-bin');
    return result;
  });
}

// =====================================================

export async function getDashboardMetricsAction() {
  return await wrap(async () => {
    const session = await checkPermission();

    const perms = session.permissions || [];
    const canViewAll = perms.includes('dashboard_view_all');
    const canViewBranch = perms.includes('dashboard_view_branch');

    if (!canViewAll && !canViewBranch) {
      throw new Error('Forbidden: Missing dashboard permissions');
    }

    // Pass branchId if they can only see their branch
    const branchId = getEffectiveBranchId(session, undefined, 'dashboard_view_all');

    return await dbGetDashboardMetrics(branchId);
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
    await checkPermission();
    const rows: any = await dbGetDistinctBillingMonths();
    const months = rows.map((r: any) => r.month_year || r.month).filter(Boolean);
    // Ensure uniqueness and sort DESC
    const uniqueMonths = Array.from(new Set(months)).sort().reverse();
    return { data: uniqueMonths };
  } catch (error: any) {
    console.error("Failed to fetch distinct months", error);
    return { error: error?.message || "Failed to fetch distinct months" };
  }
}

export async function getBillsByMonthAction(monthYear: string, branchId?: string) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const perms = session.permissions || [];
    const isSuperAdmin = perms.includes('*') || perms.includes('all') || perms.includes('admin');

    const canView = perms.includes(PERMISSIONS.REPORTS_GENERATE_ALL) ||
      perms.includes(PERMISSIONS.REPORTS_GENERATE_BRANCH) ||
      perms.includes(PERMISSIONS.METER_READINGS_ANALYTICS_VIEW) ||
      perms.includes(PERMISSIONS.BILL_VIEW_ALL) ||
      perms.includes(PERMISSIONS.BILL_VIEW_BRANCH) ||
      perms.includes(PERMISSIONS.BILL_VIEW_DRAFTS) ||
      perms.includes(PERMISSIONS.BILL_VIEW_PENDING) ||
      perms.includes(PERMISSIONS.BILL_VIEW_APPROVED) ||
      perms.includes(PERMISSIONS.BILL_CREATE) ||
      perms.includes(PERMISSIONS.BILL_APPROVE) ||
      perms.includes(PERMISSIONS.BILL_POST) ||
      perms.includes('bill:manage_all') ||
      perms.includes('bill:view_branch') ||
      perms.includes('bill:view_drafts') ||
      isSuperAdmin;

    if (!canView) {
      throw new Error('Forbidden: Missing bill or report view permissions');
    }
    
    const hasManageAll = perms.includes('*') || perms.includes('admin') || perms.includes('all') || perms.includes('bill:manage_all') || isSuperAdmin;
    const effectiveBranchId = !hasManageAll ? session.branchId : branchId;

    return await dbGetBillsWithBulkMeterInfoByMonth(monthYear, effectiveBranchId);
  });
}

export async function getMostRecentBillsForBulkMetersAction(customerKeys: string[]) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    const perms = session.permissions || [];
    const hasManageAll = perms.includes('bill:manage_all');
    const branchId = !hasManageAll ? session.branchId : undefined;

    return await dbGetMostRecentBillsForBulkMeters(customerKeys, branchId);
  });
}

export async function syncAllBillsAgingDebtAction() {
  return await wrap(async () => {
    const session = await checkPermission('billing:close_cycle');
    const perms = session.permissions || [];
    const hasManageAll = perms.includes('bill:manage_all');
    const branchId = !hasManageAll ? session.branchId : undefined;

    const bills = await dbGetAllBills({ branchId });
    
    // Get distinct customer keys (can be bulk or individual)
    const customerKeys = Array.from(new Set(
      bills.map(b => b.CUSTOMERKEY || b.individual_customer_id)
        .filter(key => key !== null && key !== undefined)
    )) as string[];

    let count = 0;
    for (const key of customerKeys) {
      await dbSyncAgingForCustomer(key);
      count++;
    }

    revalidatePath('/admin/bulk-meters');
    revalidatePath('/admin/reports');
    revalidatePath('/staff/reports');
    return { success: true, updatedCount: count };
  });
}


// =====================================================
// Scalability Phase 2: Batch Processing
// =====================================================

export async function startBillingJobAction(payload: {
  type: 'bulk_meters' | 'individual_customers';
  monthYear: string;
  carryBalance: boolean;
  branchId?: string;
  periodStartDate?: string;
  periodEndDate?: string;
  dueDateOffsetDays?: number;
  allowOverlap?: boolean;
}) {
  return await wrap(async () => {
    await checkPermissionAny(
      PERMISSIONS.BILL_CLOSE_CYCLE,
      'billing:close_cycle',
      'bill:close_cycle',
      'bill:manage_all',
      PERMISSIONS.BILL_CREATE
    );

    // 1. Count total items to process
    let totalItems = 0;
    if (payload.type === 'bulk_meters') {
      totalItems = await dbCountBulkMeters({ branchId: payload.branchId });
    } else {
      totalItems = await dbCountCustomers({ branchId: payload.branchId });
    }

    if (totalItems === 0) {
      throw new Error("No active meters/customers found for processing.");
    }

    // 2. Pre-check for overlapping bills if allowOverlap is false
    if (!payload.allowOverlap) {
      let overlapQuery = `
        SELECT COUNT(*)::int as count 
        FROM bills 
        WHERE month_year = $1 
          AND deleted_at IS NULL
      `;
      const queryParams: any[] = [payload.monthYear];

      if (payload.branchId) {
        overlapQuery += ` AND branch_id = $2`;
        queryParams.push(payload.branchId);
      }

      if (payload.type === 'bulk_meters') {
        overlapQuery += ` AND "CUSTOMERKEY" IS NOT NULL`;
      } else {
        overlapQuery += ` AND individual_customer_id IS NOT NULL`;
      }

      const overlapCountRes = await query(overlapQuery, queryParams);
      const overlapCount = overlapCountRes[0]?.count || 0;
      if (overlapCount > 0 && overlapCount >= totalItems) {
        throw new Error(
          `Cannot start processing: All active meters/customers for the selected period (${payload.monthYear}) already have bills. ` +
          `To overwrite or append new bills, please enable "Allow Overlap".`
        );
      }
    }

    // 1. Check for active jobs to avoid duplicates or resume them.
    // Branch-specific jobs may run concurrently only when they target different branches.
    const activeJobs = await dbGetActiveBillingJobs(payload.monthYear, payload.type, payload.branchId);
    if (activeJobs.length > 0) {
      const job = activeJobs[0];
      const updatedAt = new Date(job.updated_at || job.created_at).getTime();
      const now = Date.now();
      const isStale = (now - updatedAt) > 30 * 60 * 1000; // 30 mins stale threshold

      if (isStale) {
        // Auto-fail stale job to allow a new one to start
        await dbUpdateBillingJob(job.id, { 
          status: 'failed', 
          error_log: 'Job automatically marked as failed due to inactivity (stale job).',
          updated_at: new Date()
        });
        console.log(`Auto-reset stale billing job ${job.id} for ${payload.monthYear}`);
      } else {
        // Return the existing active job so the client resumes it
        console.log(`Resuming active billing job ${job.id} for ${payload.monthYear} at processed count: ${job.processed_items}`);
        return job;
      }
    }

    // 3. Create the job record
    const job = await dbCreateBillingJob({
      type: payload.type,
      month_year: payload.monthYear,
      total_items: totalItems,
      carry_balance: payload.carryBalance,
      branch_id: payload.branchId,
      period_start_date: payload.periodStartDate,
      period_end_date: payload.periodEndDate,
      due_date_offset_days: payload.dueDateOffsetDays,
      allow_overlap: payload.allowOverlap
    });

    await logSecurityEventAction({
      event: 'Start Billing Job',
      details: { jobId: job.id, type: payload.type, month: payload.monthYear }
    });

    return job;
  });
}

export async function processBillingJobChunkAction(jobId: string, chunkSize: number = 200) {
  return await wrap(async () => {
    await checkPermissionAny(
      PERMISSIONS.BILL_CLOSE_CYCLE,
      'billing:close_cycle',
      'bill:close_cycle',
      'bill:manage_all',
      PERMISSIONS.BILL_CREATE
    );

    const job = await dbGetBillingJob(jobId);
    if (!job) throw new Error("Job not found");
    if (job.status === 'completed' || job.status === 'failed') return job;

    // Update status to processing
    await dbUpdateBillingJob(jobId, {
      status: 'processing',
      updated_at: new Date()
    });

    // 1. Fetch unprocessed items
    let items: any[] = [];
    if (job.type === 'bulk_meters') {
      items = await dbGetUnprocessedMetersForJob(job, chunkSize);
    } else {
      items = await dbGetUnprocessedIndividualCustomersForJob(job, chunkSize);
    }

    if (items.length === 0) {
      return await dbUpdateBillingJob(jobId, { status: 'completed', updated_at: new Date() });
    }

    // 2. Prepare Batch Constants (Tariffs, Dates, etc.)
    const { calculateDebtAging, normalizeTariff } = await import('./billing-utils');
    const {
      dbGetLatestApplicableTariff,
      dbGetCustomersByBulkMeterIds,
      dbGetBillsByBulkMeterIds,
      dbGetBillsByIndividualCustomerIds,
      dbBatchRolloverBulkMeters,
      dbBatchRolloverIndividualCustomersOfBulkMeters,
      dbBatchRolloverIndividualCustomers,
      dbGetReadingsForMonth,
    } = await import('./db-queries');


    const lookupDate = job.month_year;
    const { buildBillingPeriod } = await import('./billing-config');
    const period = buildBillingPeriod({
      monthYear: job.month_year,
      periodStartDate: (job as any).period_start_date,
      periodEndDate: (job as any).period_end_date,
      dueDateOffsetDays: (job as any).due_date_offset_days,
    });
    const periodStartDate = period.startDate;
    const periodEndDate = period.endDate;
    const dueDate = period.dueDate;
    const pStart = new Date(periodStartDate).getTime();
    const pEnd = new Date(periodEndDate).getTime();

    // ─────────────────────────────────────────────────────────────
    // PERFORMANCE: Pre-fetch all data needed for this chunk in bulk
    // This replaces ~(chunkSize * 2) individual queries with 2 total.
    // ─────────────────────────────────────────────────────────────
    const customerKeys = items.map((i: any) => i.customerKeyNumber);

    // Pre-fetch 1: all sub-customers for every bulk meter in this chunk (1 query)
    const subCustomersMap = job.type === 'bulk_meters'
      ? await dbGetCustomersByBulkMeterIds(customerKeys)
      : new Map<string, any[]>();

    // Pre-fetch 2: all historical bills for every meter in this chunk (1 query)
    const historicalBillsMap = job.type === 'bulk_meters'
      ? await dbGetBillsByBulkMeterIds(customerKeys, job.month_year)
      : await dbGetBillsByIndividualCustomerIds(customerKeys, job.month_year);

    // Pre-fetch 3: cache tariffs by charge group (avoids repeated DB hits per unique type)
    const tariffCache = new Map<string, any>();
    const uniqueChargeGroups = [...new Set(items.map((i: any) => i.charge_group || i.customerType || 'Non-domestic'))];
    await Promise.all(uniqueChargeGroups.map(async (cg) => {
      const tariff = await dbGetLatestApplicableTariff(cg, lookupDate);
      tariffCache.set(cg, tariff ? normalizeTariff(tariff) : null);
    }));

    // Pre-fetch 4: all current month readings for this chunk
    let currentMonthReadingsMap = new Map<string, any>();
    if (customerKeys.length > 0) {
      const readings = await dbGetReadingsForMonth(job.type, customerKeys, job.month_year);
      for (const r of readings) {
        currentMonthReadingsMap.set(r.CUST_KEY, r);
      }
    }

    // Pre-fetch 5: branch id→name map (avoids N+1 per item in the loop)
    const branchRowsForJob: any[] = await query('SELECT id, name FROM branches');
    const branchNameMapForJob = new Map<string, string>();
    for (const br of branchRowsForJob) {
      branchNameMapForJob.set(br.id, br.name);
    }

    const billsToInsert: any[] = [];
    let lastId = job.last_processed_id;
    const failedItems: string[] = [];

    // 3. Process each item using pre-fetched in-memory data (no DB calls inside loop)
    for (const item of items) {
      try {
        const customerKey = item.customerKeyNumber;
        const chargeGroup = (item.charge_group || item.customerType || 'Non-domestic') as CustomerType;
        const sewerageConn = (item.sewerage_connection || 'No') as SewerageConnection;

        // Calculate Usage
        let currRead = Number(item.currentReading ?? item.current_reading ?? 0);
        let prevRead = Number(item.previousReading ?? item.previous_reading ?? 0);
        
        const readingRecord = currentMonthReadingsMap.get(customerKey);
        if (readingRecord) {
            currRead = readingRecord.METER_READING != null ? Number(readingRecord.METER_READING) : currRead;
            prevRead = readingRecord.PREVIOUS_READING != null ? Number(readingRecord.PREVIOUS_READING) : prevRead;
        }

        const usage = currRead - prevRead;
        let diffUsage = usage;

        if (job.type === 'bulk_meters') {
          // Use pre-fetched sub-customers instead of a per-meter query
          const associatedCustomers = subCustomersMap.get(customerKey) || [];
          const totalIndivUsage = associatedCustomers.reduce((sum: number, cust: any) =>
            sum + ((Number(cust.currentReading) || 0) - (Number(cust.previousReading) || 0)), 0);
          diffUsage = usage - totalIndivUsage;
        }

        const cachedTariff = tariffCache.get(chargeGroup as string);
        if (diffUsage < 0) {
          const useRuleOfThree = cachedTariff ? (cachedTariff.use_rule_of_three !== undefined && cachedTariff.use_rule_of_three !== null ? Boolean(cachedTariff.use_rule_of_three) : true) : true;
          if (!useRuleOfThree) {
            throw new Error(
              `Negative consumption detected (${diffUsage} m³) for ${chargeGroup} in ${job.month_year}. ` +
              `Individual sub-meter usage exceeds bulk meter reading. ` +
              `Please verify meter readings before generating a bill.`
            );
          } else {
            failedItems.push(`${customerKey}: Negative consumption detected (${diffUsage} m³). Billed at 3 m³ (Rule of 3 active), but readings need attention.`);
          }
        }
        const billBreakdown = cachedTariff
          ? calculateBillFromTariff(
              cachedTariff,
              diffUsage,
              item.meterSize || item.meter_size || 0.5,
              sewerageConn
            )
          : await calculateBill(
              diffUsage,
              chargeGroup,
              sewerageConn,
              item.meterSize || item.meter_size || 0.5,
              job.month_year
            );

        diffUsage = billBreakdown.effectiveUsage;

        // Use pre-fetched historical bills instead of a per-meter query
        const historicalBills = historicalBillsMap.get(customerKey) || [];

        // Overlap Protection
        const hasOverlap = historicalBills.some((bill: any) => {
          if (!bill.bill_period_start_date || !bill.bill_period_end_date) return false;
          const bStart = new Date(bill.bill_period_start_date).getTime();
          const bEnd = new Date(bill.bill_period_end_date).getTime();
          return pStart <= bEnd && pEnd >= bStart;
        });

        if (hasOverlap && !(job as any).allow_overlap) {
          console.log(`Skipping meter ${customerKey}: billing period overlaps an existing bill.`);
          failedItems.push(`${customerKey}: Billing period overlaps with an existing bill.`);
          lastId = customerKey; // still advance cursor
          continue;
        }

        const balanceFromPreviousPeriods = Number(item.outStandingbill || item.balance_carried_forward || 0);
        // Pass job.month_year so age is calculated relative to the billing month, not server time
        const { debit30, debit30_60, debit60, penaltyAmt } = calculateDebtAging(balanceFromPreviousPeriods, historicalBills, undefined, job.month_year);

        const outstandingAmt = Number((debit30 + debit30_60 + debit60).toFixed(2));
        const totalPayable = Number((penaltyAmt + outstandingAmt + billBreakdown.totalBill).toFixed(2));

        const billId = crypto.randomUUID();
        const carryBalance = Boolean((job as any).carry_balance);
        const branchId: string | null = item.branch_id || null;
        const branchName: string | null = branchId ? (branchNameMapForJob.get(branchId) || null) : null;

        // Snapshot captures usage breakdown for PDF generation
        const snapshotData = job.type === 'bulk_meters' ? {
          chargeGroup: item.charge_group || item.customerType,
          sewerageConnection: sewerageConn,
          individualCustomerCount: (subCustomersMap.get(customerKey) || []).length,
          totalIndividualUsage: (subCustomersMap.get(customerKey) || []).reduce((s: number, c: any) =>
            s + ((Number(c.currentReading) || 0) - (Number(c.previousReading) || 0)), 0),
        } : null;

        const bill: any = {
          id: billId,
          BILLKEY: generateBillKey(billId),
          CUSTOMERKEY: job.type === 'bulk_meters' ? customerKey : null,
          individual_customer_id: job.type === 'individual_customers' ? customerKey : null,
          CUSTOMERNAME: item.name,
          CUSTOMERBRANCH: branchName,
          branch_id: branchId,
          month_year: job.month_year,
          bill_period_start_date: periodStartDate,
          bill_period_end_date: periodEndDate,
          due_date: dueDate,
          PREVREAD: prevRead,
          CURRREAD: currRead,
          CONS: usage,
          difference_usage: diffUsage,
          THISMONTHBILLAMT: billBreakdown.totalBill,
          OUTSTANDINGAMT: outstandingAmt,
          PENALTYAMT: penaltyAmt,
          TOTALBILLAMOUNT: totalPayable,
          base_water_charge: billBreakdown.baseWaterCharge,
          maintenance_fee: billBreakdown.maintenanceFee,
          sanitation_fee: billBreakdown.sanitationFee,
          sewerage_charge: billBreakdown.sewerageCharge,
          meter_rent: billBreakdown.meterRent,
          vat_amount: billBreakdown.vatAmount,
          additional_fees_breakdown: billBreakdown.additionalFeesBreakdown,
          balance_carried_forward: outstandingAmt,
          amount_paid: carryBalance ? 0 : totalPayable,
          payment_status: carryBalance ? 'Unpaid' : 'Paid',
          debit_30: debit30,
          debit_30_60: debit30_60,
          debit_60: debit60,
          status: 'Draft',
          bill_number: `BILL-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          snapshot_data: snapshotData,
        };

        billsToInsert.push(bill);
        lastId = customerKey;
      } catch (err: any) {
        // Log the failure but continue processing remaining meters
        const reason = err?.message || String(err);
        console.error(`Error processing item ${item.customerKeyNumber}: ${reason}`);
        failedItems.push(`${item.customerKeyNumber}: ${reason}`);
        lastId = item.customerKeyNumber; // advance cursor so we don't retry this item
      }
    }

    // 4. Batch Insert Bills & Update Job Progress (wrapped in transaction)
    const updatedJob = await withTransaction(async (client) => {
      if (billsToInsert.length > 0) {
        await dbBatchInsertBills(billsToInsert, client);

        // Rollover meter readings for successfully billed items
        if (job.type === 'bulk_meters') {
          const successes = billsToInsert.map(b => b.CUSTOMERKEY).filter(Boolean);
          await dbBatchRolloverBulkMeters(successes, client);
          await dbBatchRolloverIndividualCustomersOfBulkMeters(successes, client);
          const bulkMetersToUpdate = billsToInsert
            .filter(b => b.CUSTOMERKEY)
            .map(b => [
              b.CUSTOMERKEY,
              String((job as any).carry_balance ? b.TOTALBILLAMOUNT : 0),
              (job as any).carry_balance ? 'Unpaid' : 'Paid'
            ]);

          if (bulkMetersToUpdate.length > 0) {
            const placeholders = bulkMetersToUpdate.map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}::numeric, $${idx * 3 + 3})`).join(', ');
            const flatValues = bulkMetersToUpdate.flat();
            await client.query(`
              UPDATE bulk_meters AS m 
              SET "outStandingbill" = v.balance, "paymentStatus" = v.status
              FROM (VALUES ${placeholders}) AS v(key, balance, status)
              WHERE m."customerKeyNumber" = v.key
            `, flatValues);
          }
        } else {
          const successes = billsToInsert.map(b => b.individual_customer_id).filter(Boolean);
          await dbBatchRolloverIndividualCustomers(successes, client);

          const individualCustomersToUpdate = billsToInsert
            .filter(b => b.individual_customer_id)
            .map(b => [
              b.individual_customer_id,
              String((job as any).carry_balance ? b.TOTALBILLAMOUNT : 0),
              (job as any).carry_balance ? 'Unpaid' : 'Paid'
            ]);

          if (individualCustomersToUpdate.length > 0) {
            const placeholders = individualCustomersToUpdate.map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}::numeric, $${idx * 3 + 3})`).join(', ');
            const flatValues = individualCustomersToUpdate.flat();
            await client.query(`
              UPDATE individual_customers AS m 
              SET "outStandingbill" = v.balance, "paymentStatus" = v.status
              FROM (VALUES ${placeholders}) AS v(key, balance, status)
              WHERE m."customerKeyNumber" = v.key
            `, flatValues);
          }
        }
      }

      // 5. Update Job Progress — count only successfully billed items, log any failures
      const jobUpdate: any = {
        processed_items: job.processed_items + items.length,
        last_processed_id: lastId,
        updated_at: new Date()
      };
      if (failedItems.length > 0) {
        // Append to existing error_log so failures accumulate across chunks
        const existingLog = job.error_log ? job.error_log + '\n' : '';
        jobUpdate.error_log = existingLog + failedItems.join('\n');
      }
      return await dbUpdateBillingJob(jobId, jobUpdate, client);
    });

    // If we processed fewer items than chunk size, the job is complete
    if (items.length < chunkSize) {
      return await dbUpdateBillingJob(jobId, { status: 'completed', updated_at: new Date() });
    }

    return updatedJob;
  });
}

export async function getBillingJobStatusAction(jobId: string) {
  return await wrap(async () => {
    await checkPermission('billing:close_cycle');
    return await dbGetBillingJob(jobId);
  });
}

/**
 * Manually resets any stuck (pending or processing) billing jobs for a month.
 */
export async function resetStuckBillingJobsAction(monthYear: string, type: 'bulk_meters' | 'individual_customers') {
  return await wrap(async () => {
    await checkPermission('billing:close_cycle');
    
    const activeJobs = await dbGetActiveBillingJobs(monthYear, type);
    if (activeJobs.length === 0) {
      return { success: true, message: "No active jobs found to reset." };
    }

    for (const job of activeJobs) {
      await dbUpdateBillingJob(job.id, {
        status: 'failed',
        error_log: 'Job manually reset by administrator.',
        updated_at: new Date()
      });
    }

    await logSecurityEventAction({
      event: 'Reset Billing Jobs',
      details: { monthYear, type, resetCount: activeJobs.length }
    });

    return { success: true, resetCount: activeJobs.length };
  });
}

/**
 * Scalable Reporting Actions (Phase 4)
 */

export async function getUnsettledBillsAction(params: {
  page: number;
  limit: number;
  searchTerm?: string;
  branchId?: string;
  monthYear?: string;
  statusFilter?: 'all' | 'overdue' | 'unpaid';
  excludeUnfinalized?: boolean;
}) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms = session.permissions || [];
    const hasGlobalAccess = perms.includes('*') || perms.includes('all') || perms.includes(PERMISSIONS.REPORTS_GENERATE_ALL) || perms.includes('reports_generate_all') || perms.includes(PERMISSIONS.BILL_VIEW_ALL) || perms.includes('bill:manage_all') || perms.includes('bill:view_unpaid') || perms.includes('reports_view');

    // If user doesn't have global access, they are strictly restricted to their own branch
    const effectiveBranchId = hasGlobalAccess ? params.branchId : (session.branchId || params.branchId);
    const normalizedBranchId = !effectiveBranchId || effectiveBranchId === 'all' ? undefined : effectiveBranchId;

    const offset = params.page * params.limit;
    const [bills, total] = await Promise.all([
      dbGetUnsettledBillsPaginated({ ...params, offset, branchId: normalizedBranchId, excludeUnfinalized: params.excludeUnfinalized ?? true }),
      dbGetUnsettledBillsCount({ ...params, branchId: normalizedBranchId, excludeUnfinalized: params.excludeUnfinalized ?? true })
    ]);
    return { success: true, bills, total };
  });
}

export async function getPaidBillsAction(params: {
  page: number;
  limit: number;
  searchTerm?: string;
  branchId?: string;
  monthYear?: string;
  excludeUnfinalized?: boolean;
}) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms = session.permissions || [];
    const hasGlobalAccess = perms.includes('*') || perms.includes('all') || perms.includes(PERMISSIONS.REPORTS_GENERATE_ALL) || perms.includes('reports_generate_all') || perms.includes(PERMISSIONS.BILL_VIEW_ALL) || perms.includes('bill:manage_all') || perms.includes('bill:view_paid') || perms.includes('reports_view');

    // If user doesn't have global access, they are strictly restricted to their own branch
    const effectiveBranchId = hasGlobalAccess ? params.branchId : (session.branchId || params.branchId);
    const normalizedBranchId = !effectiveBranchId || effectiveBranchId === 'all' ? undefined : effectiveBranchId;

    const offset = params.page * params.limit;
    const [bills, total] = await Promise.all([
      dbGetPaidBillsPaginated({ ...params, offset, branchId: normalizedBranchId, excludeUnfinalized: params.excludeUnfinalized ?? true }),
      dbGetPaidBillsCount({ ...params, branchId: normalizedBranchId, excludeUnfinalized: params.excludeUnfinalized ?? true })
    ]);
    return { success: true, bills, total };
  });
}

export async function getAllSentBillsAction(params: {
  page: number;
  limit: number;
  searchTerm?: string;
  branchId?: string;
  monthYear?: string;
}) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const perms = session.permissions || [];
    const hasGlobalAccess = perms.includes('*') || perms.includes('all') || perms.includes(PERMISSIONS.REPORTS_GENERATE_ALL) || perms.includes('reports_generate_all') || perms.includes(PERMISSIONS.BILL_VIEW_ALL) || perms.includes('bill:manage_all') || perms.includes('reports_view');

    // If user doesn't have global access, they are strictly restricted to their own branch
    const effectiveBranchId = hasGlobalAccess ? params.branchId : (session.branchId || params.branchId);
    const normalizedBranchId = !effectiveBranchId || effectiveBranchId === 'all' ? undefined : effectiveBranchId;

    const offset = params.page * params.limit;
    const [bills, total] = await Promise.all([
      dbGetAllSentBillsPaginated({ ...params, offset, branchId: normalizedBranchId }),
      dbGetAllSentBillsCount({ ...params, branchId: normalizedBranchId })
    ]);
    return { success: true, bills, total };
  });
}

export async function archiveOldRecordsAction(monthsThreshold: number = 36) {
  try {
    const session = await checkPermission(PERMISSIONS.SETTINGS_MANAGE);
    const result = await dbArchiveOldRecords(monthsThreshold);
    await logSecurityEventAction({
      event: 'Archive Old Records',
      details: { monthsThreshold, result }
    });
    return result;
  } catch (error: any) {
    console.error("Error archiving old records:", error);
    return { success: false, error: error.message };
  }
}

export async function getSystemStatsAction() {
  try {
    const session = await checkPermission();
    const perms = session.permissions || await dbGetStaffPermissions(session.id!);
    const hasAccess = perms.includes('*') || perms.includes('all') || perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL) || perms.includes(PERMISSIONS.SETTINGS_MANAGE);
    if (!hasAccess) {
      throw new Error('Forbidden: Missing permission to view system stats.');
    }
    const stats = await dbGetSystemStats();
    return { success: true, stats };
  } catch (error: any) {
    console.error("Error fetching system stats:", error);
    return { success: false, error: error.message };
  }
}

export async function runDataAuditAction() {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.SETTINGS_MANAGE);
    const branchId = getEffectiveBranchId(session, undefined, 'dashboard_view_all');
    const result = await dbRunDataAudit(branchId);
    
    await logSecurityEventAction({
      event: 'Run Data Integrity Audit',
      details: { branchId, findCount: result.length }
    });

    return result;
  });
}

// ==========================================
// SYSTEM SETTINGS ACTIONS
// ==========================================

export async function getSystemSettingsAction() {
  return await wrap(async () => {
    // Any authenticated staff member can read non-sensitive UI settings
    await checkPermission();
    const { dbGetSystemSettings } = await import('./db-queries');
    const settings = await dbGetSystemSettings();
    return settings;
  });
}

export async function getSessionSettingsAction() {
  return await wrap(async () => {
    await checkPermission();
    const { dbGetSessionSettings } = await import('./db-queries');
    const settings = await dbGetSessionSettings();
    return settings;
  });
}

export async function updateBillingSettingsAction(payload: {
  cycleMode: 'once_per_month' | 'custom' | 'unlimited';
  startDay: string;
  dueDateOffset: string;
}) {
  return await wrap(async () => {
    // Check if user has settings management permission
    await checkPermission(PERMISSIONS.SETTINGS_MANAGE);
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const { dbUpdateSystemSetting } = await import('./db-queries');
    await dbUpdateSystemSetting('billing_cycle_mode', payload.cycleMode);
    await dbUpdateSystemSetting('billing_cycle_start_day', payload.startDay);
    await dbUpdateSystemSetting('billing_due_date_offset', payload.dueDateOffset);

    await logSecurityEventAction({
      event: 'Updated Billing Settings',
      details: payload
    });

    return { success: true };
  });
}

export async function updateSessionSettingsAction(payload: { sessionDurationSeconds: string; sessionWarningSeconds: string }) {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.SETTINGS_MANAGE);
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const { dbUpdateSessionSettings } = await import('./db-queries');
    await dbUpdateSessionSettings(payload.sessionDurationSeconds, payload.sessionWarningSeconds);

    await logSecurityEventAction({
      event: 'Updated Session Settings',
      details: payload,
    });

    return { success: true };
  });
}

// Bulk bill workflow helpers & actions
const verifyBillsBranchAccessBulk = async (billIds: string[], session: any) => {
  const perms = session.permissions || [];
  if (perms.includes('bill:manage_all')) {
    return;
  }

  const placeholders = billIds.map((_, i) => `$${i + 2}`).join(', ');
  const res = await query(
    `SELECT id FROM bills WHERE id IN (${placeholders}) AND branch_id = $1 AND deleted_at IS NULL`,
    [session.branchId, ...billIds]
  );
  if (res.length !== billIds.length) {
    throw new Error('Forbidden: One or more bills are not in your branch or do not exist');
  }
};

export async function submitBillsBulkAction(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true };
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];

    if (!(perms.includes(PERMISSIONS.BILL_CREATE) || perms.includes(PERMISSIONS.BILL_VIEW_ALL))) {
      throw new Error('Forbidden: Missing permission bill_create or bill_view_all');
    }

    await verifyBillsBranchAccessBulk(ids, session);

    return await withTransaction(async (client) => {
      await client.query('SAVEPOINT sp_bulk_submit');
      try {
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const currentBills = await client.query(`SELECT id, status, month_year FROM bills WHERE id IN (${placeholders})`, ids);
        const statusMap = new Map(currentBills.rows.map((b: any) => [b.id, b.status || 'Draft']));

        // Group IDs by month_year for partition pruning updates
        const groups = new Map<string, string[]>();
        for (const r of currentBills.rows) {
          if (!groups.has(r.month_year)) groups.set(r.month_year, []);
          groups.get(r.month_year)!.push(r.id);
        }

        for (const [my, groupIds] of groups.entries()) {
          const groupPlaceholders = groupIds.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(
            `UPDATE bills SET status = 'Pending' WHERE month_year = $${groupIds.length + 1} AND id IN (${groupPlaceholders})`,
            [...groupIds, my]
          );
        }

        const logValues: any[] = [];
        const logPlaceholders: string[] = [];
        let index = 1;
        for (const id of ids) {
          const fromStatus = statusMap.get(id) || 'Draft';
          logValues.push(id, fromStatus, 'Pending', session.id);
          logPlaceholders.push(`($${index}, $${index+1}, $${index+2}, $${index+3})`);
          index += 4;
        }
        await client.query(
          `INSERT INTO bill_workflow_logs ("bill_id", "from_status", "to_status", "changed_by") VALUES ${logPlaceholders.join(', ')}`,
          logValues
        );

        await client.query('RELEASE SAVEPOINT sp_bulk_submit');

        await logSecurityEventAction({
          event: 'Submit Bills Bulk',
          details: { count: ids.length, ids }
        });

        return { success: true };
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT sp_bulk_submit');
        throw err;
      }
    });
  });
}

export async function approveBillsBulkAction(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true };
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.BILL_APPROVE);
    await verifyBillsBranchAccessBulk(ids, session);

    return await withTransaction(async (client) => {
      await client.query('SAVEPOINT sp_bulk_approve');
      try {
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const currentBills = await client.query(`SELECT id, status, month_year FROM bills WHERE id IN (${placeholders})`, ids);
        const statusMap = new Map(currentBills.rows.map((b: any) => [b.id, b.status || 'Pending']));

        const approvalDate = new Date();

        // Group IDs by month_year for partition pruning updates
        const groups = new Map<string, string[]>();
        for (const r of currentBills.rows) {
          if (!groups.has(r.month_year)) groups.set(r.month_year, []);
          groups.get(r.month_year)!.push(r.id);
        }

        for (const [my, groupIds] of groups.entries()) {
          const groupPlaceholders = groupIds.map((_, i) => `$${i + 3}`).join(', ');
          await client.query(
            `UPDATE bills SET status = 'Approved', approval_date = $1, approved_by = $2 WHERE month_year = $${groupIds.length + 3} AND id IN (${groupPlaceholders})`,
            [approvalDate, session.id, ...groupIds, my]
          );
        }

        const logValues: any[] = [];
        const logPlaceholders: string[] = [];
        let index = 1;
        for (const id of ids) {
          const fromStatus = statusMap.get(id) || 'Pending';
          logValues.push(id, fromStatus, 'Approved', session.id);
          logPlaceholders.push(`($${index}, $${index+1}, $${index+2}, $${index+3})`);
          index += 4;
        }
        await client.query(
          `INSERT INTO bill_workflow_logs ("bill_id", "from_status", "to_status", "changed_by") VALUES ${logPlaceholders.join(', ')}`,
          logValues
        );

        await client.query('RELEASE SAVEPOINT sp_bulk_approve');

        await logSecurityEventAction({
          event: 'Approve Bills Bulk',
          details: { count: ids.length, ids }
        });

        return { success: true };
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT sp_bulk_approve');
        throw err;
      }
    });
  });
}

export async function postBillsBulkAction(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true };
  return await wrap(async () => {
    const session = await checkPermission();
    const perms = session.permissions || [];

    if (!(perms.includes(PERMISSIONS.BILL_POST) || perms.includes(PERMISSIONS.BILL_VIEW_ALL))) {
      throw new Error('Forbidden: Missing permission bill_post or bill_view_all');
    }

    await verifyBillsBranchAccessBulk(ids, session);

    return await withTransaction(async (client) => {
      await client.query('SAVEPOINT sp_bulk_post');
      try {
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const currentBills = await client.query(`SELECT id, status, month_year FROM bills WHERE id IN (${placeholders})`, ids);
        const statusMap = new Map(currentBills.rows.map((b: any) => [b.id, b.status || 'Approved']));

        // Group IDs by month_year for partition pruning updates
        const groups = new Map<string, string[]>();
        for (const r of currentBills.rows) {
          if (!groups.has(r.month_year)) groups.set(r.month_year, []);
          groups.get(r.month_year)!.push(r.id);
        }

        for (const [my, groupIds] of groups.entries()) {
          const groupPlaceholders = groupIds.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(
            `UPDATE bills SET status = 'Posted' WHERE month_year = $${groupIds.length + 1} AND id IN (${groupPlaceholders})`,
            [...groupIds, my]
          );
        }

        const logValues: any[] = [];
        const logPlaceholders: string[] = [];
        let index = 1;
        for (const id of ids) {
          const fromStatus = statusMap.get(id) || 'Approved';
          logValues.push(id, fromStatus, 'Posted', session.id);
          logPlaceholders.push(`($${index}, $${index+1}, $${index+2}, $${index+3})`);
          index += 4;
        }
        await client.query(
          `INSERT INTO bill_workflow_logs ("bill_id", "from_status", "to_status", "changed_by") VALUES ${logPlaceholders.join(', ')}`,
          logValues
        );

        await client.query('RELEASE SAVEPOINT sp_bulk_post');

        await logSecurityEventAction({
          event: 'Post Bills Bulk',
          details: { count: ids.length, ids }
        });

        return { success: true };
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT sp_bulk_post');
        throw err;
      }
    });
  });
}

// =====================================================
// Batch CSV Import Actions — Single-transaction bulk insert
// =====================================================

/**
 * Shared two-layer savepoint guard used by all batch CSV import functions.
 *
 * Layer 1 — ROLLBACK TO SAVEPOINT:
 *   If the rollback itself throws, the transaction is permanently aborted.
 *   Returns { ok: false, transactionDead: true }.
 *
 * Layer 2 — SELECT 1 health probe (double-check):
 *   Even when ROLLBACK TO SAVEPOINT succeeds without throwing, PostgreSQL can
 *   silently leave the connection in a broken state. The probe detects this.
 *   Returns { ok: false, transactionDead: true } if the probe fails.
 *
 * On a normal (recoverable) row error it returns { ok: false, transactionDead: false },
 * meaning the transaction is still alive and the loop can continue.
 * On success it returns { ok: true }.
 */
async function savepointGuard(
  client: any,
  spName: string,
  fn: () => Promise<void>,
  tag: string // e.g. "[BatchImportBulkMeters]"
): Promise<{ ok: true } | { ok: false; errMsg: string; transactionDead: boolean }> {
  try {
    await client.query(`SAVEPOINT ${spName}`);
    await fn();
    await client.query(`RELEASE SAVEPOINT ${spName}`);
    return { ok: true };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error(`${tag} Row error: ${errMsg}`);

    // ── Layer 1: attempt savepoint rollback ────────────────────────────────
    try {
      await client.query(`ROLLBACK TO SAVEPOINT ${spName}`);
    } catch (spErr: any) {
      console.error(`${tag} CRITICAL: Savepoint rollback failed — transaction is dead: ${spErr?.message || spErr}`);
      return { ok: false, errMsg, transactionDead: true };
    }

    // ── Layer 2: double-check the connection is genuinely alive ────────────
    try {
      await client.query('SELECT 1');
    } catch {
      console.error(`${tag} CRITICAL: Health probe failed after savepoint rollback — transaction is dead`);
      return { ok: false, errMsg, transactionDead: true };
    }

    return { ok: false, errMsg, transactionDead: false };
  }
}

const normalizePhoneNumber = (raw?: any): string | null => {
  if (!raw) return null;
  const clean = String(raw).trim().replace(/[\s-]/g, '');
  if (/^[79]\d{8}$/.test(clean)) return `0${clean}`;
  return clean;
};

const generateRandomDigits = (length: number): string => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
};

/**
 * Batch-import bulk meters from a CSV upload.
 * Replaces N individual createBulkMeterAction calls with a single server roundtrip.
 */
export async function batchImportBulkMetersAction(rows: any[]) {
  if (!rows || rows.length === 0) return { success: true, inserted: 0, errors: [] };
  return await wrap(async () => {
    const session = await checkPermissionAny(PERMISSIONS.BULK_METERS_CREATE, PERMISSIONS.DATA_ENTRY_ACCESS);
    const branches = await dbGetAllBranches();
    const branchMap = new Map<string, string>();
    branches.forEach((b: any) => {
      if (b.id) branchMap.set(String(b.id).toLowerCase(), b.id);
      if (b.name) branchMap.set(b.name.toLowerCase().trim(), b.id);
    });

    const ALLOWED_BULK_COLS = new Set([
  "customerKeyNumber",
  "INST_KEY",
  "name",
  "contractNumber",
  "meterSize",
  "METER_KEY",
  "previousReading",
  "currentReading",
  "month",
  "specificArea",
  "subCity",
  "woreda",
  "branch_id",
  "NUMBER_OF_DIALS",
  "status",
  "paymentStatus",
  "charge_group",
  "ROUTE_KEY",
  "ROUND_KEY",
  "sewerage_connection",
  "ordinal",
  "phoneNumber",
  "outStandingbill"
]);

    const preparedRows = rows.map((row: any) => {
      const r = { ...row };
      const rawBranch = r.branch_id || r.branchId || session.branchId;
      const resolvedBranchId = rawBranch ? (branchMap.get(String(rawBranch).toLowerCase().trim()) || session.branchId) : session.branchId;

      const customerKeyNumber = r.customerKeyNumber || `BM-${generateRandomDigits(8)}`;
      const instKey = r.INST_KEY || r.instKey || `INST-${generateRandomDigits(6)}`;
      const meterKey = r.METER_KEY || r.meterNumber || r.meter_key;
      const routeKey = r.ROUTE_KEY || r.routeKey || r.route_key || null;
      const roundKey = r.ROUND_KEY || r.roundKey || r.round_key || null;
      const spatial = { xCoordinate: r.xCoordinate, yCoordinate: r.yCoordinate, zCoordinate: r.zCoordinate };

      const normalizedRow: Record<string, any> = {
        customerKeyNumber,
        INST_KEY: instKey,
        name: r.name || 'Bulk Meter',
        contractNumber: r.contractNumber || `CON-${generateRandomDigits(8)}`,
        meterSize: r.meterSize !== undefined ? Number(r.meterSize) || 1 : 1,
        METER_KEY: meterKey,
        previousReading: r.previousReading !== undefined ? Number(r.previousReading) || 0 : 0,
        currentReading: r.currentReading !== undefined ? Number(r.currentReading) || 0 : 0,
        month: r.month || format(new Date(), 'yyyy-MM'),
        specificArea: r.specificArea || null,
        subCity: r.subCity || null,
        woreda: r.woreda || null,
        branch_id: resolvedBranchId,
        NUMBER_OF_DIALS: r.NUMBER_OF_DIALS || r.numberOfDials ? Number(r.NUMBER_OF_DIALS || r.numberOfDials) : null,
        status: 'Pending Approval',
        paymentStatus: r.paymentStatus || 'Unpaid',
        charge_group: r.charge_group || r.chargeGroup || null,
        ROUTE_KEY: routeKey,
        ROUND_KEY: roundKey,
        sewerage_connection: r.sewerage_connection || r.sewerageConnection || 'No',
        ordinal: r.ordinal !== undefined ? Number(r.ordinal) || null : null,
        phoneNumber: normalizePhoneNumber(r.phoneNumber || r.phone_number || r.PHONE_NUMBER),
      };

      // Strip keys not in the allowed database columns
      for (const k of Object.keys(normalizedRow)) {
        if (!ALLOWED_BULK_COLS.has(k) || normalizedRow[k] === undefined) {
          delete normalizedRow[k];
        }
      }

      return { row: normalizedRow, spatial, key: customerKeyNumber, routeKey };
    });

    const insertedKeys: string[] = [];
    const errors: string[] = [];

    console.log(`[BatchImportBulkMeters] Processing batch of ${preparedRows.length} rows`);

    await withTransaction(async (client) => {
      // 1. Auto-provision any missing routes using the exact resolved branch ID from the CSV
      const routeBranchMap = new Map<string, string | null>();
      for (const p of preparedRows) {
        if (p.routeKey && !routeBranchMap.has(p.routeKey)) {
          routeBranchMap.set(p.routeKey, p.row.branch_id || session.branchId || null);
        }
      }

      for (const [rk, routeBranchId] of routeBranchMap.entries()) {
        try {
          await client.query(
            `INSERT INTO routes (route_key, branch_id, description) VALUES ($1, $2, $3) 
             ON CONFLICT (route_key) DO UPDATE SET branch_id = COALESCE(routes.branch_id, EXCLUDED.branch_id)`,
            [rk, routeBranchId, `Route ${rk}`]
          );
        } catch (e) {
          console.warn(`[BatchImportBulkMeters] Route provision warning for ${rk}:`, e);
        }
      }

      const MINI_BATCH = 50;
      for (let i = 0; i < preparedRows.length; i += MINI_BATCH) {
        const batch = preparedRows.slice(i, i + MINI_BATCH);
        const batchSp = `sp_bm_batch_${i}`;
        
        // Collect all distinct column names in this mini-batch
        const colSet = new Set<string>();
        batch.forEach(b => Object.keys(b.row).forEach(k => colSet.add(k)));
        const cols = Array.from(colSet);
        const colNamesStr = cols.map(c => `"${c}"`).join(', ');

        const values: any[] = [];
        const valueTuples: string[] = [];
        let paramIdx = 1;

        batch.forEach(item => {
          const tuplePlaceholders = cols.map(c => {
            values.push(item.row[c] !== undefined ? item.row[c] : null);
            return `$${paramIdx++}`;
          });
          valueTuples.push(`(${tuplePlaceholders.join(', ')})`);
        });

        const sql = `INSERT INTO bulk_meters (${colNamesStr}) VALUES ${valueTuples.join(', ')} ON CONFLICT ("customerKeyNumber") DO NOTHING RETURNING "customerKeyNumber"`;
        
        let batchOk = false;
        try {
          await client.query(`SAVEPOINT ${batchSp}`);
          const res = await client.query(sql, values);
          await client.query(`RELEASE SAVEPOINT ${batchSp}`);
          batchOk = true;

          const insertedInThisBatch = new Set((res.rows || []).map((r: any) => r.customerKeyNumber));
          
          for (const item of batch) {
            if (insertedInThisBatch.has(item.key)) {
              insertedKeys.push(item.key);
              if (item.spatial.xCoordinate != null || item.spatial.yCoordinate != null || item.spatial.zCoordinate != null) {
                await dbUpsertSpatialRecord(item.key, 'bulk_meter', item.spatial, client);
              }
            } else {
              errors.push(`Meter ${item.key}: already exists or conflict`);
            }
          }
        } catch (batchErr: any) {
          try { await client.query(`ROLLBACK TO SAVEPOINT ${batchSp}`); } catch {}
          console.warn(`[BatchImportBulkMeters] Mini-batch ${i} failed, falling back to row-by-row:`, batchErr?.message);
        }

        // Fallback to row-by-row with individual savepoints if mini-batch failed
        if (!batchOk) {
          for (let rIdx = 0; rIdx < batch.length; rIdx++) {
            const item = batch[rIdx];
            const rowSp = `sp_bm_row_${i}_${rIdx}`;
            try {
              await client.query(`SAVEPOINT ${rowSp}`);
              const itemCols = Object.keys(item.row).map(c => `"${c}"`).join(', ');
              const itemPlaceholders = Object.keys(item.row).map((_, idx) => `$${idx + 1}`).join(', ');
              const itemValues = Object.values(item.row);
              const singleRes = await client.query(
                `INSERT INTO bulk_meters (${itemCols}) VALUES (${itemPlaceholders}) ON CONFLICT ("customerKeyNumber") DO NOTHING RETURNING "customerKeyNumber"`,
                itemValues
              );
              await client.query(`RELEASE SAVEPOINT ${rowSp}`);

              if (singleRes.rows?.length > 0) {
                insertedKeys.push(item.key);
                if (item.spatial.xCoordinate != null || item.spatial.yCoordinate != null || item.spatial.zCoordinate != null) {
                  await dbUpsertSpatialRecord(item.key, 'bulk_meter', item.spatial, client);
                }
              } else {
                errors.push(`Meter ${item.key}: already exists`);
              }
            } catch (singleErr: any) {
              try { await client.query(`ROLLBACK TO SAVEPOINT ${rowSp}`); } catch {}
              errors.push(`Meter ${item.key}: ${singleErr?.message || 'Insert failed'}`);
            }
          }
        }
      }
    });

    console.log(`[BatchImportBulkMeters] Complete: inserted=${insertedKeys.length}, errors=${errors.length}`);

    try {
      await logSecurityEventAction({
        event: 'Batch Import Bulk Meters',
        details: { inserted: insertedKeys.length, errors: errors.length, total: rows.length }
      });
    } catch (logErr) {
      console.warn('Failed to log batch import event:', logErr);
    }

    const sanitizedErrors = errors.map(e => typeof e === 'string' ? e : String(e));
    return { success: true, inserted: insertedKeys.length, errors: sanitizedErrors };
  });
}

/**
 * Batch-import individual customers from a CSV upload.
 * Replaces N individual createCustomerAction calls with a single server roundtrip.
 */
export async function batchImportIndividualCustomersAction(rows: any[]) {
  if (!rows || rows.length === 0) return { success: true, inserted: 0, errors: [] };
  return await wrap(async () => {
    const session = await checkPermissionAny(PERMISSIONS.CUSTOMERS_CREATE, PERMISSIONS.DATA_ENTRY_ACCESS);
    const branches = await dbGetAllBranches();
    const branchMap = new Map<string, string>();
    branches.forEach((b: any) => {
      if (b.id) branchMap.set(String(b.id).toLowerCase(), b.id);
      if (b.name) branchMap.set(b.name.toLowerCase().trim(), b.id);
    });

    const ALLOWED_IND_COLS = new Set([
  "customerKeyNumber",
  "INST_KEY",
  "name",
  "contractNumber",
  "customerType",
  "bookNumber",
  "ordinal",
  "meterSize",
  "METER_KEY",
  "previousReading",
  "currentReading",
  "month",
  "assignedBulkMeterId",
  "branch_id",
  "NUMBER_OF_DIALS",
  "status",
  "paymentStatus",
  "ROUTE_KEY",
  "ROUND_KEY",
  "calculatedBill",
  "sewerageConnection",
  "specificArea",
  "subCity",
  "woreda",
  "phone_number"
]);

    const preparedRows = rows.map((row: any) => {
      const r = { ...row };
      const rawBranch = r.branch_id || r.branchId || session.branchId;
      const resolvedBranchId = rawBranch ? (branchMap.get(String(rawBranch).toLowerCase().trim()) || session.branchId) : session.branchId;

      const customerKeyNumber = r.customerKeyNumber || `IND-${crypto.randomUUID().replace(/-/g, '').slice(0,8)}`;
      const instKey = r.INST_KEY || r.instKey || `INST-${crypto.randomUUID().replace(/-/g, '').slice(0,6)}`;
      const meterKey = r.METER_KEY || r.meterNumber || r.meter_key;
      const routeKey = r.ROUTE_KEY || r.routeKey || r.route_key || null;
      const spatial = { xCoordinate: r.xCoordinate, yCoordinate: r.yCoordinate, zCoordinate: r.zCoordinate };

      const normalizedRow: Record<string, any> = {
        customerKeyNumber,
        INST_KEY: instKey,
        name: r.name || 'Customer',
        contractNumber: r.contractNumber || `CON-${crypto.randomUUID().replace(/-/g, '').slice(0,8)}`,
        customerType: r.customerType || 'Domestic',
        bookNumber: r.bookNumber || '1',
        ordinal: r.ordinal !== undefined ? Number(r.ordinal) || 1 : 1,
        meterSize: r.meterSize !== undefined ? Number(r.meterSize) || 0.5 : 0.5,
        METER_KEY: meterKey,
        previousReading: r.previousReading !== undefined ? Number(r.previousReading) || 0 : 0,
        currentReading: r.currentReading !== undefined ? Number(r.currentReading) || 0 : 0,
        month: r.month || format(new Date(), 'yyyy-MM'),
        assignedBulkMeterId: r.assignedBulkMeterId || null,
        branch_id: resolvedBranchId,
        NUMBER_OF_DIALS: r.NUMBER_OF_DIALS || r.numberOfDials ? Number(r.NUMBER_OF_DIALS || r.numberOfDials) : null,
        status: 'Pending Approval',
        paymentStatus: r.paymentStatus || 'Unpaid',
        ROUTE_KEY: routeKey,
        ROUND_KEY: r.ROUND_KEY || r.roundKey || r.round_key || null,
        calculatedBill: r.calculatedBill !== undefined ? Number(r.calculatedBill) || 0 : 0,
        sewerageConnection: r.sewerageConnection || r.sewerage_connection || 'No',
        specificArea: r.specificArea || null,
        subCity: r.subCity || null,
        woreda: r.woreda || null,
        phone_number: normalizePhoneNumber(r.phoneNumber || r.phone_number || r.PHONE_NUMBER),
      };

      for (const k of Object.keys(normalizedRow)) {
        if (!ALLOWED_IND_COLS.has(k) || normalizedRow[k] === undefined) {
          delete normalizedRow[k];
        }
      }

      return { row: normalizedRow, spatial, key: customerKeyNumber, routeKey };
    });

    const insertedKeys: string[] = [];
    const errors: string[] = [];

    console.log(`[BatchImportIndividualCustomers] Processing batch of ${preparedRows.length} rows`);

    await withTransaction(async (client) => {
      // 1. Auto-provision any missing routes using the exact resolved branch ID from the CSV
      const routeBranchMap = new Map<string, string | null>();
      for (const p of preparedRows) {
        if (p.routeKey && !routeBranchMap.has(p.routeKey)) {
          routeBranchMap.set(p.routeKey, p.row.branch_id || session.branchId || null);
        }
      }

      for (const [rk, routeBranchId] of routeBranchMap.entries()) {
        try {
          await client.query(
            `INSERT INTO routes (route_key, branch_id, description) VALUES ($1, $2, $3) 
             ON CONFLICT (route_key) DO UPDATE SET branch_id = COALESCE(routes.branch_id, EXCLUDED.branch_id)`,
            [rk, routeBranchId, `Route ${rk}`]
          );
        } catch (e) {
          console.warn(`[BatchImportIndividualCustomers] Route provision warning for ${rk}:`, e);
        }
      }

      const MINI_BATCH = 50;
      for (let i = 0; i < preparedRows.length; i += MINI_BATCH) {
        const batch = preparedRows.slice(i, i + MINI_BATCH);
        const batchSp = `sp_ind_batch_${i}`;
        
        // Collect all distinct column names in this mini-batch
        const colSet = new Set<string>();
        batch.forEach(b => Object.keys(b.row).forEach(k => colSet.add(k)));
        const cols = Array.from(colSet);
        const colNamesStr = cols.map(c => `"${c}"`).join(', ');

        const values: any[] = [];
        const valueTuples: string[] = [];
        let paramIdx = 1;

        batch.forEach(item => {
          const tuplePlaceholders = cols.map(c => {
            values.push(item.row[c] !== undefined ? item.row[c] : null);
            return `$${paramIdx++}`;
          });
          valueTuples.push(`(${tuplePlaceholders.join(', ')})`);
        });

        const sql = `INSERT INTO individual_customers (${colNamesStr}) VALUES ${valueTuples.join(', ')} ON CONFLICT ("customerKeyNumber") DO NOTHING RETURNING "customerKeyNumber"`;
        
        let batchOk = false;
        try {
          await client.query(`SAVEPOINT ${batchSp}`);
          const res = await client.query(sql, values);
          await client.query(`RELEASE SAVEPOINT ${batchSp}`);
          batchOk = true;

          const insertedInThisBatch = new Set((res.rows || []).map((r: any) => r.customerKeyNumber));
          
          for (const item of batch) {
            if (insertedInThisBatch.has(item.key)) {
              insertedKeys.push(item.key);
              if (item.spatial.xCoordinate != null || item.spatial.yCoordinate != null || item.spatial.zCoordinate != null) {
                await dbUpsertSpatialRecord(item.key, 'individual_customer', item.spatial, client);
              }
            } else {
              errors.push(`Customer ${item.key}: already exists or conflict`);
            }
          }
        } catch (batchErr: any) {
          try { await client.query(`ROLLBACK TO SAVEPOINT ${batchSp}`); } catch {}
          console.warn(`[BatchImportIndividualCustomers] Mini-batch ${i} failed, falling back to row-by-row:`, batchErr?.message);
        }

        // Fallback to row-by-row with individual savepoints
        if (!batchOk) {
          for (let rIdx = 0; rIdx < batch.length; rIdx++) {
            const item = batch[rIdx];
            const rowSp = `sp_ind_row_${i}_${rIdx}`;
            try {
              await client.query(`SAVEPOINT ${rowSp}`);
              const itemCols = Object.keys(item.row).map(c => `"${c}"`).join(', ');
              const itemPlaceholders = Object.keys(item.row).map((_, idx) => `$${idx + 1}`).join(', ');
              const itemValues = Object.values(item.row);
              const singleRes = await client.query(
                `INSERT INTO individual_customers (${itemCols}) VALUES (${itemPlaceholders}) ON CONFLICT ("customerKeyNumber") DO NOTHING RETURNING "customerKeyNumber"`,
                itemValues
              );
              await client.query(`RELEASE SAVEPOINT ${rowSp}`);

              if (singleRes.rows?.length > 0) {
                insertedKeys.push(item.key);
                if (item.spatial.xCoordinate != null || item.spatial.yCoordinate != null || item.spatial.zCoordinate != null) {
                  await dbUpsertSpatialRecord(item.key, 'individual_customer', item.spatial, client);
                }
              } else {
                errors.push(`Customer ${item.key}: already exists`);
              }
            } catch (singleErr: any) {
              try { await client.query(`ROLLBACK TO SAVEPOINT ${rowSp}`); } catch {}
              errors.push(`Customer ${item.key}: ${singleErr?.message || 'Insert failed'}`);
            }
          }
        }
      }
    });

    console.log(`[BatchImportIndividualCustomers] Complete: inserted=${insertedKeys.length}, errors=${errors.length}`);

    try {
      await logSecurityEventAction({
        event: 'Batch Import Individual Customers',
        details: { inserted: insertedKeys.length, errors: errors.length, total: rows.length }
      });
    } catch (logErr) {
      console.warn('Failed to log batch import event:', logErr);
    }

    const sanitizedErrors = errors.map(e => typeof e === 'string' ? e : String(e));
    return { success: true, inserted: insertedKeys.length, errors: sanitizedErrors };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Customer ↔ Bulk Meter Assignment Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a paginated list of individual customers assigned to the given bulk meter.
 * Also returns the total count for pagination controls.
 */
export async function getAssignedCustomersForBulkMeterAction(
  bulkMeterId: string,
  page: number = 1,
  pageSize: number = 5
) {
  return await wrap(async () => {
    await checkPermissionAny(
      PERMISSIONS.BULK_METERS_MANAGE_CUSTOMERS,
      PERMISSIONS.CUSTOMERS_VIEW_ALL,
      PERMISSIONS.CUSTOMERS_VIEW_BRANCH,
      PERMISSIONS.BULK_METERS_VIEW_ALL,
      PERMISSIONS.BULK_METERS_VIEW_BRANCH
    );
    const offset = (page - 1) * pageSize;
    const [rows, countResult] = await Promise.all([
      query(
        `SELECT "customerKeyNumber", name, "METER_KEY", branch_id
         FROM individual_customers
         WHERE "assignedBulkMeterId" = $1 AND deleted_at IS NULL
         ORDER BY name ASC
         LIMIT $2 OFFSET $3`,
        [bulkMeterId, pageSize, offset]
      ),
      query(
        `SELECT COUNT(*) AS total FROM individual_customers WHERE "assignedBulkMeterId" = $1 AND deleted_at IS NULL`,
        [bulkMeterId]
      ),
    ]);
    return { rows: rows as any[], total: parseInt((countResult[0] as any).total, 10) };
  });
}

/**
 * Returns a paginated list of individual customers NOT assigned to any bulk meter.
 * Supports optional search term and returns total count for pagination controls.
 */
export async function getUnassignedIndividualCustomersAction(
  searchTerm?: string,
  page: number = 1,
  pageSize: number = 5
) {
  return await wrap(async () => {
    await checkPermissionAny(
      PERMISSIONS.BULK_METERS_MANAGE_CUSTOMERS,
      PERMISSIONS.CUSTOMERS_VIEW_ALL,
      PERMISSIONS.CUSTOMERS_VIEW_BRANCH,
      PERMISSIONS.BULK_METERS_VIEW_ALL,
      PERMISSIONS.BULK_METERS_VIEW_BRANCH
    );
    const offset = (page - 1) * pageSize;
    const baseWhere = `"assignedBulkMeterId" IS NULL AND deleted_at IS NULL AND status != 'Pending Approval'`;
    const searchParams: any[] = [];
    let searchClause = '';
    if (searchTerm && searchTerm.trim()) {
      searchClause = ` AND (name ILIKE $1 OR "customerKeyNumber" ILIKE $1 OR "METER_KEY" ILIKE $1)`;
      searchParams.push(`%${searchTerm.trim()}%`);
    }
    const rowsParams = [...searchParams, pageSize, offset];
    const limitParam = searchParams.length + 1;
    const offsetParam = searchParams.length + 2;
    const [rows, countResult] = await Promise.all([
      query(
        `SELECT "customerKeyNumber", name, "METER_KEY", branch_id
         FROM individual_customers
         WHERE ${baseWhere}${searchClause}
         ORDER BY name ASC
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        rowsParams
      ),
      query(
        `SELECT COUNT(*) AS total FROM individual_customers WHERE ${baseWhere}${searchClause}`,
        searchParams
      ),
    ]);
    return { rows: rows as any[], total: parseInt((countResult[0] as any).total, 10) };
  });
}

/** Assigns an individual customer to a bulk meter by setting assignedBulkMeterId. */
export async function assignCustomerToBulkMeterAction(customerKeyNumber: string, bulkMeterId: string) {
  return await wrap(async () => {
    await checkPermissionAny(
      PERMISSIONS.BULK_METERS_MANAGE_CUSTOMERS,
      PERMISSIONS.CUSTOMERS_UPDATE,
      PERMISSIONS.BULK_METERS_UPDATE
    );
    await dbUpdateCustomer(customerKeyNumber, { assignedBulkMeterId: bulkMeterId } as any);
    revalidatePath('/staff/bill-management');
    revalidatePath('/admin/dashboard');
    return { customerKeyNumber, bulkMeterId };
  });
}

/** Removes an individual customer from their current bulk meter assignment. */
export async function unassignCustomerFromBulkMeterAction(customerKeyNumber: string) {
  return await wrap(async () => {
    await checkPermissionAny(
      PERMISSIONS.BULK_METERS_MANAGE_CUSTOMERS,
      PERMISSIONS.CUSTOMERS_UPDATE,
      PERMISSIONS.BULK_METERS_UPDATE
    );
    await query(
      `UPDATE individual_customers SET "assignedBulkMeterId" = NULL WHERE "customerKeyNumber" = $1`,
      [customerKeyNumber]
    );
    revalidatePath('/staff/bill-management');
    revalidatePath('/admin/dashboard');
    return { customerKeyNumber };
  });
}

/** Batch-update payments from a CSV file (Bill Key, Customer Key, Customer Name, Branch, Amount, Payment Date, Reconciliation Status, Payment Channel, Bank Ref, Phone, Route Key, Walk Order, Meter Key). */
export async function updatePaymentsFromCsvAction(records: Array<{
  billKey?: string;
  customerKey?: string;
  customerName?: string;
  branch?: string;
  amount?: number;
  paymentDate?: string;
  reconciliationStatus?: string;
  paymentChannel?: string;
  bankRef?: string;
  phone?: string;
  routeKey?: string;
  walkOrder?: number | string;
  meterKey?: string;
}>) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');
    
    const startTime = Date.now();
    console.log(`[CSV UPLOAD] ⏱️  Started at ${new Date().toISOString()}`);
    console.log(`[CSV UPLOAD] 📊 Records to process: ${records.length}`);
    console.log(`[CSV UPLOAD] 🔑 Staff ID: ${session.id}`);
    console.log(`[CSV UPLOAD] 🏢 Branch: ${session.branchId}`);
    console.log(`[CSV UPLOAD] 🌐 Environment: ${process.env.NODE_ENV}`);
    console.log(`[CSV UPLOAD] 🗄️  Database Host: ${process.env.POSTGRES_HOST}`);
    
    try {
      // Verify database connection and schema
      const testQuery = await query('SELECT 1 as connection_test');
      console.log(`[CSV UPLOAD] ✅ Database connection verified`);
      
      // Check if payment columns exist
      const columnsCheck = await query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'bills' 
        AND column_name IN ('reconciliation_status', 'payment_channel', 'bank_ref', 'last_payment_date')
        LIMIT 1
      `);
      
      if (!columnsCheck || columnsCheck.length === 0) {
        console.error(`[CSV UPLOAD] ❌ Payment columns DO NOT EXIST on bills table! Schema not initialized.`);
        throw new Error('Database schema not initialized. Please run migrations: database/migrations/050_payment_infrastructure_csv.sql');
      }
      
      console.log(`[CSV UPLOAD] ✅ Database schema verified - payment columns exist`);
      
      // Diagnostic: Count total bills in database
      const billCountResult = await query('SELECT COUNT(*) as count FROM bills');
      const totalBills = billCountResult?.[0]?.count || 0;
      console.log(`[CSV UPLOAD] 📊 Total bills in database: ${totalBills}`);
      
      // Diagnostic: Check payment_status column type
      const statusTypeResult = await query(`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name='bills' AND column_name='payment_status'
      `);
      console.log(`[CSV UPLOAD] 📋 payment_status column type:`, statusTypeResult?.[0]?.data_type || 'UNKNOWN');
    } catch (checkErr) {
      console.error(`[CSV UPLOAD] ❌ Pre-flight check failed:`, checkErr);
      throw checkErr;
    }
    
    const result = await dbBatchUpdatePaymentsFromCsv(records, session.id);
    
    const duration = Date.now() - startTime;
    console.log(`[CSV UPLOAD] ✅ Completed in ${duration}ms`);
    console.log(`[CSV UPLOAD] 📈 Result:`, {
      success: result.success,
      updatedCount: result.updatedCount,
      errorCount: result.errors?.length || 0,
      duration: `${duration}ms`
    });
    
    if (result.errors && result.errors.length > 0) {
      console.log(`[CSV UPLOAD] ⚠️  Sample errors (first 3):`, result.errors.slice(0, 3));
    }
    
    // Invalidate cache paths to refresh UI
    console.log(`[CSV UPLOAD] 🔄 Invalidating cache paths...`);
    revalidatePath('/admin/reports');
    revalidatePath('/staff/reports');
    revalidatePath('/admin/reports/paid-bills');
    revalidatePath('/staff/reports/paid-bills');
    revalidatePath('/admin/reports/sent-bills');
    revalidatePath('/staff/reports/sent-bills');
    revalidatePath('/staff/bill-management');
    revalidatePath('/admin/bill-management');
    
    console.log(`[CSV UPLOAD] ✅ Cache invalidated`);
    console.log(`[CSV UPLOAD] 🎉 Final result:`, result);
    
    return result;
  });
}

