'use server';

import { query } from './db';
import { getSession } from './auth';
import { PERMISSIONS } from './constants/auth';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreditNoteTransaction {
  id: string;
  bulkMeterKey: string;
  customerName: string;
  meterNumber: string;
  branchName: string;
  branchId: string;
  eventType: 'created' | 'applied' | 'voided';
  amount: number;
  reason: string | null;
  sourceBillId: string | null;
  sourceBillKey: string | null;
  sourcePaymentId: string | null;
  voidedLedgerId: string | null;
  balanceAfter: number;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  notes: string | null;
}

export interface CreditNoteMeterSummary {
  bulkMeterKey: string;
  customerName: string;
  meterNumber: string;
  branchName: string;
  branchId: string;
  creditBalance: number;
  outstandingBill: number;
  paymentStatus: string | null;
  contractNumber: string | null;
}

export interface CreditNoteKPIs {
  totalActiveBalance: number;
  metersWithActiveBalanceCount: number;
  totalCreditCreated: number;
  totalCreditApplied: number;
  totalCreditVoided: number;
  totalTransactionsCount: number;
}

export interface CreditNotesFilterOptions {
  search?: string;
  branchId?: string;
  eventType?: 'all' | 'created' | 'applied' | 'voided';
  reason?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// ── Authorization Helper ───────────────────────────────────────────────────

async function authorizeCreditNoteReport() {
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  const perms = session.permissions || [];
  const role = (session.role || '').toLowerCase().trim();
  const isAdmin = role === 'admin' || role === 'system administrator' || role === 'super admin'
    || perms.includes('*') || perms.includes('all') || perms.includes('admin');

  const canView = isAdmin
    || perms.includes(PERMISSIONS.CREDIT_VIEW_ALL)
    || perms.includes(PERMISSIONS.CREDIT_VIEW_BRANCH)
    || perms.includes(PERMISSIONS.REPORTS_GENERATE_ALL)
    || perms.includes(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || perms.includes(PERMISSIONS.BILL_VIEW_ALL);

  if (!canView) throw new Error('Forbidden: Missing Credit Note report permissions');

  const isLockedToBranch = !isAdmin && !perms.includes(PERMISSIONS.CREDIT_VIEW_ALL) && !perms.includes(PERMISSIONS.REPORTS_GENERATE_ALL);
  const lockedBranchId = isLockedToBranch ? (session.branchId || null) : null;

  return { session, isAdmin, isLockedToBranch, lockedBranchId };
}

// ── Actions ─────────────────────────────────────────────────────────────────

/**
 * Fetch KPI metrics for Credit Notes Report.
 */
export async function getCreditNotesKPIsAction(filters: {
  branchId?: string;
  startDate?: string;
  endDate?: string;
}) {
  try {
    const auth = await authorizeCreditNoteReport();
    const effectiveBranchId = auth.lockedBranchId || (filters.branchId && filters.branchId !== 'all' ? filters.branchId : null);

    // 1. Live bulk_meters metrics
    const bmWhere: string[] = ['bm.deleted_at IS NULL', 'COALESCE(bm."creditBalance", 0) > 0.005'];
    const bmParams: any[] = [];

    if (effectiveBranchId) {
      bmParams.push(effectiveBranchId);
      bmWhere.push(`bm.branch_id::text = $${bmParams.length}`);
    }

    const bmSql = `
      SELECT
        COALESCE(SUM(bm."creditBalance"), 0) AS total_active_balance,
        COUNT(*) AS meters_with_active_balance
      FROM bulk_meters bm
      WHERE ${bmWhere.join(' AND ')}
    `;
    const bmRows: any = await query(bmSql, bmParams);

    // 2. Live credit_ledger metrics (period & branch filtered)
    const clWhere: string[] = ['1=1'];
    const clParams: any[] = [];

    if (effectiveBranchId) {
      clParams.push(effectiveBranchId);
      clWhere.push(`bm.branch_id::text = $${clParams.length}`);
    }

    if (filters.startDate) {
      clParams.push(filters.startDate);
      clWhere.push(`cl.created_at >= $${clParams.length}`);
    }

    if (filters.endDate) {
      clParams.push(`${filters.endDate} 23:59:59.999`);
      clWhere.push(`cl.created_at <= $${clParams.length}`);
    }

    const clSql = `
      SELECT
        COUNT(*) AS total_transactions,
        COALESCE(SUM(CASE WHEN cl.event_type = 'created' THEN cl.amount ELSE 0 END), 0) AS total_created,
        COALESCE(SUM(CASE WHEN cl.event_type = 'applied' THEN cl.amount ELSE 0 END), 0) AS total_applied,
        COALESCE(SUM(CASE WHEN cl.event_type = 'voided' THEN cl.amount ELSE 0 END), 0) AS total_voided
      FROM credit_ledger cl
      LEFT JOIN bulk_meters bm ON LOWER(TRIM(bm."customerKeyNumber")) = LOWER(TRIM(cl.bulk_meter_id))
      WHERE ${clWhere.join(' AND ')}
    `;
    const clRows: any = await query(clSql, clParams);

    const kpis: CreditNoteKPIs = {
      totalActiveBalance: Number(bmRows[0]?.total_active_balance || 0),
      metersWithActiveBalanceCount: Number(bmRows[0]?.meters_with_active_balance || 0),
      totalCreditCreated: Number(clRows[0]?.total_created || 0),
      totalCreditApplied: Number(clRows[0]?.total_applied || 0),
      totalCreditVoided: Number(clRows[0]?.total_voided || 0),
      totalTransactionsCount: Number(clRows[0]?.total_transactions || 0),
    };

    return { success: true, data: kpis };
  } catch (error: any) {
    console.error('Error fetching credit note KPIs:', error);
    return { success: false, error: error.message || 'Failed to load credit note KPIs' };
  }
}

/**
 * Fetch paginated Credit Notes ledger transactions with full filter support.
 */
export async function getCreditNotesReportAction(filters: CreditNotesFilterOptions) {
  try {
    const auth = await authorizeCreditNoteReport();
    const effectiveBranchId = auth.lockedBranchId || (filters.branchId && filters.branchId !== 'all' ? filters.branchId : null);

    const where: string[] = ['1=1'];
    const params: any[] = [];

    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      where.push(`bm.branch_id::text = $${params.length}`);
    }

    if (filters.eventType && filters.eventType !== 'all') {
      params.push(filters.eventType);
      where.push(`cl.event_type = $${params.length}`);
    }

    if (filters.reason && filters.reason !== 'all') {
      params.push(filters.reason);
      where.push(`cl.reason = $${params.length}`);
    }

    if (filters.startDate) {
      params.push(filters.startDate);
      where.push(`cl.created_at >= $${params.length}`);
    }

    if (filters.endDate) {
      params.push(`${filters.endDate} 23:59:59.999`);
      where.push(`cl.created_at <= $${params.length}`);
    }

    if (filters.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const pIdx = params.length;
      where.push(`(
        cl.bulk_meter_id ILIKE $${pIdx}
        OR bm.name ILIKE $${pIdx}
        OR bm."METER_KEY" ILIKE $${pIdx}
        OR b."BILLKEY" ILIKE $${pIdx}
        OR cl.notes ILIKE $${pIdx}
      )`);
    }

    // Total Count
    const countSql = `
      SELECT COUNT(*) as total
      FROM credit_ledger cl
      LEFT JOIN bulk_meters bm ON LOWER(TRIM(bm."customerKeyNumber")) = LOWER(TRIM(cl.bulk_meter_id))
      LEFT JOIN bills b ON b.id = cl.source_bill_id
      WHERE ${where.join(' AND ')}
    `;
    const countRes: any = await query(countSql, params);
    const totalCount = Number(countRes[0]?.total || 0);

    // Data Rows
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const dataParams = [...params, pageSize, offset];
    const dataSql = `
      SELECT
        cl.id,
        cl.bulk_meter_id,
        COALESCE(bm.name, 'Unknown Meter') AS customer_name,
        COALESCE(bm."METER_KEY", '—') AS meter_number,
        COALESCE(br.name, bm.branch_id::text, 'Unassigned') AS branch_name,
        COALESCE(bm.branch_id::text, '') AS branch_id,
        cl.event_type,
        cl.amount,
        cl.reason,
        cl.source_bill_id,
        b."BILLKEY" AS source_bill_key,
        cl.source_payment_id,
        cl.voided_ledger_id,
        cl.balance_after,
        cl.created_by,
        COALESCE(u.name, u.email, 'Operator') AS created_by_name,
        cl.created_at,
        cl.notes
      FROM credit_ledger cl
      LEFT JOIN bulk_meters bm ON LOWER(TRIM(bm."customerKeyNumber")) = LOWER(TRIM(cl.bulk_meter_id))
      LEFT JOIN branches br ON br.id::text = bm.branch_id::text
      LEFT JOIN bills b ON b.id = cl.source_bill_id
      LEFT JOIN staff_members u ON u.id::text = cl.created_by::text
      WHERE ${where.join(' AND ')}
      ORDER BY cl.created_at DESC, cl.id DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const rows: any = await query(dataSql, dataParams);

    const transactions: CreditNoteTransaction[] = rows.map((r: any) => ({
      id: String(r.id),
      bulkMeterKey: String(r.bulk_meter_id),
      customerName: r.customer_name,
      meterNumber: r.meter_number,
      branchName: r.branch_name,
      branchId: r.branch_id,
      eventType: r.event_type,
      amount: Number(r.amount || 0),
      reason: r.reason,
      sourceBillId: r.source_bill_id ? String(r.source_bill_id) : null,
      sourceBillKey: r.source_bill_key || null,
      sourcePaymentId: r.source_payment_id ? String(r.source_payment_id) : null,
      voidedLedgerId: r.voided_ledger_id ? String(r.voided_ledger_id) : null,
      balanceAfter: Number(r.balance_after || 0),
      createdBy: r.created_by ? String(r.created_by) : null,
      createdByName: r.created_by_name,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      notes: r.notes || null,
    }));

    return {
      success: true,
      data: {
        transactions,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };
  } catch (error: any) {
    console.error('Error fetching credit note report:', error);
    return { success: false, error: error.message || 'Failed to load credit notes' };
  }
}

/**
 * Fetch Bulk Meters Credit Summary (Meters holding deposits or credit history).
 */
export async function getCreditMetersSummaryAction(filters: {
  search?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const auth = await authorizeCreditNoteReport();
    const effectiveBranchId = auth.lockedBranchId || (filters.branchId && filters.branchId !== 'all' ? filters.branchId : null);

    const where: string[] = [
      'bm.deleted_at IS NULL',
      // Only meters that have credit — either active balance OR ledger history
      `(
        COALESCE(bm."creditBalance", 0) > 0.005
        OR EXISTS (SELECT 1 FROM credit_ledger cl WHERE LOWER(TRIM(cl.bulk_meter_id)) = LOWER(TRIM(bm."customerKeyNumber")))
      )`,
    ];
    const params: any[] = [];

    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      where.push(`bm.branch_id::text = $${params.length}`);
    }

    if (filters.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const pIdx = params.length;
      where.push(`(
        bm."customerKeyNumber" ILIKE $${pIdx}
        OR bm.name ILIKE $${pIdx}
        OR bm."METER_KEY" ILIKE $${pIdx}
      )`);
    }

    const countSql = `
      SELECT COUNT(*) as total
      FROM bulk_meters bm
      WHERE ${where.join(' AND ')}
    `;
    const countRes: any = await query(countSql, params);
    const totalCount = Number(countRes[0]?.total || 0);

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const dataParams = [...params, pageSize, offset];
    const dataSql = `
      SELECT
        bm."customerKeyNumber" AS bulk_meter_key,
        COALESCE(bm.name, 'Unknown Meter') AS customer_name,
        COALESCE(bm."METER_KEY", '—') AS meter_number,
        COALESCE(br.name, bm.branch_id::text, 'Unassigned') AS branch_name,
        COALESCE(bm.branch_id::text, '') AS branch_id,
        COALESCE(bm."creditBalance", 0) AS credit_balance,
        COALESCE(bm."outStandingbill", 0) AS outstanding_bill,
        bm."paymentStatus" AS payment_status,
        bm."contractNumber" AS contract_number
      FROM bulk_meters bm
      LEFT JOIN branches br ON br.id::text = bm.branch_id::text
      WHERE ${where.join(' AND ')}
      ORDER BY bm."creditBalance" DESC NULLS LAST, bm."customerKeyNumber" ASC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const rows: any = await query(dataSql, dataParams);

    const meters: CreditNoteMeterSummary[] = rows.map((r: any) => ({
      bulkMeterKey: String(r.bulk_meter_key),
      customerName: r.customer_name,
      meterNumber: r.meter_number,
      branchName: r.branch_name,
      branchId: r.branch_id,
      creditBalance: Number(r.credit_balance || 0),
      outstandingBill: Number(r.outstanding_bill || 0),
      paymentStatus: r.payment_status || null,
      contractNumber: r.contract_number || null,
    }));

    return {
      success: true,
      data: {
        meters,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };
  } catch (error: any) {
    console.error('Error fetching credit meters summary:', error);
    return { success: false, error: error.message || 'Failed to load credit meters summary' };
  }
}
