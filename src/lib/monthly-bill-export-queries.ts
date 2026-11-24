import { query } from './db';

// ============================================================================
// Monthly Bill Export (CSV / XLSX) Reports
// ============================================================================

export interface MonthlyBillExportRow {
    BILLKEY: string;
    CUSTOMERKEY: string;
    CUSTOMERNAME: string;
    CUSTOMERTIN: string;
    CUSTOMERBRANCH: string;
    REASON: string;
    CURRREAD: number;
    PREVREAD: number;
    CONS: number;
    TOTALBILLAMOUNT: number;
    THISMONTHBILLAMT: number;
    OUTSTANDINGAMT: number;
    PENALTYAMT: number;
    VAT_AMOUNT: number;
    DRACCTNO: string;
    CRACCTNO: string;
    id: string;
    status: string;
    payment_status: string;
    charge_group: string;
    month_year: string;
}

export interface MonthlyBillExportTotals {
    totalBills: number;
    totalAmount: number;
    totalThisMonth: number;
    totalOutstanding: number;
    totalPenalty: number;
    totalVat: number;
}

function buildMonthlyBillExportWhere(params: {
    branchId?: string;
    monthYear?: string;
    chargeGroup?: string;
    searchTerm?: string;
}) {
    let whereSql = ` WHERE b.deleted_at IS NULL`;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.branchId && params.branchId !== 'all') {
        whereSql += ` AND (
            COALESCE(br.id::text, b.branch_id::text, '') ILIKE $${paramIndex}
            OR br.id::text ILIKE $${paramIndex}
            OR b.branch_id::text ILIKE $${paramIndex}
            OR c.branch_id::text ILIKE $${paramIndex}
            OR bm.branch_id::text ILIKE $${paramIndex}
            OR COALESCE(br.name, b."CUSTOMERBRANCH", '') ILIKE $${paramIndex}
            OR br.name ILIKE $${paramIndex}
            OR b."CUSTOMERBRANCH" ILIKE $${paramIndex}
        )`;
        queryParams.push(params.branchId);
        paramIndex++;
    }

    if (params.monthYear && params.monthYear !== 'all') {
        whereSql += ` AND b.month_year = $${paramIndex++}`;
        queryParams.push(params.monthYear);
    }

    if (params.chargeGroup && params.chargeGroup !== 'all') {
        whereSql += ` AND COALESCE(bm.charge_group, c."customerType", 'Domestic') ILIKE $${paramIndex++}`;
        queryParams.push(params.chargeGroup);
    }

    if (params.searchTerm && params.searchTerm.trim() !== '') {
        const term = `%${params.searchTerm.trim()}%`;
        whereSql += ` AND (
            b."BILLKEY" ILIKE $${paramIndex}
            OR b."CUSTOMERKEY" ILIKE $${paramIndex}
            OR b.individual_customer_id ILIKE $${paramIndex}
            OR COALESCE(b."CUSTOMERNAME", bm.name, c.name, '') ILIKE $${paramIndex}
            OR COALESCE(b."CUSTOMERTIN", bm."contractNumber", c."contractNumber", '') ILIKE $${paramIndex}
            OR COALESCE(br.name, b."CUSTOMERBRANCH", '') ILIKE $${paramIndex}
        )`;
        queryParams.push(term);
        paramIndex++;
    }

    return { whereSql, queryParams, paramIndex };
}

