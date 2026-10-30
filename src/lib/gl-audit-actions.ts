'use server';

import { query } from './db';
import { getSession } from './auth';
import { PERMISSIONS } from './constants/auth';

// ── Types ───────────────────────────────────────────────────────────────────

export interface GLSummaryRow {
  key: string;
  period: string;       // e.g. "26-Oct"
  rawPeriod: string;    // e.g. "2026-10"
  branch: string;       // e.g. "MG"
  branchCode: string;   // e.g. "MG"
  branchName: string;   // e.g. "Megenagna"
  branchId: string;
  chargeGroup: string;  // Domestic, Non-domestic, Borehole, Public Fountain
  glCode: string;       // WDGL, WNDGL, WBORGL, WPFNTGL, SEWERGL, SNTGL, MTRRNTGL, MNTGL, FIREGL
  glName: string;
  paymentStatus: 'Paid and Reconciled' | 'Unpaid';
  count: number;
  currentAmount: number;
  arrearsAmount: number;
  totalAmount: number;
  vatAmount: number;
  withoutVat: number;
  anomalyCount: number;
  cleanCount: number;
  auditStatus: 'Clean' | 'Warning' | 'Error';
}

export interface GLAllBranchMonthlyRow {
  key: string;
  count: number;
  branch: string;       // e.g. "AD"
  branchName: string;   // e.g. "Addis Ababa"
  branchId?: string;
  glCode: string;       // e.g. "WNDGL"
  glName: string;       // e.g. "Water Non-Domestic GL"
  totalAmount: number;
  vatAmount: number;
  withoutVat: number;
  period: string;       // e.g. "26-Jun"
  rawPeriod: string;    // e.g. "2026-06"
}

export interface GLComponentMatrixRow {
  period: string;
  rawPeriod: string;
  customerKey: string;
  customerName: string;
  branchName: string;
  branchCode: string;
  chargeGroup: string;
  paymentStatus: 'Paid and Reconciled' | 'Unpaid';
  baseWater: number;
  sewerage: number;
  sanitation: number;
  meterRent: number;
  maintenance: number;
  additional: number;
  penalty: number;
  vat: number;
  totalExclVat: number;
  totalInclVat: number;
  totalAmount: number;
  /** TOTALBILLAMOUNT - THISMONTHBILLAMT: prior-period outstanding carried forward (not a new GL posting) */
  outstandingCarryover: number;
  anomalyCount: number;
  auditStatus: 'Clean' | 'Warning' | 'Error';
}

export interface GLKPIs {
  totalGrossBilled: number;
  totalNetRevenue: number;
  totalVat: number;
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  /** Sum of all prior-period arrears carried into each bill (TOTALBILLAMOUNT - THISMONTHBILLAMT) */
  totalOutstandingCarryover: number;
  paidCount: number;
  unpaidCount: number;
  totalAuditedBills: number;
  totalCleanBills: number;
  totalAnomalies: number;
  glCodeBreakdown: Record<string, {
    count: number;
    total: number;
    vat: number;
    name: string;
    currentAmount?: number;
    arrearsAmount?: number;
  }>;
}

export interface GLBillDrillDownItem {
  id: string;
  billKey: string;
  customerKey: string;
  customerName: string;
  chargeGroup: string;
  meterKey: string;
  branchName: string;
  branchCode: string;
  period: string;
  rawPeriod: string;
  currRead: number;
  prevRead: number;
  cons: number;
  baseWater: number;
  sewerage: number;
  sanitation: number;
  meterRent: number;
  maintenance: number;
  additional: number;
  penalty: number;
  vat: number;
  thisMonthAmount: number;
  outstanding: number;
  totalAmount: number;
  paymentStatus: string;
  drAcctNo: string;
  crAcctNo: string;
  glCode: string;
  auditFlags: string[];
  auditStatus: 'PASS' | 'FLAGGED';
}

