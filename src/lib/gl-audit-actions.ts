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
  count: number;
  totalAmount: number;
  vatAmount: number;
  withoutVat: number;
  anomalyCount: number;
  cleanCount: number;
  auditStatus: 'Clean' | 'Warning' | 'Error';
}

export interface GLComponentMatrixRow {
  period: string;
  rawPeriod: string;
  customerKey: string;
  customerName: string;
  branchName: string;
  branchCode: string;
  chargeGroup: string;
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
  totalAuditedBills: number;
  totalCleanBills: number;
  totalAnomalies: number;
  glCodeBreakdown: Record<string, { count: number; total: number; vat: number; name: string }>;
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

  if (v.includes('ADDIS')) return 'AD';
  if (v.includes('AKAKI')) return 'AK';
  if (v.includes('ARADA')) return 'AR';
  if (v.includes('GERD') || v.includes('SHOLA')) return 'GS';
  if (v.includes('GULLELE') || v.includes('GULELE')) return 'GU';
  if (v.includes('KALITY') || v.includes('KOTEBE') || v.includes('KOTTEBE')) return 'KO';
  if (v.includes('LIDETA')) return 'LK';
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
  const session = await getSession();
  if (!session || !session.id) throw new Error('Unauthorized');

  const perms = session.permissions || [];
  const role = (session.role || '').toLowerCase().trim();
  const isAdmin = role === 'admin' || role === 'system administrator' || role === 'super admin'
    || perms.includes('*') || perms.includes('all') || perms.includes('admin');

  const canView = isAdmin
    || perms.includes(PERMISSIONS.REPORTS_GENERATE_ALL)
    || perms.includes(PERMISSIONS.REPORTS_GENERATE_BRANCH)
    || perms.includes(PERMISSIONS.REPORT_GL_MONTHLY_SUMMARY_BY_CODE)
    || perms.includes(PERMISSIONS.REPORT_GL_FINANCE_MONTHLY)
    || perms.includes(PERMISSIONS.REPORT_GL_FINANCE_YEARLY)
    || perms.includes(PERMISSIONS.BILL_VIEW_ALL);

  if (!canView) throw new Error('Forbidden: Missing GL report permissions');

  const isLockedToBranch = !isAdmin && !perms.includes(PERMISSIONS.REPORTS_GENERATE_ALL);
  const lockedBranchId = isLockedToBranch ? (session.branchId || null) : null;

  return { session, isAdmin, isLockedToBranch, lockedBranchId };
}