export const dbGetMonthlyBillExportPaginated = async (params: {
    limit: number;
    offset: number;
    branchId?: string;
    monthYear?: string;
    chargeGroup?: string;
    searchTerm?: string;
}): Promise<{ rows: MonthlyBillExportRow[]; total: number; totals: MonthlyBillExportTotals }> => {
    const { whereSql, queryParams, paramIndex } = buildMonthlyBillExportWhere(params);

    const totalsSql = `
        SELECT 
            COUNT(*)::int AS total_bills,
            COALESCE(SUM(COALESCE(b."TOTALBILLAMOUNT", (COALESCE(b."THISMONTHBILLAMT", b.base_water_charge, 0) + COALESCE(b."OUTSTANDINGAMT", 0) + COALESCE(b."PENALTYAMT", 0)))::numeric), 0)::numeric AS total_amount,
            COALESCE(SUM(COALESCE(b."THISMONTHBILLAMT", b.base_water_charge, 0)::numeric), 0)::numeric AS total_this_month,
            COALESCE(SUM(COALESCE(b."OUTSTANDINGAMT", 0)::numeric), 0)::numeric AS total_outstanding,
            COALESCE(SUM(COALESCE(b."PENALTYAMT", 0)::numeric), 0)::numeric AS total_penalty,
            COALESCE(SUM(COALESCE(b.vat_amount, 0)::numeric), 0)::numeric AS total_vat
        FROM bills b
        LEFT JOIN bulk_meters bm ON (b."CUSTOMERKEY" = bm."customerKeyNumber" OR b.individual_customer_id = bm."customerKeyNumber")
        LEFT JOIN individual_customers c ON (b.individual_customer_id = c."customerKeyNumber" OR b."CUSTOMERKEY" = c."customerKeyNumber")
        LEFT JOIN branches br ON COALESCE(b.branch_id, bm.branch_id, c.branch_id) = br.id
        ${whereSql}
    `;

    const dataSql = `
        SELECT 
            COALESCE(
                NULLIF(b."BILLKEY", ''),
                CONCAT('BBPT-', LPAD(RIGHT(REPLACE(b.id::text, '-', ''), 8), 10, '0') )
            ) AS "BILLKEY",
            COALESCE(b."CUSTOMERKEY", b.individual_customer_id, '') AS "CUSTOMERKEY",
            COALESCE(b."CUSTOMERNAME", bm.name, c.name, 'N/A') AS "CUSTOMERNAME",
            COALESCE(b."CUSTOMERTIN", bm."contractNumber", c."contractNumber", '') AS "CUSTOMERTIN",
            COALESCE(br.name, b."CUSTOMERBRANCH", 'Head Office') AS "CUSTOMERBRANCH",
            CASE 
                WHEN b.month_year ~ '^[0-9]{4}-[0-9]{2}$' 
                THEN TO_CHAR(TO_DATE(b.month_year, 'YYYY-MM'), 'Mon-YYYY')
                ELSE COALESCE(b.month_year, b."REASON", '')
            END AS "REASON",
            COALESCE(b."CURRREAD", 0)::numeric AS "CURRREAD",
            COALESCE(b."PREVREAD", 0)::numeric AS "PREVREAD",
            COALESCE(b."CONS", 0)::numeric AS "CONS",
            COALESCE(b."TOTALBILLAMOUNT", (COALESCE(b."THISMONTHBILLAMT", b.base_water_charge, 0) + COALESCE(b."OUTSTANDINGAMT", 0) + COALESCE(b."PENALTYAMT", 0)))::numeric AS "TOTALBILLAMOUNT",
            COALESCE(b."THISMONTHBILLAMT", b.base_water_charge, 0)::numeric AS "THISMONTHBILLAMT",
            COALESCE(b."OUTSTANDINGAMT", 0)::numeric AS "OUTSTANDINGAMT",
            COALESCE(b."PENALTYAMT", 0)::numeric AS "PENALTYAMT",
            COALESCE(b.vat_amount, 0)::numeric AS "VAT_AMOUNT",
            COALESCE(b."DRACCTNO", '') AS "DRACCTNO",
            COALESCE(b."CRACCTNO", '') AS "CRACCTNO",
            b.id::text AS id,
            COALESCE(b.status, 'Draft') AS status,
            COALESCE(b.payment_status, 'Unpaid') AS payment_status,
            COALESCE(bm.charge_group, c."customerType", 'Domestic') AS charge_group,
            COALESCE(b.month_year, '') AS month_year
        FROM bills b
        LEFT JOIN bulk_meters bm ON (b."CUSTOMERKEY" = bm."customerKeyNumber" OR b.individual_customer_id = bm."customerKeyNumber")
        LEFT JOIN individual_customers c ON (b.individual_customer_id = c."customerKeyNumber" OR b."CUSTOMERKEY" = c."customerKeyNumber")
        LEFT JOIN branches br ON COALESCE(b.branch_id, bm.branch_id, c.branch_id) = br.id
        ${whereSql}
        ORDER BY b.created_at DESC, b.id DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...queryParams, params.limit, params.offset];

    const [totalsRows, dataRows]: [any, any] = await Promise.all([
        query(totalsSql, queryParams),
        query(dataSql, dataParams),
    ]);

    const totalRow = (totalsRows && totalsRows[0]) || {};
    const total = Number(totalRow.total_bills || 0);

    const totals: MonthlyBillExportTotals = {
        totalBills: total,
        totalAmount: Number(totalRow.total_amount || 0),
        totalThisMonth: Number(totalRow.total_this_month || 0),
        totalOutstanding: Number(totalRow.total_outstanding || 0),
        totalPenalty: Number(totalRow.total_penalty || 0),
        totalVat: Number(totalRow.total_vat || 0),
    };

    const rows: MonthlyBillExportRow[] = (dataRows || []).map((r: any) => ({
        BILLKEY: String(r.BILLKEY || ''),
        CUSTOMERKEY: String(r.CUSTOMERKEY || ''),
        CUSTOMERNAME: String(r.CUSTOMERNAME || ''),
        CUSTOMERTIN: '',
        CUSTOMERBRANCH: String(r.CUSTOMERBRANCH || ''),
        REASON: String(r.REASON || ''),
        CURRREAD: Number(r.CURRREAD || 0),
        PREVREAD: Number(r.PREVREAD || 0),
        CONS: Number(r.CONS || 0),
        TOTALBILLAMOUNT: Number(r.TOTALBILLAMOUNT || 0),
        THISMONTHBILLAMT: Number(r.THISMONTHBILLAMT || 0),
        OUTSTANDINGAMT: Number(r.OUTSTANDINGAMT || 0),
        PENALTYAMT: Number(r.PENALTYAMT || 0),
        VAT_AMOUNT: Number(r.VAT_AMOUNT || 0),
        DRACCTNO: String(r.DRACCTNO || ''),
        CRACCTNO: String(r.CRACCTNO || ''),
        id: String(r.id || ''),
        status: String(r.status || ''),
        payment_status: String(r.payment_status || ''),
        charge_group: String(r.charge_group || ''),
        month_year: String(r.month_year || ''),
    }));

    return { rows, total, totals };
};

export const dbGetMonthlyBillExportAll = async (params: {
    branchId?: string;
    monthYear?: string;
    chargeGroup?: string;
    searchTerm?: string;
    limit?: number;
}): Promise<MonthlyBillExportRow[]> => {
    const { whereSql, queryParams, paramIndex } = buildMonthlyBillExportWhere(params);
    const maxLimit = params.limit ?? 50000;

    const dataSql = `
        SELECT 
            COALESCE(
                NULLIF(b."BILLKEY", ''),
                CONCAT('BBPT-', LPAD(RIGHT(REPLACE(b.id::text, '-', ''), 8), 10, '0') )
            ) AS "BILLKEY",
            COALESCE(b."CUSTOMERKEY", b.individual_customer_id, '') AS "CUSTOMERKEY",
            COALESCE(b."CUSTOMERNAME", bm.name, c.name, 'N/A') AS "CUSTOMERNAME",
            COALESCE(b."CUSTOMERTIN", bm."contractNumber", c."contractNumber", '') AS "CUSTOMERTIN",
            COALESCE(br.name, b."CUSTOMERBRANCH", 'Head Office') AS "CUSTOMERBRANCH",
            CASE 
                WHEN b.month_year ~ '^[0-9]{4}-[0-9]{2}$' 
                THEN TO_CHAR(TO_DATE(b.month_year, 'YYYY-MM'), 'Mon-YYYY')
                ELSE COALESCE(b.month_year, b."REASON", '')
            END AS "REASON",
            COALESCE(b."CURRREAD", 0)::numeric AS "CURRREAD",
            COALESCE(b."PREVREAD", 0)::numeric AS "PREVREAD",
            COALESCE(b."CONS", 0)::numeric AS "CONS",
            COALESCE(b."TOTALBILLAMOUNT", (COALESCE(b."THISMONTHBILLAMT", b.base_water_charge, 0) + COALESCE(b."OUTSTANDINGAMT", 0) + COALESCE(b."PENALTYAMT", 0)))::numeric AS "TOTALBILLAMOUNT",
            COALESCE(b."THISMONTHBILLAMT", b.base_water_charge, 0)::numeric AS "THISMONTHBILLAMT",
            COALESCE(b."OUTSTANDINGAMT", 0)::numeric AS "OUTSTANDINGAMT",
            COALESCE(b."PENALTYAMT", 0)::numeric AS "PENALTYAMT",
            COALESCE(b.vat_amount, 0)::numeric AS "VAT_AMOUNT",
            COALESCE(b."DRACCTNO", '') AS "DRACCTNO",
            COALESCE(b."CRACCTNO", '') AS "CRACCTNO",
            b.id::text AS id,
            COALESCE(b.status, 'Draft') AS status,
            COALESCE(b.payment_status, 'Unpaid') AS payment_status,
            COALESCE(bm.charge_group, c."customerType", 'Domestic') AS charge_group,
            COALESCE(b.month_year, '') AS month_year
        FROM bills b
        LEFT JOIN bulk_meters bm ON (b."CUSTOMERKEY" = bm."customerKeyNumber" OR b.individual_customer_id = bm."customerKeyNumber")
        LEFT JOIN individual_customers c ON (b.individual_customer_id = c."customerKeyNumber" OR b."CUSTOMERKEY" = c."customerKeyNumber")
        LEFT JOIN branches br ON COALESCE(b.branch_id, bm.branch_id, c.branch_id) = br.id
        ${whereSql}
        ORDER BY b.created_at DESC, b.id DESC
        LIMIT $${paramIndex}
    `;

    const dataRows: any = await query(dataSql, [...queryParams, maxLimit]);

    return (dataRows || []).map((r: any) => ({
        BILLKEY: String(r.BILLKEY || ''),
        CUSTOMERKEY: String(r.CUSTOMERKEY || ''),
        CUSTOMERNAME: String(r.CUSTOMERNAME || ''),
        CUSTOMERTIN: '',
        CUSTOMERBRANCH: String(r.CUSTOMERBRANCH || ''),
        REASON: String(r.REASON || ''),
        CURRREAD: Number(r.CURRREAD || 0),
        PREVREAD: Number(r.PREVREAD || 0),
        CONS: Number(r.CONS || 0),
        TOTALBILLAMOUNT: Number(r.TOTALBILLAMOUNT || 0),
        THISMONTHBILLAMT: Number(r.THISMONTHBILLAMT || 0),
        OUTSTANDINGAMT: Number(r.OUTSTANDINGAMT || 0),
        PENALTYAMT: Number(r.PENALTYAMT || 0),
        VAT_AMOUNT: Number(r.VAT_AMOUNT || 0),
        DRACCTNO: String(r.DRACCTNO || ''),
        CRACCTNO: String(r.CRACCTNO || ''),
        id: String(r.id || ''),
        status: String(r.status || ''),
        payment_status: String(r.payment_status || ''),
        charge_group: String(r.charge_group || ''),
        month_year: String(r.month_year || ''),
    }));
};