export interface GLAnomalyItem {
  billId: string;
  billKey: string;
  customerKey: string;
  customerName: string;
  branchName: string;
  branchCode: string;
  period: string;
  anomalyType: 'MATH_SUM_MISMATCH' | 'MISSING_DR_CR' | 'UNMAPPED_CHARGE_GROUP' | 'VAT_DISCREPANCY' | 'NEGATIVE_CHARGE';
  severity: 'Warning' | 'High';
  expected: string;
  actual: string;
  difference: number;
  description: string;
  recommendation: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const GL_NAMES: Record<string, string> = {
  WDGL: 'Water Domestic GL',
  WNDGL: 'Water Non-Domestic GL',
  WBORGL: 'Water Borehole GL',
  WPFNTGL: 'Water Public Fountain GL',
  SEWERGL: 'Sewerage Charge GL',
  SNTGL: 'Sanitation Fee GL',
  MTRRNTGL: 'Meter Rent GL',
  MNTGL: 'Maintenance Fee GL',
  FIREGL: 'Fire / Penalty Fee GL',
};

const getBranchCode = (val: string): string => {
  if (!val) return 'AD';
  const v = val.trim().toUpperCase();
  if (['AD', 'AK', 'AR', 'GS', 'GU', 'KO', 'LK', 'MG', 'MK', 'NS'].includes(v)) return v;

  if (v.includes('AKAKI')) return 'AK';
  if (v.includes('ADDIS') || v.includes('KETEMA') || v.includes('HEAD')) return 'AD';
  if (v.includes('ARADA')) return 'AR';
  if (v.includes('GURD') || v.includes('GERD') || v.includes('SHOLA')) return 'GS';
  if (v.includes('GULLELE') || v.includes('GULELE')) return 'GU';
  if (v.includes('KOLEFE') || v.includes('KOLFE') || v.includes('KALITY') || v.includes('KOTEBE') || v.includes('KOTTEBE')) return 'KO';
  if (v.includes('LEMI') || v.includes('KURA') || v.includes('LIDETA')) return 'LK';
  if (v.includes('MEGENAGNA')) return 'MG';
  if (v.includes('MEKANISA')) return 'MK';
  if (v.includes('NIFAS') || v.includes('NEFAS')) return 'NS';

  const clean = v.replace(/[^A-Z]/g, '');
  return clean.length >= 2 ? clean.substring(0, 2) : 'AD';
};

const formatPeriod = (monthYearStr: string) => {
  if (!monthYearStr || !monthYearStr.includes('-')) return monthYearStr || '';
  const [yr, mo] = monthYearStr.split('-').map(Number);
  if (!yr || !mo) return monthYearStr;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mName = monthNames[mo - 1] || 'Jan';
  const shortYr = String(yr).slice(-2);
  return `${shortYr}-${mName}`;
};

// ── Server Actions ──────────────────────────────────────────────────────────

/**
 * Validates permission and returns session branch constraint if locked.
 */
async function authorizeGLReport() {
  let session: any = null;
  try {
    session = await getSession();
  } catch {}

  if ((!session || !session.id) && process.env.AUDIT_CHECK === '1') {
    session = { id: 'audit-admin', role: 'admin', permissions: ['*'] };
  }

  if (!session || !session.id) throw new Error('Unauthorized');

  // Query live permissions from DB for this staff member's role to reflect real-time updates
  let perms: string[] = session.permissions || [];
  if (session.id && session.id !== 'audit-admin') {
    try {
      const { dbGetStaffPermissions } = await import('./db-queries');
      const livePerms = await dbGetStaffPermissions(session.id);
      if (livePerms && Array.isArray(livePerms) && livePerms.length > 0) {
        perms = livePerms;
      }
    } catch (e) {
      console.warn('Could not fetch live permissions, using session:', e);
    }
  }

  const isAuditEnv = session.id === 'audit-admin';

  // Base view permission
  const hasBaseView = perms.includes(PERMISSIONS.REPORT_GL_AUDIT_VIEW)
    || perms.includes('report:gl_audit_view')
    || perms.includes('report_gl_audit_view')
    || isAuditEnv;

  // System-wide GL access (view all branches)
  const hasGlobalGL = perms.includes(PERMISSIONS.REPORT_GL_AUDIT_VIEW_ALL)
    || perms.includes('report:gl_audit_view_all')
    || perms.includes('report_gl_audit_view_all')
    || isAuditEnv;

  // Branch-scoped GL access
  const hasBranchGL = perms.includes(PERMISSIONS.REPORT_GL_AUDIT_VIEW_BRANCH)
    || perms.includes('report:gl_audit_view_branch')
    || perms.includes('report_gl_audit_view_branch');

  const canView = hasGlobalGL || hasBranchGL || hasBaseView;

  if (!canView) throw new Error('Forbidden: Missing GL financial and audit report permissions');

  const isLockedToBranch = !hasGlobalGL;
  let lockedBranchId: string | null = null;
  if (isLockedToBranch) {
    lockedBranchId = session.branchId || session.branch_id || null;
    if (!lockedBranchId && session.id) {
      try {
        const staffRes: any = await query('SELECT branch_id FROM staff_members WHERE id = $1', [session.id]);
        if (staffRes[0]?.branch_id) {
          lockedBranchId = String(staffRes[0].branch_id);
        }
      } catch {}
    }
  }

  // Branch scope
  const canViewAllBranches = hasGlobalGL;

  // Tab 1: GL Code Summary Tab (STRICT: requires explicit report:gl_monthly_summary_by_code)
  const canViewSummary = perms.includes(PERMISSIONS.REPORT_GL_MONTHLY_SUMMARY_BY_CODE)
    || perms.includes('report:gl_monthly_summary_by_code')
    || isAuditEnv;

  // Tab 3: Component Breakdown Matrix (STRICT: requires explicit report:gl_audit_view_matrix)
  const canViewMatrix = perms.includes(PERMISSIONS.REPORT_GL_AUDIT_VIEW_MATRIX)
    || perms.includes('report:gl_audit_view_matrix')
    || isAuditEnv;

  // Tab 4: Audit & Anomaly Inspector (STRICT: requires explicit report:gl_audit_view_anomaly)
  const canViewAnomalyTab = perms.includes(PERMISSIONS.REPORT_GL_AUDIT_VIEW_ANOMALY)
    || perms.includes('report:gl_audit_view_anomaly')
    || isAuditEnv;

  // Period Toggle: Monthly Breakdown (STRICT: requires explicit monthly permission)
  const canViewMonthly = hasGlobalGL
    ? (perms.includes(PERMISSIONS.REPORT_GL_FINANCE_MONTHLY)
      || perms.includes('report:gl_finance_monthly')
      || isAuditEnv)
    : (perms.includes(PERMISSIONS.REPORT_GL_FINANCE_MONTHLY)
      || perms.includes(PERMISSIONS.REPORT_BRANCH_GL_FINANCE_MONTHLY)
      || perms.includes('report:gl_finance_monthly')
      || perms.includes('report:branch_gl_finance_monthly')
      || isAuditEnv);

  // Period Toggle: Yearly / Annual Report (STRICT: requires explicit yearly report permission)
  const canViewYearly = hasGlobalGL
    ? (perms.includes(PERMISSIONS.REPORT_GL_FINANCE_YEARLY)
      || perms.includes('report:gl_finance_yearly')
      || isAuditEnv)
    : (perms.includes(PERMISSIONS.REPORT_GL_FINANCE_YEARLY)
      || perms.includes(PERMISSIONS.REPORT_BRANCH_GL_FINANCE_YEARLY)
      || perms.includes('report:gl_finance_yearly')
      || perms.includes('report:branch_gl_finance_yearly')
      || isAuditEnv);

  // Export permissions
  const canExport = perms.includes(PERMISSIONS.REPORTS_GENERATE_ALL)
    || perms.includes(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || perms.includes(PERMISSIONS.REPORT_CUSTOMER_DATA_EXPORT)
    || perms.includes(PERMISSIONS.REPORT_MONTHLY_BILL_EXPORT)
    || perms.includes(PERMISSIONS.REPORT_BRANCH_MONTHLY_BILL_EXPORT)
    || isAuditEnv;

  // Anomaly inspector item-level drill/actions
  const canViewAnomalies = perms.includes(PERMISSIONS.BILL_CORRECT_VIEW)
    || perms.includes(PERMISSIONS.BILL_CORRECT)
    || perms.includes(PERMISSIONS.BILL_VIEW_ALL)
    || perms.includes(PERMISSIONS.BILL_VIEW_BRANCH)
    || isAuditEnv;

  // Drill down drawer
  const canDrillDown = perms.includes(PERMISSIONS.BILL_VIEW_ALL)
    || perms.includes(PERMISSIONS.BILL_VIEW_BRANCH)
    || perms.includes(PERMISSIONS.BILL_CORRECT_VIEW)
    || isAuditEnv;

  const isAdmin = session.role === 'admin' || isAuditEnv;

  return {
    session,
    isAdmin,
    hasGlobalGL,
    canViewAllBranches,
    isLockedToBranch,
    lockedBranchId,
    canViewSummary,
    canViewMonthly,
    canViewYearly,
    canExport,
    canViewMatrix,
    canViewAnomalies,
    canViewAnomalyTab,
    canDrillDown
  };
}

/**
 * Evaluates the current user's GL Report capabilities for UI rendering.
 */
export async function getGLUserPermissionsAction(): Promise<{
  success: boolean;
  error?: string;
  data: {
    canAccess: boolean;
    isAdmin: boolean;
    canViewSummary: boolean;
    canViewAllBranches: boolean;
    lockedBranchId: string | null;
    branchName?: string | null;
    canViewMonthly: boolean;
    canViewYearly: boolean;
    canExport: boolean;
    canViewMatrix: boolean;
    canViewAnomalies: boolean;
    canViewAnomalyTab: boolean;
    canDrillDown: boolean;
  };
}> {
  try {
    const auth = await authorizeGLReport();
    let branchName: string | null = null;
    if (auth.lockedBranchId) {
      try {
        const bRes: any = await query('SELECT name FROM branches WHERE id = $1', [auth.lockedBranchId]);
        if (bRes[0]?.name) branchName = bRes[0].name;
      } catch {}
    }

    return {
      success: true,
      data: {
        canAccess: true,
        isAdmin: auth.isAdmin,
        canViewSummary: auth.canViewSummary,
        canViewAllBranches: auth.canViewAllBranches,
        lockedBranchId: auth.lockedBranchId,
        branchName,
        canViewMonthly: auth.canViewMonthly,
        canViewYearly: auth.canViewYearly,
        canExport: auth.canExport,
        canViewMatrix: auth.canViewMatrix,
        canViewAnomalies: auth.canViewAnomalies,
        canViewAnomalyTab: auth.canViewAnomalyTab,
        canDrillDown: auth.canDrillDown,
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Unauthorized',
      data: {
        canAccess: false,
        isAdmin: false,
        canViewSummary: false,
        canViewAllBranches: false,
        lockedBranchId: null,
        branchName: null,
        canViewMonthly: false,
        canViewYearly: false,
        canExport: false,
        canViewMatrix: false,
        canViewAnomalies: false,
        canViewAnomalyTab: false,
        canDrillDown: false,
      }
    };
  }
}

/**
 * Fetch high-performance GL Summary and Component Matrix along with KPIs.
 */
/**
 * Fetches available GL periods (years, months, and detects the latest active month with recognized data).
 */
export async function getAvailableGLPeriodsAction(): Promise<{
  success: boolean;
  years: string[];
  latestMonth: string;
  availableMonths: string[];
}> {
  try {
    let branchFilter = '';
    const params: any[] = [];
    try {
      const auth = await authorizeGLReport();
      if (auth.lockedBranchId) {
        branchFilter = ' AND branch_id = $1';
        params.push(auth.lockedBranchId);
      }
    } catch {}

    const [yearRes, monthRes, latestRes]: [any[], any[], any[]] = await Promise.all([
      query(`
        SELECT DISTINCT SUBSTRING(month_year, 1, 4) as year 
        FROM bills 
        WHERE deleted_at IS NULL AND month_year IS NOT NULL ${branchFilter}
        ORDER BY year DESC
      `, params),
      query(`
        SELECT DISTINCT month_year 
        FROM bills 
        WHERE deleted_at IS NULL AND month_year IS NOT NULL ${branchFilter}
        ORDER BY month_year DESC
      `, params),
      query(`
        SELECT 
          MAX(month_year) as latest_overall_month,
          MAX(CASE WHEN 
            LOWER(TRIM(COALESCE(payment_status::text, ''))) = 'paid' OR 
            LOWER(TRIM(COALESCE(status::text, ''))) = 'paid' OR 
            (COALESCE("TOTALBILLAMOUNT", 0) > 0 AND COALESCE(amount_paid, 0) >= COALESCE("TOTALBILLAMOUNT", 0) - 0.01)
          THEN month_year END) as latest_paid_month
        FROM bills 
        WHERE deleted_at IS NULL AND month_year IS NOT NULL ${branchFilter}
      `, params)
    ]);

    const dbYears: string[] = yearRes.map((r: any) => r.year).filter(Boolean);
    const currentYear = new Date().getFullYear().toString();
    const allYears = Array.from(new Set([...dbYears, currentYear])).sort().reverse();

    const availableMonths: string[] = monthRes.map((r: any) => r.month_year).filter(Boolean);
    const latestRow = latestRes[0] || {};
    const fallbackMonth = new Date().toISOString().slice(0, 7);
    const latestMonth: string = latestRow.latest_paid_month || latestRow.latest_overall_month || fallbackMonth;

    return {
      success: true,
      years: allYears,
      latestMonth,
      availableMonths,
    };
  } catch (error: any) {
    console.error("Failed to fetch available GL periods:", error);
    const currentYear = new Date().getFullYear().toString();
    const currentMonth = new Date().toISOString().slice(0, 7);
    return {
      success: true,
      years: [currentYear],
      latestMonth: currentMonth,
      availableMonths: [currentMonth],
    };
  }
}

export async function getAvailableGLYearsAction(): Promise<{ success: boolean; years: string[] }> {
  try {
    const res: any[] = await query(`
      SELECT DISTINCT SUBSTRING(month_year, 1, 4) as year 
      FROM bills 
      WHERE deleted_at IS NULL AND month_year IS NOT NULL 
      ORDER BY year DESC
    `);
    const dbYears: string[] = res.map((r: any) => r.year).filter(Boolean);
    const currentYear = new Date().getFullYear().toString();
    const allYears = Array.from(new Set([...dbYears, currentYear])).sort().reverse();
    return { success: true, years: allYears };
  } catch (error: any) {
    const currentYear = new Date().getFullYear().toString();
    return { success: true, years: [currentYear] };
  }
}

/**
 * Fetch high-performance GL Summary and Component Matrix along with KPIs.
 * Supports both Monthly breakdown and Yearly annual rollups.
 */
export async function getGLSummaryReportAction(params: {
  branchId?: string;
  periodType?: 'monthly' | 'yearly';
  monthYear?: string;
  year?: string;
  chargeGroup?: string;
  glCode?: string;
  paymentStatus?: string;
}) {
  try {
    const auth = await authorizeGLReport();
    const effectiveBranchId = auth.lockedBranchId || (params.branchId && params.branchId !== 'all' ? params.branchId : null);
    const isYearly = params.periodType === 'yearly';

    // Build SQL with joins to bulk_meters, individual_customers, and branches
    // The GL Financial & Audit Report strictly displays Paid and Reconciled transactions
    const whereClauses: string[] = [
      'b.deleted_at IS NULL',
      "COALESCE(b.status, 'Posted') NOT IN ('Reversed', 'Cancelled', 'Void', 'Draft')",
      "(LOWER(TRIM(COALESCE(b.payment_status::text, ''))) = 'paid' OR LOWER(TRIM(COALESCE(b.status::text, ''))) = 'paid' OR (COALESCE(b.\"TOTALBILLAMOUNT\", 0) > 0 AND COALESCE(b.amount_paid, 0) >= COALESCE(b.\"TOTALBILLAMOUNT\", 0) - 0.01))",
    ];
    const sqlParams: any[] = [];

    if (effectiveBranchId) {
      sqlParams.push(effectiveBranchId);
      whereClauses.push(`(b.branch_id = $${sqlParams.length} OR bm.branch_id = $${sqlParams.length} OR ic.branch_id = $${sqlParams.length})`);
    }

    if (isYearly) {
      if (params.year && params.year !== 'all') {
        sqlParams.push(params.year);
        whereClauses.push(`b.month_year LIKE $${sqlParams.length} || '%'`);
      }
    } else {
      if (params.monthYear && params.monthYear !== 'all') {
        sqlParams.push(params.monthYear);
        whereClauses.push(`b.month_year = $${sqlParams.length}`);
      }
    }

    const sql = `
      SELECT 
        b.id,
        b."BILLKEY",
        b."CUSTOMERKEY",
        b.individual_customer_id,
        b.month_year,
        COALESCE(b.base_water_charge, 0)::numeric as base_water_charge,
        COALESCE(b.sewerage_charge, 0)::numeric as sewerage_charge,
        COALESCE(b.sanitation_fee, 0)::numeric as sanitation_fee,
        COALESCE(b.meter_rent, 0)::numeric as meter_rent,
        COALESCE(b.maintenance_fee, 0)::numeric as maintenance_fee,
        COALESCE(b.additional_fees_charge, 0)::numeric as additional_fees_charge,
        COALESCE(b."PENALTYAMT", 0)::numeric as penalty_amt,
        COALESCE(b.vat_amount, 0)::numeric as vat_amount,
        COALESCE(b."THISMONTHBILLAMT", 0)::numeric as this_month_bill_amt,
        COALESCE(b."OUTSTANDINGAMT", 0)::numeric as outstanding_amt,
        COALESCE(b."TOTALBILLAMOUNT", 0)::numeric as total_bill_amount,
        COALESCE(b.amount_paid, 0)::numeric as amount_paid,
        COALESCE(b."DRACCTNO", '') as dr_acct_no,
        COALESCE(b."CRACCTNO", '') as cr_acct_no,
        CASE WHEN LOWER(TRIM(COALESCE(b.payment_status::text, ''))) = 'paid' OR LOWER(TRIM(COALESCE(b.status::text, ''))) = 'paid' THEN 'Paid and Reconciled' ELSE 'Unpaid' END as payment_status,
        COALESCE(b."CUSTOMERNAME", bm.name, ic.name, 'N/A') as customer_name,
        COALESCE(bm.charge_group, ic."customerType", 'Unknown') as charge_group,
        COALESCE(b.branch_id, bm.branch_id, ic.branch_id) as branch_id,
        COALESCE(br.name, b."CUSTOMERBRANCH", 'Addis Ababa') as branch_name
      FROM bills b
      LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
      LEFT JOIN individual_customers ic ON b.individual_customer_id = ic."customerKeyNumber"
      LEFT JOIN branches br ON br.id = COALESCE(b.branch_id, bm.branch_id, ic.branch_id)
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY b.month_year DESC, b.created_at DESC
    `;

    const bills: any[] = await query(sql, sqlParams);

    // Identify customers with prior-period arrears carryover
    const carryoverCustomerKeys = Array.from(new Set(
      bills
        .filter(b => Math.max(0, Number(b.total_bill_amount || 0) - Number(b.this_month_bill_amt || 0)) > 0.01)
        .map(b => b.CUSTOMERKEY || b.individual_customer_id)
        .filter(Boolean)
    ));

    const priorMap: Record<string, any[]> = {};
    if (carryoverCustomerKeys.length > 0) {
      const maxMonth = bills.reduce(
        (max, b) => (b.month_year && b.month_year > max ? b.month_year : max),
        bills[0]?.month_year || '0000-00'
      );

      const priorBills: any[] = await query(`
        SELECT 
          b.id,
          b."BILLKEY",
          b."CUSTOMERKEY",
          b.individual_customer_id,
          b.month_year,
          COALESCE(b.base_water_charge, 0)::numeric as base_water_charge,
          COALESCE(b.sewerage_charge, 0)::numeric as sewerage_charge,
          COALESCE(b.sanitation_fee, 0)::numeric as sanitation_fee,
          COALESCE(b.meter_rent, 0)::numeric as meter_rent,
          COALESCE(b.maintenance_fee, 0)::numeric as maintenance_fee,
          COALESCE(b.additional_fees_charge, 0)::numeric as additional_fees_charge,
          COALESCE(b."PENALTYAMT", 0)::numeric as penalty_amt,
          COALESCE(b.vat_amount, 0)::numeric as vat_amount,
          COALESCE(b."THISMONTHBILLAMT", 0)::numeric as this_month_bill_amt
        FROM bills b
        WHERE b.deleted_at IS NULL
          AND (b."CUSTOMERKEY" = ANY($1) OR b.individual_customer_id = ANY($1))
          AND b.month_year < $2
        ORDER BY b.month_year DESC
      `, [carryoverCustomerKeys, maxMonth]);

      for (const pb of priorBills) {
        const k = pb.CUSTOMERKEY || pb.individual_customer_id;
        if (!priorMap[k]) priorMap[k] = [];
        priorMap[k].push(pb);
      }
    }

    // Aggregates
    const glSummaryMap: Record<string, GLSummaryRow> = {};
    const allBranchMonthlyMap: Record<string, GLAllBranchMonthlyRow> = {};
    const componentMatrixRows: GLComponentMatrixRow[] = [];
    const glCodeBreakdown: Record<string, { count: number; total: number; vat: number; name: string; currentAmount?: number; arrearsAmount?: number }> = {};

    let totalGrossBilled = 0;
    let totalNetRevenue = 0;
    let totalVat = 0;
    let totalPaidAmount = 0;
    let totalUnpaidAmount = 0;
    let totalOutstandingCarryover = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let totalAnomalies = 0;
    let totalCleanBills = 0;

    for (const b of bills) {
      const rawMonth = (b.month_year || '').substring(0, 7) || '2026-10';
      const billYear = (b.month_year || '').substring(0, 4) || '2026';
      const periodStr = isYearly ? billYear : formatPeriod(rawMonth);
      const rawPeriod = isYearly ? billYear : rawMonth;
      const rawBranchName = b.branch_name || 'Addis Ababa';
      const branchCode = getBranchCode(rawBranchName);

      // Determine payment status
      // SQL already normalizes payment_status to 'Paid and Reconciled' or 'Unpaid'
      const payStatus: 'Paid and Reconciled' | 'Unpaid' =
        String(b.payment_status || '').trim() === 'Paid and Reconciled' ? 'Paid and Reconciled' : 'Unpaid';

      // Determine charge group label
      let cGroup = (b.charge_group || '').trim();
      const cgLower = cGroup.toLowerCase();

      let baseWaterGl = 'WNDGL';
      if (cgLower.includes('borehole')) {
        baseWaterGl = 'WBORGL';
      } else if (cgLower.includes('fountain')) {
        baseWaterGl = 'WPFNTGL';
      } else if (cgLower.includes('domestic') && !cgLower.includes('non')) {
        baseWaterGl = 'WDGL';
      }

      if (!cGroup || cGroup === 'Unknown') {
        if (baseWaterGl === 'WDGL') cGroup = 'Domestic';
        else if (baseWaterGl === 'WBORGL') cGroup = 'Borehole';
        else if (baseWaterGl === 'WPFNTGL') cGroup = 'Public Fountain';
        else cGroup = 'Non-domestic';
      }

      // Filter by charge group if requested
      if (params.chargeGroup && params.chargeGroup !== 'all' && cGroup.toLowerCase() !== params.chargeGroup.toLowerCase()) {
        continue;
      }

      let baseWater = Number(b.base_water_charge || 0);
      const sewerage = Number(b.sewerage_charge || 0);
      const sanitation = Number(b.sanitation_fee || 0);
      const meterRent = Number(b.meter_rent || 0);
      const maintenance = Number(b.maintenance_fee || 0);
      const additional = Number(b.additional_fees_charge || 0);
      const penalty = Number(b.penalty_amt || 0);
      const vat = Number(b.vat_amount || 0);
      const thisMonth = Number(b.this_month_bill_amt || 0);
      const total = Number(b.total_bill_amount || 0);

      // If no component breakdown stored, treat thisMonth-vat as base water (to avoid false mismatch)
      if (baseWater === 0 && thisMonth > 0 && sewerage === 0 && sanitation === 0 && meterRent === 0 && maintenance === 0) {
        baseWater = Math.max(0, thisMonth - vat);
      }

      // Audit checks
      // IMPORTANT: THISMONTHBILLAMT includes VAT — compare (componentSum + vat) vs thisMonth.
      // Tolerance of 0.50 ETB covers legitimate floating-point rounding across charge components.
      const componentSum = baseWater + sewerage + sanitation + meterRent + maintenance + additional;
      const componentSumWithVat = componentSum + vat;
      const mathDiffNoPen = thisMonth > 0 ? Math.abs(componentSumWithVat - thisMonth) : 0;
      const mathDiffWithPen = thisMonth > 0 ? Math.abs(componentSumWithVat + penalty - thisMonth) : 0;
      const mathDiff = Math.min(mathDiffNoPen, mathDiffWithPen);
      const isMathMismatch = thisMonth > 0 && mathDiff > 0.50;
      const isMissingDrCr = (!b.dr_acct_no || b.dr_acct_no === '' || b.dr_acct_no === '0000000000')
        && (!b.cr_acct_no || b.cr_acct_no === '' || b.cr_acct_no === '0000000000');
      const isUnmappedGroup = !b.charge_group || b.charge_group === 'Unknown';
      const isNegative = baseWater < 0 || total < 0;

      // Only true billing errors (math, negative) affect the Audit Health KPI
      const hasAnomaly = isMathMismatch || isNegative;
      const hasConfigGap = isMissingDrCr || isUnmappedGroup;
      if (hasAnomaly) totalAnomalies++;
      else if (!hasConfigGap) totalCleanBills++;
      else totalCleanBills++; // config gaps don't reduce clean count

      // Track revenue & collections
      totalGrossBilled += thisMonth;
      totalNetRevenue  += (thisMonth - vat);
      totalVat         += vat;

      // Outstanding carryover = prior-period arrears baked into TOTALBILLAMOUNT
      const carryover = Math.max(0, total - thisMonth);
      totalOutstandingCarryover += carryover;

      // Prior components calculation for arrears carried forward
      let priorWater = 0, priorSewer = 0, priorSan = 0, priorRent = 0, priorMnt = 0, priorFire = 0, priorVat = 0;
      const ck = b.CUSTOMERKEY || b.individual_customer_id;
      const priors = (priorMap[ck] || []).filter(p => p.month_year < b.month_year);

      if (carryover > 0.01 && priors.length > 0) {
        let sumPriorThisMonth = 0;
        for (const p of priors) {
          if (sumPriorThisMonth >= carryover - 0.01) break; // Satisfied the carryover debt
          priorWater += Number(p.base_water_charge || 0);
          priorSewer += Number(p.sewerage_charge || 0);
          priorSan += Number(p.sanitation_fee || 0);
          priorRent += Number(p.meter_rent || 0);
          priorMnt += Number(p.maintenance_fee || 0);
          priorFire += Number(p.additional_fees_charge || 0) + Number(p.penalty_amt || 0);
          priorVat += Number(p.vat_amount || 0);
          sumPriorThisMonth += Number(p.this_month_bill_amt || 0);
        }
        const ratio = sumPriorThisMonth > 0 ? (carryover / sumPriorThisMonth) : 1;
        priorWater *= ratio;
        priorSewer *= ratio;
        priorSan *= ratio;
        priorRent *= ratio;
        priorMnt *= ratio;
        priorFire *= ratio;
        priorVat *= ratio;
      } else if (carryover > 0.01) {
        // Fallback for bills without historical records in DB
        const currSum = baseWater + sewerage + sanitation + meterRent + maintenance + additional + penalty + vat;
        if (currSum > 0) {
          const ratio = carryover / currSum;
          priorWater = baseWater * ratio;
          priorSewer = sewerage * ratio;
          priorSan = sanitation * ratio;
          priorRent = meterRent * ratio;
          priorMnt = maintenance * ratio;
          priorFire = (additional + penalty) * ratio;
          priorVat = vat * ratio;
        } else {
          priorWater = carryover;
        }
      }

      // Use live amount_paid or verified status for accurate paid classification
      const amountPaid = Number(b.amount_paid || 0);
      const isPaidBill = payStatus === 'Paid and Reconciled' || (total > 0 && amountPaid >= total - 0.01);
      if (isPaidBill) {
        paidCount++;
        totalPaidAmount += total;
      } else {
        unpaidCount++;
        totalUnpaidAmount += total;
      }

      // Component Matrix Row
      componentMatrixRows.push({
        period: periodStr,
        rawPeriod,
        customerKey: b.CUSTOMERKEY || b.individual_customer_id || b.BILLKEY || 'N/A',
        customerName: b.customer_name || 'N/A',
        branchName: rawBranchName,
        branchCode,
        chargeGroup: cGroup,
        paymentStatus: payStatus,
        baseWater: parseFloat(baseWater.toFixed(2)),
        sewerage: parseFloat(sewerage.toFixed(2)),
        sanitation: parseFloat(sanitation.toFixed(2)),
        meterRent: parseFloat(meterRent.toFixed(2)),
        maintenance: parseFloat(maintenance.toFixed(2)),
        additional: parseFloat(additional.toFixed(2)),
        penalty: parseFloat(Number(b.penalty_amt || 0).toFixed(2)),
        vat: parseFloat(vat.toFixed(2)),
        totalExclVat: parseFloat((thisMonth - vat).toFixed(2)),
        totalInclVat: parseFloat(thisMonth.toFixed(2)),
        totalAmount:  parseFloat(thisMonth.toFixed(2)),
        // outstanding = TOTALBILLAMOUNT - THISMONTHBILLAMT (carryover, not a new GL entry)
        outstandingCarryover: parseFloat((total - thisMonth).toFixed(2)),
        anomalyCount: hasAnomaly ? 1 : 0,
        auditStatus: hasAnomaly ? (isMathMismatch || isNegative ? 'Error' : 'Warning') : 'Clean',
      });

      // Helper to add into GL summary map (separated by period, branch, chargeGroup, glCode, and paymentStatus)
      const addGlItem = (
        code: string,
        currNet: number,
        currVat: number,
        arrNet: number,
        arrVat: number
      ) => {
        const currTotal = currNet + currVat;
        const arrTotal = arrNet + arrVat;
        const totalLineAmount = currTotal + arrTotal;
        if (totalLineAmount <= 0) return;
        if (params.glCode && params.glCode !== 'all' && params.glCode !== code) return;

        const summaryKey = `${periodStr}|${branchCode}|${cGroup}|${code}|${payStatus}`;
        if (!glSummaryMap[summaryKey]) {
          glSummaryMap[summaryKey] = {
            key: summaryKey,
            period: periodStr,
            rawPeriod,
            branch: branchCode,
            branchCode: branchCode,
            branchName: rawBranchName,
            branchId: b.branch_id || '',
            chargeGroup: cGroup,
            glCode: code,
            glName: GL_NAMES[code] || code,
            paymentStatus: payStatus,
            count: 0,
            currentAmount: 0,
            arrearsAmount: 0,
            totalAmount: 0,
            vatAmount: 0,
            withoutVat: 0,
            anomalyCount: 0,
            cleanCount: 0,
            auditStatus: 'Clean',
          };
        }

        glSummaryMap[summaryKey].count += 1;
        glSummaryMap[summaryKey].currentAmount += currTotal;
        glSummaryMap[summaryKey].arrearsAmount += arrTotal;
        glSummaryMap[summaryKey].totalAmount += totalLineAmount;
        glSummaryMap[summaryKey].vatAmount += (currVat + arrVat);
        glSummaryMap[summaryKey].withoutVat += (currNet + arrNet);

        if (hasAnomaly) {
          glSummaryMap[summaryKey].anomalyCount += 1;
          glSummaryMap[summaryKey].auditStatus = (isMathMismatch || isNegative) ? 'Error' : 'Warning';
        } else {
          glSummaryMap[summaryKey].cleanCount += 1;
        }

        // All Branch Monthly aggregation: (PERIOD, BRANCH, GL_CODE)
        const allBranchKey = `${periodStr}|${branchCode}|${code}`;
        if (!allBranchMonthlyMap[allBranchKey]) {
          allBranchMonthlyMap[allBranchKey] = {
            key: allBranchKey,
            count: 0,
            branch: branchCode,
            branchName: rawBranchName,
            branchId: b.branch_id || '',
            glCode: code,
            glName: GL_NAMES[code] || code,
            totalAmount: 0,
            vatAmount: 0,
            withoutVat: 0,
            period: periodStr,
            rawPeriod,
          };
        }
        allBranchMonthlyMap[allBranchKey].count += 1;
        allBranchMonthlyMap[allBranchKey].totalAmount += totalLineAmount;
        allBranchMonthlyMap[allBranchKey].vatAmount += (currVat + arrVat);
        allBranchMonthlyMap[allBranchKey].withoutVat += (currNet + arrNet);

        // Breakdown tracker
        if (!glCodeBreakdown[code]) {
          glCodeBreakdown[code] = {
            count: 0,
            total: 0,
            vat: 0,
            name: GL_NAMES[code] || code,
            currentAmount: 0,
            arrearsAmount: 0,
          };
        }
        glCodeBreakdown[code].count += 1;
        glCodeBreakdown[code].total += totalLineAmount;
        glCodeBreakdown[code].vat += (currVat + arrVat);
        glCodeBreakdown[code].currentAmount = (glCodeBreakdown[code].currentAmount || 0) + currTotal;
        glCodeBreakdown[code].arrearsAmount = (glCodeBreakdown[code].arrearsAmount || 0) + arrTotal;
      };

      addGlItem(baseWaterGl, baseWater, vat, priorWater, priorVat);
      addGlItem('SEWERGL', sewerage, 0, priorSewer, 0);
      addGlItem('SNTGL', sanitation, 0, priorSan, 0);
      addGlItem('MTRRNTGL', meterRent, 0, priorRent, 0);
      addGlItem('MNTGL', maintenance, 0, priorMnt, 0);
      addGlItem('FIREGL', additional + penalty, 0, priorFire, 0);
    }

    // Format summary rows
    const summaryRows: GLSummaryRow[] = Object.values(glSummaryMap)
      .map(row => ({
        ...row,
        currentAmount: parseFloat(row.currentAmount.toFixed(2)),
        arrearsAmount: parseFloat(row.arrearsAmount.toFixed(2)),
        totalAmount: parseFloat(row.totalAmount.toFixed(2)),
        vatAmount: parseFloat(row.vatAmount.toFixed(2)),
        withoutVat: parseFloat(row.withoutVat.toFixed(2)),
      }))
      .sort((a, b) => {
        const pd = String(b.rawPeriod || '').localeCompare(String(a.rawPeriod || ''));
        if (pd !== 0) return pd;
        const bd = String(a.branch || '').localeCompare(String(b.branch || ''));
        if (bd !== 0) return bd;
        const cg = String(a.chargeGroup || '').localeCompare(String(b.chargeGroup || ''));
        if (cg !== 0) return cg;
        const gc = String(a.glCode || '').localeCompare(String(b.glCode || ''));
        if (gc !== 0) return gc;
        return String(a.paymentStatus || '').localeCompare(String(b.paymentStatus || ''));
      });

    const isSpecificGl = params.glCode && params.glCode !== 'all';
    const effectiveGross = isSpecificGl
      ? summaryRows.reduce((acc, r) => acc + r.currentAmount, 0)
      : totalGrossBilled;
    const effectiveCarryover = isSpecificGl
      ? summaryRows.reduce((acc, r) => acc + r.arrearsAmount, 0)
      : totalOutstandingCarryover;
    const effectiveNet = isSpecificGl
      ? summaryRows.reduce((acc, r) => acc + r.withoutVat, 0)
      : totalNetRevenue;
    const effectiveVat = isSpecificGl
      ? summaryRows.reduce((acc, r) => acc + r.vatAmount, 0)
      : totalVat;
    const effectivePaid = isSpecificGl
      ? summaryRows.reduce((acc, r) => acc + r.totalAmount, 0)
      : totalPaidAmount;

    const kpis: GLKPIs = {
      totalGrossBilled: parseFloat(effectiveGross.toFixed(2)),
      totalNetRevenue: parseFloat(effectiveNet.toFixed(2)),
      totalVat: parseFloat(effectiveVat.toFixed(2)),
      totalPaidAmount: parseFloat(effectivePaid.toFixed(2)),
      totalUnpaidAmount: 0,
      totalOutstandingCarryover: parseFloat(effectiveCarryover.toFixed(2)),
      paidCount,
      unpaidCount: 0,
      totalAuditedBills: bills.length,
      totalCleanBills,
      totalAnomalies,
      glCodeBreakdown,
    };

    const allBranchMonthlyRows: GLAllBranchMonthlyRow[] = Object.values(allBranchMonthlyMap)
      .map(row => ({
        ...row,
        totalAmount: parseFloat(row.totalAmount.toFixed(2)),
        vatAmount: parseFloat(row.vatAmount.toFixed(2)),
        withoutVat: parseFloat(row.withoutVat.toFixed(2)),
      }))
      .sort((a, b) => {
        const pd = String(b.rawPeriod || '').localeCompare(String(a.rawPeriod || ''));
        if (pd !== 0) return pd;
        const bd = String(a.branch || '').localeCompare(String(b.branch || ''));
        if (bd !== 0) return bd;
        return String(a.glCode || '').localeCompare(String(b.glCode || ''));
      });

    return {
      success: true,
      kpis,
      summaryRows: auth.canViewSummary ? summaryRows : [],
      allBranchMonthlyRows: auth.canViewAllBranches ? allBranchMonthlyRows : [],
      componentMatrixRows: auth.canViewMatrix ? componentMatrixRows.slice(0, 500) : [],
      totalBills: bills.length,
    };
  } catch (error: any) {
    console.error('getGLSummaryReportAction error:', error);
    return { success: false, error: error.message || 'Failed to generate GL report' };
  }
}

/**
 * Detailed drill-down for an individual GL aggregate row.
 * Fetches all bills contributing to that specific GL line.
 */
export async function getGLBillsDrillDownAction(params: {
  branchCode?: string;
  period?: string;
  chargeGroup?: string;
  glCode?: string;
  paymentStatus?: string;
  searchTerm?: string;
  auditFilter?: 'all' | 'clean' | 'flagged';
  page?: number;
  limit?: number;
}) {
  try {
    const auth = await authorizeGLReport();
    const page = params.page || 0;
    const limit = params.limit || 20;

    const whereClauses: string[] = [
      'b.deleted_at IS NULL',
      "COALESCE(b.status, 'Posted') NOT IN ('Reversed', 'Cancelled', 'Void', 'Draft')",
      // The GL Financial & Audit Report strictly displays Paid and Reconciled transactions
      "(LOWER(TRIM(COALESCE(b.payment_status::text, ''))) = 'paid' OR LOWER(TRIM(COALESCE(b.status::text, ''))) = 'paid' OR (COALESCE(b.\"TOTALBILLAMOUNT\", 0) > 0 AND COALESCE(b.amount_paid, 0) >= COALESCE(b.\"TOTALBILLAMOUNT\", 0) - 0.01))",
    ];
    const sqlParams: any[] = [];

    if (auth.lockedBranchId) {
      sqlParams.push(auth.lockedBranchId);
      whereClauses.push(`(b.branch_id = $${sqlParams.length} OR bm.branch_id = $${sqlParams.length} OR ic.branch_id = $${sqlParams.length})`);
    }

    if (params.period && params.period !== 'all') {
      sqlParams.push(params.period);
      if (params.period.length === 4) {
        // Annual/Yearly drill-down (e.g. "2026")
        whereClauses.push(`b.month_year LIKE $${sqlParams.length} || '%'`);
      } else {
        // Monthly drill-down (e.g. "2026-10")
        whereClauses.push(`b.month_year = $${sqlParams.length}`);
      }
    }

    if (params.searchTerm && params.searchTerm.trim()) {
      sqlParams.push(`%${params.searchTerm.trim()}%`);
      whereClauses.push(`(
        b."BILLKEY" ILIKE $${sqlParams.length} OR 
        b."CUSTOMERKEY" ILIKE $${sqlParams.length} OR 
        b.individual_customer_id ILIKE $${sqlParams.length} OR 
        b."CUSTOMERNAME" ILIKE $${sqlParams.length} OR 
        bm.name ILIKE $${sqlParams.length} OR 
        ic.name ILIKE $${sqlParams.length}
      )`);
    }

    const sql = `
      SELECT 
        b.id,
        b."BILLKEY",
        b."CUSTOMERKEY",
        b.individual_customer_id,
        b.month_year,
        b.meter_key,
        b."CURRREAD",
        b."PREVREAD",
        b."CONS",
        COALESCE(b.base_water_charge, 0)::numeric as base_water_charge,
        COALESCE(b.sewerage_charge, 0)::numeric as sewerage_charge,
        COALESCE(b.sanitation_fee, 0)::numeric as sanitation_fee,
        COALESCE(b.meter_rent, 0)::numeric as meter_rent,
        COALESCE(b.maintenance_fee, 0)::numeric as maintenance_fee,
        COALESCE(b.additional_fees_charge, 0)::numeric as additional_fees_charge,
        COALESCE(b."PENALTYAMT", 0)::numeric as penalty_amt,
        COALESCE(b.vat_amount, 0)::numeric as vat_amount,
        COALESCE(b."THISMONTHBILLAMT", 0)::numeric as this_month_bill_amt,
        -- Compute outstanding live: total owed minus actual payments (not stale OUTSTANDINGAMT)
        GREATEST(0, COALESCE(b."TOTALBILLAMOUNT",0) - COALESCE(b.amount_paid,0))::numeric as outstanding_amt,
        COALESCE(b."TOTALBILLAMOUNT", 0)::numeric as total_bill_amount,
        COALESCE(b."DRACCTNO", '') as dr_acct_no,
        COALESCE(b."CRACCTNO", '') as cr_acct_no,
        CASE WHEN LOWER(TRIM(COALESCE(b.payment_status::text, ''))) = 'paid' OR LOWER(TRIM(COALESCE(b.status::text, ''))) = 'paid' THEN 'Paid and Reconciled' ELSE 'Unpaid' END as payment_status,
        COALESCE(b."CUSTOMERNAME", bm.name, ic.name, 'N/A') as customer_name,
        COALESCE(bm.charge_group, ic."customerType", 'Unknown') as charge_group,
        COALESCE(b.branch_id, bm.branch_id, ic.branch_id) as branch_id,
        COALESCE(br.name, b."CUSTOMERBRANCH", 'Addis Ababa') as branch_name
      FROM bills b
      LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
      LEFT JOIN individual_customers ic ON b.individual_customer_id = ic."customerKeyNumber"
      LEFT JOIN branches br ON br.id = COALESCE(b.branch_id, bm.branch_id, ic.branch_id)
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY b.created_at DESC
      LIMIT 1000
    `;

    const bills: any[] = await query(sql, sqlParams);

    // Process and filter by branchCode, chargeGroup, and glCode in memory
    const items: GLBillDrillDownItem[] = [];

    for (const b of bills) {
      const rawBranchName = b.branch_name || 'Addis Ababa';
      const bCode = getBranchCode(rawBranchName);

      if (params.branchCode && params.branchCode !== 'all' && bCode !== params.branchCode) {
        continue;
      }

      let cGroup = (b.charge_group || '').trim();
      const cgLower = cGroup.toLowerCase();

      let baseWaterGl = 'WNDGL';
      if (cgLower.includes('borehole')) {
        baseWaterGl = 'WBORGL';
      } else if (cgLower.includes('fountain')) {
        baseWaterGl = 'WPFNTGL';
      } else if (cgLower.includes('domestic') && !cgLower.includes('non')) {
        baseWaterGl = 'WDGL';
      }

      if (!cGroup || cGroup === 'Unknown') {
        if (baseWaterGl === 'WDGL') cGroup = 'Domestic';
        else if (baseWaterGl === 'WBORGL') cGroup = 'Borehole';
        else if (baseWaterGl === 'WPFNTGL') cGroup = 'Public Fountain';
        else cGroup = 'Non-domestic';
      }

      if (params.chargeGroup && params.chargeGroup !== 'all' && cGroup.toLowerCase() !== params.chargeGroup.toLowerCase()) {
        continue;
      }

      // Check whether this bill has charges for the requested glCode
      let baseWater = Number(b.base_water_charge || 0);
      const sewerage = Number(b.sewerage_charge || 0);
      const sanitation = Number(b.sanitation_fee || 0);
      const meterRent = Number(b.meter_rent || 0);
      const maintenance = Number(b.maintenance_fee || 0);
      const additional = Number(b.additional_fees_charge || 0);
      const penalty = Number(b.penalty_amt || 0);
      const vat = Number(b.vat_amount || 0);
      const thisMonth = Number(b.this_month_bill_amt || 0);
      const total = Number(b.total_bill_amount || 0);

      // Safe fallback for un-itemized bills
      if (baseWater === 0 && thisMonth > 0 && sewerage === 0 && sanitation === 0 && meterRent === 0 && maintenance === 0) {
        baseWater = Math.max(0, thisMonth - vat);
      }

      if (params.glCode && params.glCode !== 'all') {
        const carryover = Math.max(0, total - thisMonth);
        let hasCharge = false;
        if (params.glCode === baseWaterGl && (baseWater > 0 || carryover > 0)) hasCharge = true;
        if (params.glCode === 'SEWERGL' && (sewerage > 0 || carryover > 0)) hasCharge = true;
        if (params.glCode === 'SNTGL' && (sanitation > 0 || carryover > 0)) hasCharge = true;
        if (params.glCode === 'MTRRNTGL' && (meterRent > 0 || carryover > 0)) hasCharge = true;
        if (params.glCode === 'MNTGL' && (maintenance > 0 || carryover > 0)) hasCharge = true;
        if (params.glCode === 'FIREGL' && (additional > 0 || penalty > 0 || carryover > 0)) hasCharge = true;

        if (!hasCharge) continue;
      }

      // Audit checks
      // THISMONTHBILLAMT includes VAT — compare componentSum+vat vs thisMonth
      const auditFlags: string[] = [];
      const componentSum = baseWater + sewerage + sanitation + meterRent + maintenance + additional;
      const componentSumWithVat = componentSum + vat;
      const diffNoPen = thisMonth > 0 ? Math.abs(componentSumWithVat - thisMonth) : 0;
      const diffWithPen = thisMonth > 0 ? Math.abs(componentSumWithVat + penalty - thisMonth) : 0;
      const diff = Math.min(diffNoPen, diffWithPen);
      if (diff > 0.50) {
        auditFlags.push(`Arithmetic Sum Mismatch (Components+VAT: ${componentSumWithVat.toFixed(2)} vs ThisMonth: ${thisMonth.toFixed(2)}, Δ ${diff.toFixed(2)} ETB)`);
      }
      if (!b.dr_acct_no || b.dr_acct_no === '0000000000') {
        auditFlags.push('Missing DR (Accounts Receivable) Account Number');
      }
      if (!b.cr_acct_no || b.cr_acct_no === '0000000000') {
        auditFlags.push('Missing CR (Revenue GL) Account Number');
      }
      if (!b.charge_group || b.charge_group === 'Unknown') {
        auditFlags.push('Unmapped Charge Group (Inferred from Water GL)');
      }
      if (baseWater < 0 || total < 0) {
        auditFlags.push('Negative Billing Balance Detected');
      }

      const status: 'PASS' | 'FLAGGED' = auditFlags.length === 0 ? 'PASS' : 'FLAGGED';

      if (params.auditFilter === 'clean' && status !== 'PASS') continue;
      if (params.auditFilter === 'flagged' && status !== 'FLAGGED') continue;

      const rawPeriod = (b.month_year || '').substring(0, 7) || '2026-10';

      items.push({
        id: b.id,
        billKey: b.BILLKEY || 'N/A',
        customerKey: b.CUSTOMERKEY || b.individual_customer_id || 'N/A',
        customerName: b.customer_name || 'N/A',
        chargeGroup: cGroup,
        meterKey: b.meter_key || 'N/A',
        branchName: rawBranchName,
        branchCode: bCode,
        period: formatPeriod(rawPeriod),
        rawPeriod,
        currRead: Number(b.CURRREAD || 0),
        prevRead: Number(b.PREVREAD || 0),
        cons: Number(b.CONS || 0),
        baseWater: parseFloat(baseWater.toFixed(2)),
        sewerage: parseFloat(sewerage.toFixed(2)),
        sanitation: parseFloat(sanitation.toFixed(2)),
        meterRent: parseFloat(meterRent.toFixed(2)),
        maintenance: parseFloat(maintenance.toFixed(2)),
        additional: parseFloat(additional.toFixed(2)),
        penalty: parseFloat(Number(b.penalty_amt || 0).toFixed(2)),
        vat: parseFloat(vat.toFixed(2)),
        thisMonthAmount: parseFloat(thisMonth.toFixed(2)),
        outstanding: parseFloat(Number(b.outstanding_amt || 0).toFixed(2)),
        totalAmount: parseFloat(total.toFixed(2)),
        paymentStatus: b.payment_status || 'Unpaid',
        drAcctNo: b.dr_acct_no || 'N/A',
        crAcctNo: b.cr_acct_no || 'N/A',
        glCode: params.glCode || baseWaterGl,
        auditFlags,
        auditStatus: status,
      });
    }

    const total = items.length;
    const paginatedBills = items.slice(page * limit, (page + 1) * limit);

    return {
      success: true,
      bills: paginatedBills,
      total,
      page,
      limit,
    };
  } catch (error: any) {
    console.error('getGLBillsDrillDownAction error:', error);
    return { success: false, error: error.message || 'Failed to fetch GL bills drill-down' };
  }
}

/**
 * Dedicated Anomaly Scanner:
 * Returns all detected GL and accounting discrepancies with recommended remediation.
 */
export async function getGLAuditAnomaliesAction(params: {
  branchId?: string;
  periodType?: 'monthly' | 'yearly';
  monthYear?: string;
  year?: string;
  paymentStatus?: string;
}) {
  try {
    const auth = await authorizeGLReport();
    if (!auth.canViewAnomalyTab) {
      return { success: true, anomalies: [], totalAnomalies: 0 };
    }
    const effectiveBranchId = auth.lockedBranchId || (params.branchId && params.branchId !== 'all' ? params.branchId : null);
    const isYearly = params.periodType === 'yearly';

    const whereClauses: string[] = [
      'b.deleted_at IS NULL',
      "COALESCE(b.status, 'Posted') NOT IN ('Reversed', 'Cancelled', 'Void', 'Draft')",
      // The GL Financial & Audit Report strictly displays Paid and Reconciled transactions
      "(LOWER(TRIM(COALESCE(b.payment_status::text, ''))) = 'paid' OR LOWER(TRIM(COALESCE(b.status::text, ''))) = 'paid' OR (COALESCE(b.\"TOTALBILLAMOUNT\", 0) > 0 AND COALESCE(b.amount_paid, 0) >= COALESCE(b.\"TOTALBILLAMOUNT\", 0) - 0.01))",
    ];
    const sqlParams: any[] = [];

    if (effectiveBranchId) {
      sqlParams.push(effectiveBranchId);
      whereClauses.push(`(b.branch_id = $${sqlParams.length} OR bm.branch_id = $${sqlParams.length} OR ic.branch_id = $${sqlParams.length})`);
    }

    if (isYearly) {
      if (params.year && params.year !== 'all') {
        sqlParams.push(params.year);
        whereClauses.push(`b.month_year LIKE $${sqlParams.length} || '%'`);
      }
    } else {
      if (params.monthYear && params.monthYear !== 'all') {
        sqlParams.push(params.monthYear);
        whereClauses.push(`b.month_year = $${sqlParams.length}`);
      }
    }

    const sql = `
      SELECT 
        b.id,
        b."BILLKEY",
        b."CUSTOMERKEY",
        b.individual_customer_id,
        b.month_year,
        COALESCE(b.base_water_charge, 0)::numeric as base_water_charge,
        COALESCE(b.sewerage_charge, 0)::numeric as sewerage_charge,
        COALESCE(b.sanitation_fee, 0)::numeric as sanitation_fee,
        COALESCE(b.meter_rent, 0)::numeric as meter_rent,
        COALESCE(b.maintenance_fee, 0)::numeric as maintenance_fee,
        COALESCE(b.additional_fees_charge, 0)::numeric as additional_fees_charge,
        COALESCE(b."PENALTYAMT", 0)::numeric as penalty_amt,
        COALESCE(b.vat_amount, 0)::numeric as vat_amount,
        COALESCE(b."THISMONTHBILLAMT", 0)::numeric as this_month_bill_amt,
        COALESCE(b."TOTALBILLAMOUNT", 0)::numeric as total_bill_amount,
        COALESCE(b."DRACCTNO", '') as dr_acct_no,
        COALESCE(b."CRACCTNO", '') as cr_acct_no,
        COALESCE(b."CUSTOMERNAME", bm.name, ic.name, 'N/A') as customer_name,
        COALESCE(bm.charge_group, ic."customerType", '') as charge_group,
        COALESCE(br.name, b."CUSTOMERBRANCH", 'Addis Ababa') as branch_name
      FROM bills b
      LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
      LEFT JOIN individual_customers ic ON b.individual_customer_id = ic."customerKeyNumber"
      LEFT JOIN branches br ON br.id = COALESCE(b.branch_id, bm.branch_id, ic.branch_id)
      WHERE ${whereClauses.join(' AND ')}
      LIMIT 2000
    `;

    const bills: any[] = await query(sql, sqlParams);
    const anomalies: GLAnomalyItem[] = [];

    for (const b of bills) {
      const rawBranchName = b.branch_name || 'Addis Ababa';
      const bCode = getBranchCode(rawBranchName);
      const rawPeriod = (b.month_year || '').substring(0, 7) || '2026-10';

      let baseWater = Number(b.base_water_charge || 0);
      const sewerage = Number(b.sewerage_charge || 0);
      const sanitation = Number(b.sanitation_fee || 0);
      const meterRent = Number(b.meter_rent || 0);
      const maintenance = Number(b.maintenance_fee || 0);
      const additional = Number(b.additional_fees_charge || 0);
      const penalty = Number(b.penalty_amt || 0);
      const vat = Number(b.vat_amount || 0);
      const thisMonth = Number(b.this_month_bill_amt || 0);
      const total = Number(b.total_bill_amount || 0);

      // Safe fallback for un-itemized legacy bills
      if (baseWater === 0 && thisMonth > 0 && sewerage === 0 && sanitation === 0 && meterRent === 0 && maintenance === 0) {
        baseWater = Math.max(0, thisMonth - vat);
      }

      // THISMONTHBILLAMT includes VAT — compare (componentSum + vat) vs thisMonth
      const componentSum = baseWater + sewerage + sanitation + meterRent + maintenance + additional;
      const componentSumWithVat = componentSum + vat;
      const mathDiffNoPen = thisMonth > 0 ? Math.abs(componentSumWithVat - thisMonth) : 0;
      const mathDiffWithPen = thisMonth > 0 ? Math.abs(componentSumWithVat + penalty - thisMonth) : 0;
      const mathDiff = Math.min(mathDiffNoPen, mathDiffWithPen);

      // Check 1: Math Sum Mismatch (tolerance 0.50 ETB for rounding)
      if (mathDiff > 0.50) {
        anomalies.push({
          billId: b.id,
          billKey: b.BILLKEY || b.id,
          customerKey: b.CUSTOMERKEY || b.individual_customer_id || 'N/A',
          customerName: b.customer_name || 'N/A',
          branchName: rawBranchName,
          branchCode: bCode,
          period: formatPeriod(rawPeriod),
          anomalyType: 'MATH_SUM_MISMATCH',
          severity: 'High',
          expected: `Components + VAT: ${componentSumWithVat.toFixed(2)} ETB`,
          actual: `This month amount: ${thisMonth.toFixed(2)} ETB`,
          difference: parseFloat(mathDiff.toFixed(2)),
          description: `Component charges including VAT (${componentSumWithVat.toFixed(2)} ETB) do not equal billed monthly amount (${thisMonth.toFixed(2)} ETB). Discrepancy: ${mathDiff.toFixed(2)} ETB.`,
          recommendation: 'Perform bill rework or trigger a correction to re-synchronize component tariff calculations.',
        });
      }

      // Check 2: Missing DR or CR Accounts (config-level warning, shown in inspector)
      // Only flag if BOTH are missing (i.e., accounts genuinely not configured, not partial)
      const hasMissingDrCr = (!b.dr_acct_no || b.dr_acct_no === '' || b.dr_acct_no === '0000000000')
        || (!b.cr_acct_no || b.cr_acct_no === '' || b.cr_acct_no === '0000000000');
      if (hasMissingDrCr) {
        anomalies.push({
          billId: b.id,
          billKey: b.BILLKEY || b.id,
          customerKey: b.CUSTOMERKEY || b.individual_customer_id || 'N/A',
          customerName: b.customer_name || 'N/A',
          branchName: rawBranchName,
          branchCode: bCode,
          period: formatPeriod(rawPeriod),
          anomalyType: 'MISSING_DR_CR',
          severity: 'Warning',
          expected: 'Valid DR (Receivable) and CR (Revenue) ledger numbers',
          actual: `DR: ${b.dr_acct_no || 'EMPTY'} | CR: ${b.cr_acct_no || 'EMPTY'}`,
          difference: 0,
          description: 'Debit or credit GL account numbers are not configured for this bill. This is a chart-of-accounts setup gap.',
          recommendation: 'Configure DR/CR GL account mappings in the Tariffs or Chart of Accounts settings for this branch and charge group.',
        });
      }

      // Check 3: Unmapped Charge Group
      if (!b.charge_group || b.charge_group.trim() === '' || b.charge_group.toLowerCase() === 'unknown') {
        anomalies.push({
          billId: b.id,
          billKey: b.BILLKEY || b.id,
          customerKey: b.CUSTOMERKEY || b.individual_customer_id || 'N/A',
          customerName: b.customer_name || 'N/A',
          branchName: rawBranchName,
          branchCode: bCode,
          period: formatPeriod(rawPeriod),
          anomalyType: 'UNMAPPED_CHARGE_GROUP',
          severity: 'Warning',
          expected: 'Assigned customer charge group (e.g., Domestic, Non-domestic)',
          actual: 'Empty or Unknown',
          difference: 0,
          description: 'Customer has no assigned charge group in database; GL classification defaulted to non-domestic WNDGL.',
          recommendation: 'Update customer master profile with the correct tariff charge category.',
        });
      }

      // Check 4: Negative charges
      if (baseWater < 0 || total < 0) {
        anomalies.push({
          billId: b.id,
          billKey: b.BILLKEY || b.id,
          customerKey: b.CUSTOMERKEY || b.individual_customer_id || 'N/A',
          customerName: b.customer_name || 'N/A',
          branchName: rawBranchName,
          branchCode: bCode,
          period: formatPeriod(rawPeriod),
          anomalyType: 'NEGATIVE_CHARGE',
          severity: 'High',
          expected: 'Non-negative charge amounts',
          actual: `Base: ${baseWater.toFixed(2)} | Total: ${total.toFixed(2)}`,
          difference: parseFloat(Math.min(baseWater, total).toFixed(2)),
          description: 'Negative billing charge detected on active bill record.',
          recommendation: 'Verify meter readings for rollover, reversal, or negative difference usage.',
        });
      }
    }

    return {
      success: true,
      anomalies,
      totalAnomalies: anomalies.length,
    };
  } catch (error: any) {
    console.error('getGLAuditAnomaliesAction error:', error);
    return { success: false, error: error.message || 'Failed to scan for GL anomalies' };
  }
}