/**
 * Fetch high-performance GL Summary and Component Matrix along with KPIs.
 */
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
}) {
  try {
    const auth = await authorizeGLReport();
    const effectiveBranchId = auth.lockedBranchId || (params.branchId && params.branchId !== 'all' ? params.branchId : null);
    const isYearly = params.periodType === 'yearly';

    // Build SQL with joins to bulk_meters, individual_customers, and branches
    const whereClauses: string[] = ['b.deleted_at IS NULL'];
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
        COALESCE(b."DRACCTNO", '') as dr_acct_no,
        COALESCE(b."CRACCTNO", '') as cr_acct_no,
        COALESCE(b.payment_status, 'Unpaid') as payment_status,
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

    // Aggregates
    const glSummaryMap: Record<string, GLSummaryRow> = {};
    const componentMatrixRows: GLComponentMatrixRow[] = [];
    const glCodeBreakdown: Record<string, { count: number; total: number; vat: number; name: string }> = {};

    let totalGrossBilled = 0;
    let totalNetRevenue = 0;
    let totalVat = 0;
    let totalAnomalies = 0;
    let totalCleanBills = 0;

    for (const b of bills) {
      const rawMonth = (b.month_year || '').substring(0, 7) || '2026-10';
      const billYear = (b.month_year || '').substring(0, 4) || '2026';
      const periodStr = isYearly ? billYear : formatPeriod(rawMonth);
      const rawPeriod = isYearly ? billYear : rawMonth;
      const rawBranchName = b.branch_name || 'Addis Ababa';
      const branchCode = getBranchCode(rawBranchName);

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
      const additional = Number(b.additional_fees_charge || 0) + Number(b.penalty_amt || 0);
      const vat = Number(b.vat_amount || 0);
      const thisMonth = Number(b.this_month_bill_amt || 0);
      const total = Number(b.total_bill_amount || 0);

      // If no component breakdown stored, treat thisMonth-vat as base water (to avoid false mismatch)
      if (baseWater === 0 && thisMonth > 0 && sewerage === 0 && sanitation === 0 && meterRent === 0 && maintenance === 0) {
        baseWater = Math.max(0, thisMonth - vat);
      }

      // Audit checks
      // IMPORTANT: THISMONTHBILLAMT includes VAT, so we must compare (componentSum + vat) vs thisMonth.
      // Tolerance of 0.50 ETB covers legitimate floating-point rounding across charge components.
      const componentSum = baseWater + sewerage + sanitation + meterRent + maintenance + additional;
      const componentSumWithVat = componentSum + vat;
      const isMathMismatch = thisMonth > 0 && Math.abs(componentSumWithVat - thisMonth) > 0.50;
      // isMissingDrCr is a config-level gap (DR/CR accounts not set up system-wide).
      // It is shown in the Anomaly Inspector but does NOT affect the KPI Audit Health score.
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

      // Use thisMonth (THISMONTHBILLAMT) for GL revenue — this is the current-period charge.
      // TOTALBILLAMOUNT = THISMONTHBILLAMT + OUTSTANDINGAMT (prior-period carryover).
      // GL revenue should only recognise new charges, not re-post already-recognized outstanding.
      totalGrossBilled += thisMonth;
      totalNetRevenue  += (thisMonth - vat);
      totalVat         += vat;

      // Component Matrix Row
      componentMatrixRows.push({
        period: periodStr,
        rawPeriod,
        customerKey: b.CUSTOMERKEY || b.individual_customer_id || b.BILLKEY || 'N/A',
        customerName: b.customer_name || 'N/A',
        branchName: rawBranchName,
        branchCode,
        chargeGroup: cGroup,
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

      // Helper to add into GL summary map
      const addGlItem = (code: string, amount: number, vatAmt: number = 0) => {
        if (amount <= 0 && vatAmt <= 0) return;
        if (params.glCode && params.glCode !== 'all' && params.glCode !== code) return;

        const summaryKey = `${periodStr}|${branchCode}|${cGroup}|${code}`;
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
            count: 0,
            totalAmount: 0,
            vatAmount: 0,
            withoutVat: 0,
            anomalyCount: 0,
            cleanCount: 0,
            auditStatus: 'Clean',
          };
        }

        glSummaryMap[summaryKey].count += 1;
        glSummaryMap[summaryKey].totalAmount += (amount + vatAmt);
        glSummaryMap[summaryKey].vatAmount += vatAmt;
        glSummaryMap[summaryKey].withoutVat += amount;

        if (hasAnomaly) {
          glSummaryMap[summaryKey].anomalyCount += 1;
          glSummaryMap[summaryKey].auditStatus = (isMathMismatch || isNegative) ? 'Error' : 'Warning';
        } else {
          glSummaryMap[summaryKey].cleanCount += 1;
        }

        // Breakdown tracker
        if (!glCodeBreakdown[code]) {
          glCodeBreakdown[code] = { count: 0, total: 0, vat: 0, name: GL_NAMES[code] || code };
        }
        glCodeBreakdown[code].count += 1;
        glCodeBreakdown[code].total += (amount + vatAmt);
        glCodeBreakdown[code].vat += vatAmt;
      };

      addGlItem(baseWaterGl, baseWater, vat);
      addGlItem('SEWERGL', sewerage, 0);
      addGlItem('SNTGL', sanitation, 0);
      addGlItem('MTRRNTGL', meterRent, 0);
      addGlItem('MNTGL', maintenance, 0);
      addGlItem('FIREGL', additional, 0);
    }

    // Format summary rows
    const summaryRows: GLSummaryRow[] = Object.values(glSummaryMap)
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
        const cg = String(a.chargeGroup || '').localeCompare(String(b.chargeGroup || ''));
        if (cg !== 0) return cg;
        return String(a.glCode || '').localeCompare(String(b.glCode || ''));
      });

    const kpis: GLKPIs = {
      totalGrossBilled: parseFloat(totalGrossBilled.toFixed(2)),
      totalNetRevenue: parseFloat(totalNetRevenue.toFixed(2)),
      totalVat: parseFloat(totalVat.toFixed(2)),
      totalAuditedBills: bills.length,
      totalCleanBills,
      totalAnomalies,
      glCodeBreakdown,
    };

    return {
      success: true,
      kpis,
      summaryRows,
      componentMatrixRows: componentMatrixRows.slice(0, 500), // top 500 for UI responsiveness
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
  searchTerm?: string;
  auditFilter?: 'all' | 'clean' | 'flagged';
  page?: number;
  limit?: number;
}) {
  try {
    const auth = await authorizeGLReport();
    const page = params.page || 0;
    const limit = params.limit || 20;

    const whereClauses: string[] = ['b.deleted_at IS NULL'];
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
        COALESCE(b."OUTSTANDINGAMT", 0)::numeric as outstanding_amt,
        COALESCE(b."TOTALBILLAMOUNT", 0)::numeric as total_bill_amount,
        COALESCE(b."DRACCTNO", '') as dr_acct_no,
        COALESCE(b."CRACCTNO", '') as cr_acct_no,
        COALESCE(b.payment_status, 'Unpaid') as payment_status,
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
      const baseWater = Number(b.base_water_charge || 0);
      const sewerage = Number(b.sewerage_charge || 0);
      const sanitation = Number(b.sanitation_fee || 0);
      const meterRent = Number(b.meter_rent || 0);
      const maintenance = Number(b.maintenance_fee || 0);
      const additional = Number(b.additional_fees_charge || 0) + Number(b.penalty_amt || 0);
      const vat = Number(b.vat_amount || 0);
      const thisMonth = Number(b.this_month_bill_amt || 0);
      const total = Number(b.total_bill_amount || 0);

      if (params.glCode && params.glCode !== 'all') {
        let hasCharge = false;
        if (params.glCode === baseWaterGl && baseWater > 0) hasCharge = true;
        if (params.glCode === 'SEWERGL' && sewerage > 0) hasCharge = true;
        if (params.glCode === 'SNTGL' && sanitation > 0) hasCharge = true;
        if (params.glCode === 'MTRRNTGL' && meterRent > 0) hasCharge = true;
        if (params.glCode === 'MNTGL' && maintenance > 0) hasCharge = true;
        if (params.glCode === 'FIREGL' && additional > 0) hasCharge = true;

        if (!hasCharge) continue;
      }

      // Audit checks
      // THISMONTHBILLAMT includes VAT — compare componentSum+vat vs thisMonth
      const auditFlags: string[] = [];
      const componentSum = baseWater + sewerage + sanitation + meterRent + maintenance + additional;
      const componentSumWithVat = componentSum + vat;
      const diff = thisMonth > 0 ? Math.abs(componentSumWithVat - thisMonth) : 0;
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
}) {
  try {
    const auth = await authorizeGLReport();
    const effectiveBranchId = auth.lockedBranchId || (params.branchId && params.branchId !== 'all' ? params.branchId : null);
    const isYearly = params.periodType === 'yearly';

    const whereClauses: string[] = ['b.deleted_at IS NULL'];
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

      const baseWater = Number(b.base_water_charge || 0);
      const sewerage = Number(b.sewerage_charge || 0);
      const sanitation = Number(b.sanitation_fee || 0);
      const meterRent = Number(b.meter_rent || 0);
      const maintenance = Number(b.maintenance_fee || 0);
      const additional = Number(b.additional_fees_charge || 0) + Number(b.penalty_amt || 0);
      const vat = Number(b.vat_amount || 0);
      const thisMonth = Number(b.this_month_bill_amt || 0);
      const total = Number(b.total_bill_amount || 0);

      // THISMONTHBILLAMT includes VAT — compare (componentSum + vat) vs thisMonth
      const componentSum = baseWater + sewerage + sanitation + meterRent + maintenance + additional;
      const componentSumWithVat = componentSum + vat;
      const mathDiff = thisMonth > 0 ? Math.abs(componentSumWithVat - thisMonth) : 0;

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
