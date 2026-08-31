import { query, withTransaction } from './db';
import { randomUUID } from 'crypto';
import { buildUserSessionsFilters, USER_SESSION_STATUS_SQL } from './session-monitoring';
import { computeCreditForBill, roundMoney, type ComputeCreditForBillOutput } from './credit-utils';

// Postgres-backed implementations for common DB operations.
// These functions keep `any` shapes to match the existing codebase.

export const dbGetSpatialRecord = async (entityId: string, entityType: 'individual_customer' | 'bulk_meter') => {
    const sql = 'SELECT * FROM spatial_records WHERE entity_id = $1 AND entity_type = $2';
    const rows: any = await query(sql, [entityId, entityType]);
    return rows[0] ?? null;
};

export const dbUpsertSpatialRecord = async (entityId: string, entityType: 'individual_customer' | 'bulk_meter', data: any, client?: any) => {
    const { xCoordinate, yCoordinate, zCoordinate } = data;
    const qFunc = client ? client.query.bind(client) : query;
    
    // Check if exists
    const checkSql = 'SELECT id FROM spatial_records WHERE entity_id = $1 AND entity_type = $2';
    const checkRes = await qFunc(checkSql, [entityId, entityType]);
    const rows = client ? checkRes.rows : checkRes;
    const existing = rows[0];

    if (existing) {
        const updateSql = `
            UPDATE spatial_records 
            SET x_coordinate = $1, y_coordinate = $2, z_coordinate = $3, updated_at = NOW() 
            WHERE id = $4 
            RETURNING *
        `;
        const res = await qFunc(updateSql, [xCoordinate, yCoordinate, zCoordinate, existing.id]);
        return (client ? res.rows : res)[0];
    } else {
        const insertSql = `
            INSERT INTO spatial_records (entity_id, entity_type, x_coordinate, y_coordinate, z_coordinate) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *
        `;
        const res = await qFunc(insertSql, [entityId, entityType, xCoordinate, yCoordinate, zCoordinate]);
        return (client ? res.rows : res)[0];
    }
};

export const dbGetSystemSetting = async (key: string) => {
    const sql = 'SELECT value FROM system_settings WHERE key = $1';
    const rows: any = await query(sql, [key]);
    return rows[0]?.value ?? null;
};

export const dbUpdateSystemSetting = async (key: string, value: string) => {
    const sql = `
        INSERT INTO system_settings (key, value, updated_at) 
        VALUES ($1, $2, NOW()) 
        ON CONFLICT (key) 
        DO UPDATE SET value = $2, updated_at = NOW() 
        RETURNING *
    `;
    const rows: any = await query(sql, [key, value]);
    return rows[0];
};

export const dbGetSessionSetting = async (key: string) => {
    const sql = 'SELECT value FROM system_settings WHERE key = $1';
    const rows: any = await query(sql, [key]);
    return rows[0]?.value ?? null;
};

export const dbGetSessionSettings = async () => {
    const sql = `
        SELECT
            session_duration_seconds,
            warning_before_expiry_seconds
        FROM session_settings
        ORDER BY id DESC
        LIMIT 1
    `;
    const rows: any = await query(sql);
    const row = rows[0] ?? null;
    
    const sysDuration = await dbGetSessionSetting('session_duration_seconds');
    const sysWarning = await dbGetSessionSetting('session_warning_seconds');

    return {
        session_duration_seconds: row?.session_duration_seconds != null 
            ? String(row.session_duration_seconds) 
            : (sysDuration ?? undefined),
        session_warning_seconds: row?.warning_before_expiry_seconds != null 
            ? String(row.warning_before_expiry_seconds) 
            : (sysWarning ?? undefined),
    } as Record<string, string>;
};

export const dbUpdateSessionSettings = async (durationSeconds: string, warningSeconds: string) => {
    const duration = Number(durationSeconds);
    const warning = Number(warningSeconds);
    const sql = `
        WITH updated AS (
          UPDATE session_settings
          SET session_duration_seconds = $1,
              warning_before_expiry_seconds = $2,
              updated_at = NOW()
          WHERE id = (SELECT id FROM session_settings ORDER BY id DESC LIMIT 1)
          RETURNING *
        )
        INSERT INTO session_settings (session_duration_seconds, warning_before_expiry_seconds)
        SELECT $1, $2
        WHERE NOT EXISTS (SELECT 1 FROM updated)
        RETURNING *
    `;
    const finalDuration = String(isNaN(duration) ? 7200 : duration);
    const finalWarning = String(isNaN(warning) ? 120 : warning);

    const rows: any = await query(sql, [Number(finalDuration), Number(finalWarning)]);

    // Also update system_settings table so both tables stay in sync
    await dbUpdateSystemSetting('session_duration_seconds', finalDuration);
    await dbUpdateSystemSetting('session_warning_seconds', finalWarning);

    return rows[0];
};

export const getStaffMemberForAuth = async (email: string, password?: string) => {
    let sql = `
        SELECT
            sm.*,
            r.role_name,
            STRING_AGG(p.name, ',') AS permissions
        FROM
            staff_members sm
        LEFT JOIN
            roles r ON (sm.role_id = r.id OR LOWER(r.role_name) = LOWER(sm.role))
        LEFT JOIN
            role_permissions rp ON r.id = rp.role_id
        LEFT JOIN
            permissions p ON rp.permission_id = p.id
        WHERE
            LOWER(TRIM(sm.email)) = LOWER(TRIM($1))
    `;

    const params = [email];

    if (password) {
        sql += ' AND sm.password = $2';
        params.push(password);
    }

    sql += ' GROUP BY sm.id, r.role_name';

    const rows: any = await query(sql, params);

    if (rows && rows[0]) {
        const user = rows[0];
        if (user.permissions) {
            user.permissions = user.permissions.split(',');
        } else {
            user.permissions = [];
        }
        return user;
    }
    return null;
};

export const dbGetStaffPermissions = async (staffId: string) => {
    const sql = `
        SELECT
            STRING_AGG(DISTINCT p.name, ',') AS permissions
        FROM
            staff_members sm
        LEFT JOIN
            roles r ON (sm.role_id = r.id OR LOWER(r.role_name) = LOWER(sm.role))
        LEFT JOIN
            role_permissions rp ON r.id = rp.role_id
        LEFT JOIN
            permissions p ON rp.permission_id = p.id
        WHERE
            sm.id = $1
    `;
    const rows: any = await query(sql, [staffId]);
    if (rows && rows[0] && rows[0].permissions) {
        return rows[0].permissions.split(',');
    }
    return [];
};

export const dbGetAllBranches = async () => {
    return await query('SELECT * FROM branches WHERE deleted_at IS NULL');
};

export const dbCreateBranch = async (branch: any) => {
    try {
        const cleanBranch = { ...branch };
        delete cleanBranch.created_at;
        delete cleanBranch.updated_at;
        const keys = Object.keys(cleanBranch);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
        const sql = `INSERT INTO branches (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
        const rows: any = await query(sql, keys.map(k => cleanBranch[k]));
        return rows[0] || cleanBranch;
    } catch (error) {
        console.error('dbCreateBranch error:', error);
        throw error;
    }
};

export const dbUpdateBranch = async (id: string, branch: any) => {
    const cleanBranch = { ...branch };
    delete cleanBranch.created_at;
    delete cleanBranch.updated_at;
    const keys = Object.keys(cleanBranch);
    if (keys.length === 0) return null;
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE branches SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => cleanBranch[k]), id]);
    return rows[0] ?? null;
};

export const dbDeleteBranch = async (id: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const branchRes = await client.query('SELECT * FROM branches WHERE id = $1', [id]);
        const branch = branchRes.rows[0];
        if (!branch) return false;

        await client.query('UPDATE branches SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['branch', id, branch.name, deletedBy, JSON.stringify(branch)]);
        return true;
    });
};

export const dbGetBranchById = async (id: string) => {
    const rows: any = await query('SELECT * FROM branches WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [id]);
    return rows[0] ?? null;
};

export const dbGetAllCustomers = async (options?: { branchId?: string; readerId?: string; limit?: number; offset?: number; searchTerm?: string; excludePending?: boolean; routeKey?: string; status?: string }) => {
    let sql = `
        SELECT ic.*, sr.x_coordinate, sr.y_coordinate, sr.z_coordinate 
        FROM individual_customers ic 
        LEFT JOIN branches b ON ic.branch_id = b.id
        LEFT JOIN spatial_records sr ON ic."customerKeyNumber" = sr.entity_id AND sr.entity_type = 'individual_customer'
        LEFT JOIN bulk_meters bm ON ic."assignedBulkMeterId" = bm."customerKeyNumber"
        LEFT JOIN routes r ON COALESCE(ic."ROUTE_KEY", bm."ROUTE_KEY") = r.route_key
        WHERE ic.deleted_at IS NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.branchId) {
        sql += ` AND ic.branch_id = $${paramIndex++}`;
        params.push(options.branchId);
    }

    if (options?.readerId) {
        sql += ` AND r.reader_id = $${paramIndex++}`;
        params.push(options.readerId);
    }

    if (options?.routeKey) {
        sql += ` AND (ic."ROUTE_KEY" = $${paramIndex} OR bm."ROUTE_KEY" = $${paramIndex})`;
        params.push(options.routeKey);
        paramIndex++;
    }

    if (options?.excludePending) {
        sql += " AND ic.status != 'Pending Approval'";
    }

    if (options?.status) {
        sql += ` AND ic.status = $${paramIndex++}`;
        params.push(options.status);
    }

    if (options?.searchTerm) {
        // Search by Name, Meter Key, Customer Key, or Branch Name (via join)
        sql += ` AND (ic.name ILIKE $${paramIndex} OR ic."METER_KEY" ILIKE $${paramIndex} OR ic."customerKeyNumber" ILIKE $${paramIndex} OR ic."contractNumber" ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
        params.push(`%${options.searchTerm}%`);
        paramIndex++;
    }

    sql += ' ORDER BY ic.created_at DESC';

    if (options?.limit) {
        sql += ` LIMIT $${paramIndex++}`;
        params.push(options.limit);
    }

    if (options?.offset) {
        sql += ` OFFSET $${paramIndex++}`;
        params.push(options.offset);
    }

    return await query(sql, params);
};

export const dbCountCustomers = async (options?: { branchId?: string; searchTerm?: string; excludePending?: boolean; status?: string }) => {
    let sql = 'SELECT COUNT(*) as total FROM individual_customers ic LEFT JOIN branches b ON ic.branch_id = b.id WHERE ic.deleted_at IS NULL';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.branchId) {
        sql += ` AND ic.branch_id = $${paramIndex++}`;
        params.push(options.branchId);
    }

    if (options?.excludePending) {
        sql += " AND ic.status != 'Pending Approval'";
    }

    if (options?.status) {
        sql += ` AND ic.status = $${paramIndex++}`;
        params.push(options.status);
    }

    if (options?.searchTerm) {
        // Search by Name, Meter Key, Customer Key, or Branch Name
        sql += ` AND (ic.name ILIKE $${paramIndex} OR ic."METER_KEY" ILIKE $${paramIndex} OR ic."customerKeyNumber" ILIKE $${paramIndex} OR ic."contractNumber" ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
        params.push(`%${options.searchTerm}%`);
        paramIndex++;
    }

    const rows: any = await query(sql, params);
    return parseInt(rows[0]?.total || '0', 10);
};

export const dbGetCustomersSummary = async (branchId?: string) => {
    let sql = "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'Active') as active FROM individual_customers WHERE deleted_at IS NULL";
    const params = [];
    if (branchId) {
        sql += ' AND branch_id = $1';
        params.push(branchId);
    }
    const rows: any = await query(sql, params);
    const total = parseInt(rows[0]?.total || '0', 10);
    const active = parseInt(rows[0]?.active || '0', 10);
    return {
        total,
        active,
        inactive: total - active
    };
};

export const dbGetCustomersByBulkMeterId = async (bulkMeterId: string) => {
    return await query('SELECT * FROM individual_customers WHERE "assignedBulkMeterId" = $1 AND deleted_at IS NULL', [bulkMeterId]);
};

/**
 * Batch version: fetch all individual customers for multiple bulk meter IDs in one query.
 * Returns a Map<bulkMeterId, customer[]> for O(1) lookups in the processing loop.
 */
export const dbGetCustomersByBulkMeterIds = async (bulkMeterIds: string[]): Promise<Map<string, any[]>> => {
    if (bulkMeterIds.length === 0) return new Map();
    const placeholders = bulkMeterIds.map((_, i) => `$${i + 1}`).join(',');
    const rows: any[] = await query(
        `SELECT * FROM individual_customers WHERE "assignedBulkMeterId" IN (${placeholders}) AND deleted_at IS NULL`,
        bulkMeterIds
    );
    const map = new Map<string, any[]>();
    for (const row of rows) {
        const key = row.assignedBulkMeterId;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(row);
    }
    return map;
};

/**
 * Batch version: fetch the most recent bills for multiple bulk meters in one query.
 * Returns a Map<customerKeyNumber, bill[]> for O(1) lookups.
 * Pass baseMonthYear (e.g. "2026-06") to enable PostgreSQL partition pruning;
 * the query will only scan the last 13 monthly partitions instead of all of them.
 */
export const dbGetBillsByBulkMeterIds = async (customerKeys: string[], baseMonthYear?: string): Promise<Map<string, any[]>> => {
    if (customerKeys.length === 0) return new Map();
    const placeholders = customerKeys.map((_, i) => `$${i + 1}`).join(',');

    // Build a list of the 13 most recent month_year values (current + 12 prior months)
    // so PostgreSQL can prune irrelevant partitions. Falls back to no filter if not provided.
    let monthFilter = '';
    const queryParams: any[] = [...customerKeys];
    if (baseMonthYear) {
        const [year, month] = baseMonthYear.split('-').map(Number);
        const monthValues: string[] = [];
        for (let i = 0; i < 13; i++) {
            const d = new Date(year, month - 1 - i, 1);
            monthValues.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        const monthPlaceholders = monthValues.map((_, i) => `$${customerKeys.length + i + 1}`).join(',');
        monthFilter = ` AND month_year IN (${monthPlaceholders})`;
        queryParams.push(...monthValues);
    }

    const rows: any[] = await query(
        `SELECT * FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY "CUSTOMERKEY" ORDER BY created_at DESC) as rn
            FROM bills
            WHERE "CUSTOMERKEY" IN (${placeholders})${monthFilter} AND deleted_at IS NULL
        ) t
        WHERE rn <= 12`,
        queryParams
    );
    const map = new Map<string, any[]>();
    for (const row of rows) {
        const key = row.CUSTOMERKEY;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(row);
    }
    return map;
};

/**
 * Batch version: fetch all bills for multiple individual customers in one query.
 * Returns a Map<individual_customer_id, bill[]> for O(1) lookups.
 * Pass baseMonthYear (e.g. "2026-06") to enable PostgreSQL partition pruning;
 * the query will only scan the last 13 monthly partitions instead of all of them.
 */
export const dbGetBillsByIndividualCustomerIds = async (customerKeys: string[], baseMonthYear?: string): Promise<Map<string, any[]>> => {
    if (customerKeys.length === 0) return new Map();
    const placeholders = customerKeys.map((_, i) => `$${i + 1}`).join(',');

    // Build a list of the 13 most recent month_year values for partition pruning.
    let monthFilter = '';
    const queryParams: any[] = [...customerKeys];
    if (baseMonthYear) {
        const [year, month] = baseMonthYear.split('-').map(Number);
        const monthValues: string[] = [];
        for (let i = 0; i < 13; i++) {
            const d = new Date(year, month - 1 - i, 1);
            monthValues.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        const monthPlaceholders = monthValues.map((_, i) => `$${customerKeys.length + i + 1}`).join(',');
        monthFilter = ` AND month_year IN (${monthPlaceholders})`;
        queryParams.push(...monthValues);
    }

    const rows: any[] = await query(
        `SELECT * FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY individual_customer_id ORDER BY created_at DESC) as rn
            FROM bills
            WHERE individual_customer_id IN (${placeholders})${monthFilter} AND deleted_at IS NULL
        ) t
        WHERE rn <= 12`,
        queryParams
    );
    const map = new Map<string, any[]>();
    for (const row of rows) {
        const key = row.individual_customer_id;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(row);
    }
    return map;
};

export const dbCreateIndividualCustomer = async (customer: any, client?: any) => {
    const cleanCust = { ...customer };
    // Map camelCase to DB column names
    if (cleanCust.meterNumber !== undefined) {
        cleanCust.METER_KEY = cleanCust.meterNumber;
        // Keep meterNumber for legacy if column still exists, but METER_KEY is primary
    }
    if (cleanCust.routeKey !== undefined) {
        cleanCust.ROUTE_KEY = cleanCust.routeKey;
        delete cleanCust.routeKey;
    }
    if (cleanCust.roundKey !== undefined) {
        cleanCust.ROUND_KEY = cleanCust.roundKey;
        delete cleanCust.roundKey;
    }
    if (cleanCust.phoneNumber !== undefined) {
        cleanCust.phone_number = cleanCust.phoneNumber;
        delete cleanCust.phoneNumber;
    }

    const keys = Object.keys(cleanCust);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO individual_customers (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const params = keys.map(k => cleanCust[k]);
    
    if (client) {
        const res = await client.query(sql, params);
        return res.rows[0] || cleanCust;
    }
    const rows: any = await query(sql, params);
    return rows[0] || cleanCust;
};

export const dbUpdateCustomer = async (customerKeyNumber: string, customer: any, client?: any) => {
    const keys = Object.keys(customer);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const sql = `UPDATE individual_customers SET ${setClause} WHERE "customerKeyNumber" = $${keys.length + 1} RETURNING *`;
    const params = [...keys.map(k => customer[k]), customerKeyNumber];
    
    if (client) {
        const res = await client.query(sql, params);
        return res.rows[0] ?? null;
    }
    const rows = await query(sql, params);
    return rows[0] ?? null;
};

export const dbDeleteCustomer = async (customerKeyNumber: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const custRes = await client.query('SELECT * FROM individual_customers WHERE "customerKeyNumber" = $1', [customerKeyNumber]);
        const customer = custRes.rows[0];
        if (!customer) return false;

        await client.query('UPDATE individual_customers SET deleted_at = now(), deleted_by = $2 WHERE "customerKeyNumber" = $1', [customerKeyNumber, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['customer', customerKeyNumber, customer.name, deletedBy, JSON.stringify(customer)]);
        return true;
    });
};

export const dbGetCustomerById = async (customerKeyNumber: string, client?: any) => {
    const qFunc = client ? client.query.bind(client) : query;
    const sql = `
        SELECT ic.*, sr.x_coordinate, sr.y_coordinate, sr.z_coordinate
        FROM individual_customers ic
        LEFT JOIN spatial_records sr ON ic."customerKeyNumber" = sr.entity_id AND sr.entity_type = 'individual_customer'
        WHERE LOWER(TRIM(ic."customerKeyNumber")) = LOWER(TRIM($1)) AND ic.deleted_at IS NULL
    `;
    const res = await qFunc(sql, [customerKeyNumber]);
    const rows = client ? res.rows : res;
    return rows[0] ?? null;
};

export const dbGetCustomersByBookNumber = async (bookNumber: string) => {
    return await query('SELECT * FROM individual_customers WHERE "bookNumber" = $1 AND status = \'Active\' AND deleted_at IS NULL', [bookNumber]);
};

export const dbGetAllBulkMeters = async (options?: { branchId?: string; readerId?: string; limit?: number; offset?: number; searchTerm?: string; excludePending?: boolean; routeKey?: string; status?: string }) => {
    let sql = `
        SELECT bm.*, b.name as branch_name, sr.x_coordinate, sr.y_coordinate, sr.z_coordinate
        FROM bulk_meters bm 
        LEFT JOIN branches b ON bm.branch_id = b.id 
        LEFT JOIN spatial_records sr ON bm."customerKeyNumber" = sr.entity_id AND sr.entity_type = 'bulk_meter'
        LEFT JOIN routes r ON bm."ROUTE_KEY" = r.route_key
        WHERE bm.deleted_at IS NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.branchId) {
        sql += ` AND bm.branch_id = $${paramIndex++}`;
        params.push(options.branchId);
    }

    if (options?.readerId) {
        sql += ` AND r.reader_id = $${paramIndex++}`;
        params.push(options.readerId);
    }

    if (options?.routeKey) {
        sql += ` AND bm."ROUTE_KEY" = $${paramIndex++}`;
        params.push(options.routeKey);
    }

    if (options?.excludePending) {
        sql += " AND bm.status != 'Pending Approval'";
    }

    if (options?.status) {
        sql += ` AND bm.status = $${paramIndex++}`;
        params.push(options.status);
    }

    if (options?.searchTerm) {
        // Search by Name, Meter Key, Customer Key, or Branch Name
        sql += ` AND (bm.name ILIKE $${paramIndex} OR bm."METER_KEY" ILIKE $${paramIndex} OR bm."customerKeyNumber" ILIKE $${paramIndex} OR bm."contractNumber" ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
        params.push(`%${options.searchTerm}%`);
        paramIndex++;
    }

    sql += ' ORDER BY bm."createdAt" DESC';

    if (options?.limit) {
        sql += ` LIMIT $${paramIndex++}`;
        params.push(options.limit);
    }

    if (options?.offset) {
        sql += ` OFFSET $${paramIndex++}`;
        params.push(options.offset);
    }

    return await query(sql, params);
};

export const dbCountBulkMeters = async (options?: { branchId?: string; searchTerm?: string; excludePending?: boolean; status?: string }) => {
    let sql = 'SELECT COUNT(*) as total FROM bulk_meters bm LEFT JOIN branches b ON bm.branch_id = b.id WHERE bm.deleted_at IS NULL';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.branchId) {
        sql += ` AND bm.branch_id = $${paramIndex++}`;
        params.push(options.branchId);
    }

    if (options?.excludePending) {
        sql += " AND bm.status != 'Pending Approval'";
    }

    if (options?.status) {
        sql += ` AND bm.status = $${paramIndex++}`;
        params.push(options.status);
    }

    if (options?.searchTerm) {
        // Search by Name, Meter Key, Customer Key, or Branch Name
        sql += ` AND (bm.name ILIKE $${paramIndex} OR bm."METER_KEY" ILIKE $${paramIndex} OR bm."customerKeyNumber" ILIKE $${paramIndex} OR bm."contractNumber" ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
        params.push(`%${options.searchTerm}%`);
        paramIndex++;
    }

    const rows: any = await query(sql, params);
    return parseInt(rows[0]?.total || '0', 10);
};

export const dbCreateBulkMeter = async (bulkMeter: any, client?: any) => {
    const cleanBm = { ...bulkMeter };
    // Map camelCase to DB column names 
    if (cleanBm.meterNumber !== undefined) {
        cleanBm.METER_KEY = cleanBm.meterNumber;
        // Keep meterNumber for legacy if column still exists, but METER_KEY is primary
    }
    if (cleanBm.routeKey !== undefined) {
        cleanBm.ROUTE_KEY = cleanBm.routeKey;
        delete cleanBm.routeKey;
    }
    if (cleanBm.roundKey !== undefined) {
        cleanBm.ROUND_KEY = cleanBm.roundKey;
        delete cleanBm.roundKey;
    }

    const keys = Object.keys(cleanBm);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO bulk_meters (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const params = keys.map(k => cleanBm[k]);
    
    if (client) {
        const res = await client.query(sql, params);
        return res.rows[0] || cleanBm;
    }
    const rows: any = await query(sql, params);
    return rows[0] || cleanBm;
};

export const dbGetBulkMeterById = async (customerKeyNumber: string, client?: any) => {
    const qFunc = client ? client.query.bind(client) : query;
    const sql = `
        SELECT bm.*, sr.x_coordinate, sr.y_coordinate, sr.z_coordinate
        FROM bulk_meters bm
        LEFT JOIN spatial_records sr ON bm."customerKeyNumber" = sr.entity_id AND sr.entity_type = 'bulk_meter'
        WHERE LOWER(TRIM(bm."customerKeyNumber")) = LOWER(TRIM($1)) AND bm.deleted_at IS NULL
    `;
    const res = await qFunc(sql, [customerKeyNumber]);
    const rows = client ? res.rows : res;
    return rows[0] ?? null;
};

export const dbUpdateBulkMeter = async (customerKeyNumber: string, bulkMeter: any, client?: any) => {
    const cleanBm = { ...bulkMeter };
    if (cleanBm.routeKey !== undefined) {
        cleanBm.ROUTE_KEY = cleanBm.routeKey;
        delete cleanBm.routeKey;
    }
    const keys = Object.keys(cleanBm);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const sql = `UPDATE bulk_meters SET ${setClause} WHERE "customerKeyNumber" = $${keys.length + 1} RETURNING *`;
    const params = [...keys.map(k => cleanBm[k]), customerKeyNumber];

    if (client) {
        const res = await client.query(sql, params);
        return res.rows[0] ?? null;
    }
    const rows = await query(sql, params);
    return rows[0] ?? null;
};

/**
 * Rollover: Move currentReading into previousReading for multiple bulk meters.
 */
export const dbBatchRolloverBulkMeters = async (customerKeyNumbers: string[], client?: any) => {
    if (customerKeyNumbers.length === 0) return;
    const placeholders = customerKeyNumbers.map((_, i) => `$${i + 1}`).join(',');
    const qFunc = client ? client.query.bind(client) : query;
    await qFunc(`UPDATE bulk_meters SET "previousReading" = "currentReading" WHERE "customerKeyNumber" IN (${placeholders})`, customerKeyNumbers);
};

/**
 * Rollover: Move currentReading into previousReading for all individual sub-meters of specified bulk meters.
 */
export const dbBatchRolloverIndividualCustomersOfBulkMeters = async (bulkMeterIds: string[], client?: any) => {
    if (bulkMeterIds.length === 0) return;
    const placeholders = bulkMeterIds.map((_, i) => `$${i + 1}`).join(',');
    const qFunc = client ? client.query.bind(client) : query;
    await qFunc(`UPDATE individual_customers SET "previousReading" = "currentReading" WHERE "assignedBulkMeterId" IN (${placeholders})`, bulkMeterIds);
};

/**
 * Rollover: Move currentReading into previousReading for multiple individual customers.
 */
export const dbBatchRolloverIndividualCustomers = async (customerKeyNumbers: string[], client?: any) => {
    if (customerKeyNumbers.length === 0) return;
    const placeholders = customerKeyNumbers.map((_, i) => `$${i + 1}`).join(',');
    const qFunc = client ? client.query.bind(client) : query;
    await qFunc(`UPDATE individual_customers SET "previousReading" = "currentReading" WHERE "customerKeyNumber" IN (${placeholders})`, customerKeyNumbers);
};


export const dbDeleteBulkMeter = async (customerKeyNumber: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const bmRes = await client.query('SELECT * FROM bulk_meters WHERE "customerKeyNumber" = $1', [customerKeyNumber]);
        const bm = bmRes.rows[0];
        if (!bm) return false;

        await client.query('UPDATE bulk_meters SET deleted_at = now(), deleted_by = $2 WHERE "customerKeyNumber" = $1', [customerKeyNumber, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['bulk_meter', customerKeyNumber, bm.name, deletedBy, JSON.stringify(bm)]);
        return true;
    });
};

export const dbGetBulkMetersSummary = async (branchId?: string) => {
    // Total includes everything not deleted. Active is just status='Active'.
    let sql = "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'Active') as active FROM bulk_meters WHERE deleted_at IS NULL";
    const params = [];
    if (branchId) {
        sql += ' AND branch_id = $1';
        params.push(branchId);
    }
    const rows: any = await query(sql, params);
    const total = parseInt(rows[0]?.total || '0', 10);
    const active = parseInt(rows[0]?.active || '0', 10);
    return {
        total,
        active,
        inactive: total - active
    };
};

export const dbGetAllStaffMembers = async (branchId?: string) => {
    if (branchId) {
        return await query(`
            SELECT s.*, r.role_name, b.name as branch_name 
            FROM staff_members s 
            LEFT JOIN roles r ON s.role_id = r.id
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE s.deleted_at IS NULL AND s.branch_id = $1
        `, [branchId]);
    }
    return await query(`
        SELECT s.*, r.role_name, b.name as branch_name 
        FROM staff_members s 
        LEFT JOIN roles r ON s.role_id = r.id
        LEFT JOIN branches b ON s.branch_id = b.id
        WHERE s.deleted_at IS NULL
    `);
};
export const dbCreateStaffMember = async (staffMember: any) => {
    const keys = Object.keys(staffMember);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO staff_members (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => staffMember[k]));
    return rows[0] || staffMember;
};

export const dbUpdateStaffMember = async (email: string, staffMember: any, branchId?: string) => {
    const keys = Object.keys(staffMember);
    if (keys.length === 0) return null;
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    
    let sql = `UPDATE staff_members SET ${setClause} WHERE LOWER(TRIM(email)) = LOWER(TRIM($${keys.length + 1}))`;
    const params = [...keys.map(k => staffMember[k]), email];
    
    if (branchId) {
        sql += ` AND branch_id = $${keys.length + 2}`;
        params.push(branchId);
    }
    
    sql += ' RETURNING *';
    const rows = await query(sql, params);
    return rows[0] ?? null;
};

export const dbDeleteStaffMember = async (email: string, deletedBy?: string, branchId?: string) => {
    return await withTransaction(async (client) => {
        let selectSql = 'SELECT * FROM staff_members WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))';
        const selectParams = [email];
        if (branchId) {
            selectSql += ' AND branch_id = $2';
            selectParams.push(branchId);
        }
        
        const staffRes = await client.query(selectSql, selectParams);
        const staff = staffRes.rows[0];
        if (!staff) return false;

        let deleteSql = 'UPDATE staff_members SET deleted_at = now(), deleted_by = $2 WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))';
        const deleteParams = [email, deletedBy];
        if (branchId) {
            deleteSql += ' AND branch_id = $3';
            deleteParams.push(branchId);
        }

        await client.query(deleteSql, deleteParams);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['staff', staff.id, staff.name, deletedBy, JSON.stringify(staff)]);
        return true;
    });
};

export const dbGetDistinctBillingMonths = async () => {
    return await query(`
      SELECT DISTINCT month_year FROM bills WHERE deleted_at IS NULL
      UNION
      SELECT DISTINCT month FROM bulk_meters
      ORDER BY month_year DESC
    `);
};

export const dbGetBillsByMonth = async (monthYear: string) => {
    return await query('SELECT * FROM bills WHERE month_year = $1', [monthYear]);
};

export const dbGetBillsByIndividualCustomerId = async (customerId: string) => {
    return await query('SELECT * FROM bills WHERE individual_customer_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC', [customerId]);
};


export const dbGetBillsWithBulkMeterInfoByMonth = async (monthYear: string, branchId?: string) => {
    if (branchId) {
        return await query(`
            SELECT b.*, bm.name, bm."phoneNumber", bm."contractNumber", bm."METER_KEY" as "meterNumber", bm."meterSize", bm."specificArea", bm."subCity", bm.woreda, bm.charge_group, bm.sewerage_connection
            FROM bills b
            LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
            WHERE b.month_year = $1 AND b.deleted_at IS NULL AND (b.branch_id = $2 OR bm.branch_id = $2)
            ORDER BY b.created_at DESC
        `, [monthYear, branchId]);
    }
    return await query(`
      SELECT b.*, bm.name, bm."phoneNumber", bm."contractNumber", bm."METER_KEY" as "meterNumber", bm."meterSize", bm."specificArea", bm."subCity", bm.woreda, bm.charge_group, bm.sewerage_connection
      FROM bills b
      LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
      WHERE b.month_year = $1 AND b.deleted_at IS NULL
      ORDER BY b.created_at DESC
    `, [monthYear]);
};

/**
 * Fetches the most recent bill (by month_year DESC, then created_at DESC) for each
 * of the given bulk meter customer keys, joined with bulk_meters for full meter info.
 */
export const dbGetMostRecentBillsForBulkMeters = async (customerKeys: string[], branchId?: string) => {
    if (customerKeys.length === 0) return [];
    const placeholders = customerKeys.map((_, i) => `$${i + 1}`).join(',');
    const queryStr = `
      SELECT DISTINCT ON (b."CUSTOMERKEY")
        b.*,
        bm.name,
        bm."phoneNumber",
        bm."contractNumber",
        bm."METER_KEY" as "meterNumber",
        bm."meterSize",
        bm."specificArea",
        bm."subCity",
        bm.woreda,
        bm.charge_group,
        bm.sewerage_connection,
        bm.branch_id,
        bm."approved_by",
        bm."approved_at"
      FROM bills b
      JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
      WHERE b."CUSTOMERKEY" IN (${placeholders})
      AND b.deleted_at IS NULL
      ${branchId ? `AND bm.branch_id = $${customerKeys.length + 1}` : ''}
      ORDER BY b."CUSTOMERKEY", b.month_year DESC, b.created_at DESC
    `;
    const params = branchId ? [...customerKeys, branchId] : customerKeys;
    return await query(queryStr, params);
};



export const dbGetAllBills = async (options?: { branchId?: string; readerId?: string; excludeUnfinalized?: boolean }) => {
    let sql = `
        SELECT b.*,
               ic."customerType" as customer_type,
               bm.charge_group as charge_group
        FROM bills b
        LEFT JOIN individual_customers ic ON b.individual_customer_id = ic."customerKeyNumber"
        LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
        LEFT JOIN routes r ON COALESCE(ic."ROUTE_KEY", bm."ROUTE_KEY") = r.route_key
    `;
    const params: any[] = [];
    let paramIndex = 1;

    const whereClauses = ['b.deleted_at IS NULL'];

    if (options?.readerId) {
        whereClauses.push(`r.reader_id = $${paramIndex}`);
        params.push(options.readerId);
        paramIndex++;
    }

    if (options?.branchId) {
        whereClauses.push(`(bm.branch_id = $${paramIndex} OR ic.branch_id = $${paramIndex})`);
        params.push(options.branchId);
        paramIndex++;
    }

    if (options?.excludeUnfinalized) {
        whereClauses.push("b.status = 'Posted'");
    }

    if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    return await query(sql, params);
};

export const dbGetBillsPaginated = async (options: {
    limit: number;
    offset: number;
    searchTerm?: string;
    branchId?: string;
    month?: string;
    status?: string;
    readerId?: string;
}) => {
    let sql = `
        SELECT b.*,
               ic."customerType" as customer_type,
               bm.charge_group as charge_group
        FROM bills b
        LEFT JOIN individual_customers ic ON b.individual_customer_id = ic."customerKeyNumber"
        LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
        LEFT JOIN routes r ON COALESCE(ic."ROUTE_KEY", bm."ROUTE_KEY") = r.route_key
    `;
    const params: any[] = [];
    let paramIndex = 1;
    const whereClauses = ['b.deleted_at IS NULL'];

    if (options.month && options.month !== 'all') {
        whereClauses.push(`b.month_year = $${paramIndex}`);
        params.push(options.month);
        paramIndex++;
    }

    if (options.status && options.status !== 'all') {
        whereClauses.push(`b.status = $${paramIndex}`);
        params.push(options.status);
        paramIndex++;
    }

    if (options.branchId && options.branchId !== 'all') {
        whereClauses.push(`(b.branch_id = $${paramIndex} OR bm.branch_id = $${paramIndex} OR ic.branch_id = $${paramIndex})`);
        params.push(options.branchId);
        paramIndex++;
    }

    if (options.readerId) {
        whereClauses.push(`r.reader_id = $${paramIndex}`);
        params.push(options.readerId);
        paramIndex++;
    }

    if (options.searchTerm && options.searchTerm.trim()) {
        const searchPattern = `%${options.searchTerm.trim()}%`;
        whereClauses.push(`(
            b."CUSTOMERKEY" ILIKE $${paramIndex} OR
            b.individual_customer_id ILIKE $${paramIndex} OR
            b."CUSTOMERNAME" ILIKE $${paramIndex} OR
            b.id::text ILIKE $${paramIndex} OR
            b."BILLKEY" ILIKE $${paramIndex}
        )`);
        params.push(searchPattern);
        paramIndex++;
    }

    if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Count total query
    const countSql = `SELECT COUNT(*) as count FROM (` + sql + `) as count_query`;
    const countRes: any = await query(countSql, params);
    const totalCount = Number(countRes?.[0]?.count || 0);

    // Data query with ordering and pagination
    sql += ` ORDER BY b.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(options.limit, options.offset);

    const rows: any = await query(sql, params);
    return { data: rows || [], totalCount };
};

export const dbGetBillsStatusCounts = async (options: {
    branchId?: string;
    month?: string;
    searchTerm?: string;
    readerId?: string;
}) => {
    let sql = `
        SELECT b.status, COUNT(*) as count
        FROM bills b
        LEFT JOIN individual_customers ic ON b.individual_customer_id = ic."customerKeyNumber"
        LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
        LEFT JOIN routes r ON COALESCE(ic."ROUTE_KEY", bm."ROUTE_KEY") = r.route_key
    `;
    const params: any[] = [];
    let paramIndex = 1;
    const whereClauses = ['b.deleted_at IS NULL'];

    if (options.month && options.month !== 'all') {
        whereClauses.push(`b.month_year = $${paramIndex}`);
        params.push(options.month);
        paramIndex++;
    }

    if (options.branchId && options.branchId !== 'all') {
        whereClauses.push(`(b.branch_id = $${paramIndex} OR bm.branch_id = $${paramIndex} OR ic.branch_id = $${paramIndex})`);
        params.push(options.branchId);
        paramIndex++;
    }

    if (options.readerId) {
        whereClauses.push(`r.reader_id = $${paramIndex}`);
        params.push(options.readerId);
        paramIndex++;
    }

    if (options.searchTerm && options.searchTerm.trim()) {
        const searchPattern = `%${options.searchTerm.trim()}%`;
        whereClauses.push(`(
            b."CUSTOMERKEY" ILIKE $${paramIndex} OR
            b.individual_customer_id ILIKE $${paramIndex} OR
            b."CUSTOMERNAME" ILIKE $${paramIndex} OR
            b.id::text ILIKE $${paramIndex} OR
            b."BILLKEY" ILIKE $${paramIndex}
        )`);
        params.push(searchPattern);
        paramIndex++;
    }

    if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ` GROUP BY b.status`;
    const rows: any = await query(sql, params);
    
    const counts: Record<string, number> = {
        Draft: 0,
        Pending: 0,
        Approved: 0,
        Posted: 0,
        Rework: 0,
        Total: 0
    };

    if (Array.isArray(rows)) {
        for (const row of rows) {
            const st = row.status || 'Draft';
            const cnt = Number(row.count || 0);
            counts[st] = (counts[st] || 0) + cnt;
            counts.Total += cnt;
        }
    }
    return counts;
};

export const dbGetBillsByCustomerKey = async (customerKey: string) => {
    return await query(
        `SELECT * FROM bills 
         WHERE deleted_at IS NULL 
           AND ("CUSTOMERKEY" = $1 OR individual_customer_id = $1)
         ORDER BY
           COALESCE(bill_period_end_date, created_at::date) ASC,
           created_at ASC`,
        [customerKey]
    );
};


export const dbCreateBill = async (bill: any, client?: any) => {
    const qFunc = client ? client.query.bind(client) : query;

    // Soft-delete existing active bill for the same customer & month to avoid unique constraint violations
    if (bill.month_year) {
        if (bill.CUSTOMERKEY) {
            await qFunc(
                `UPDATE bills SET deleted_at = NOW(), deleted_by = '00000000-0000-0000-0000-000000000000'::uuid 
                 WHERE deleted_at IS NULL AND month_year = $1 AND "CUSTOMERKEY" = $2`,
                [bill.month_year, bill.CUSTOMERKEY]
            );
        } else if (bill.individual_customer_id) {
            await qFunc(
                `UPDATE bills SET deleted_at = NOW(), deleted_by = '00000000-0000-0000-0000-000000000000'::uuid 
                 WHERE deleted_at IS NULL AND month_year = $1 AND individual_customer_id = $2`,
                [bill.month_year, bill.individual_customer_id]
            );
        }
    }

    const keys = Object.keys(bill);
    const placeholders = keys.map((k, i) =>
        k === 'payment_status' ? `$${i + 1}::payment_status` : `$${i + 1}`
    ).join(',');
    const sql = `INSERT INTO bills (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const params = keys.map(k => bill[k]);

    if (client) {
        const res = await client.query(sql, params);
        return res.rows[0] || bill;
    }
    const rows: any = await query(sql, params);
    return rows[0] || bill;
};

export const dbUpdateBill = async (id: string, bill: any, client?: any, monthYear?: string) => {
    // Never update the partition key — strip it defensively so callers can't accidentally
    // change month_year, which would require PostgreSQL to move the row to another partition.
    const { month_year: _ignored, ...safeFields } = bill;
    const keys = Object.keys(safeFields);
    if (keys.length === 0) return null;
    const setClause = keys.map((k, i) =>
        k === 'payment_status' ? `"${k}" = $${i + 1}::payment_status` : `"${k}" = $${i + 1}`
    ).join(',');

    const monthYearClause = monthYear ? ` AND month_year = $${keys.length + 2}` : '';
    const sql = `UPDATE bills SET ${setClause} WHERE id = $${keys.length + 1}${monthYearClause} RETURNING *`;
    const params = monthYear
        ? [...keys.map(k => safeFields[k]), id, monthYear]
        : [...keys.map(k => safeFields[k]), id];

    if (client) {
        const res = await client.query(sql, params);
        return res.rows[0] ?? null;
    }
    const rows = await query(sql, params);
    return rows[0] ?? null;
};



export const dbDeleteBill = async (id: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const billRes = await client.query('SELECT * FROM bills WHERE id = $1', [id]);
        const bill = billRes.rows[0];
        if (!bill) return false;

        // Reconcile outstanding balance:
        // If the bill was unpaid or partially paid, subtract the unpaid portion from the meter/customer's balance.
        const totalAmt = Number(bill.TOTALBILLAMOUNT || 0);
        const paidAmt = Number(bill.amount_paid || 0);
        const unpaidAmt = Number((totalAmt - paidAmt).toFixed(2));

        if (unpaidAmt > 0) {
            if (bill.CUSTOMERKEY) {
                await client.query('UPDATE bulk_meters SET "outStandingbill" = GREATEST(0, COALESCE("outStandingbill", 0) - $1) WHERE "customerKeyNumber" = $2', [unpaidAmt, bill.CUSTOMERKEY]);
            } else if (bill.individual_customer_id) {
                await client.query('UPDATE individual_customers SET "outStandingbill" = GREATEST(0, COALESCE("outStandingbill", 0) - $1) WHERE "customerKeyNumber" = $2', [unpaidAmt, bill.individual_customer_id]);
            }
        }

        // Restore pre-rollover readings when the bill is deleted so they can be re-billed/edited correctly.
        if (bill.CUSTOMERKEY) {
            // Restore bulk meter readings
            await client.query(
                `UPDATE bulk_meters 
                 SET "previousReading" = $1, "currentReading" = $2, month = $3 
                 WHERE "customerKeyNumber" = $4`,
                [bill.PREVREAD, bill.CURRREAD, bill.month_year, bill.CUSTOMERKEY]
            );

            // Restore assigned individual sub-meters readings using reading records of that month
            if (bill.month_year && bill.month_year.includes('-')) {
                const [year, month] = bill.month_year.split('-').map(Number);
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
                    [bill.CUSTOMERKEY, startDate, endDate]
                );

                for (const r of readingsRes.rows) {
                    await client.query(
                        `UPDATE individual_customers 
                         SET "previousReading" = $1, "currentReading" = $2, month = $3 
                         WHERE "customerKeyNumber" = $4`,
                        [r.PREVIOUS_READING, r.METER_READING, bill.month_year, r.CUST_KEY]
                    );
                }
            }
        } else if (bill.individual_customer_id) {
            // Restore standalone individual customer readings
            await client.query(
                `UPDATE individual_customers 
                 SET "previousReading" = $1, "currentReading" = $2, month = $3 
                 WHERE "customerKeyNumber" = $4`,
                [bill.PREVREAD, bill.CURRREAD, bill.month_year, bill.individual_customer_id]
            );
        }

        await client.query('UPDATE bills SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['bill', id, bill.bill_number || `Bill ${id}`, deletedBy, JSON.stringify(bill)]);

        // Re-run the aging replay so any credit created by this bill's overpayment
        // is reversed (bill no longer exists) and balances stay consistent.
        const customerKeyToSync = bill.CUSTOMERKEY || bill.individual_customer_id;
        if (customerKeyToSync) {
            await dbSyncAgingForCustomer(customerKeyToSync, client);
        }
        return true;
    });
};
export const dbGetBillById = async (id: string, branchId?: string) => {
    if (branchId) {
        const rows: any = await query(`
            SELECT b.* 
            FROM bills b
            LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
            LEFT JOIN individual_customers ic ON b.individual_customer_id = ic."customerKeyNumber"
            WHERE b.id = $1 AND b.deleted_at IS NULL
            AND (bm.branch_id = $2 OR ic.branch_id = $2)
        `, [id, branchId]);
        return rows[0] ?? null;
    }
    const rows: any = await query('SELECT * FROM bills WHERE id = $1 AND deleted_at IS NULL', [id]);
    return rows[0] ?? null;
};

export const dbGetBillsByCustomerId = async (customerKeyNumber: string, branchId?: string, excludeUnfinalized?: boolean) => {
    let sql = 'SELECT b.* FROM bills b';
    const params: any[] = [customerKeyNumber];
    let paramIndex = 2;

    const whereClauses = ['(b.individual_customer_id = $1 OR b."CUSTOMERKEY" = $1)', 'b.deleted_at IS NULL'];

    if (branchId) {
        sql += ' LEFT JOIN individual_customers ic ON b.individual_customer_id = ic."customerKeyNumber"';
        sql += ' LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"';
        whereClauses.push(`(ic.branch_id = $${paramIndex} OR bm.branch_id = $${paramIndex})`);
        params.push(branchId);
        paramIndex++;
    }

    if (excludeUnfinalized) {
        whereClauses.push("b.status = 'Posted'");
    }

    sql += ' WHERE ' + whereClauses.join(' AND ');
    sql += ' ORDER BY b.created_at DESC';

    return await query(sql, params);
};

export const dbGetBillsByBulkMeterId = async (customerKeyNumber: string, branchId?: string, excludeUnfinalized?: boolean) => {
    let sql = 'SELECT b.* FROM bills b';
    const params: any[] = [customerKeyNumber];
    let paramIndex = 2;

    const whereClauses = ['b."CUSTOMERKEY" = $1', 'b.deleted_at IS NULL'];

    if (branchId) {
        sql += ' JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"';
        whereClauses.push(`bm.branch_id = $${paramIndex}`);
        params.push(branchId);
        paramIndex++;
    }

    if (excludeUnfinalized) {
        whereClauses.push("b.status = 'Posted'");
    }

    sql += ' WHERE ' + whereClauses.join(' AND ');
    sql += ' ORDER BY b.created_at DESC';

    return await query(sql, params);
};

export const dbUpdateBillStatus = async (id: string, status: string, approvalDate: Date | null = null, approvedBy: string | null = null, client?: any, monthYear?: string) => {
    let sql = '';
    const params: any[] = [status, id];

    if (approvalDate) {
        params.push(approvalDate, approvedBy);
        if (monthYear) {
            params.push(monthYear);
            sql = 'UPDATE bills SET status = $1, approval_date = $3, approved_by = $4 WHERE id = $2 AND month_year = $5 RETURNING *';
        } else {
            sql = 'UPDATE bills SET status = $1, approval_date = $3, approved_by = $4 WHERE id = $2 RETURNING *';
        }
    } else {
        if (monthYear) {
            params.push(monthYear);
            sql = 'UPDATE bills SET status = $1 WHERE id = $2 AND month_year = $3 RETURNING *';
        } else {
            sql = 'UPDATE bills SET status = $1 WHERE id = $2 RETURNING *';
        }
    }

    if (client) {
        const res = await client.query(sql, params);
        return res.rows[0] ?? null;
    }
    const rows = await query(sql, params);
    return rows[0] ?? null;
};

export const dbCreateBillWorkflowLog = async (log: { bill_id: string, from_status: string, to_status: string, changed_by: string, reason?: string, details?: any }, client?: any) => {
    const keys = Object.keys(log);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO bill_workflow_logs (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const params = keys.map(k => (log as any)[k]);

    if (client) {
        const res = await client.query(sql, params);
        return res.rows[0] || log;
    }
    const rows: any = await query(sql, params);
    return rows[0] || log;
};

export const dbGetBillWorkflowLogs = async (billId: string) => {
    return await query('SELECT * FROM bill_workflow_logs WHERE bill_id = $1 ORDER BY created_at DESC', [billId]);
};

export async function ensureReadingPartitionExists(parentTable: string, monthYear?: string | null, executor?: any) {
    if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) return;
    try {
        const partitionName = `${parentTable}_${monthYear.replace('-', '_')}`;
        const checkSql = `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1 AND n.nspname = 'public'`;
        const checkRes = await executor.query(checkSql, [partitionName]);
        const exists = checkRes.rows ? checkRes.rows.length > 0 : (Array.isArray(checkRes) && checkRes.length > 0);
        if (!exists) {
            const createSql = `CREATE TABLE IF NOT EXISTS public.${partitionName} PARTITION OF public.${parentTable} FOR VALUES IN ($1)`;
            await executor.query(createSql, [monthYear]);
        }
    } catch (e) {
        // Ignore if table is not partitioned or already created concurrently
    }
}

export const dbGetAllIndividualCustomerReadings = async (branchId?: string, readerId?: string, limit?: number) => {
    let sql = `
        SELECT r.*, 
        EXISTS(SELECT 1 FROM meter_reading_photos WHERE reading_id = r.id::text) as has_photo
        FROM individual_customer_readings r
        JOIN individual_customers ic ON r."CUST_KEY" = ic."customerKeyNumber"
        LEFT JOIN bulk_meters bm ON ic."assignedBulkMeterId" = bm."customerKeyNumber"
        LEFT JOIN routes ro ON COALESCE(ic."ROUTE_KEY", bm."ROUTE_KEY") = ro.route_key
        WHERE r.deleted_at IS NULL
    `;
    const params: any[] = [];
    
    if (branchId) {
        params.push(branchId);
        sql += ` AND ic.branch_id = $${params.length}`;
    }
    
    if (readerId) {
        params.push(readerId);
        sql += ` AND ro.reader_id = $${params.length}`;
    }

    sql += ` ORDER BY r.created_at DESC`;
    if (limit && limit > 0) {
        sql += ` LIMIT ${Number(limit)}`;
    }

    return await query(sql, params);
};

export const dbCreateIndividualCustomerReading = async (reading: any, client?: any) => {
    try {
        const { reading_month: _ignored, ...safeFields } = reading;
        const custKey = safeFields.CUST_KEY || safeFields.individual_customer_id || safeFields.individualCustomerId;
        const rDate = safeFields.READING_DATE || safeFields.reading_date;
        const monthYear = safeFields.month_year || safeFields.monthYear || (rDate ? String(rDate).slice(0, 7) : null);

        const executor = client || { query };

        // Ensure partition exists for this month before insert
        await ensureReadingPartitionExists('individual_customer_readings', monthYear, executor);

        // Check if a reading record already exists for this individual customer in the same billing month
        if (custKey && monthYear) {
            const checkSql = `SELECT id FROM individual_customer_readings WHERE "CUST_KEY" = $1 AND LEFT("READING_DATE"::text, 7) = $2 AND deleted_at IS NULL LIMIT 1`;
            const checkRes = await executor.query(checkSql, [custKey, monthYear]);
            const existingRow = checkRes.rows ? checkRes.rows[0] : checkRes[0];

            if (existingRow && existingRow.id) {
                // Update existing reading value instead of creating duplicate reading
                const keys = Object.keys(safeFields).filter(k => k !== 'id' && k !== 'created_at');
                const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
                const updateSql = `UPDATE individual_customer_readings SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
                const params = [...keys.map(k => safeFields[k]), existingRow.id];
                const updateRes = await executor.query(updateSql, params);
                return (updateRes.rows ? updateRes.rows[0] : updateRes[0]) || existingRow;
            }
        }

        // Otherwise insert new reading
        const keys = Object.keys(safeFields);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
        const sql = `INSERT INTO individual_customer_readings (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
        const params = keys.map(k => safeFields[k]);
        
        const res = await executor.query(sql, params);
        return (res.rows ? res.rows[0] : res[0]) || reading;
    } catch (error) {
        console.error('dbCreateIndividualCustomerReading error:', error);
        throw error;
    }
};


export const dbUpdateIndividualCustomerReading = async (id: string, reading: any, readingMonth?: string) => {
    const { reading_month: _ignored, ...safeFields } = reading;
    const keys = Object.keys(safeFields);
    if (keys.length === 0) return null;
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const monthClause = readingMonth ? ` AND reading_month = $${keys.length + 2}` : '';
    const sql = `UPDATE individual_customer_readings SET ${setClause} WHERE id = $${keys.length + 1}${monthClause} RETURNING *`;
    const params = readingMonth
        ? [...keys.map(k => safeFields[k]), id, readingMonth]
        : [...keys.map(k => safeFields[k]), id];
    const rows = await query(sql, params);
    return rows[0] ?? null;
};

export const dbDeleteIndividualCustomerReading = async (id: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const res = await client.query('SELECT * FROM individual_customer_readings WHERE id = $1', [id]);
        const reading = res.rows[0];
        if (!reading) return false;

        await client.query('UPDATE individual_customer_readings SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['reading_individual', id, `Reading ${id}`, deletedBy, JSON.stringify(reading)]);
        return true;
    });
};

export const dbGetIndividualCustomerReadingsByCustomer = async (customerKey: string) => {
    return await query(
        'SELECT * FROM individual_customer_readings WHERE "CUST_KEY" = $1 AND deleted_at IS NULL ORDER BY "READING_DATE" DESC',
        [customerKey]
    );
};

export const dbGetAllBulkMeterReadings = async (branchId?: string, readerId?: string, limit?: number) => {
    let sql = `
        SELECT r.*,
        EXISTS(SELECT 1 FROM meter_reading_photos WHERE reading_id = r.id::text) as has_photo
        FROM bulk_meter_readings r
        JOIN bulk_meters bm ON r."CUST_KEY" = bm."customerKeyNumber"
        LEFT JOIN routes ro ON bm."ROUTE_KEY" = ro.route_key
        WHERE r.deleted_at IS NULL
    `;
    const params: any[] = [];
    
    if (branchId) {
        params.push(branchId);
        sql += ` AND bm.branch_id = $${params.length}`;
    }
    
    if (readerId) {
        params.push(readerId);
        sql += ` AND ro.reader_id = $${params.length}`;
    }

    sql += ` ORDER BY r.created_at DESC`;
    if (limit && limit > 0) {
        sql += ` LIMIT ${Number(limit)}`;
    }

    return await query(sql, params);
};

export const dbCreateBulkMeterReading = async (reading: any, client?: any) => {
    try {
        const { reading_month: _ignored, ...safeFields } = reading;
        const custKey = safeFields.CUST_KEY || safeFields.CUSTOMERKEY;
        const rDate = safeFields.READING_DATE || safeFields.reading_date;
        const monthYear = safeFields.month_year || safeFields.monthYear || (rDate ? String(rDate).slice(0, 7) : null);

        const executor = client || { query };

        // Ensure partition exists for this month before insert
        await ensureReadingPartitionExists('bulk_meter_readings', monthYear, executor);

        // Check if a reading record already exists for this bulk meter in the same billing month
        if (custKey && monthYear) {
            const checkSql = `SELECT id FROM bulk_meter_readings WHERE "CUST_KEY" = $1 AND LEFT("READING_DATE"::text, 7) = $2 AND deleted_at IS NULL LIMIT 1`;
            const checkRes = await executor.query(checkSql, [custKey, monthYear]);
            const existingRow = checkRes.rows ? checkRes.rows[0] : checkRes[0];

            if (existingRow && existingRow.id) {
                // Update existing reading value instead of creating duplicate reading
                const keys = Object.keys(safeFields).filter(k => k !== 'id' && k !== 'created_at');
                const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
                const updateSql = `UPDATE bulk_meter_readings SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
                const params = [...keys.map(k => safeFields[k]), existingRow.id];
                const updateRes = await executor.query(updateSql, params);
                return (updateRes.rows ? updateRes.rows[0] : updateRes[0]) || existingRow;
            }
        }

        // Otherwise insert new reading
        const keys = Object.keys(safeFields);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
        const sql = `INSERT INTO bulk_meter_readings (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
        const params = keys.map(k => safeFields[k]);
        
        const res = await executor.query(sql, params);
        return (res.rows ? res.rows[0] : res[0]) || reading;
    } catch (error) {
        console.error('dbCreateBulkMeterReading error:', error);
        throw error;
    }
};


export const dbUpdateBulkMeterReading = async (id: string, reading: any, readingMonth?: string) => {
    const { reading_month: _ignored, ...safeFields } = reading;
    const keys = Object.keys(safeFields);
    if (keys.length === 0) return null;
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const monthClause = readingMonth ? ` AND reading_month = $${keys.length + 2}` : '';
    const sql = `UPDATE bulk_meter_readings SET ${setClause} WHERE id = $${keys.length + 1}${monthClause} RETURNING *`;
    const params = readingMonth
        ? [...keys.map(k => safeFields[k]), id, readingMonth]
        : [...keys.map(k => safeFields[k]), id];
    const rows = await query(sql, params);
    return rows[0] ?? null;
};

export const dbDeleteBulkMeterReading = async (id: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const res = await client.query('SELECT * FROM bulk_meter_readings WHERE id = $1', [id]);
        const reading = res.rows[0];
        if (!reading) return false;

        await client.query('UPDATE bulk_meter_readings SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['reading_bulk', id, `Bulk Reading ${id}`, deletedBy, JSON.stringify(reading)]);
        return true;
    });
};

export const dbGetBulkMeterReadingsByMeter = async (meterKey: string) => {
    return await query(
        'SELECT * FROM bulk_meter_readings WHERE "CUST_KEY" = $1 AND deleted_at IS NULL ORDER BY "READING_DATE" DESC',
        [meterKey]
    );
};

// =====================================================
// Meter Reading Photos
// =====================================================

export const dbCreateMeterReadingPhoto = async (photo: {
    reading_id: string;
    photo_data?: string | null;   // base64 string — stored as bytea
    photo_url?: string | null;    // optional URL reference
}, client?: any) => {
    // Convert base64 string to Buffer for bytea storage
    const photoDataBuffer = photo.photo_data
        ? Buffer.from(photo.photo_data.replace(/^data:[^;]+;base64,/, ''), 'base64')
        : null;

    const sql = `INSERT INTO meter_reading_photos (reading_id, photo_url, photo_data)
                 VALUES ($1, $2, $3) RETURNING id, reading_id, photo_url, captured_at`;
    const params = [photo.reading_id, photo.photo_url ?? null, photoDataBuffer];

    if (client) {
        const res = await client.query(sql, params);
        return res.rows[0] || photo;
    }
    const rows: any = await query(sql, params);
    return rows[0] || photo;
};

export const dbGetPhotosByReadingId = async (readingId: string) => {
    return await query(
        'SELECT * FROM meter_reading_photos WHERE "reading_id" = $1 ORDER BY "captured_at" DESC',
        [readingId]
    );
};

export const dbGetLatestReadingsByMeters = async (meterKeys: string[], type: 'individual' | 'bulk') => {
    if (meterKeys.length === 0) return [];
    const placeholders = meterKeys.map((_, i) => `$${i + 1}`).join(',');
    const table = type === 'individual' ? 'individual_customer_readings' : 'bulk_meter_readings';
    const keyColumn = type === 'individual' ? '"CUST_KEY"' : '"CUST_KEY"'; // Both use CUST_KEY now

    const sql = `
        SELECT DISTINCT ON (${keyColumn}) *
        FROM ${table}
        WHERE ${keyColumn} IN (${placeholders})
        AND deleted_at IS NULL
        ORDER BY ${keyColumn}, "READING_DATE" DESC
    `;
    return await query(sql, meterKeys);
};

export const dbGetMeterReadings = async (branchId?: string) => {
    let individualSql = 'SELECT r.* FROM individual_customer_readings r JOIN individual_customers ic ON r."CUST_KEY" = ic."customerKeyNumber" WHERE r.deleted_at IS NULL';
    let bulkSql = 'SELECT r.* FROM bulk_meter_readings r JOIN bulk_meters bm ON r."CUST_KEY" = bm."customerKeyNumber" WHERE r.deleted_at IS NULL';
    const params = [];

    if (branchId) {
        individualSql += ' AND ic.branch_id = $1';
        bulkSql += ' AND bm.branch_id = $1';
        params.push(branchId);
    }

    const individual = await query(individualSql, params);
    const bulk = await query(bulkSql, params);

    const individualWithType = (individual as any[]).map(r => ({ ...r, reading_type: 'Individual' }));
    const bulkWithType = (bulk as any[]).map(r => ({ ...r, reading_type: 'Bulk' }));

    return [...individualWithType, ...bulkWithType];
};

export const dbGetAllPayments = async (branchId?: string) => {
    if (branchId) {
        return await query(`
            SELECT p.* FROM payments p
            LEFT JOIN bills b ON p.bill_id = b.id
            LEFT JOIN individual_customers ic ON p.individual_customer_id = ic."customerKeyNumber"
            WHERE p.deleted_at IS NULL 
            AND (b.branch_id = $1 OR ic.branch_id = $1)
        `, [branchId]);
    }
    return await query('SELECT * FROM payments WHERE deleted_at IS NULL');
};

const normalizePaymentMethod = (rawMethod?: string | null): string | null => {
    const cleaned = rawMethod?.toString().trim();
    if (!cleaned) return null;

    const normalized = cleaned.replace(/[_\s]+/g, ' ').toLowerCase();
    const validChannels: {[key: string]: string} = {
        'cbe': 'Bank Transfer',
        'bank transfer': 'Bank Transfer',
        'bank_transfer': 'Bank Transfer',
        'banktransfer': 'Bank Transfer',
        'cash': 'Cash',
        'mobile money': 'Mobile Money',
        'mobile_money': 'Mobile Money',
        'mobilemoney': 'Mobile Money',
        'online payment': 'Online Payment',
        'online_payment': 'Online Payment',
        'onlinepayment': 'Online Payment',
        'other': 'Other'
    };

    if (validChannels[normalized]) {
        return validChannels[normalized];
    }
    if (normalized.includes('cbe')) {
        return 'Bank Transfer';
    }
    if (normalized.includes('mobile')) {
        return 'Mobile Money';
    }
    if (normalized.includes('online')) {
        return 'Online Payment';
    }
    if (normalized.includes('bank')) {
        return 'Bank Transfer';
    }
    return 'Other';
};

export const dbCreatePayment = async (payment: any) => {
    if (payment.payment_method !== undefined) {
        payment.payment_method = normalizePaymentMethod(payment.payment_method);
    }
    const keys = Object.keys(payment);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO payments (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => payment[k]));
    return rows[0] || payment;
};

export const dbGetTotalPaymentsForBill = async (billId: string) => {
    const rows: any = await query('SELECT SUM(amount_paid) as total_paid FROM payments WHERE bill_id = $1', [billId]);
    return Number(rows[0]?.total_paid || 0);
};

export const dbUpdatePayment = async (id: string, payment: any) => {
    const keys = Object.keys(payment);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE payments SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => payment[k]), id]);
    return rows[0] ?? null;
};

export const dbDeletePayment = async (id: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const res = await client.query('SELECT * FROM payments WHERE id = $1', [id]);
        const payment = res.rows[0];
        if (!payment) return false;

        await client.query('UPDATE payments SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['payment', id, `Payment ${payment.amount_paid}`, deletedBy, JSON.stringify(payment)]);
        return true;
    });
};

export const dbGetAllReportLogs = async (branchId?: string) => {
    if (branchId) {
        // Reports might be linked to branches via the staff who generated them
        return await query(`
            SELECT r.* FROM reports r
            LEFT JOIN staff_members sm ON r.generated_by_staff_id = sm.id
            WHERE r.deleted_at IS NULL AND sm.branch_id = $1
        `, [branchId]);
    }
    return await query('SELECT * FROM reports WHERE deleted_at IS NULL');
};

export const dbCreateReportLog = async (log: any) => {
    const keys = Object.keys(log);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO reports (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => log[k]));
    return rows[0] || log;
};

export const dbUpdateReportLog = async (id: string, log: any) => {
    const keys = Object.keys(log);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE reports SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => log[k]), id]);
    return rows[0] ?? null;
};

export const dbDeleteReportLog = async (id: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const res = await client.query('SELECT * FROM reports WHERE id = $1', [id]);
        const report = res.rows[0];
        if (!report) return false;

        await client.query('UPDATE reports SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['report', id, report.name || `Report ${id}`, deletedBy, JSON.stringify(report)]);
        return true;
    });
};

export const dbGetAllNotifications = async (branchId?: string) => {
    if (branchId) {
        return await query('SELECT * FROM notifications WHERE deleted_at IS NULL AND (target_branch_id = $1 OR target_branch_id IS NULL)', [branchId]);
    }
    return await query('SELECT * FROM notifications WHERE deleted_at IS NULL');
};

export const dbDeleteNotification = async (id: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const res = await client.query('SELECT * FROM notifications WHERE id = $1', [id]);
        const notification = res.rows[0];
        if (!notification) return false;

        await client.query('UPDATE notifications SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['notification', id, notification.title || `Notification ${id}`, deletedBy, JSON.stringify(notification)]);
        return true;
    });
};

export const dbCreateNotification = async (notification: any) => {
    try {
        const allowed = ['id', 'title', 'message', 'sender_name', 'target_branch_id', 'created_at'];
        const payload: any = { ...notification };

        if (!payload.id) payload.id = randomUUID();
        if (!payload.created_at) {
            const d = new Date();
            payload.created_at = d.toISOString().slice(0, 19).replace('T', ' ');
        }

        const keys = Object.keys(payload).filter(k => allowed.includes(k));
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
        const sql = `INSERT INTO notifications (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
        const rows: any = await query(sql, keys.map(k => payload[k]));
        return rows[0] || payload;
    } catch (error) {
        console.error('dbCreateNotification error:', error);
        throw error;
    }
};

export const dbUpdateNotification = async (id: string, notification: any) => {
    const keys = Object.keys(notification);
    if (keys.length === 0) return null;
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE notifications SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => notification[k]), id]);
    return rows[0] ?? null;
};

export const dbGetAllRoles = async () => await query('SELECT * FROM roles');

export const dbCreateRole = async (role: any) => {
    const keys = Object.keys(role);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO roles (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => role[k]));
    return rows[0] || role;
};

export const dbGetAllPermissions = async () => await query('SELECT * FROM permissions');

export const dbCreatePermission = async (permission: any) => {
    const keys = Object.keys(permission);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO permissions (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => permission[k]));
    return rows[0] || permission;
};

export const dbUpdatePermission = async (id: number, permission: any) => {
    const keys = Object.keys(permission);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE permissions SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => permission[k]), id]);
    return rows[0] ?? null;
};

export const dbDeletePermission = async (id: number) => { await query('DELETE FROM permissions WHERE id = $1', [id]); return true; };

export const dbGetAllRolePermissions = async () => await query('SELECT * FROM role_permissions');

export const dbRpcUpdateRolePermissions = async (roleId: number, permissionIds: number[]) => {
    return await withTransaction(async (client) => {
        // 1. Clear existing permissions
        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

        // 2. Insert new permissions if any
        if (permissionIds && permissionIds.length > 0) {
            // Construct ($1, $2), ($1, $3), ...
            const values: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            // Filter out any duplicates just in case
            const uniqueIds = Array.from(new Set(permissionIds));

            uniqueIds.forEach(pid => {
                values.push(`($${paramIndex}, $${paramIndex + 1})`);
                params.push(roleId, pid);
                paramIndex += 2;
            });

            const sql = `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values.join(',')}`;
            await client.query(sql, params);
        }

        return true;
    });
};

export const dbGetAllTariffs = async () => await query('SELECT * FROM tariffs');

export const dbGetTariffByTypeAndDate = async (customerType: string, date: string) => {
    // Standardize date: if YYYY-MM is provided, use the last day of that month.
    let lookupDate = date;
    if (date && date.length === 7 && date.includes('-')) {
        const [year, month] = date.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        lookupDate = `${date}-${lastDay}`;
    }

    const rows: any = await query('SELECT * FROM tariffs WHERE customer_type = $1 AND effective_date = $2 LIMIT 1', [customerType, lookupDate]);
    return rows[0] ?? null;
};

export const dbGetLatestApplicableTariff = async (customerType: string, date: string) => {
    // Standardize date: if YYYY-MM is provided, use the last day of that month
    // to ensure we catch the latest tariff applicable for that billing period.
    let lookupDate = date;
    if (date && date.length === 7 && date.includes('-')) {
        const [year, month] = date.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        lookupDate = `${date}-${lastDay}`;
    }

    const rows: any = await query(
        'SELECT * FROM tariffs WHERE customer_type = $1 AND effective_date <= $2 ORDER BY effective_date DESC LIMIT 1',
        [customerType, lookupDate]
    );
    return rows[0] ?? null;
};

export const dbCreateTariff = async (tariff: any) => {
    const keys = Object.keys(tariff);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO tariffs (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => tariff[k]));
    return rows[0] || tariff;
};

export const dbUpdateTariff = async (customerType: string, effectiveDate: string, tariff: any) => {
    const keys = Object.keys(tariff);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');

    // Try updating with the exact provided date first
    let rows = await query(
        `UPDATE tariffs SET ${setClause} WHERE customer_type = $${keys.length + 1} AND effective_date = $${keys.length + 2} RETURNING *`,
        [...keys.map(k => tariff[k]), customerType, effectiveDate]
    );

    if (rows[0]) return rows[0];

    // If no row was updated, try an alternate lookup: if the provided date is YYYY-MM-DD,
    // also try the last-day-of-month variant for that same month (some rows are stored
    // using month-end canonicalization). If the provided date is YYYY-MM, normalize
    // it to month-end and try that as well.
    let altDate = effectiveDate;
    if (effectiveDate && effectiveDate.length >= 7 && effectiveDate.includes('-')) {
        const parts = effectiveDate.split('-').map(Number);
        const year = parts[0];
        const month = parts[1] || 1;
        const lastDay = new Date(year, month, 0).getDate();
        altDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    if (altDate !== effectiveDate) {
        rows = await query(
            `UPDATE tariffs SET ${setClause} WHERE customer_type = $${keys.length + 1} AND effective_date = $${keys.length + 2} RETURNING *`,
            [...keys.map(k => tariff[k]), customerType, altDate]
        );
        if (rows[0]) return rows[0];
    }

    return null;
};



export const dbGetAllKnowledgeBaseArticles = async () => await query('SELECT * FROM knowledge_base_articles WHERE deleted_at IS NULL');

export const dbCreateKnowledgeBaseArticle = async (article: any) => {
    const keys = Object.keys(article);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO knowledge_base_articles (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => article[k]));
    return rows[0] || article;
};

export const dbUpdateKnowledgeBaseArticle = async (id: number, article: any) => {
    const keys = Object.keys(article);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE knowledge_base_articles SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => article[k]), id]);
    return rows[0] ?? null;
};

export const dbDeleteKnowledgeBaseArticle = async (id: number, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const res = await client.query('SELECT * FROM knowledge_base_articles WHERE id = $1', [id]);
        const article = res.rows[0];
        if (!article) return false;

        await client.query('UPDATE knowledge_base_articles SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['knowledge_base', id.toString(), article.title || `Article ${id}`, deletedBy, JSON.stringify(article)]);
        return true;
    });
};

export const dbGetAllSecurityLogs = async (page: number = 1, pageSize: number = 10, sortBy: string = 'created_at', sortOrder: 'asc' | 'desc' = 'desc', branchName?: string) => {
    try {
        const offset = (page - 1) * pageSize;
        const validSortColumns = ['id', 'created_at', 'event', 'staff_email', 'ip_address'];
        const validatedSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const validatedSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

        let sql = `
            SELECT id, created_at, event, branch_name, staff_email, customer_key_number, ip_address, severity, details
            FROM security_logs
            WHERE 1=1
        `;
        const params: any[] = [offset, pageSize];
        let paramIndex = 3;

        if (branchName) {
            sql += ` AND branch_name = $${paramIndex++}`;
            params.push(branchName);
        }

        sql += ` ORDER BY ${validatedSortBy} ${validatedSortOrder} LIMIT $2 OFFSET $1`;
        
        let countSql = `SELECT COUNT(*) as total FROM security_logs WHERE 1=1`;
        const countParams: any[] = [];
        if (branchName) {
            countSql += ` AND branch_name = $1`;
            countParams.push(branchName);
        }

        const logs = await query(sql, params);
        const totalResult: any = await query(countSql, countParams);
        const total = totalResult[0].total;

        return {
            logs,
            total,
            page,
            pageSize,
            lastPage: Math.ceil(total / pageSize),
        };
    } catch (error) {
        console.error('Error in dbGetAllSecurityLogs:', error);
        throw error;
    }
};

export const dbUpdateSecurityLog = async (id: string, log: { event?: string; branch_name?: string; staff_email?: string; ip_address?: string; customer_key_number?: string }) => {
    const keys = Object.keys(log);
    if (keys.length === 0) return null;

    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const params = [...keys.map(k => (log as any)[k]), id];

    const rows = await query(`UPDATE security_logs SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, params);
    return rows[0] ?? null;
};

export const dbDeleteSecurityLog = async (id: string) => {
    await query('DELETE FROM security_logs WHERE id = $1', [id]);
    return true;
};

export const dbLogSecurityEvent = async (event: string, staff_email?: string, branch_name?: string, ipAddress?: string, severity: 'info' | 'warning' | 'critical' = 'info', details: any = {}, customer_key_number?: string) => {
    try {
        let ip_address = ipAddress ?? 'unknown';

        if (!ip_address) ip_address = 'unknown';

        // Try to dynamically import `next/headers` when available (Server Components).
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const maybeHeaders = await import('next/headers');
            if (maybeHeaders && typeof maybeHeaders.headers === 'function') {
                const h = await (maybeHeaders as any).headers();

                // Capture IP
                const forwarded = h.get?.('x-forwarded-for') ?? h.get?.('x-real-ip');
                if (forwarded) ip_address = forwarded;

                // Capture User Agent into details if not already present
                const userAgent = h.get?.('user-agent');
                if (userAgent && typeof details === 'object') {
                    details = { ...details, userAgent };
                }
            }
        } catch (e) {
            // ignore: `next/headers` not available in this runtime
        }

        console.log('Logging security event:', { event, staff_email, branch_name, ip_address, severity, customer_key_number });

        const dbSeverity = severity === 'warning' || severity === 'critical' ? severity : 'info';

        const sql = 'INSERT INTO security_logs (event, staff_email, branch_name, ip_address, severity, details, customer_key_number) VALUES ($1, $2, $3, $4, $5, $6, $7)';
        await query(sql, [event, staff_email, branch_name, ip_address, dbSeverity, JSON.stringify(details), customer_key_number]);
        return { success: true };
    } catch (error) {
        console.error('Error logging security event:', error);
        return { success: false, message: 'Failed to log security event' };
    }
};

// =====================================================
// Customer Session Management
// =====================================================

export const dbCreateCustomerSession = async (session: {
    customer_key_number: string;
    customer_type: string;
    ip_address?: string;
    device_name?: string;
    location?: string;
}) => {
    const keys = Object.keys(session);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO customer_sessions (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => (session as any)[k]));
    return rows[0];
};

export const dbRevokeCustomerSession = async (sessionId: string, reason: 'revoked' | 'logout' = 'revoked') => {
    const sql = `
        UPDATE customer_sessions
        SET is_revoked = true,
            logout_time = now(),
            duration_seconds = EXTRACT(EPOCH FROM (now() - created_at))::int,
            session_end_reason = $2
        WHERE id = $1
        RETURNING *
    `;
    const rows: any = await query(sql, [sessionId, reason]);
    return rows[0];
};

/**
 * Undo for an ended customer session: clears the end-of-session fields and
 * the revoked flag so the row shows as active again. Only applies to ended
 * sessions. Note the guard covers BOTH shapes: rows revoked before migration
 * 017 (is_revoked=true with no logout_time) and rows ended afterwards
 * (logout_time set) — otherwise old revoked rows could never be reactivated.
 */
export const dbReactivateCustomerSession = async (sessionId: string) => {
    const sql = `
        UPDATE customer_sessions
        SET is_revoked = false,
            logout_time = NULL,
            duration_seconds = NULL,
            session_end_reason = NULL
        WHERE id = $1 AND (logout_time IS NOT NULL OR is_revoked = true)
        RETURNING *
    `;
    const rows: any = await query(sql, [sessionId]);
    return rows[0] ?? null;
};

export const dbGetActiveCustomerSessions = async () => {
    const sql = `
        SELECT * FROM customer_sessions 
        WHERE is_revoked = false 
        ORDER BY last_active_at DESC
    `;
    return await query(sql);
};

export const dbIsCustomerSessionValid = async (sessionId: string) => {
    const sql = 'SELECT * FROM customer_sessions WHERE id = $1 AND is_revoked = false LIMIT 1';
    const rows: any = await query(sql, [sessionId]);
    if (rows && rows[0]) {
        // Update last active
        await query('UPDATE customer_sessions SET last_active_at = now() WHERE id = $1', [sessionId]);
        return true;
    }
    return false;
};

/**
 * Returns the full customer_sessions row (including customer_key_number and customer_type)
 * if the session exists and is not revoked. Used to verify ownership of customer portal resources.
 */
export const dbGetCustomerSession = async (sessionId: string) => {
    const sql = 'SELECT * FROM customer_sessions WHERE id = $1 AND is_revoked = false LIMIT 1';
    const rows: any = await query(sql, [sessionId]);
    return rows && rows[0] ? rows[0] : null;
};

/**
 * Appends a timestamped page view {path,label,viewed_at} to a customer session.
 * Repeat visits are kept; only consecutive identical paths are deduped. The
 * last_active_at heartbeat is throttled to once per 60s.
 * Returns true when the session existed and was not revoked.
 */
export const dbLogCustomerPageView = async (sessionId: string, pageName: string, path?: string) => {
    const pagePath = path || pageName;
    const entry = JSON.stringify({ path: pagePath, label: pageName, viewed_at: new Date().toISOString() });
    const sql = `
        UPDATE customer_sessions
        SET pages_viewed = CASE
                WHEN jsonb_array_length(COALESCE(pages_viewed, '[]'::jsonb)) > 0
                     AND pages_viewed -> (jsonb_array_length(COALESCE(pages_viewed, '[]'::jsonb)) - 1) ->> 'path' = $3
                THEN pages_viewed
                ELSE COALESCE(pages_viewed, '[]'::jsonb) || $2::jsonb
            END,
            last_active_at = CASE
                WHEN last_active_at > now() - interval '60 seconds' THEN last_active_at
                ELSE now()
            END
        WHERE id = $1 AND is_revoked = false
        RETURNING id
    `;
    const rows: any = await query(sql, [sessionId, entry, pagePath]);
    return rows.length > 0;
};

/**
 * Appends a timestamped page view {path,label,viewed_at} to a staff session.
 * Same semantics as dbLogCustomerPageView: consecutive-path dedupe + 60s
 * heartbeat throttle. Returns true when the session is active.
 */
export const dbLogStaffPageView = async (sessionId: string, path: string, label: string) => {
    const entry = JSON.stringify({ path, label, viewed_at: new Date().toISOString() });
    const sql = `
        UPDATE staff_sessions
        SET pages_viewed = CASE
                WHEN jsonb_array_length(COALESCE(pages_viewed, '[]'::jsonb)) > 0
                     AND pages_viewed -> (jsonb_array_length(COALESCE(pages_viewed, '[]'::jsonb)) - 1) ->> 'path' = $3
                THEN pages_viewed
                ELSE COALESCE(pages_viewed, '[]'::jsonb) || $2::jsonb
            END,
            last_active_at = CASE
                WHEN last_active_at > now() - interval '60 seconds' THEN last_active_at
                ELSE now()
            END
        WHERE id = $1 AND logout_time IS NULL
        RETURNING id
    `;
    const rows: any = await query(sql, [sessionId, entry, path]);
    return rows.length > 0;
};

// =====================================================
// Staff Session Management (login monitoring)
// =====================================================

/**
 * Creates a staff_sessions row at login time. Resolves branch_name from the
 * branches table when only branch_id is provided.
 */
export const dbCreateStaffSession = async (session: {
    staff_id: string;
    staff_email: string;
    role_name?: string | null;
    branch_id?: string | null;
    branch_name?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    device_name?: string | null;
    location?: string | null;
}) => {
    let branchName = session.branch_name ?? null;
    if (!branchName && session.branch_id) {
        try {
            const branchRows: any = await query('SELECT name FROM branches WHERE id = $1', [session.branch_id]);
            branchName = branchRows[0]?.name ?? null;
        } catch (e) {
            console.warn('Failed to resolve branch name for staff session:', e);
        }
    }

    const sql = `
        INSERT INTO staff_sessions
            (staff_id, staff_email, role_name, branch_id, branch_name, ip_address, user_agent, device_name, location)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    `;
    const rows: any = await query(sql, [
        session.staff_id,
        session.staff_email,
        session.role_name ?? null,
        session.branch_id ?? null,
        branchName,
        session.ip_address ?? null,
        session.user_agent ?? null,
        session.device_name ?? null,
        session.location ?? null,
    ]);
    return rows[0] ?? null;
};

/**
 * Closes an active staff session: sets logout_time, computed duration and the
 * reason the session ended. No-op (returns null) if already closed.
 */
export const dbFinalizeStaffSession = async (sessionId: string, reason: 'logout' | 'idle_timeout' | 'expired' | 'revoked') => {
    const sql = `
        UPDATE staff_sessions
        SET logout_time = now(),
            duration_seconds = EXTRACT(EPOCH FROM (now() - login_time))::int,
            session_end_reason = $2
        WHERE id = $1 AND logout_time IS NULL
        RETURNING *
    `;
    const rows: any = await query(sql, [sessionId, reason]);
    return rows[0] ?? null;
};

/**
 * Heartbeat: bumps last_active_at for an active staff session.
 * Callers are responsible for throttling.
 */
export const dbTouchStaffSession = async (sessionId: string) => {
    const sql = 'UPDATE staff_sessions SET last_active_at = now() WHERE id = $1 AND logout_time IS NULL';
    await query(sql, [sessionId]);
    return true;
};

/**
 * Closes an active staff session (admin kick-out). No-op if already closed.
 */
export const dbRevokeStaffSession = async (sessionId: string, reason: 'revoked' | 'idle_timeout' | 'expired' = 'revoked') => {
    const sql = `
        UPDATE staff_sessions
        SET logout_time = now(),
            duration_seconds = EXTRACT(EPOCH FROM (now() - login_time))::int,
            session_end_reason = $2
        WHERE id = $1 AND logout_time IS NULL
        RETURNING *
    `;
    const rows: any = await query(sql, [sessionId, reason]);
    return rows[0] ?? null;
};

/**
 * Undo for an ended staff session: clears the end-of-session fields and bumps
 * last_active_at so the nightly sweep gives the reactivated session a fresh
 * lease instead of immediately re-closing it. Only applies to ended sessions
 * (logout_time IS NOT NULL). Note: it restores the DB row only — if the user's
 * JWT cookie was already cleared by the kick-out redirect, they re-login.
 */
export const dbReactivateStaffSession = async (sessionId: string) => {
    const sql = `
        UPDATE staff_sessions
        SET logout_time = NULL,
            duration_seconds = NULL,
            session_end_reason = NULL,
            last_active_at = now()
        WHERE id = $1 AND logout_time IS NOT NULL
        RETURNING *
    `;
    const rows: any = await query(sql, [sessionId]);
    return rows[0] ?? null;
};

/**
 * True while a staff session is still active (not finalized by logout,
 * expiry or kick-out). Used by the middleware/getSession revocation checks.
 */
export const dbIsStaffSessionActive = async (sessionId: string) => {
    const rows: any = await query(
        'SELECT 1 FROM staff_sessions WHERE id = $1 AND logout_time IS NULL LIMIT 1',
        [sessionId]
    );
    return rows.length > 0;
};

/**
 * Nightly sweep: closes staff sessions that have been idle longer than the
 * configured session duration (defaults to the 2h JWT ceiling). Customers are
 * deliberately NOT swept — customer sessions have no expiry policy.
 * Returns the number of sessions closed.
 */
export const dbSweepExpiredStaffSessions = async (durationSeconds: number = 7200) => {
    const seconds = Math.max(60, Math.floor(Number(durationSeconds) || 7200));
    const sql = `
        UPDATE staff_sessions
        SET logout_time = now(),
            duration_seconds = EXTRACT(EPOCH FROM (now() - login_time))::int,
            session_end_reason = 'expired'
        WHERE logout_time IS NULL
          AND last_active_at < now() - ($1::int * interval '1 second')
        RETURNING id
    `;
    const rows: any = await query(sql, [seconds]);
    return rows.length;
};

// =====================================================
// Unified User Sessions (staff + customer UNION)
// =====================================================

// Shared CTE: one row per session with a user_type discriminator. Customer
// branch is resolved best-effort via bulk_meters / individual_customers
// (customer_sessions has no branch column of its own).
const USER_SESSIONS_CTE = `
    WITH sessions AS (
        SELECT
            'staff'::text AS user_type,
            ss.id,
            ss.staff_email AS user_identifier,
            ss.role_name,
            ss.branch_id,
            ss.branch_name,
            ss.ip_address,
            ss.user_agent,
            ss.device_name,
            ss.location,
            ss.login_time,
            ss.logout_time,
            ss.duration_seconds,
            ss.session_end_reason,
            ss.last_active_at,
            ss.pages_viewed,
            ss.created_at,
            NULL::text AS customer_key_number,
            NULL::text AS customer_type,
            NULL::boolean AS is_revoked
        FROM staff_sessions ss
        UNION ALL
        SELECT
            'customer'::text AS user_type,
            cs.id,
            cs.customer_key_number AS user_identifier,
            NULL::text AS role_name,
            COALESCE(bm.branch_id, ic.branch_id) AS branch_id,
            COALESCE(b.name, icb.name) AS branch_name,
            cs.ip_address,
            cs.user_agent,
            cs.device_name,
            cs.location,
            cs.created_at AS login_time,
            cs.logout_time,
            cs.duration_seconds,
            cs.session_end_reason,
            cs.last_active_at,
            cs.pages_viewed,
            cs.created_at,
            cs.customer_key_number,
            cs.customer_type,
            cs.is_revoked
        FROM customer_sessions cs
        LEFT JOIN bulk_meters bm ON cs.customer_key_number = bm."customerKeyNumber" AND cs.customer_type ILIKE 'bulk%'
        LEFT JOIN individual_customers ic ON cs.customer_key_number = ic."customerKeyNumber" AND cs.customer_type ILIKE 'individual%'
        LEFT JOIN branches b ON bm.branch_id = b.id
        LEFT JOIN branches icb ON ic.branch_id = icb.id
    )
`;

export interface UserSessionsOptions {
    page?: number;
    pageSize?: number;
    type?: 'staff' | 'customer';
    status?: string;
    branchName?: string; // exact match — branch isolation for non-management staff
    branch?: string;     // ILIKE — UI filter
    search?: string;     // ILIKE on user identifier
}

/**
 * Paginated, filterable UNION of staff + customer sessions, newest first.
 * duration_seconds is live (now - login) for active sessions.
 */
export const dbGetUserSessions = async (options: UserSessionsOptions = {}) => {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    const { whereSql, params } = buildUserSessionsFilters(options);
    const selectSql = `
        ${USER_SESSIONS_CTE}
        SELECT
            s.*,
            ${USER_SESSION_STATUS_SQL} AS status,
            COALESCE(s.duration_seconds, EXTRACT(EPOCH FROM (now() - s.login_time))::int) AS duration_seconds
        FROM sessions s
        ${whereSql}
    `;

    const rows = await query(
        `${selectSql} ORDER BY s.login_time DESC, s.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
    );
    const totalResult: any = await query(
        `${USER_SESSIONS_CTE} SELECT COUNT(*) AS total FROM sessions s ${whereSql}`,
        params
    );
    const total = parseInt(totalResult[0]?.total || '0', 10);

    return {
        sessions: rows,
        total,
        page,
        pageSize,
        lastPage: Math.ceil(total / pageSize),
    };
};

/**
 * Summary counts across the unified session store: active now, logins today,
 * average duration of finished sessions, and total sessions.
 */
export const dbGetSessionSummary = async (branchName?: string) => {
    const params: any[] = [];
    let whereSql = '';
    if (branchName) {
        whereSql = 'WHERE s.branch_name = $1';
        params.push(branchName);
    }

    const sql = `
        ${USER_SESSIONS_CTE}
        SELECT
            COUNT(*) FILTER (WHERE ${USER_SESSION_STATUS_SQL} = 'active') AS active_count,
            COUNT(*) FILTER (WHERE s.login_time >= date_trunc('day', now())) AS today_count,
            ROUND(AVG(s.duration_seconds) FILTER (WHERE s.duration_seconds IS NOT NULL AND s.duration_seconds > 0)) AS avg_duration_seconds,
            COUNT(*) AS total_count
        FROM sessions s
        ${whereSql}
    `;
    const rows: any = await query(sql, params);
    const row = rows[0] ?? {};
    return {
        active_count: parseInt(row.active_count || '0', 10),
        today_count: parseInt(row.today_count || '0', 10),
        avg_duration_seconds: row.avg_duration_seconds != null ? Number(row.avg_duration_seconds) : null,
        total_count: parseInt(row.total_count || '0', 10),
    };
};

// =====================================================
// Mobile App Support
// =====================================================

export const dbGetAllFaultCodes = async () => {
    return await query('SELECT * FROM fault_codes WHERE deleted_at IS NULL ORDER BY code ASC');
};

export const dbGetFaultCodeById = async (id: string) => {
    const rows: any = await query('SELECT * FROM fault_codes WHERE id = $1 AND deleted_at IS NULL', [id]);
    return rows[0] ?? null;
};

export const dbCreateFaultCode = async (faultCode: any) => {
    const keys = Object.keys(faultCode);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO fault_codes (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => faultCode[k]));
    return rows[0] || faultCode;
};

export const dbUpdateFaultCode = async (id: string, faultCode: any) => {
    const keys = Object.keys(faultCode);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE fault_codes SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => faultCode[k]), id]);
    return rows[0] ?? null;
};

export const dbDeleteFaultCode = async (id: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const res = await client.query('SELECT * FROM fault_codes WHERE id = $1', [id]);
        const faultCode = res.rows[0];
        if (!faultCode) return false;

        await client.query('UPDATE fault_codes SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['fault_code', id, faultCode.code || `Fault Code ${id}`, deletedBy, JSON.stringify(faultCode)]);
        return true;
    });
};


// =====================================================
// Route Management Queries
// =====================================================

export const dbGetAllRoutes = async (branchId?: string, readerId?: string) => {
    let sql = `
        SELECT r.*, b.name as branch_name, sm.name as reader_name, sm.email as reader_email
        FROM routes r
        LEFT JOIN branches b ON r.branch_id = b.id
        LEFT JOIN staff_members sm ON r.reader_id = sm.id
        WHERE r.deleted_at IS NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (branchId) {
        sql += ` AND r.branch_id = $${paramIndex++}`;
        params.push(branchId);
    }

    // Reader isolation: only routes where this staff member is the assigned reader
    if (readerId) {
        sql += ` AND r.reader_id = $${paramIndex++}`;
        params.push(readerId);
    }

    sql += ' ORDER BY r.route_key';
    return await query(sql, params);
};

export const dbGetRouteByKey = async (routeKey: string) => {
    const rows: any = await query('SELECT * FROM routes WHERE route_key = $1 AND deleted_at IS NULL LIMIT 1', [routeKey]);
    return rows[0] ?? null;
};

export const dbCreateRoute = async (route: any) => {
    const keys = Object.keys(route);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO routes (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => route[k]));
    return rows[0] || route;
};

export const dbUpdateRoute = async (routeKey: string, routeUpdates: any) => {
    return await withTransaction(async (client) => {
        if (routeUpdates.route_key && routeUpdates.route_key !== routeKey) {
            // First update child references if route_key changes
            await client.query('UPDATE bulk_meters SET "ROUTE_KEY" = $1 WHERE "ROUTE_KEY" = $2', [routeUpdates.route_key, routeKey]);
            await client.query('UPDATE individual_customers SET "ROUTE_KEY" = $1 WHERE "ROUTE_KEY" = $2', [routeUpdates.route_key, routeKey]);
        }
        const keys = Object.keys(routeUpdates);
        if (keys.length === 0) return null;
        const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
        const res = await client.query(`UPDATE routes SET ${setClause}, updated_at = now() WHERE route_key = $${keys.length + 1} RETURNING *`, [...keys.map(k => routeUpdates[k]), routeKey]);
        return res.rows[0] ?? null;
    });
};

export const dbDeleteRoute = async (routeKey: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const routeRes = await client.query('SELECT * FROM routes WHERE route_key = $1', [routeKey]);
        const route = routeRes.rows[0];
        if (!route) return false;

        await client.query('UPDATE routes SET deleted_at = now(), deleted_by = $2 WHERE route_key = $1', [routeKey, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['route', routeKey, route.description || routeKey, deletedBy, JSON.stringify(route)]);
        return true;
    });
};

export const dbGetDashboardMetrics = async (branchId?: string) => {
    // ── Step 1: Resolve latestMonth first (needed by most queries) ────────────
    let latestMonth = new Date().toISOString().substring(0, 7);
    try {
        const [postedRes, anyRes]: any[] = await Promise.all([
            query(`SELECT MAX(month_year) as latest_month FROM bills WHERE month_year IS NOT NULL AND status = 'Posted' AND deleted_at IS NULL`),
            query(`SELECT MAX(month_year) as latest_month FROM bills WHERE month_year IS NOT NULL AND deleted_at IS NULL`),
        ]);
        latestMonth = postedRes[0]?.latest_month || anyRes[0]?.latest_month || latestMonth;
    } catch (err) {
        console.warn('Failed to fetch latest bill month_year, falling back to current calendar month:', err);
    }

    // ── Step 2: Build shared filter fragments ─────────────────────────────────
    const params = [latestMonth];
    let branchFilter = '';
    if (branchId) {
        branchFilter = ' AND branch_id = $2';
        params.push(branchId);
    }

    let meterFilter = '';
    if (branchId) meterFilter = ' WHERE branch_id = $1';

    let perfBranchFilter = "WHERE b.name != 'Head Office'";
    if (branchId) perfBranchFilter += ' AND b.id = $2';

    const usageBranchFilter = branchId ? 'AND branch_id = $1' : '';

    let individualFilter = "WHERE status != 'Pending Approval'";
    if (branchId) individualFilter += ' AND branch_id = $1';

    const todayIso = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    let todayBillsFilter = branchId ? 'AND branch_id = $2' : '';
    let todayReadingsBranchJoin = branchId
        ? 'JOIN bulk_meters bm ON bmr."CUST_KEY" = bm."customerKeyNumber" WHERE DATE(bmr."READING_DATE") = $1 AND bm.branch_id = $2'
        : 'WHERE DATE(bmr."READING_DATE") = $1';
    let todayIndReadingsBranchJoin = branchId
        ? 'JOIN individual_customers ic ON imr."CUST_KEY" = ic."customerKeyNumber" WHERE (DATE(imr."READING_DATE") = $1 OR DATE(imr.created_at) = $1) AND ic.branch_id = $2'
        : 'WHERE DATE(imr."READING_DATE") = $1 OR DATE(imr.created_at) = $1';
    let todayCustFilter = branchId ? 'AND branch_id = $2' : '';

    // ── Step 3: Run all independent queries in parallel ────────────────────────
    const [
        billStatuses,
        revenueData,
        totalCustomersData,
        currentReadingsData,
        bulkMeterCountData,
        individualCustomerCountData,
        branchCountData,
        topDelinquent,
        branchPerformance,
        usageTrend,
        todayBillsData,
        todayBulkReadingsData,
        todayIndReadingsData,
        todayCustomersData,
    ]: any[] = await Promise.all([
        // 1. Bill statuses for latest month
        query(
            `SELECT payment_status as status, COUNT(*) as count
             FROM bills
             WHERE month_year = $1 AND status = 'Posted' AND deleted_at IS NULL ${branchFilter}
             GROUP BY payment_status`,
            params
        ),

        // 2. Revenue aggregation
        query(
            `SELECT
                SUM(COALESCE("TOTALBILLAMOUNT", COALESCE("PENALTYAMT", 0) + COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0))))) as total_billed,
                SUM(CASE WHEN payment_status = 'Paid' THEN COALESCE("TOTALBILLAMOUNT", COALESCE("PENALTYAMT", 0) + COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0)))) ELSE 0 END) as total_collected
             FROM bills
             WHERE status = 'Posted' AND month_year = $1 AND deleted_at IS NULL ${branchFilter}`,
            params
        ),

        // 3a. Total active bulk meters (for reading progress denominator)
        query(
            `SELECT COUNT(*) as count FROM bulk_meters ${meterFilter ? meterFilter + " AND status = 'Active'" : "WHERE status = 'Active'"}`,
            branchId ? [branchId] : []
        ),

        // 3b. Bulk meter readings completed for the latest month
        query(
            `SELECT COUNT(DISTINCT bmr."CUST_KEY") as count
             FROM bulk_meter_readings bmr
             JOIN bulk_meters bm ON bmr."CUST_KEY" = bm."customerKeyNumber"
             WHERE bmr."READING_DATE" >= CAST($1 || '-01' AS DATE)
               AND bmr."READING_DATE" < CAST($1 || '-01' AS DATE) + INTERVAL '1 month'
               ${branchId ? 'AND bm.branch_id = $2' : ''}`,
            params
        ),

        // 4a. Total bulk meters count
        query(
            `SELECT COUNT(*) as count FROM bulk_meters ${meterFilter ? meterFilter + " AND status != 'Pending Approval'" : "WHERE status != 'Pending Approval'"}`,
            branchId ? [branchId] : []
        ),

        // 4b. Individual customers count
        query(
            `SELECT COUNT(*) as count FROM individual_customers ${individualFilter}`,
            branchId ? [branchId] : []
        ),

        // 4c. Branch count
        query('SELECT COUNT(*) as count FROM branches'),

        // 5. Top delinquent accounts
        query(
            `SELECT
                COALESCE("CUSTOMERKEY", individual_customer_id) as key,
                COALESCE(
                    (SELECT name FROM individual_customers WHERE "customerKeyNumber" = bills.individual_customer_id),
                    (SELECT name FROM bulk_meters WHERE "customerKeyNumber" = bills."CUSTOMERKEY"),
                    'Unknown'
                ) as name,
                COALESCE("TOTALBILLAMOUNT", COALESCE("PENALTYAMT", 0) + COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0)))) as outstanding,
                CASE WHEN "CUSTOMERKEY" IS NOT NULL THEN 'Bulk' ELSE 'Individual' END as type
             FROM bills
             WHERE month_year = $1 AND payment_status = 'Unpaid' AND status = 'Posted' ${branchFilter}
             ORDER BY COALESCE("TOTALBILLAMOUNT", COALESCE("PENALTYAMT", 0) + COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0)))) DESC
             LIMIT 5`,
            params
        ),

        // 6. Branch performance breakdown
        query(
            `SELECT
                b.name as branch_name,
                COUNT(CASE WHEN bi.payment_status = 'Paid' THEN 1 END) as paid,
                COUNT(CASE WHEN bi.payment_status = 'Unpaid' THEN 1 END) as unpaid
             FROM branches b
             LEFT JOIN (
                 SELECT
                     COALESCE(
                         branch_id,
                         (SELECT branch_id FROM bulk_meters bm WHERE bm."customerKeyNumber" = bills."CUSTOMERKEY" LIMIT 1),
                         (SELECT branch_id FROM individual_customers ic WHERE ic."customerKeyNumber" = bills.individual_customer_id LIMIT 1),
                         (SELECT id FROM branches br WHERE TRIM(BOTH '\t' FROM TRIM(br.name)) = TRIM(BOTH '\t' FROM TRIM(bills."CUSTOMERBRANCH")) LIMIT 1)
                     ) as effective_branch_id,
                     payment_status
                 FROM bills
                 WHERE month_year = $1 AND status = 'Posted' AND deleted_at IS NULL
             ) bi ON bi.effective_branch_id = b.id
             ${perfBranchFilter}
             GROUP BY b.name`,
            params
        ),

        // 7. Water usage trend (last 6 months)
        query(
            `SELECT "month_year" as month, SUM("CONS") as usage
             FROM bills
             WHERE "CONS" IS NOT NULL AND status = 'Posted' ${usageBranchFilter}
             GROUP BY month
             ORDER BY month DESC
             LIMIT 6`,
            branchId ? [branchId] : []
        ),

        // 8a. Bills created today
        query(
            `SELECT COUNT(*) as count FROM bills WHERE DATE(created_at) = $1 AND deleted_at IS NULL ${todayBillsFilter}`,
            branchId ? [todayIso, branchId] : [todayIso]
        ).catch(() => [{ count: 0 }]),

        // 8b. Bulk meter readings today
        query(
            `SELECT COUNT(*) as count FROM bulk_meter_readings bmr ${todayReadingsBranchJoin}`,
            branchId ? [todayIso, branchId] : [todayIso]
        ).catch(() => [{ count: 0 }]),

        // 8c. Individual meter readings today
        query(
            `SELECT COUNT(*) as count FROM individual_customer_readings imr ${todayIndReadingsBranchJoin}`,
            branchId ? [todayIso, branchId] : [todayIso]
        ).catch(() => [{ count: 0 }]),

        // 8d. New customers today
        query(
            `SELECT COUNT(*) as count FROM individual_customers WHERE DATE(created_at) = $1 AND deleted_at IS NULL ${todayCustFilter}`,
            branchId ? [todayIso, branchId] : [todayIso]
        ).catch(() => [{ count: 0 }]),
    ]);

    // ── Step 4: Assemble result ───────────────────────────────────────────────
    const revenue = revenueData[0] || { total_billed: 0, total_collected: 0 };
    const totalCustomers = parseInt(totalCustomersData[0]?.count || 0);
    const currentReadings = parseInt(currentReadingsData[0]?.count || 0);

    return {
        latestMonth,
        billStatuses,
        revenue: {
            totalBilled: Number(revenue.total_billed || 0),
            totalCollected: Number(revenue.total_collected || 0),
            efficiency: (revenue.total_billed && Number(revenue.total_billed) > 0)
                ? (Number(revenue.total_collected || 0) / Number(revenue.total_billed)) * 100
                : 0,
        },
        readings: {
            totalCustomers,
            completedReadings: currentReadings,
            progress: totalCustomers > 0 ? (currentReadings / totalCustomers) * 100 : 0,
        },
        counts: {
            bulkMeters: parseInt(bulkMeterCountData[0]?.count || 0),
            individualCustomers: parseInt(individualCustomerCountData[0]?.count || 0),
            branches: parseInt(branchCountData[0]?.count || 0),
        },
        todayActivity: {
            bills: parseInt(todayBillsData[0]?.count || 0),
            readings: parseInt(todayBulkReadingsData[0]?.count || 0) + parseInt(todayIndReadingsData[0]?.count || 0),
            customers: parseInt(todayCustomersData[0]?.count || 0),
        },
        delinquent: {
            combined: topDelinquent,
        },
        branchPerformance: branchPerformance.map((bp: any) => ({
            branch: bp.branch_name,
            paid: parseInt(bp.paid || 0),
            unpaid: parseInt(bp.unpaid || 0),
        })),
        usageTrend: usageTrend.reverse().map((ut: any) => ({
            month: ut.month,
            usage: Number(ut.usage || 0),
        })),
    };
};







// =====================================================
// Recycle Bin Queries
// =====================================================

export const dbGetRecycleBinItems = async (branchId?: string) => {
    let sql = `
        SELECT rb.*, sm.name as deleted_by_name
        FROM recycle_bin rb
        LEFT JOIN staff_members sm ON rb.deleted_by = sm.id
        WHERE 1=1
    `;
    const params = [];
    if (branchId) {
        sql += ' AND sm.branch_id = $1';
        params.push(branchId);
    }
    sql += ' ORDER BY rb.deleted_at DESC';
    return await query(sql, params);
};

export const dbRestoreFromRecycleBin = async (recycleBinId: string) => {
    return await withTransaction(async (client) => {
        const rbRes = await client.query('SELECT * FROM recycle_bin WHERE id = $1', [recycleBinId]);
        const rb = rbRes.rows[0];
        if (!rb) throw new Error('Item not found in recycle bin');

        let tableName = '';
        let idColumn = '';

        switch (rb.entity_type) {
            case 'staff': tableName = 'staff_members'; idColumn = 'id'; break;
            case 'branch': tableName = 'branches'; idColumn = 'id'; break;
            case 'customer': tableName = 'individual_customers'; idColumn = '"customerKeyNumber"'; break;
            case 'bulk_meter': tableName = 'bulk_meters'; idColumn = '"customerKeyNumber"'; break;
            case 'route': tableName = 'routes'; idColumn = 'route_key'; break;
            case 'bill': {
                // When restoring a bill, add its unpaid amount back to the customer's outstanding balance
                const originalData = rb.original_data || {};
                const totalAmt = Number(originalData.TOTALBILLAMOUNT || 0);
                const paidAmt = Number(originalData.amount_paid || 0);
                const unpaidAmt = Number((totalAmt - paidAmt).toFixed(2));
                if (unpaidAmt > 0) {
                    if (originalData.CUSTOMERKEY) {
                        await client.query('UPDATE bulk_meters SET "outStandingbill" = COALESCE("outStandingbill", 0) + $1 WHERE "customerKeyNumber" = $2', [unpaidAmt, originalData.CUSTOMERKEY]);
                    } else if (originalData.individual_customer_id) {
                        await client.query('UPDATE individual_customers SET "outStandingbill" = COALESCE("outStandingbill", 0) + $1 WHERE "customerKeyNumber" = $2', [unpaidAmt, originalData.individual_customer_id]);
                    }
                }
                tableName = 'bills';
                idColumn = 'id';
                break;
            }
            case 'reading_individual': tableName = 'individual_customer_readings'; idColumn = 'id'; break;
            case 'reading_bulk': tableName = 'bulk_meter_readings'; idColumn = 'id'; break;
            case 'payment': tableName = 'payments'; idColumn = 'id'; break;
            case 'report': tableName = 'reports'; idColumn = 'id'; break;
            case 'notification': tableName = 'notifications'; idColumn = 'id'; break;
            case 'knowledge_base': tableName = 'knowledge_base_articles'; idColumn = 'id'; break;
            case 'fault_code': tableName = 'fault_codes'; idColumn = 'id'; break;
            default: throw new Error('Unknown entity type: ' + rb.entity_type);
        }

        await client.query(`UPDATE ${tableName} SET deleted_at = NULL, deleted_by = NULL WHERE ${idColumn} = $1`, [rb.entity_id]);
        await client.query('DELETE FROM recycle_bin WHERE id = $1', [recycleBinId]);
        return true;
    });
};

export const dbPermanentlyDeleteFromRecycleBin = async (recycleBinId: string) => {
    return await withTransaction(async (client) => {
        const rbRes = await client.query('SELECT * FROM recycle_bin WHERE id = $1', [recycleBinId]);
        const rb = rbRes.rows[0];
        if (!rb) throw new Error('Item not found in recycle bin');

        let tableName = '';
        let idColumn = '';

        switch (rb.entity_type) {
            case 'staff': tableName = 'staff_members'; idColumn = 'id'; break;
            case 'branch': tableName = 'branches'; idColumn = 'id'; break;
            case 'customer': tableName = 'individual_customers'; idColumn = '"customerKeyNumber"'; break;
            case 'bulk_meter': tableName = 'bulk_meters'; idColumn = '"customerKeyNumber"'; break;
            case 'route': tableName = 'routes'; idColumn = 'route_key'; break;
            case 'bill':
                // Delete related records first to avoid foreign key constraints
                await client.query('DELETE FROM bill_workflow_logs WHERE bill_id = $1', [rb.entity_id]);
                await client.query('DELETE FROM payments WHERE bill_id = $1', [rb.entity_id]);
                tableName = 'bills';
                idColumn = 'id';
                break;
            case 'reading_individual': tableName = 'individual_customer_readings'; idColumn = 'id'; break;
            case 'reading_bulk': tableName = 'bulk_meter_readings'; idColumn = 'id'; break;
            case 'payment': tableName = 'payments'; idColumn = 'id'; break;
            case 'report': tableName = 'reports'; idColumn = 'id'; break;
            case 'notification': tableName = 'notifications'; idColumn = 'id'; break;
            case 'knowledge_base': tableName = 'knowledge_base_articles'; idColumn = 'id'; break;
            case 'fault_code': tableName = 'fault_codes'; idColumn = 'id'; break;
            default: throw new Error('Unknown entity type: ' + rb.entity_type);
        }

        await client.query(`DELETE FROM ${tableName} WHERE ${idColumn} = $1`, [rb.entity_id]);
        await client.query('DELETE FROM recycle_bin WHERE id = $1', [recycleBinId]);
        return true;
    });
};

export const dbGetAllPromotions = async () => {
    return await query('SELECT * FROM promotions ORDER BY display_order ASC, created_at DESC');
};

export const dbGetActivePromotions = async () => {
    return await query('SELECT * FROM promotions WHERE is_active = true ORDER BY display_order ASC, created_at DESC');
};

export const dbCreatePromotion = async (promotion: any) => {
    const keys = Object.keys(promotion);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO promotions (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => promotion[k]));
    return rows[0];
};

export const dbUpdatePromotion = async (id: string, promotion: any) => {
    const keys = Object.keys(promotion);
    if (keys.length === 0) return null;
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows: any = await query(`UPDATE promotions SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => promotion[k]), id]);
    return rows[0] || null;
};

export const dbDeletePromotion = async (id: string) => {
    await query('DELETE FROM promotions WHERE id = $1', [id]);
    return { success: true };
};

export const dbValidateApiKey = async (apiKey: string) => {
    // Standard implementation: check against an environment variable for internal access
    const internalKey = process.env.INTERNAL_API_KEY || 'aawsa-internal-secret-2026';
    return apiKey === internalKey;
};

// -----------------------------------------------------------------
// 12. BILLING JOBS (Scalability Phase 2)
// -----------------------------------------------------------------

export const dbCreateBillingJob = async (job: { type: string; month_year: string; total_items: number; carry_balance: boolean; branch_id?: string; period_start_date?: string; period_end_date?: string; due_date_offset_days?: number; allow_overlap?: boolean }) => {
    const keys = Object.keys(job);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO billing_jobs (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => (job as any)[k]));
    return rows[0];
};

export const dbUpdateBillingJob = async (id: string, updates: any, client?: any) => {
    const keys = Object.keys(updates);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const sql = `UPDATE billing_jobs SET ${setClause} WHERE id = $1 RETURNING *`;
    const qFunc = client ? client.query.bind(client) : query;
    const res = await qFunc(sql, [id, ...keys.map(k => updates[k])]);
    const rows = client ? res.rows : res;
    return rows[0] || null;
};

export const dbGetBillingJob = async (id: string) => {
    const rows: any = await query('SELECT * FROM billing_jobs WHERE id = $1', [id]);
    return rows[0];
};

export const dbGetActiveBillingJobs = async (monthYear: string, type: string, branchId?: string) => {
    let sql = `
        SELECT * FROM billing_jobs 
        WHERE month_year = $1 AND type = $2 AND status IN ('pending', 'processing')
    `;
    const params: any[] = [monthYear, type];
    if (branchId) {
        sql += ` AND (branch_id = $3 OR branch_id IS NULL)`;
        params.push(branchId);
    }
    sql += ` ORDER BY created_at DESC`;
    return await query(sql, params);
};

export const dbGetUnprocessedMetersForJob = async (job: any, limit: number) => {
    let sql = `
        SELECT * FROM bulk_meters 
        WHERE status = 'Active' 
        AND deleted_at IS NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (job.branch_id) {
        sql += ` AND branch_id = $${paramIndex++}`;
        params.push(job.branch_id);
    }

    if (job.last_processed_id) {
        sql += ` AND "customerKeyNumber" > $${paramIndex++}`;
        params.push(job.last_processed_id);
    }

    sql += ` ORDER BY "customerKeyNumber" ASC LIMIT $${paramIndex++}`;
    params.push(limit);

    return await query(sql, params);
};

export const dbGetUnprocessedIndividualCustomersForJob = async (job: any, limit: number) => {
    let sql = `
        SELECT * FROM individual_customers 
        WHERE status = 'Active' 
        AND deleted_at IS NULL
        AND "assignedBulkMeterId" IS NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (job.branch_id) {
        sql += ` AND branch_id = $${paramIndex++}`;
        params.push(job.branch_id);
    }

    if (job.last_processed_id) {
        sql += ` AND "customerKeyNumber" > $${paramIndex++}`;
        params.push(job.last_processed_id);
    }

    sql += ` ORDER BY "customerKeyNumber" ASC LIMIT $${paramIndex++}`;
    params.push(limit);

    return await query(sql, params);
};

/**
 * High-performance batch insertion for bills.
 * Uses UNNEST with arrays for much faster insertion than individual INSERTs.
 */
export const dbBatchInsertBills = async (bills: any[], client?: any) => {
    if (bills.length === 0) return [];

    const qFunc = client ? client.query.bind(client) : query;

    // Soft-delete any existing active bills for these customers and months
    // so re-running or overlapping bill creation does not violate the partial unique index.
    const monthYears = Array.from(new Set(bills.map(b => b.month_year).filter(Boolean)));
    const bulkKeys = Array.from(new Set(bills.map(b => b.CUSTOMERKEY).filter(Boolean)));
    const indivKeys = Array.from(new Set(bills.map(b => b.individual_customer_id).filter(Boolean)));

    if (monthYears.length > 0) {
        if (bulkKeys.length > 0) {
            await qFunc(
                `UPDATE bills SET deleted_at = NOW(), deleted_by = '00000000-0000-0000-0000-000000000000'::uuid
                 WHERE deleted_at IS NULL AND month_year = ANY($1) AND "CUSTOMERKEY" = ANY($2)`,
                [monthYears, bulkKeys]
            );
        }
        if (indivKeys.length > 0) {
            await qFunc(
                `UPDATE bills SET deleted_at = NOW(), deleted_by = '00000000-0000-0000-0000-000000000000'::uuid
                 WHERE deleted_at IS NULL AND month_year = ANY($1) AND individual_customer_id = ANY($2)`,
                [monthYears, indivKeys]
            );
        }
    }

    // Map all fields in the bills table with their PostgreSQL types.
    // Explicit types are REQUIRED for unnest() — without them PostgreSQL
    // cannot resolve the overload when the array contains only null values.
    const columnDefs: { name: string; pgType: string }[] = [
        { name: 'id',                       pgType: 'uuid' },
        { name: 'BILLKEY',                  pgType: 'text' },
        { name: 'CUSTOMERKEY',              pgType: 'text' },
        { name: 'CUSTOMERNAME',             pgType: 'text' },
        { name: 'CUSTOMERTIN',              pgType: 'text' },
        { name: 'CUSTOMERBRANCH',           pgType: 'text' },
        { name: 'REASON',                   pgType: 'text' },
        { name: 'CURRREAD',                 pgType: 'numeric' },
        { name: 'PREVREAD',                 pgType: 'numeric' },
        { name: 'CONS',                     pgType: 'numeric' },
        { name: 'TOTALBILLAMOUNT',          pgType: 'numeric' },
        { name: 'THISMONTHBILLAMT',         pgType: 'numeric' },
        { name: 'OUTSTANDINGAMT',           pgType: 'numeric' },
        { name: 'PENALTYAMT',              pgType: 'numeric' },
        { name: 'DRACCTNO',                pgType: 'text' },
        { name: 'CRACCTNO',                pgType: 'text' },
        { name: 'individual_customer_id',  pgType: 'text' },
        { name: 'bill_period_start_date',  pgType: 'date' },
        { name: 'bill_period_end_date',    pgType: 'date' },
        { name: 'month_year',              pgType: 'text' },
        { name: 'difference_usage',        pgType: 'numeric' },
        { name: 'base_water_charge',       pgType: 'numeric' },
        { name: 'sewerage_charge',         pgType: 'numeric' },
        { name: 'maintenance_fee',         pgType: 'numeric' },
        { name: 'sanitation_fee',          pgType: 'numeric' },
        { name: 'meter_rent',              pgType: 'numeric' },
        { name: 'balance_carried_forward', pgType: 'numeric' },
        { name: 'amount_paid',             pgType: 'numeric' },
        { name: 'due_date',                pgType: 'date' },
        { name: 'payment_status',          pgType: 'text' },
        { name: 'status',                  pgType: 'text' },
        { name: 'bill_number',             pgType: 'text' },
        { name: 'notes',                   pgType: 'text' },
        { name: 'vat_amount',              pgType: 'numeric' },
        { name: 'additional_fees_charge',          pgType: 'numeric' },
        { name: 'additional_fees_breakdown',       pgType: 'jsonb' },
        { name: 'debit_30',                pgType: 'numeric' },
        { name: 'debit_30_60',             pgType: 'numeric' },
        { name: 'debit_60',                pgType: 'numeric' },
        { name: 'branch_id',               pgType: 'uuid' },
        { name: 'snapshot_data',           pgType: 'jsonb' },
    ];

    const colNames = columnDefs.map(c => `"${c.name}"`).join(', ');
    // Each placeholder is cast to its explicit type so PostgreSQL can resolve unnest()
    const placeholders = columnDefs.map((c, i) => `unnest($${i + 1}::${c.pgType}[])`).join(', ');

    const sql = `
        INSERT INTO bills (${colNames})
        SELECT ${placeholders}
        RETURNING *
    `;

    // Build one array per column.
    // JSONB fields must be serialized to strings so PostgreSQL's unnest(::jsonb[])
    // can parse them correctly — pg driver does not auto-stringify object array elements.
    const columnData = columnDefs.map(c => bills.map(b => {
        const val = (b as any)[c.name];
        if (val === undefined || val === null) return null;
        if (c.pgType === 'jsonb') {
            return typeof val === 'string' ? val : JSON.stringify(val);
        }
        return val;
    }));

    const res = await qFunc(sql, columnData);
    const rows = client ? res.rows : res;
    return rows;
};


// --- Paginated Reports ---

export const dbGetUnsettledBillsPaginated = async (params: {
    limit: number;
    offset: number;
    searchTerm?: string;
    branchId?: string;
    monthYear?: string;
    statusFilter?: 'all' | 'overdue' | 'unpaid';
    excludeUnfinalized?: boolean;
}) => {
    let sql = `
        SELECT b.*,
               c."customerType" as customer_type,
               bm.charge_group as charge_group
        FROM bills b
        LEFT JOIN individual_customers c ON b.individual_customer_id = c."customerKeyNumber"
        LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
        WHERE b.deleted_at IS NULL 
          AND (LOWER(TRIM(COALESCE(b.payment_status::text, ''))) != 'paid' OR b.payment_status IS NULL)
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.excludeUnfinalized) {
        sql += " AND b.status = 'Posted'";
    }

    if (params.branchId && params.branchId !== 'all') {
        sql += ` AND b.branch_id = $${paramIndex++}`;
        queryParams.push(params.branchId);
    }

    if (params.monthYear && params.monthYear !== 'all') {
        sql += ` AND b.month_year = $${paramIndex++}`;
        queryParams.push(params.monthYear);
    }

    if (params.statusFilter === 'overdue') {
        sql += ` AND b.due_date < NOW()`;
    } else if (params.statusFilter === 'unpaid') {
        sql += ` AND (b.due_date IS NULL OR b.due_date >= NOW())`;
    }

    if (params.searchTerm) {
        sql += ` AND (b."BILLKEY" ILIKE $${paramIndex} OR b."CUSTOMERNAME" ILIKE $${paramIndex} OR b."CUSTOMERKEY" ILIKE $${paramIndex} OR b.individual_customer_id ILIKE $${paramIndex})`;
        queryParams.push(`%${params.searchTerm}%`);
        paramIndex++;
    }

    sql += ` ORDER BY b.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(params.limit, params.offset);

    return await query(sql, queryParams);
};

export const dbGetUnsettledBillsCount = async (params: {
    searchTerm?: string;
    branchId?: string;
    monthYear?: string;
    statusFilter?: 'all' | 'overdue' | 'unpaid';
    excludeUnfinalized?: boolean;
}) => {
    let sql = `SELECT COUNT(*) FROM bills WHERE deleted_at IS NULL AND (LOWER(TRIM(COALESCE(payment_status::text, ''))) != 'paid' OR payment_status IS NULL)`;
    if (params.excludeUnfinalized) {
        sql += " AND status = 'Posted'";
    }
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.branchId && params.branchId !== 'all') {
        sql += ` AND branch_id = $${paramIndex++}`;
        queryParams.push(params.branchId);
    }

    if (params.monthYear && params.monthYear !== 'all') {
        sql += ` AND month_year = $${paramIndex++}`;
        queryParams.push(params.monthYear);
    }

    if (params.statusFilter === 'overdue') {
        sql += ` AND due_date < NOW()`;
    } else if (params.statusFilter === 'unpaid') {
        sql += ` AND (due_date IS NULL OR due_date >= NOW())`;
    }

    if (params.searchTerm) {
        sql += ` AND ("BILLKEY" ILIKE $${paramIndex} OR "CUSTOMERNAME" ILIKE $${paramIndex} OR "CUSTOMERKEY" ILIKE $${paramIndex} OR individual_customer_id ILIKE $${paramIndex})`;
        queryParams.push(`%${params.searchTerm}%`);
    }

    const rows: any = await query(sql, queryParams);
    return parseInt(rows[0].count);
};

export const dbEnsurePaymentColumnsExist = async () => {
    try {
        const columns = [
            { name: 'reconciliation_status', def: "text DEFAULT 'Not reconciled'" },
            { name: 'payment_channel', def: 'text' },
            { name: 'bank_ref', def: 'text' },
            { name: 'last_payment_date', def: 'timestamp with time zone' },
            { name: 'phone', def: 'text' },
            { name: 'route_key', def: 'text' },
            { name: 'walk_order', def: 'integer' },
            { name: 'meter_key', def: 'text' },
        ];
        
        for (const col of columns) {
            try {
                await query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`);
            } catch (colErr) {
                console.error(`[DB] Failed to add column '${col.name}':`, colErr);
            }
        }
    } catch (e) {
        console.error('[DB] Error ensuring payment columns exist:', e);
    }
};

export const dbGetPaidBillsPaginated = async (params: {
    limit: number;
    offset: number;
    searchTerm?: string;
    branchId?: string;
    monthYear?: string;
    excludeUnfinalized?: boolean;
}) => {
    let sql = `
        SELECT b.*,
               COALESCE(NULLIF(b.phone, '-'), bm."phoneNumber", c.phone_number, '-') as phone_computed,
               COALESCE(NULLIF(b.meter_key, '-'), bm."METER_KEY", c."METER_KEY", '-') as meter_key_computed,
               COALESCE(NULLIF(b.route_key, '-'), bm."ROUTE_KEY", c."ROUTE_KEY", '-') as route_key_computed,
               COALESCE(b.walk_order, bm.ordinal, c.ordinal) as walk_order_computed,
               COALESCE(b.reconciliation_status, 'Not reconciled') as reconciliation_status_computed,
               br.name as branch_name,
               c."customerType" as customer_type,
               bm.charge_group as charge_group
        FROM bills b
        LEFT JOIN bulk_meters bm ON (b."CUSTOMERKEY" = bm."customerKeyNumber" OR b.individual_customer_id = bm."customerKeyNumber")
        LEFT JOIN individual_customers c ON (b.individual_customer_id = c."customerKeyNumber" OR b."CUSTOMERKEY" = c."customerKeyNumber")
        LEFT JOIN branches br ON COALESCE(b.branch_id, bm.branch_id, c.branch_id) = br.id
        WHERE b.deleted_at IS NULL
          AND (
            LOWER(TRIM(COALESCE(b.payment_status::text, ''))) = 'paid'
            OR COALESCE(b.amount_paid, 0) > 0
            OR LOWER(TRIM(COALESCE(b.reconciliation_status, ''))) = 'reconciled'
            OR (b.bank_ref IS NOT NULL AND b.bank_ref <> '' AND b.bank_ref <> '-')
          )
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.branchId && params.branchId !== 'all') {
        sql += ` AND (b.branch_id::text ILIKE $${paramIndex} OR c.branch_id::text ILIKE $${paramIndex} OR bm.branch_id::text ILIKE $${paramIndex} OR b."CUSTOMERBRANCH" ILIKE $${paramIndex} OR br.name ILIKE $${paramIndex})`;
        queryParams.push(params.branchId);
        paramIndex++;
    }

    if (params.monthYear) {
        sql += ` AND b.month_year = $${paramIndex++}`;
        queryParams.push(params.monthYear);
    }

    if (params.searchTerm) {
        sql += ` AND (b."BILLKEY" ILIKE $${paramIndex} OR b."CUSTOMERNAME" ILIKE $${paramIndex} OR b."CUSTOMERKEY" ILIKE $${paramIndex} OR b.individual_customer_id ILIKE $${paramIndex})`;
        queryParams.push(`%${params.searchTerm}%`);
        paramIndex++;
    }

    sql += ` ORDER BY COALESCE(b.last_payment_date, b.updated_at, b.created_at) DESC NULLS LAST LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(params.limit, params.offset);

    return await query(sql, queryParams);
};

export const dbGetPaidBillsCount = async (params: {
    searchTerm?: string;
    branchId?: string;
    monthYear?: string;
    excludeUnfinalized?: boolean;
}) => {
    let sql = `
        SELECT COUNT(*) as count
        FROM bills b
        LEFT JOIN bulk_meters bm ON (b."CUSTOMERKEY" = bm."customerKeyNumber" OR b.individual_customer_id = bm."customerKeyNumber")
        LEFT JOIN individual_customers c ON (b.individual_customer_id = c."customerKeyNumber" OR b."CUSTOMERKEY" = c."customerKeyNumber")
        LEFT JOIN branches br ON COALESCE(b.branch_id, bm.branch_id, c.branch_id) = br.id
        WHERE b.deleted_at IS NULL
          AND (
            LOWER(TRIM(COALESCE(b.payment_status::text, ''))) = 'paid'
            OR COALESCE(b.amount_paid, 0) > 0
            OR LOWER(TRIM(COALESCE(b.reconciliation_status, ''))) = 'reconciled'
            OR (b.bank_ref IS NOT NULL AND b.bank_ref <> '' AND b.bank_ref <> '-')
          )
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.branchId && params.branchId !== 'all') {
        sql += ` AND (b.branch_id::text ILIKE $${paramIndex} OR c.branch_id::text ILIKE $${paramIndex} OR bm.branch_id::text ILIKE $${paramIndex} OR b."CUSTOMERBRANCH" ILIKE $${paramIndex} OR br.name ILIKE $${paramIndex})`;
        queryParams.push(params.branchId);
        paramIndex++;
    }

    if (params.monthYear) {
        sql += ` AND b.month_year = $${paramIndex++}`;
        queryParams.push(params.monthYear);
    }

    if (params.searchTerm) {
        sql += ` AND (b."BILLKEY" ILIKE $${paramIndex} OR b."CUSTOMERNAME" ILIKE $${paramIndex} OR b."CUSTOMERKEY" ILIKE $${paramIndex} OR b.individual_customer_id ILIKE $${paramIndex})`;
        queryParams.push(`%${params.searchTerm}%`);
        paramIndex++;
    }

    const rows: any = await query(sql, queryParams);
    return parseInt(rows[0]?.count || '0', 10);
};

export const dbBatchUpdatePaymentsFromCsv = async (records: Array<{
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
}>, staffId?: string) => {
    await dbEnsurePaymentColumnsExist();
    let updatedCount = 0;
    const errors: Array<{ row: number; error: string }> = [];
    const affectedBulkKeys = new Set<string>();

    if (!records || records.length === 0) {
        return { success: true, updatedCount: 0, errors: [] };
    }

    const cleanKey = (val?: string) => (val || '').replace(/^(BBPT|BILL|BM|IND|CUST|METER)[-_]?/i, '').replace(/[^a-zA-Z0-9]/g, '').trim().toLowerCase();

    // Collect all raw keys for bulk pre-fetching
    const rawBillKeys = new Set<string>();
    const rawCustKeys = new Set<string>();
    const rawMeterKeys = new Set<string>();

    for (const rec of records) {
        if (rec.billKey?.trim()) rawBillKeys.add(rec.billKey.trim());
        if (rec.customerKey?.trim()) rawCustKeys.add(rec.customerKey.trim());
        if (rec.meterKey?.trim() && rec.meterKey.trim() !== '-') rawMeterKeys.add(rec.meterKey.trim());
    }

    // Fast in-memory lookup map
    const billMap = new Map<string, any>();

    // 1. Bulk pre-fetch by Bill Keys / Numbers
    if (rawBillKeys.size > 0) {
        const keyList = Array.from(rawBillKeys);
        try {
            const rows: any = await query(`
                SELECT * FROM bills 
                WHERE TRIM("BILLKEY") = ANY($1) 
                   OR bill_number = ANY($1)
                   OR id::text = ANY($1)
                   OR "BILLKEY" ILIKE ANY($1)
            `, [keyList]);
            for (const b of (rows || [])) {
                if (b.id) billMap.set(b.id.toString(), b);
                if (b.BILLKEY) billMap.set(b.BILLKEY.trim(), b);
                if (b.bill_number) billMap.set(b.bill_number.trim(), b);
                const cBk = cleanKey(b.BILLKEY);
                if (cBk) billMap.set(`clean_${cBk}`, b);
                const cBn = cleanKey(b.bill_number);
                if (cBn) billMap.set(`clean_${cBn}`, b);
            }
        } catch (e) {
            console.warn('Pre-fetch by Bill Key warning:', e);
        }
    }

    // 2. Bulk pre-fetch by Customer Keys
    if (rawCustKeys.size > 0) {
        const keyList = Array.from(rawCustKeys);
        try {
            const rows: any = await query(`
                SELECT * FROM bills 
                WHERE individual_customer_id = ANY($1) 
                   OR "CUSTOMERKEY" = ANY($1)
                   OR individual_customer_id ILIKE ANY($1)
                   OR "CUSTOMERKEY" ILIKE ANY($1)
                ORDER BY CASE WHEN LOWER(COALESCE(payment_status::text, '')) = 'unpaid' THEN 0 ELSE 1 END, created_at DESC
            `, [keyList]);
            for (const b of (rows || [])) {
                if (b.individual_customer_id && !billMap.has(`cust_${b.individual_customer_id.trim()}`)) {
                    billMap.set(`cust_${b.individual_customer_id.trim()}`, b);
                }
                if (b.CUSTOMERKEY && !billMap.has(`cust_${b.CUSTOMERKEY.trim()}`)) {
                    billMap.set(`cust_${b.CUSTOMERKEY.trim()}`, b);
                }
                const cCust = cleanKey(b.individual_customer_id || b.CUSTOMERKEY);
                if (cCust && !billMap.has(`clean_cust_${cCust}`)) {
                    billMap.set(`clean_cust_${cCust}`, b);
                }
            }
        } catch (e) {
            console.warn('Pre-fetch by Customer Key warning:', e);
        }
    }

    // 3. Bulk pre-fetch by Meter Keys
    if (rawMeterKeys.size > 0) {
        const keyList = Array.from(rawMeterKeys);
        try {
            const rows: any = await query(`
                SELECT b.*, c."METER_KEY" as cust_meter, bm."METER_KEY" as bulk_meter FROM bills b
                LEFT JOIN individual_customers c ON (b.individual_customer_id = c."customerKeyNumber" OR b."CUSTOMERKEY" = c."customerKeyNumber")
                LEFT JOIN bulk_meters bm ON (b."CUSTOMERKEY" = bm."customerKeyNumber" OR b.individual_customer_id = bm."customerKeyNumber")
                WHERE TRIM(c."METER_KEY") = ANY($1) OR TRIM(bm."METER_KEY") = ANY($1) OR TRIM(b.meter_key) = ANY($1)
                ORDER BY CASE WHEN LOWER(COALESCE(b.payment_status::text, '')) = 'unpaid' THEN 0 ELSE 1 END, b.created_at DESC
            `, [keyList]);
            for (const b of (rows || [])) {
                const mk = b.meter_key || b.cust_meter || b.bulk_meter;
                if (mk && !billMap.has(`meter_${mk.trim()}`)) {
                    billMap.set(`meter_${mk.trim()}`, b);
                }
                const cMk = cleanKey(mk);
                if (cMk && !billMap.has(`clean_meter_${cMk}`)) {
                    billMap.set(`clean_meter_${cMk}`, b);
                }
            }
        } catch (e) {
            console.warn('Pre-fetch by Meter Key warning:', e);
        }
    }

    // Helper for fast in-memory target bill resolution
    const findTargetBill = async (rawBillKey: string, rawCustKey: string, rawMeterKey: string, cBillKey: string, cCustKey: string, cMeterKey: string) => {
        // 1. By exact or clean Bill Key
        if (rawBillKey) {
            let found = billMap.get(rawBillKey) || billMap.get(`clean_${cBillKey}`);
            if (found) return found;
        }

        // 2. By exact or clean Customer Key
        if (rawCustKey) {
            let found = billMap.get(`cust_${rawCustKey}`) || billMap.get(`clean_cust_${cCustKey}`);
            if (found) return found;
        }

        // 3. By exact or clean Meter Key
        if (rawMeterKey && rawMeterKey !== '-') {
            let found = billMap.get(`meter_${rawMeterKey}`) || billMap.get(`clean_meter_${cMeterKey}`);
            if (found) return found;
        }

        // Fallback to single SQL query if not found in pre-fetched map
        if (rawBillKey) {
            const rows: any = await query(`
                SELECT * FROM bills 
                WHERE TRIM("BILLKEY") ILIKE TRIM($1) 
                   OR id::text ILIKE TRIM($1) 
                   OR TRIM(bill_number) ILIKE TRIM($1)
                   OR ($2 <> '' AND (
                       REPLACE(REPLACE(TRIM("BILLKEY"), 'BBPT-', ''), '-', '') ILIKE $2
                       OR REPLACE(REPLACE(TRIM(bill_number), 'BBPT-', ''), '-', '') ILIKE $2
                   ))
                LIMIT 1
            `, [rawBillKey, cBillKey ? `%${cBillKey}%` : '']);
            if (rows && rows[0]) return rows[0];
        }

        if (rawCustKey) {
            const rows: any = await query(`
                SELECT * FROM bills 
                WHERE (individual_customer_id ILIKE TRIM($1) OR "CUSTOMERKEY" ILIKE TRIM($1))
                   OR ($2 <> '' AND (
                       REPLACE(REPLACE(TRIM(individual_customer_id), 'BM-', ''), '-', '') ILIKE $2
                       OR REPLACE(REPLACE(TRIM("CUSTOMERKEY"), 'BM-', ''), '-', '') ILIKE $2
                   ))
                ORDER BY CASE WHEN LOWER(COALESCE(payment_status::text, '')) = 'unpaid' THEN 0 ELSE 1 END, created_at DESC 
                LIMIT 1
            `, [rawCustKey, cCustKey ? `%${cCustKey}%` : '']);
            if (rows && rows[0]) return rows[0];
        }

        if (rawMeterKey && rawMeterKey !== '-') {
            const rows: any = await query(`
                SELECT b.* FROM bills b
                LEFT JOIN individual_customers c ON (b.individual_customer_id = c."customerKeyNumber" OR b."CUSTOMERKEY" = c."customerKeyNumber")
                LEFT JOIN bulk_meters bm ON (b."CUSTOMERKEY" = bm."customerKeyNumber" OR b.individual_customer_id = bm."customerKeyNumber")
                WHERE TRIM(c."METER_KEY") ILIKE TRIM($1) OR TRIM(bm."METER_KEY") ILIKE TRIM($1) OR TRIM(b.meter_key) ILIKE TRIM($1)
                   OR ($2 <> '' AND (
                       REPLACE(REPLACE(TRIM(c."METER_KEY"), 'METER-', ''), '-', '') ILIKE $2
                       OR REPLACE(REPLACE(TRIM(bm."METER_KEY"), 'METER-', ''), '-', '') ILIKE $2
                   ))
                ORDER BY CASE WHEN LOWER(COALESCE(b.payment_status::text, '')) = 'unpaid' THEN 0 ELSE 1 END, b.created_at DESC 
                LIMIT 1
            `, [rawMeterKey, cMeterKey ? `%${cMeterKey}%` : '']);
            if (rows && rows[0]) return rows[0];
        }

        return null;
    };

    const processedBillIds = new Set<string>();

    const resolveExistingIndividualCustomerId = async (customerId?: string | null) => {
        if (!customerId) return null;
        const rows: any = await query(`
            SELECT 1 FROM individual_customers
            WHERE "customerKeyNumber" = $1
            LIMIT 1
        `, [customerId]);
        return rows && rows.length > 0 ? customerId : null;
    };

    // Execute row updates independently to guarantee total row isolation and prevent transaction aborts
    for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const rowNum = i + 1;

        try {
            const rawBillKey = rec.billKey?.trim() || '';
            const rawCustKey = rec.customerKey?.trim() || '';
            const rawMeterKey = rec.meterKey?.trim() || '';

            const cBillKey = cleanKey(rawBillKey);
            const cCustKey = cleanKey(rawCustKey);
            const cMeterKey = cleanKey(rawMeterKey);

            if (!rawBillKey && !rawCustKey && !rawMeterKey) {
                errors.push({ row: rowNum, error: 'Neither Bill Key, Customer Key, nor Meter Key was provided.' });
                continue;
            }

            const targetBill = await findTargetBill(rawBillKey, rawCustKey, rawMeterKey, cBillKey, cCustKey, cMeterKey);

            if (!targetBill) {
                errors.push({
                    row: rowNum,
                    error: `Bill not found for Bill Key "${rawBillKey || ''}" / Customer Key "${rawCustKey || ''}" / Meter Key "${rawMeterKey || ''}". Please confirm that the bill exists in this database and that the provided identifiers are correct.`
                });
                continue;
            }

            const billIdent = targetBill.BILLKEY || targetBill.bill_number || targetBill.id || rawBillKey || 'Bill';

            // Check if already processed in this CSV upload batch (Duplicate check)
            if (processedBillIds.has(billIdent)) {
                errors.push({ row: rowNum, error: `Bill "${billIdent}" is duplicate in CSV file. Skipped.` });
                continue;
            }

            // Note: We allow CSV updates even if bill has partial payment info
            // The CSV is the source of truth for payment reconciliation
            const existingPaymentStatus = String(targetBill.payment_status || '').trim().toLowerCase();
            const existingReconStatus = String(targetBill.reconciliation_status || '').trim().toLowerCase();
            const existingBankRef = String(targetBill.bank_ref || '').trim();
            
            if (existingPaymentStatus === 'paid' && existingReconStatus === 'reconciled') {
                errors.push({
                    row: rowNum,
                    error: `Bill "${billIdent}" is already marked as paid and reconciled. No further update was applied.`
                });
                continue;
            }

            // Debug logging for payment status
            if (existingPaymentStatus === 'paid' && existingReconStatus === 'reconciled' && existingBankRef && existingBankRef !== '-') {
                console.log(`Row ${rowNum} - Bill "${billIdent}" current status:`, {
                    payment_status: targetBill.payment_status,
                    reconciliation_status: targetBill.reconciliation_status,
                    bank_ref: targetBill.bank_ref,
                    csv_bank_ref: rec.bankRef
                });
            }



            // Validate that provided CSV values do not contradict the existing sent bill
            const rowContradictions: string[] = [];
            const cleanStrVal = (val: any) => (val === undefined || val === null ? '' : String(val).replace(/[-_\s]+/g, '').trim().toLowerCase());
            const cleanKeyVal = (val: string) => (val || '').replace(/^(BBPT|BILL|BM|IND|CUST|METER)[-_]?/i, '').replace(/[^a-zA-Z0-9]/g, '').trim().toLowerCase();

            // 1. Customer Key
            if (rawCustKey && rawCustKey !== '-') {
                const targetCustKey = targetBill.individual_customer_id || targetBill.CUSTOMERKEY || '';
                if (targetCustKey && cleanKeyVal(rawCustKey) !== cleanKeyVal(targetCustKey)) {
                    rowContradictions.push(`Customer Key "${rawCustKey}" contradicts existing bill Customer Key ("${targetCustKey}")`);
                }
            }

            // 2. Customer Name
            const rawCustName = rec.customerName?.trim();
            if (rawCustName && rawCustName !== '-' && targetBill.CUSTOMERNAME) {
                if (rawCustName.toLowerCase() !== targetBill.CUSTOMERNAME.trim().toLowerCase()) {
                    rowContradictions.push(`Customer Name "${rawCustName}" contradicts existing bill Customer Name ("${targetBill.CUSTOMERNAME}")`);
                }
            }

            // 3. Branch
            const rawBranch = rec.branch?.trim();
            if (rawBranch && rawBranch !== '-' && targetBill.CUSTOMERBRANCH) {
                if (rawBranch.toLowerCase() !== targetBill.CUSTOMERBRANCH.trim().toLowerCase()) {
                    rowContradictions.push(`Branch "${rawBranch}" contradicts existing bill Branch ("${targetBill.CUSTOMERBRANCH}")`);
                }
            }

            // 4. Amount
            // The CSV is the source of truth for payment reconciliation, so an amount
            // LOWER than the bill total is treated as a mismatch (partial payments go
            // through other channels). An amount HIGHER than the bill is an
            // overpayment (duplicate transaction / bill corrected downward) — the
            // credit-note engine turns the excess into a deposit on the meter, so it
            // is allowed through and linked to this bill (source_bill_id).
            if (rec.amount !== undefined && rec.amount !== null && !isNaN(Number(rec.amount))) {
                const csvAmount = Number(rec.amount);
                const billAmount = Number(targetBill.TOTALBILLAMOUNT || 0);
                if (billAmount > 0 && csvAmount < billAmount - 0.05) {
                    rowContradictions.push(`Amount (${csvAmount}) contradicts existing bill total amount (${billAmount})`);
                }
            }

            // 5. Phone
            const rawPhone = rec.phone?.trim();
            if (rawPhone && rawPhone !== '-' && targetBill.phone && targetBill.phone !== '-') {
                if (cleanStrVal(rawPhone) !== cleanStrVal(targetBill.phone)) {
                    rowContradictions.push(`Phone "${rawPhone}" contradicts existing bill Phone ("${targetBill.phone}")`);
                }
            }

            // 6. Route Key
            const rawRouteKey = rec.routeKey?.trim();
            if (rawRouteKey && rawRouteKey !== '-' && targetBill.route_key && targetBill.route_key !== '-') {
                if (cleanStrVal(rawRouteKey) !== cleanStrVal(targetBill.route_key)) {
                    rowContradictions.push(`Route Key "${rawRouteKey}" contradicts existing bill Route Key ("${targetBill.route_key}")`);
                }
            }

            // 7. Walk Order
            const strWalkOrder = rec.walkOrder !== undefined && rec.walkOrder !== null ? String(rec.walkOrder).trim() : '';
            if (strWalkOrder !== '' && strWalkOrder !== '-' && !isNaN(Number(strWalkOrder))) {
                const csvWalkOrder = Number(strWalkOrder);
                if (targetBill.walk_order !== null && targetBill.walk_order !== undefined && csvWalkOrder !== Number(targetBill.walk_order)) {
                    rowContradictions.push(`Walk Order (${csvWalkOrder}) contradicts existing bill Walk Order (${targetBill.walk_order})`);
                }
            }

            // 8. Meter Key
            if (rawMeterKey && rawMeterKey !== '-' && targetBill.meter_key && targetBill.meter_key !== '-') {
                if (cleanKeyVal(rawMeterKey) !== cleanKeyVal(targetBill.meter_key)) {
                    rowContradictions.push(`Meter Key "${rawMeterKey}" contradicts existing bill Meter Key ("${targetBill.meter_key}")`);
                }
            }

            if (rowContradictions.length > 0) {
                errors.push({
                    row: rowNum,
                    error: `Payment CSV row does not match existing bill ${billIdent}. Please ensure Bill Key, Customer Key, Customer Name, Branch, and Amount are correct. Details: ${rowContradictions.join('; ')}`
                });
                continue;
            }

            const amountPaid = rec.amount !== undefined && !isNaN(Number(rec.amount)) 
                ? Number(rec.amount) 
                : Number(targetBill.TOTALBILLAMOUNT || targetBill.amount_paid || 0);

            const paymentDate = rec.paymentDate ? new Date(rec.paymentDate) : new Date();
            const validPaymentDate = isNaN(paymentDate.getTime()) ? new Date() : paymentDate;
            const reconStatus = rec.reconciliationStatus?.trim() || targetBill.reconciliation_status || 'Not reconciled';
            
            // Map payment channel to valid enum values: Cash, Bank Transfer, Mobile Money, Online Payment, Other
            const rawChannel = rec.paymentChannel?.trim() || targetBill.payment_channel || 'Bank Transfer';
            const channel = normalizePaymentMethod(rawChannel) || 'Bank Transfer';
            
            const bankRef = rec.bankRef?.trim() || targetBill.bank_ref || null;

            const rawBranchName = rec.branch?.trim() || targetBill.CUSTOMERBRANCH || '';
            
            console.log(`[CSV] Row ${rowNum} - Found bill: ${billIdent} (id: ${targetBill.id})`);
            console.log(`[CSV] Row ${rowNum} - Current state:`, {
                payment_status: targetBill.payment_status,
                amount_paid: targetBill.amount_paid,
                reconciliation_status: targetBill.reconciliation_status,
                bank_ref: targetBill.bank_ref
            });
            console.log(`[CSV] Row ${rowNum} - Payment channel mapping: "${rawChannel}" → "${channel}"`);
            console.log(`[CSV] Row ${rowNum} - Will update to:`, {
                payment_status: 'Paid',
                amount_paid: amountPaid,
                reconciliation_status: reconStatus,
                bank_ref: bankRef,
                payment_channel: channel,
                last_payment_date: validPaymentDate
            });
            
            // Primary UPDATE attempt
            let updateRes: any = await query(`
                UPDATE bills
                SET payment_status = 'Paid',
                    status = 'Posted',
                    amount_paid = GREATEST(COALESCE(amount_paid, 0), $1),
                    "OUTSTANDINGAMT" = 0.00,
                    last_payment_date = $2,
                    reconciliation_status = $3,
                    payment_channel = $4,
                    bank_ref = $5,
                    "CUSTOMERBRANCH" = COALESCE(NULLIF($6, ''), "CUSTOMERBRANCH"),
                    updated_at = NOW()
                WHERE id = $7
                RETURNING id, "BILLKEY", payment_status, amount_paid, last_payment_date
            `, [
                amountPaid,
                validPaymentDate,
                reconStatus,
                channel,
                bankRef,
                rawBranchName,
                targetBill.id
            ]);

            console.log(`[CSV] Row ${rowNum} - Primary UPDATE (by id) result:`, updateRes);

            // Fallback: Try BILLKEY or bill_number if id didn't match
            if (!updateRes || updateRes.length === 0) {
                console.log(`[CSV] Row ${rowNum} - Primary UPDATE returned 0 rows, trying fallback...`);
                const fallbackKey = String(targetBill.BILLKEY || targetBill.bill_number || '').trim();
                if (fallbackKey) {
                    console.log(`[CSV] Row ${rowNum} - Fallback: trying BILLKEY="${fallbackKey}"`);
                    updateRes = await query(`
                        UPDATE bills
                        SET payment_status = 'Paid',
                            status = 'Posted',
                            amount_paid = GREATEST(COALESCE(amount_paid, 0), $1),
                            "OUTSTANDINGAMT" = 0.00,
                            last_payment_date = $2,
                            reconciliation_status = $3,
                            payment_channel = $4,
                            bank_ref = $5,
                            "CUSTOMERBRANCH" = COALESCE(NULLIF($6, ''), "CUSTOMERBRANCH"),
                            updated_at = NOW()
                        WHERE TRIM("BILLKEY") = TRIM($7) OR TRIM(bill_number) = TRIM($7)
                        RETURNING id, "BILLKEY", payment_status, amount_paid, last_payment_date
                    `, [
                        amountPaid,
                        validPaymentDate,
                        reconStatus,
                        channel,
                        bankRef,
                        rawBranchName,
                        fallbackKey
                    ]);
                    console.log(`[CSV] Row ${rowNum} - Fallback UPDATE result:`, updateRes);
                }
            }

            if (!updateRes || updateRes.length === 0) {
                console.error(`[CSV] Row ${rowNum} ❌ UPDATE FAILED - No rows affected`, {
                    billId: targetBill.id,
                    billKey: targetBill.BILLKEY,
                    billNumber: targetBill.bill_number,
                    csvBillKey: rawBillKey,
                    csvCustKey: rawCustKey,
                    updateQuery: 'WHERE id = $7',
                    updateParams: [targetBill.id]
                });
                errors.push({ row: rowNum, error: `Failed to update database record for Bill "${targetBill.BILLKEY || targetBill.bill_number || rawBillKey || 'Bill'}" - UPDATE returned 0 rows` });
                continue;
            }
            
            console.log(`[CSV] Row ${rowNum} ✅ UPDATE SUCCESS:`, updateRes[0]);

            // Synchronize paymentStatus on individual_customers or bulk_meters
            if (targetBill.individual_customer_id) {
                try {
                    const syncRes = await query(`UPDATE individual_customers SET "paymentStatus" = 'Paid', "updated_at" = NOW() WHERE "customerKeyNumber" = $1`, [targetBill.individual_customer_id]);
                    console.log(`[CSV] Row ${rowNum} ✅ Synced individual_customers for customer ${targetBill.individual_customer_id}:`, syncRes);
                } catch (syncErr) {
                    console.error(`[CSV] Row ${rowNum} ❌ Individual customer sync failed:`, syncErr);
                }
            }
            if (targetBill.CUSTOMERKEY) {
                try {
                    const syncRes = await query(`UPDATE bulk_meters SET "paymentStatus" = 'Paid', "updatedAt" = NOW() WHERE "customerKeyNumber" = $1`, [targetBill.CUSTOMERKEY]);
                    console.log(`[CSV] Row ${rowNum} ✅ Synced bulk_meters for customer ${targetBill.CUSTOMERKEY}:`, syncRes);
                } catch (syncErr) {
                    console.error(`[CSV] Row ${rowNum} ❌ Bulk meter sync failed:`, syncErr);
                }
            }

            // Double check that the individual customer ID exists before inserting payment
            const validIndividualCustomerId = await resolveExistingIndividualCustomerId(targetBill.individual_customer_id || null);
            if (!validIndividualCustomerId && targetBill.individual_customer_id) {
                console.warn(`[CSV] Row ${rowNum} ⚠️ individual_customer_id "${targetBill.individual_customer_id}" does not exist in individual_customers. Inserting payment with NULL individual_customer_id.`);
            }
            const bulkMeterId = targetBill.CUSTOMERKEY || null;
            if (bulkMeterId) affectedBulkKeys.add(bulkMeterId);

            // Log payment into payments table
            try {
                const payRes = await query(`
                    INSERT INTO payments (bill_id, bill_month_year, individual_customer_id, bulk_meter_id, amount_paid, payment_method, transaction_reference, processed_by_staff_id, payment_date, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id
                `, [
                    targetBill.id,
                    targetBill.month_year,
                    validIndividualCustomerId,
                    bulkMeterId,
                    amountPaid,
                    channel,
                    bankRef,
                    staffId || null,
                    validPaymentDate,
                    `CSV Payment Update: Recon=${reconStatus}`
                ]);
                console.log(`[CSV] Row ${rowNum} ✅ Payment logged to payments table (id: ${payRes?.[0]?.id})`);
            } catch (pErr: any) {
                console.log(`[CSV] Row ${rowNum} ⚠️  Payment insert with method="${channel}" failed, retrying without payment_method...`);
                // If payment_method causes constraint violation, retry without payment_method
                try {
                    const payRes2 = await query(`
                        INSERT INTO payments (bill_id, bill_month_year, individual_customer_id, bulk_meter_id, amount_paid, transaction_reference, processed_by_staff_id, payment_date, notes)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        RETURNING id
                    `, [
                        targetBill.id,
                        targetBill.month_year,
                        validIndividualCustomerId,
                        bulkMeterId,
                        amountPaid,
                        bankRef,
                        staffId || null,
                        validPaymentDate,
                        `CSV Payment Update: Recon=${reconStatus}`
                    ]);
                    console.log(`[CSV] Row ${rowNum} ✅ Payment logged to payments table without method (id: ${payRes2?.[0]?.id})`);
                } catch (pErr2: any) {
                    console.error(`[CSV] Row ${rowNum} ❌ Payments insert failed (both attempts):`, pErr2);
                    // Continue even if payments table insert fails - the main update succeeded
                }
            }

            // Update targetBill in-memory state so subsequent duplicate rows in the same CSV are recognized as already updated
            targetBill.payment_status = 'Paid';
            targetBill.reconciliation_status = reconStatus;
            targetBill.bank_ref = bankRef;
            processedBillIds.add(billIdent);

            updatedCount++;
        } catch (err: any) {
            console.error(`[CSV] Row ${rowNum} ❌ Unexpected error:`, err);
            errors.push({ row: rowNum, error: err.message || 'Database update error' });
        }
    }

    console.log(`[CSV] ✅ Batch complete: ${updatedCount} updated, ${errors.length} errors`);

    // Credit-note wiring: an overpaid bulk-meter bill is a deposit. The engine's
    // replay creates the credit (source_bill_id stamped from the matched bill);
    // this links each new credit to the payment row that produced it so
    // credit_ledger.source_payment_id is populated. Finally, a backfill pass
    // links any duplicate-transaction / bill-correction credit that still has no
    // source bill to the meter's most recent overpaid bill — a defensive
    // invariant for credits recorded before the overpayment was recognised.
    for (const key of affectedBulkKeys) {
        try {
            await dbSyncAgingForCustomer(key);
        } catch (syncErr) {
            console.error(`[CSV] Aging sync failed for bulk meter ${key}:`, syncErr);
        }
    }
    try {
        const linked = await dbLinkCreditSourcePayments();
        if (linked > 0) console.log(`[CSV] ✅ Linked ${linked} credit(s) to their source payment`);
    } catch (linkErr) {
        console.error('[CSV] Credit source-payment linking failed:', linkErr);
    }
    if (affectedBulkKeys.size > 0) {
        try {
            const backfilled = await dbLinkCreditsToOverpaidBills([...affectedBulkKeys]);
            if (backfilled > 0) console.log(`[CSV] ✅ Backfilled source bill on ${backfilled} credit(s)`);
        } catch (backfillErr) {
            console.error('[CSV] Credit source-bill backfill failed:', backfillErr);
        }
    }

    return { success: true, updatedCount, errors };
};

/**
 * Link 'created' credit ledger rows to the payment that produced them.
 * After a payment (e.g. CSV batch) the engine's aging sync creates a credit
 * from the overpaid bill; this attaches the largest payment on that bill as
 * source_payment_id, completing the audit trail. Safe to run repeatedly.
 */
export const dbLinkCreditSourcePayments = async (): Promise<number> => {
    const rows = await query(
        `UPDATE credit_ledger cl
         SET source_payment_id = p.id
         FROM (
             SELECT DISTINCT ON (bill_id) bill_id, id
             FROM payments
             WHERE bill_id IN (
                 SELECT source_bill_id FROM credit_ledger
                 WHERE event_type = 'created' AND source_payment_id IS NULL AND source_bill_id IS NOT NULL
             )
             ORDER BY bill_id, amount_paid DESC, created_at DESC
         ) p
         WHERE cl.event_type = 'created'
           AND cl.source_payment_id IS NULL
           AND cl.source_bill_id = p.bill_id
         RETURNING cl.id`
    );
    return Array.isArray(rows) ? rows.length : 0;
};

/**
 * Backfill: give 'created' credits that lost their source bill a link to the
 * meter's most recent overpaid bill (amount_paid > TOTALBILLAMOUNT). Runs after
 * CSV payment batches so a duplicate-transaction credit recorded before the
 * overpayment was recognised is tied to the bill the batch reveals.
 *
 * Normally this matches 0 rows — the aging engine stamps source_bill_id itself
 * (dbSyncAgingForCustomer) — so this is a defensive invariant, not the primary
 * path. It only links credits whose reason semantically implies a bill
 * ('duplicate_transaction' / 'bill_correction'); manual standalone deposits
 * (reason 'manual') are intentionally left alone, as are voided credits and
 * bills that already carry a live credit. Idempotent.
 */
export const dbLinkCreditsToOverpaidBills = async (meterKeys: string[]): Promise<number> => {
    if (!meterKeys || meterKeys.length === 0) return 0;
    const keys = meterKeys.map((k) => String(k).trim().toLowerCase());
    const rows = await query(
        `UPDATE credit_ledger cl
         SET source_bill_id = ob.bill_id
         FROM (
             SELECT DISTINCT ON (c.id) c.id AS ledger_id, b.id AS bill_id
             FROM credit_ledger c
             JOIN bulk_meters bm
               ON LOWER(TRIM(bm."customerKeyNumber")) = LOWER(TRIM(c.bulk_meter_id)) AND bm.deleted_at IS NULL
             JOIN bills b
               ON LOWER(TRIM(b."CUSTOMERKEY")) = LOWER(TRIM(c.bulk_meter_id))
              AND b.deleted_at IS NULL
              AND COALESCE(b.amount_paid, 0) > COALESCE(b."TOTALBILLAMOUNT", 0)
              AND NOT EXISTS (
                  SELECT 1 FROM credit_ledger other
                  WHERE other.source_bill_id = b.id
                    AND other.event_type = 'created'
                    AND other.id <> c.id
                    AND NOT EXISTS (
                        SELECT 1 FROM credit_ledger v
                        WHERE v.voided_ledger_id = other.id AND v.event_type = 'voided'
                    )
              )
             WHERE c.event_type = 'created'
               AND c.source_bill_id IS NULL
               AND c.reason IN ('duplicate_transaction', 'bill_correction')
               AND LOWER(TRIM(c.bulk_meter_id)) = ANY($1)
               AND NOT EXISTS (
                   SELECT 1 FROM credit_ledger v2
                   WHERE v2.voided_ledger_id = c.id AND v2.event_type = 'voided'
               )
             ORDER BY c.id, b.month_year DESC, b.created_at DESC
         ) ob
         WHERE cl.id = ob.ledger_id
         RETURNING cl.id`,
        [keys]
    );
    return Array.isArray(rows) ? rows.length : 0;
};



export const dbGetAllSentBillsPaginated = async (params: {
    limit: number;
    offset: number;
    searchTerm?: string;
    branchId?: string;
    monthYear?: string;
}) => {
    let sql = `
        SELECT b.* FROM bills b
        LEFT JOIN bulk_meters bm ON (b."CUSTOMERKEY" = bm."customerKeyNumber" OR b.individual_customer_id = bm."customerKeyNumber")
        LEFT JOIN individual_customers c ON (b.individual_customer_id = c."customerKeyNumber" OR b."CUSTOMERKEY" = c."customerKeyNumber")
        LEFT JOIN branches br ON COALESCE(b.branch_id, bm.branch_id, c.branch_id) = br.id
        WHERE b.status = 'Posted'
          AND b.deleted_at IS NULL
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.branchId && params.branchId !== 'all') {
        sql += ` AND (b.branch_id::text ILIKE $${paramIndex} OR c.branch_id::text ILIKE $${paramIndex} OR bm.branch_id::text ILIKE $${paramIndex} OR b."CUSTOMERBRANCH" ILIKE $${paramIndex} OR br.name ILIKE $${paramIndex})`;
        queryParams.push(params.branchId);
        paramIndex++;
    }

    if (params.monthYear && params.monthYear !== 'all') {
        sql += ` AND b.month_year = $${paramIndex++}`;
        queryParams.push(params.monthYear);
    }

    if (params.searchTerm) {
        sql += ` AND (b."BILLKEY" ILIKE $${paramIndex} OR b."CUSTOMERNAME" ILIKE $${paramIndex} OR b."CUSTOMERKEY" ILIKE $${paramIndex} OR b.individual_customer_id ILIKE $${paramIndex})`;
        queryParams.push(`%${params.searchTerm}%`);
        paramIndex++;
    }

    sql += ` ORDER BY b.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(params.limit, params.offset);

    return await query(sql, queryParams);
};

export const dbGetAllSentBillsCount = async (params: {
    searchTerm?: string;
    branchId?: string;
    monthYear?: string;
}) => {
    let sql = `
        SELECT COUNT(*) 
        FROM bills b
        LEFT JOIN bulk_meters bm ON (b."CUSTOMERKEY" = bm."customerKeyNumber" OR b.individual_customer_id = bm."customerKeyNumber")
        LEFT JOIN individual_customers c ON (b.individual_customer_id = c."customerKeyNumber" OR b."CUSTOMERKEY" = c."customerKeyNumber")
        LEFT JOIN branches br ON COALESCE(b.branch_id, bm.branch_id, c.branch_id) = br.id
        WHERE b.status = 'Posted' AND b.deleted_at IS NULL
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.branchId && params.branchId !== 'all') {
        sql += ` AND (b.branch_id::text ILIKE $${paramIndex} OR c.branch_id::text ILIKE $${paramIndex} OR bm.branch_id::text ILIKE $${paramIndex} OR b."CUSTOMERBRANCH" ILIKE $${paramIndex} OR br.name ILIKE $${paramIndex})`;
        queryParams.push(params.branchId);
        paramIndex++;
    }

    if (params.monthYear && params.monthYear !== 'all') {
        sql += ` AND b.month_year = $${paramIndex++}`;
        queryParams.push(params.monthYear);
    }

    if (params.searchTerm) {
        sql += ` AND (b."BILLKEY" ILIKE $${paramIndex} OR b."CUSTOMERNAME" ILIKE $${paramIndex} OR b."CUSTOMERKEY" ILIKE $${paramIndex} OR b.individual_customer_id ILIKE $${paramIndex})`;
        queryParams.push(`%${params.searchTerm}%`);
    }

    const rows: any = await query(sql, queryParams);
    return parseInt(rows[0].count);
};

export const dbArchiveOldRecords = async (monthsThreshold: number = 36) => {
    return await withTransaction(async (client) => {
        // 1. Archive old Payments
        const archivePaymentsSql = `
            WITH moved_payments AS (
                DELETE FROM payments
                WHERE payment_date < NOW() - INTERVAL '${monthsThreshold} months'
                RETURNING *
            )
            INSERT INTO payments_history (
                id, bill_id, individual_customer_id, amount_paid, payment_method,
                transaction_reference, processed_by_staff_id, payment_date, notes, archived_at
            )
            SELECT 
                id, bill_id, individual_customer_id, amount_paid, payment_method,
                transaction_reference, processed_by_staff_id, payment_date, notes, NOW()
            FROM moved_payments;
        `;
        const resPayments = await client.query(archivePaymentsSql);
        const paymentsMoved = resPayments.rowCount || 0;

        // 2. Archive old Bills 
        const archiveBillsSql = `
            WITH moved_bills AS (
                DELETE FROM bills
                WHERE bill_period_end_date < NOW() - INTERVAL '${monthsThreshold} months'
                RETURNING *
            )
            INSERT INTO bills_history (
                id, "BILLKEY", "CUSTOMERKEY", "CUSTOMERNAME", "CUSTOMERTIN", 
                "CUSTOMERBRANCH", "REASON", "CURRREAD", "PREVREAD", "CONS", 
                "TOTALBILLAMOUNT", "THISMONTHBILLAMT", "OUTSTANDINGAMT", "PENALTYAMT", 
                "DRACCTNO", "CRACCTNO", individual_customer_id, bill_period_start_date, 
                bill_period_end_date, month_year, difference_usage, base_water_charge, 
                sewerage_charge, maintenance_fee, sanitation_fee, meter_rent, 
                balance_carried_forward, amount_paid, due_date, payment_status, 
                status, bill_number, notes, created_at, updated_at, approval_date, 
                approved_by, vat_amount, additional_fees_charge, additional_fees_breakdown, 
                snapshot_data, debit_30, debit_30_60, debit_60, archived_at
            )
            SELECT 
                id, "BILLKEY", "CUSTOMERKEY", "CUSTOMERNAME", "CUSTOMERTIN", 
                "CUSTOMERBRANCH", "REASON", "CURRREAD", "PREVREAD", "CONS", 
                "TOTALBILLAMOUNT", "THISMONTHBILLAMT", "OUTSTANDINGAMT", "PENALTYAMT", 
                "DRACCTNO", "CRACCTNO", individual_customer_id, bill_period_start_date, 
                bill_period_end_date, month_year, difference_usage, base_water_charge, 
                sewerage_charge, maintenance_fee, sanitation_fee, meter_rent, 
                balance_carried_forward, amount_paid, due_date, payment_status, 
                status, bill_number, notes, created_at, updated_at, approval_date, 
                approved_by, vat_amount, additional_fees_charge, additional_fees_breakdown, 
                snapshot_data, debit_30, debit_30_60, debit_60, NOW()
            FROM moved_bills;
        `;
        const resBills = await client.query(archiveBillsSql);
        const billsMoved = resBills.rowCount || 0;

        return { success: true, billsMoved, paymentsMoved };
    });
};

export const dbGetSystemStats = async () => {
    const statsSql = `
        SELECT
            (SELECT COUNT(*) FROM bills) as active_bills,
            (SELECT COUNT(*) FROM payments) as active_payments,
            (SELECT COUNT(*) FROM bills_history) as historic_bills,
            (SELECT COUNT(*) FROM payments_history) as historic_payments,
            (SELECT COUNT(DISTINCT worker_id) FROM billing_jobs WHERE status IN ('pending', 'processing')) as active_workers,
            (SELECT COUNT(*) FROM billing_jobs WHERE status IN ('pending', 'processing')) as active_jobs
    `;
    const rows: any = await query(statsSql, []);
    return rows[0];
};

export const dbCreatePdfJob = async (job: {
    branch_id: string | null;
    month_year: string;
    total_bills: number;
    unique_key: string;
}) => {
    const sql = `
        INSERT INTO pdf_generation_jobs (branch_id, month_year, total_bills, unique_key, status)
        VALUES ($1, $2, $3, $4, 'pending')
        ON CONFLICT (unique_key) DO UPDATE SET
            status = 'pending',
            total_bills = EXCLUDED.total_bills,
            generated_bills = 0,
            file_paths = NULL,
            error_message = NULL,
            updated_at = NOW()
        RETURNING id;
    `;
    const res = await query(sql, [job.branch_id, job.month_year, job.total_bills, job.unique_key]);
    return res[0]?.id;
};

export const dbUpdatePdfJob = async (id: string, updates: {
    status?: string;
    generated_bills?: number;
    file_paths?: string[];
    error_message?: string;
}) => {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (updates.status) {
        fields.push(`status = $${i++}`);
        values.push(updates.status);
    }
    if (updates.generated_bills !== undefined) {
        fields.push(`generated_bills = $${i++}`);
        values.push(updates.generated_bills);
    }
    if (updates.file_paths) {
        fields.push(`file_paths = $${i++}`);
        values.push(updates.file_paths);
    }
    if (updates.error_message) {
        fields.push(`error_message = $${i++}`);
        values.push(updates.error_message);
    }

    if (fields.length === 0) return;

    values.push(id);
    const sql = `UPDATE pdf_generation_jobs SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i}`;
    return await query(sql, values);
};

export const dbGetActivePdfJobs = async () => {
    const sql = `SELECT * FROM pdf_generation_jobs ORDER BY created_at DESC LIMIT 10`;
    return await query(sql, []);
};

export const dbGetBillsForPdfBatch = async (monthYear: string, branchId?: string | null) => {
    let sql = `
        SELECT b.*, 
               bm.name as meter_name,
               br.name as branch_name,
               bm."contractNumber", 
               bm.charge_group, 
               bm.sewerage_connection,
               bm."subCity" as sub_city,
               (SELECT COUNT(*) FROM individual_customers WHERE "assignedBulkMeterId" = bm."customerKeyNumber") as assigned_customers_count
        FROM bills b
        LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
        LEFT JOIN branches br ON bm.branch_id = br.id
        WHERE b.month_year = $1
    `;
    const params: any[] = [monthYear];
    if (branchId && branchId !== 'all') {
        sql += ` AND bm.branch_id = $2`;
        params.push(branchId);
    }
    sql += ` ORDER BY b."CUSTOMERKEY" ASC`;
    return await query(sql, params);
};

export const dbGetBillForPdf = async (billId: string) => {
    const sql = `
        SELECT b.*, 
               bm.name as meter_name,
               br.name as branch_name,
               bm."contractNumber", 
               bm.charge_group, 
               bm.sewerage_connection,
               bm."subCity" as sub_city,
               (SELECT COUNT(*) FROM individual_customers WHERE "assignedBulkMeterId" = bm."customerKeyNumber") as assigned_customers_count
        FROM bills b
        LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
        LEFT JOIN branches br ON bm.branch_id = br.id
        WHERE b.id = $1
    `;
    const rows: any = await query(sql, [billId]);
    return rows[0] ?? null;
};


export const dbDeletePdfJob = async (id: string) => {
    const rows = await query('DELETE FROM pdf_generation_jobs WHERE id = $1 RETURNING id', [id]);
    return (rows as any[]).length > 0;
};

// --- System Settings ---
export const dbGetSystemSettings = async () => {
    const rows = await query('SELECT key, value FROM system_settings');
    const settings: Record<string, string> = {};
    for (const row of rows) {
        settings[row.key] = row.value;
    }
    return settings;
};

export const dbRunDataAudit = async (branchId?: string) => {
    // 1. Master-Sub Usage Mismatch
    let masterUsageSql = `
        SELECT 
            bm."customerKeyNumber" as id, bm.name as label, 'Usage Mismatch' as category,
            'Bulk meter usage != sum of individual sub-meters.' as description,
            ROUND(CAST((bm."currentReading" - bm."previousReading") AS NUMERIC), 3) as master_value,
            ROUND(CAST(COALESCE(sub.total_usage, 0) AS NUMERIC), 3) as comparison_value,
            ROUND(CAST(ABS((bm."currentReading" - bm."previousReading") - COALESCE(sub.total_usage, 0)) AS NUMERIC), 3) as discrepancy
        FROM bulk_meters bm
        LEFT JOIN (
            SELECT "assignedBulkMeterId", SUM("currentReading" - "previousReading") as total_usage
            FROM individual_customers WHERE deleted_at IS NULL GROUP BY "assignedBulkMeterId"
        ) sub ON bm."customerKeyNumber" = sub."assignedBulkMeterId"
        WHERE bm.deleted_at IS NULL AND ABS((bm."currentReading" - bm."previousReading") - COALESCE(sub.total_usage, 0)) > 0.01
    `;
    const masterUsageParams = [];
    if (branchId && branchId !== 'all') { masterUsageSql += ' AND bm.branch_id = $1'; masterUsageParams.push(branchId); }

    // 2. Bill Calculation Errors
    let billCalcSql = `
        SELECT id::text, "BILLKEY" as label, 'Bill Calculation' as category, 
               'Total bill amount != sum of parts (Current + Outstanding + Penalty).' as description,
               "TOTALBILLAMOUNT" as master_value,
               (COALESCE("THISMONTHBILLAMT", 0) + COALESCE("OUTSTANDINGAMT", 0) + COALESCE("PENALTYAMT", 0)) as comparison_value,
               ABS("TOTALBILLAMOUNT" - (COALESCE("THISMONTHBILLAMT", 0) + COALESCE("OUTSTANDINGAMT", 0) + COALESCE("PENALTYAMT", 0))) as discrepancy
        FROM bills WHERE deleted_at IS NULL
        AND ABS("TOTALBILLAMOUNT" - (COALESCE("THISMONTHBILLAMT", 0) + COALESCE("OUTSTANDINGAMT", 0) + COALESCE("PENALTYAMT", 0))) > 0.01
    `;
    const billCalcParams = [];
    if (branchId && branchId !== 'all') { billCalcSql += ' AND branch_id = $1'; billCalcParams.push(branchId); }

    // 3. Payment Verification
    let paymentAuditSql = `
        SELECT b.id::text, b."BILLKEY" as label, 'Payments' as category,
               'Bill amount_paid does not match sum of payment records.' as description,
               b.amount_paid as master_value,
               COALESCE(p.total_paid, 0) as comparison_value,
               ABS(b.amount_paid - COALESCE(p.total_paid, 0)) as discrepancy
        FROM bills b
        LEFT JOIN (SELECT bill_id, SUM(amount_paid) as total_paid FROM payments GROUP BY bill_id) p ON b.id = p.bill_id
        WHERE b.deleted_at IS NULL AND ABS(b.amount_paid - COALESCE(p.total_paid, 0)) > 0.01
    `;
    const paymentParams = [];
    if (branchId && branchId !== 'all') { paymentAuditSql += ' AND b.branch_id = $1'; paymentParams.push(branchId); }

    // 4. Aging Consistency
    let agingAuditSql = `
        SELECT id::text, "BILLKEY" as label, 'Aging' as category,
               'Outstanding total does not match sum of aging buckets (30/60/90+).' as description,
               "OUTSTANDINGAMT" as master_value,
               (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0)) as comparison_value,
               ABS("OUTSTANDINGAMT" - (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0))) as discrepancy
        FROM bills WHERE deleted_at IS NULL AND ABS("OUTSTANDINGAMT" - (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0))) > 0.01
    `;
    const agingParams = [];
    if (branchId && branchId !== 'all') { agingAuditSql += ' AND branch_id = $1'; agingParams.push(branchId); }

    // 5. Orphan Individual Customers
    let orphanCustSql = `
        SELECT ic."customerKeyNumber" as id, ic.name as label, 'System Orphans' as category,
               'Individual customer is assigned to a non-existent or deleted bulk meter.' as description,
               0 as master_value, 0 as comparison_value, 1 as discrepancy
        FROM individual_customers ic
        LEFT JOIN bulk_meters bm ON ic."assignedBulkMeterId" = bm."customerKeyNumber"
        WHERE ic.deleted_at IS NULL AND ic."assignedBulkMeterId" IS NOT NULL AND (bm."customerKeyNumber" IS NULL OR bm.deleted_at IS NOT NULL)
    `;
    const orphanCustParams = [];
    if (branchId && branchId !== 'all') { orphanCustSql += ' AND ic.branch_id = $1'; orphanCustParams.push(branchId); }

    // 6. Mandatory Settings / Role Integrity
    const systemAuditSql = `
        SELECT id::text, name as label, 'System' as category,
               'Staff member has an invalid or missing role assignment.' as description,
               0 as master_value, 0 as comparison_value, 1 as discrepancy
        FROM staff_members WHERE deleted_at IS NULL AND (role_id IS NULL OR role_id NOT IN (SELECT id FROM roles))
    `;

    const [usage, calc, payments, aging, orphans, system] = await Promise.all([
        query(masterUsageSql, masterUsageParams),
        query(billCalcSql, billCalcParams),
        query(paymentAuditSql, paymentParams),
        query(agingAuditSql, agingParams),
        query(orphanCustSql, orphanCustParams),
        query(systemAuditSql, [])
    ]);

    return [
        ...(usage as any[]),
        ...(calc as any[]),
        ...(payments as any[]),
        ...(aging as any[]),
        ...(orphans as any[]),
        ...(system as any[])
    ];
};

export const dbGetReadingsForMonth = async (type: string, customerKeys: string[], monthYear: string) => {
    if (customerKeys.length === 0) return [];
    
    // Use a date-range predicate instead of TO_CHAR() so PostgreSQL can use the
    // B-tree index on "READING_DATE" (idx_readings_date / idx_bulk_readings_date)
    // rather than performing a full sequential scan.
    const [year, month] = monthYear.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString();          // first day 00:00:00
    const endDate   = new Date(year, month,     1).toISOString();          // first day of NEXT month

    const placeholders = customerKeys.map((_, i) => `$${i + 3}`).join(',');
    
    let sql = '';
    if (type === 'bulk_meters') {
        sql = `SELECT "CUST_KEY", "METER_READING", "PREVIOUS_READING" 
               FROM bulk_meter_readings 
               WHERE "READING_DATE" >= $1 AND "READING_DATE" < $2
               AND "CUST_KEY" IN (${placeholders}) 
               AND deleted_at IS NULL`;
    } else {
        sql = `SELECT "CUST_KEY", "METER_READING", "PREVIOUS_READING" 
               FROM individual_customer_readings 
               WHERE "READING_DATE" >= $1 AND "READING_DATE" < $2
               AND "CUST_KEY" IN (${placeholders}) 
               AND deleted_at IS NULL`;
    }
    
    const params = [startDate, endDate, ...customerKeys];
    const rows = await query(sql, params);
    return rows;
};

export const dbSyncAgingForCustomer = async (customerKey: string, client?: any) => {
    const qFunc = client ? client.query.bind(client) : query;

    let customerType = 'Non-domestic';
    let isBulk = false;

    // 1. Fetch customer details
    const bmRes = await qFunc(
        `SELECT charge_group FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1)) AND deleted_at IS NULL`,
        [customerKey]
    );
    const bm = client ? bmRes.rows[0] : bmRes[0];
    if (bm) {
        customerType = bm.charge_group || 'Non-domestic';
        isBulk = true;
    } else {
        const custRes = await qFunc(
            `SELECT "customerType" FROM individual_customers WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1)) AND deleted_at IS NULL`,
            [customerKey]
        );
        const cust = client ? custRes.rows[0] : custRes[0];
        if (cust) {
            customerType = cust.customerType || 'Domestic';
        }
    }

    // 2. Fetch all bills sorted oldest to newest
    const billsRes = await qFunc(
        `SELECT * FROM bills 
         WHERE deleted_at IS NULL 
           AND (LOWER(TRIM("CUSTOMERKEY")) = LOWER(TRIM($1)) OR LOWER(TRIM(individual_customer_id)) = LOWER(TRIM($1)))
         ORDER BY
           COALESCE(bill_period_end_date, created_at::date) ASC,
           created_at ASC`,
        [customerKey]
    );
    const bills = client ? billsRes.rows : billsRes;

    // 2b. Credit-note state (bulk meters only — see docs/CREDIT_NOTE_PLAN.md).
    //     Individual customers have no creditBalance column yet; they keep the
    //     legacy clamp behaviour until the schema is extended.
    let creditEnabled = isBulk;
    let creditBalance = 0;
    let createdByBill: Map<string, { id: string; amount: number }> = new Map();
    let appliedByBill: Map<string, { id: string; amount: number }> = new Map();

    if (creditEnabled) {
        const balRes = await qFunc(
            `SELECT "creditBalance" FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1)) AND deleted_at IS NULL`,
            [customerKey]
        );
        const balRow = (client ? balRes.rows : balRes)[0];
        creditBalance = Number(balRow?.creditBalance || 0);

        const ledgerRes = await qFunc(
            `SELECT id, event_type, amount, source_bill_id, voided_ledger_id
             FROM credit_ledger
             WHERE bulk_meter_id = $1
             ORDER BY created_at ASC, id ASC`,
            [customerKey]
        );
        const ledgerRows = client ? ledgerRes.rows : ledgerRes;

        // A created/applied row is voided when a 'voided' row references it.
        const voidedIds = new Set<string>();
        for (const row of ledgerRows) {
            if (row.event_type === 'voided' && row.voided_ledger_id) {
                voidedIds.add(String(row.voided_ledger_id));
            }
        }
        for (const row of ledgerRows) {
            if (row.event_type === 'created' && row.source_bill_id && !voidedIds.has(row.id)) {
                createdByBill.set(String(row.source_bill_id), { id: row.id, amount: Number(row.amount || 0) });
            }
            if (row.event_type === 'applied' && row.source_bill_id && !voidedIds.has(row.id)) {
                appliedByBill.set(String(row.source_bill_id), { id: row.id, amount: Number(row.amount || 0) });
            }
        }
    }

    if (bills.length === 0) {
        if (isBulk) {
            // Void auto-created credits whose bill no longer exists; manual deposits survive.
            if (creditEnabled) {
                for (const [billId, created] of createdByBill) {
                    creditBalance = Math.max(0, roundMoney(creditBalance - created.amount));
                    await dbInsertCreditLedgerRow(qFunc, client, customerKey, 'voided', created.amount, 'bill_removed', null, null, created.id, creditBalance, null);
                    void billId;
                }
                await qFunc(
                    `UPDATE bulk_meters SET "creditBalance" = $1 WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($2))`,
                    [roundMoney(creditBalance), customerKey]
                );
            }
            await qFunc(
                `UPDATE bulk_meters SET "outStandingbill" = 0, "paymentStatus" = 'Paid' WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1))`,
                [customerKey]
            );
        } else {
            await qFunc(
                `UPDATE individual_customers SET "outStandingbill" = 0, "paymentStatus" = 'Paid' WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1))`,
                [customerKey]
            );
        }
        return;
    }

    // 3. Process history oldest to newest
    let carriedForwardUnpaid = 0;
    let d30_bucket = 0;
    let d30_60_bucket = 0;
    let d60_bucket = 0;
    let billIndexCounter = 0;

    const tariffsRes = await qFunc(
        `SELECT * FROM tariffs WHERE customer_type = $1 ORDER BY effective_date DESC`,
        [customerType]
    );
    const tariffs = client ? tariffsRes.rows : tariffsRes;

    const findActiveTariff = (dateStr: string) => {
        let lookupDate = dateStr;
        if (dateStr && dateStr.length === 7 && dateStr.includes('-')) {
            const [year, month] = dateStr.split('-').map(Number);
            const lastDay = new Date(year, month, 0).getDate();
            lookupDate = `${dateStr}-${lastDay}`;
        }
        const matched = tariffs.find((t: any) => {
            const tDate = t.effective_date instanceof Date ? t.effective_date.toISOString().split('T')[0] : String(t.effective_date);
            return tDate <= lookupDate;
        });
        return matched || tariffs[0];
    };

    const getMonthlyBillAmtLocal = (bill: any): number => {
        if (bill.THISMONTHBILLAMT !== null && bill.THISMONTHBILLAMT !== undefined) {
            return Number(bill.THISMONTHBILLAMT);
        }
        return Math.max(
            0,
            Number(bill.TOTALBILLAMOUNT || 0)
            - Number(bill.OUTSTANDINGAMT || 0)
            - Number(bill.PENALTYAMT || 0)
        );
    };

    for (const bill of bills) {
        const isVoided = bill.status === 'Deleted' || bill.status === 'Void' || bill.status === 'Reversed' || bill.status === 'Draft' || bill.status === 'Rework' || bill.status === 'Pending' || bill.status === 'Pending_Approval';
        const billMonth = bill.month_year || (bill.created_at ? (bill.created_at instanceof Date ? bill.created_at.toISOString().slice(0,7) : String(bill.created_at).slice(0,7)) : '');
        
        const activeTariff = findActiveTariff(billMonth);
        const threshold = activeTariff?.penalty_month_threshold ? Number(activeTariff.penalty_month_threshold) : 3;
        const bankRate = activeTariff?.bank_lending_rate ? Number(activeTariff.bank_lending_rate) : 0.15;
        
        let tieredRates: any[] = [];
        if (activeTariff?.penalty_tiered_rates) {
            try {
                tieredRates = typeof activeTariff.penalty_tiered_rates === 'string' 
                    ? JSON.parse(activeTariff.penalty_tiered_rates) 
                    : activeTariff.penalty_tiered_rates;
            } catch (e) {
                console.error("Error parsing tiered rates in dbSyncAgingForCustomer", e);
            }
        }

        const arrearsSum = carriedForwardUnpaid;
        let penalty = 0;
        let maxAge = 0;

        if (d60_bucket > 0.01) maxAge = 3;
        else if (d30_60_bucket > 0.01) maxAge = 2;
        else if (d30_bucket > 0.01) maxAge = 1;

        const totalMissedCycles = billIndexCounter;
        maxAge = Math.max(maxAge, totalMissedCycles);

        const legacyDebt = Math.max(0, arrearsSum - (d30_bucket + d30_60_bucket + d60_bucket));
        if (legacyDebt > 0.01) maxAge = Math.max(maxAge, 3);

        if (maxAge >= threshold) {
            const applicableTier = [...tieredRates].sort((a: any, b: any) => b.month - a.month).find((t: any) => maxAge >= t.month);
            const totalRate = bankRate + Number(applicableTier?.rate || 0);
            penalty = arrearsSum * totalRate;
        }

        const currentMonthlyCharge = isVoided ? 0 : getMonthlyBillAmtLocal(bill);
        const totalD60AndLegacy = d60_bucket + legacyDebt;

        const derivedOutstanding = d30_bucket + d30_60_bucket + totalD60AndLegacy + penalty;
        const derivedTotalPayable = isVoided ? 0 : derivedOutstanding + currentMonthlyCharge;

        const d30_rounded = Number(d30_bucket.toFixed(2));
        const d30_60_rounded = Number(d30_60_bucket.toFixed(2));
        const d60_rounded = Number(totalD60AndLegacy.toFixed(2));
        const penalty_rounded = Number(penalty.toFixed(2));
        const outstanding_rounded = Number(derivedOutstanding.toFixed(2));
        const totalPayable_rounded = Number(derivedTotalPayable.toFixed(2));
        const currentMonthlyCharge_rounded = Number(currentMonthlyCharge.toFixed(2));

        const amtPaid = isVoided ? 0 : Number(bill.amount_paid || bill.amountPaid || bill.AMOUNTPAID || 0);

        // Credit-aware carry-forward (bulk meters). Overpayments become a deposit
        // (credit_ledger 'created') that discounts future bills until consumed.
        const debtForNextMonth = d30_bucket + d30_60_bucket + totalD60AndLegacy + currentMonthlyCharge + penalty;
        let creditApplied = 0;
        let creditResult: ComputeCreditForBillOutput | null = null;

        if (creditEnabled) {
            const existingCreated = createdByBill.get(String(bill.id)) ?? null;
            const existingApplied = appliedByBill.get(String(bill.id)) ?? null;

            creditResult = computeCreditForBill({
                debtForNextMonth,
                amtPaid,
                creditBalance,
                existingCreated,
                existingApplied,
            });
            creditBalance = creditResult.newCreditBalance;

            // Persist credit events for this bill
            if (creditResult.creditCreated > 0) {
                const row = await dbInsertCreditLedgerRow(qFunc, client, customerKey, 'created', creditResult.creditCreated, 'bill_correction', bill.id, null, null, creditBalance, null);
                createdByBill.set(String(bill.id), { id: row.id, amount: creditResult.creditCreated });
            } else if (creditResult.creditCreatedAdjustment !== 0 && existingCreated) {
                const newAmount = roundMoney(existingCreated.amount + creditResult.creditCreatedAdjustment);
                await qFunc(
                    `UPDATE credit_ledger SET amount = $1, balance_after = $2 WHERE id = $3`,
                    [newAmount, creditBalance, existingCreated.id]
                );
                createdByBill.set(String(bill.id), { id: existingCreated.id, amount: newAmount });
            }

            if (creditResult.creditVoided > 0 && existingCreated) {
                await dbInsertCreditLedgerRow(qFunc, client, customerKey, 'voided', creditResult.creditVoided, 'bill_correction', bill.id, null, existingCreated.id, creditBalance, null);
                createdByBill.delete(String(bill.id));
            }

            if (creditResult.creditApplied > 0) {
                if (existingApplied) {
                    creditApplied = creditResult.creditApplied;
                    if (creditResult.existingAppliedAdjusted !== undefined) {
                        await qFunc(
                            `UPDATE credit_ledger SET amount = $1, balance_after = $2 WHERE id = $3`,
                            [creditResult.existingAppliedAdjusted, creditBalance, existingApplied.id]
                        );
                    }
                } else {
                    const row = await dbInsertCreditLedgerRow(qFunc, client, customerKey, 'applied', creditResult.creditApplied, 'billing_cycle', bill.id, null, null, creditBalance, null);
                    appliedByBill.set(String(bill.id), { id: row.id, amount: creditResult.creditApplied });
                    creditApplied = creditResult.creditApplied;
                }
            }

            carriedForwardUnpaid = creditResult.carriedForwardUnpaid;
        } else {
            // Legacy clamp for non-bulk customers (no credit support yet).
            carriedForwardUnpaid = Math.max(0, debtForNextMonth - amtPaid);
        }

        const billUnpaid = Math.max(0, derivedTotalPayable - amtPaid - creditApplied);
        const billPaymentStatus = billUnpaid <= 0.01 ? 'Paid' : 'Unpaid';

        // Preserve any bills already manually marked as 'Paid'.
        // If a bill's current payment_status is 'Paid', keep it as 'Paid'; otherwise set to computed status.
        // Include month_year in the WHERE clause so PostgreSQL can route the UPDATE
        // directly to the correct partition without crossing the BEFORE ROW trigger boundary.
        await qFunc(
            `UPDATE bills 
             SET debit_30 = $1, 
                 debit_30_60 = $2, 
                 debit_60 = $3, 
                 "PENALTYAMT" = $4, 
                 "OUTSTANDINGAMT" = $5, 
                 "THISMONTHBILLAMT" = $6, 
                 "TOTALBILLAMOUNT" = $7,
                 payment_status = CASE WHEN payment_status = 'Paid' THEN 'Paid'::payment_status ELSE $8::payment_status END
             WHERE id = $9 AND month_year = $10`,
            [
                d30_rounded,
                d30_60_rounded,
                d60_rounded,
                penalty_rounded,
                outstanding_rounded,
                currentMonthlyCharge_rounded,
                totalPayable_rounded,
                billPaymentStatus,
                bill.id,
                billMonth
            ]
        );

        // Credit acts as a payment source for the aging buckets (oldest debt first),
        // so a credit-paid bill does not carry phantom debt into the next cycle.
        let remainingPayment = roundMoney(amtPaid + creditApplied);

        const paidAgainstOldest = Math.min(remainingPayment, totalD60AndLegacy);
        const remaining_d60_plus_legacy = Math.max(0, totalD60AndLegacy - paidAgainstOldest);
        remainingPayment -= paidAgainstOldest;

        const paidAgainstPenalty = Math.min(remainingPayment, penalty);
        remainingPayment -= paidAgainstPenalty;

        const paidAgainstD30_60 = Math.min(remainingPayment, d30_60_bucket);
        const remaining_d30_60 = Math.max(0, d30_60_bucket - paidAgainstD30_60);
        remainingPayment -= paidAgainstD30_60;

        const paidAgainstD30 = Math.min(remainingPayment, d30_bucket);
        const remaining_d30 = Math.max(0, d30_bucket - paidAgainstD30);
        remainingPayment -= paidAgainstD30;

        const paidAgainstCurrent = Math.min(remainingPayment, currentMonthlyCharge);
        const remaining_current = Math.max(0, currentMonthlyCharge - paidAgainstCurrent);

        d60_bucket = remaining_d60_plus_legacy + remaining_d30_60;
        d30_60_bucket = remaining_d30;
        d30_bucket = remaining_current;

        if (carriedForwardUnpaid > 0.01) {
            billIndexCounter++;
        } else {
            billIndexCounter = 0;
        }
    }

    // Void auto-created credits whose bill was deleted/removed since the last sync.
    if (creditEnabled) {
        const liveBillIds = new Set(bills.map((b: any) => String(b.id)));
        for (const [billId, created] of createdByBill) {
            if (!liveBillIds.has(billId)) {
                creditBalance = Math.max(0, roundMoney(creditBalance - created.amount));
                await dbInsertCreditLedgerRow(qFunc, client, customerKey, 'voided', created.amount, 'bill_removed', null, null, created.id, creditBalance, null);
            }
        }
    }

    const finalOutstandingBalance = Number(carriedForwardUnpaid.toFixed(2));
    const finalStatus = finalOutstandingBalance > 0.01 ? 'Unpaid' : 'Paid';

    if (isBulk) {
        await qFunc(
            `UPDATE bulk_meters 
             SET "creditBalance" = $1, "outStandingbill" = $2, "paymentStatus" = $3 
             WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($4))`,
            [roundMoney(creditBalance), finalOutstandingBalance, finalStatus, customerKey]
        );
    } else {
        await qFunc(
            `UPDATE individual_customers 
             SET "outStandingbill" = $1, "paymentStatus" = $2 
             WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($3))`,
            [finalOutstandingBalance, finalStatus, customerKey]
        );
    }
};

/**
 * Insert a credit_ledger row through the same connection the engine is using
 * (so it participates in any enclosing transaction). Returns the new row id.
 */
async function dbInsertCreditLedgerRow(
    qFunc: (text: string, params?: any[]) => Promise<any>,
    client: any,
    bulkMeterId: string,
    eventType: 'created' | 'applied' | 'voided',
    amount: number,
    reason: string,
    sourceBillId: string | null,
    sourcePaymentId: string | null,
    voidedLedgerId: string | null,
    balanceAfter: number,
    createdBy: string | null,
    notes?: string | null
): Promise<{ id: string }> {
    const res = await qFunc(
        `INSERT INTO credit_ledger
            (bulk_meter_id, event_type, amount, reason, source_bill_id, source_payment_id, voided_ledger_id, balance_after, created_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [bulkMeterId, eventType, roundMoney(amount), reason, sourceBillId, sourcePaymentId, voidedLedgerId, roundMoney(balanceAfter), createdBy, notes ?? null]
    );
    const rows = client ? res.rows : res;
    return rows[0] as { id: string };
}

/** Current credit (deposit) balance for a bulk meter, in ETB. */
export const dbGetMeterCreditBalance = async (customerKey: string): Promise<number> => {
    const rows = await query(
        `SELECT "creditBalance" FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1)) AND deleted_at IS NULL`,
        [customerKey]
    );
    return Number(rows[0]?.creditBalance || 0);
};

/**
 * Recompute a bulk meter's creditBalance from the credit_ledger trail
 * (sum of non-voided created − non-voided applied) and persist it.
 * Self-healing / test helper: keeps the stored balance in sync with the ledger.
 */
export const dbRebuildCreditBalance = async (customerKey: string): Promise<number> => {
    const rows = await query(
        `SELECT COALESCE(SUM(CASE WHEN e.event_type = 'created' THEN e.amount ELSE -e.amount END), 0) AS balance
         FROM credit_ledger e
         WHERE e.bulk_meter_id = $1
           AND e.event_type IN ('created', 'applied')
           AND NOT EXISTS (
               SELECT 1 FROM credit_ledger v
               WHERE v.voided_ledger_id = e.id AND v.event_type = 'voided'
           )`,
        [customerKey]
    );
    const balance = Number(rows[0]?.balance || 0);
    await query(
        `UPDATE bulk_meters SET "creditBalance" = $1 WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($2))`,
        [roundMoney(balance), customerKey]
    );
    return roundMoney(balance);
};

/** A single credit_ledger row as exposed to the UI. */
export interface CreditLedgerEntry {
    id: string;
    event_type: 'created' | 'applied' | 'voided';
    amount: number;
    reason: string | null;
    source_bill_id: string | null;
    source_bill_key: string | null;
    source_payment_id: string | null;
    voided_ledger_id: string | null;
    balance_after: number;
    created_by: string | null;
    created_at: string | Date;
    notes: string | null;
}

/**
 * Current credit balance + full ledger for a bulk meter (newest first).
 * Used by the Bulk Meter Details credit card.
 */
export const dbGetMeterCredit = async (customerKey: string): Promise<{ creditBalance: number; ledger: CreditLedgerEntry[] }> => {
    const balance = await dbGetMeterCreditBalance(customerKey);
    const rows = await query(
        `SELECT l.id, l.event_type, l.amount, l.reason, l.source_bill_id, b."BILLKEY" AS source_bill_key,
                l.source_payment_id, l.voided_ledger_id, l.balance_after, l.created_by, l.created_at, l.notes
         FROM credit_ledger l
         LEFT JOIN bills b ON b.id = l.source_bill_id
         WHERE l.bulk_meter_id = $1
         ORDER BY l.created_at DESC, l.id DESC`,
        [customerKey]
    );
    return {
        creditBalance: balance,
        ledger: rows.map((r: any) => ({
            id: String(r.id),
            event_type: r.event_type,
            amount: Number(r.amount || 0),
            reason: r.reason,
            source_bill_id: r.source_bill_id ? String(r.source_bill_id) : null,
            source_bill_key: r.source_bill_key || null,
            source_payment_id: r.source_payment_id ? String(r.source_payment_id) : null,
            voided_ledger_id: r.voided_ledger_id ? String(r.voided_ledger_id) : null,
            balance_after: Number(r.balance_after || 0),
            created_by: r.created_by ? String(r.created_by) : null,
            created_at: r.created_at,
            notes: r.notes,
        })),
    };
};

/**
 * Most recent overpaid bill for a bulk meter (amount_paid > bill total, bill not
 * deleted, and no live 'created' credit already linked to it). Used to auto-link
 * manual duplicate-transaction credits to the bill that actually overpaid.
 */
export const dbGetMostRecentOverpaidBill = async (
    customerKey: string
): Promise<{ id: string; billKey: string | null; monthYear: string; total: number; overpaidBy: number } | null> => {
    const rows = await query(
        `SELECT b.id, b."BILLKEY", b.month_year, b."TOTALBILLAMOUNT", b.amount_paid
         FROM bills b
         WHERE b."CUSTOMERKEY" = $1
           AND b.deleted_at IS NULL
           AND COALESCE(b.amount_paid, 0) > COALESCE(b."TOTALBILLAMOUNT", 0)
           AND NOT EXISTS (
               SELECT 1 FROM credit_ledger c
               WHERE c.source_bill_id = b.id
                 AND c.event_type = 'created'
                 AND NOT EXISTS (
                     SELECT 1 FROM credit_ledger v
                     WHERE v.voided_ledger_id = c.id AND v.event_type = 'voided'
                 )
           )
         ORDER BY b.month_year DESC, b.created_at DESC
         LIMIT 1`,
        [customerKey]
    );
    const r = rows[0];
    if (!r) return null;
    return {
        id: String(r.id),
        billKey: r.BILLKEY || null,
        monthYear: r.month_year,
        total: Number(r.TOTALBILLAMOUNT || 0),
        overpaidBy: roundMoney(Number(r.amount_paid || 0) - Number(r.TOTALBILLAMOUNT || 0)),
    };
};

/**
 * Manual credit add (operator action): inserts a 'created' ledger row and bumps
 * the meter balance atomically. Returns the new ledger row.
 * `sourceBillId` (optional) links the deposit to the bill it came from.
 * When the reason is 'duplicate_transaction' and no bill was picked, the most
 * recent overpaid bill is auto-linked server-side (idempotent: bills that
 * already carry a live credit are skipped).
 */
export const dbCreateCredit = async (
    customerKey: string,
    amount: number,
    reason: string,
    notes: string | null,
    createdBy: string | null,
    sourceBillId?: string | null
): Promise<CreditLedgerEntry> => {
    const amt = roundMoney(Number(amount) || 0);
    if (amt <= 0) throw new Error('Credit amount must be greater than zero.');
    let linkedBillId = sourceBillId || null;
    if (!linkedBillId && reason === 'duplicate_transaction') {
        const overpaid = await dbGetMostRecentOverpaidBill(customerKey);
        if (overpaid) linkedBillId = overpaid.id;
    }
    const rows = await query(
        `WITH upd AS (
            UPDATE bulk_meters
            SET "creditBalance" = round((COALESCE("creditBalance", 0) + $2)::numeric, 2)
            WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1)) AND deleted_at IS NULL
            RETURNING "creditBalance"
         )
         INSERT INTO credit_ledger (bulk_meter_id, event_type, amount, reason, source_bill_id, balance_after, created_by, notes)
         SELECT $1, 'created', $2, $3, $6, round((SELECT "creditBalance" FROM upd)::numeric, 2), $4, $5
         RETURNING id, event_type, amount, reason, source_bill_id, balance_after, created_by, created_at, notes`,
        [customerKey, amt, reason, createdBy ?? null, notes ?? null, linkedBillId]
    );
    if (!rows[0]) throw new Error('Bulk meter not found.');
    return {
        id: String(rows[0].id),
        event_type: 'created',
        amount: Number(rows[0].amount),
        reason: rows[0].reason,
        source_bill_id: rows[0].source_bill_id ? String(rows[0].source_bill_id) : null,
        source_bill_key: null,
        source_payment_id: null,
        voided_ledger_id: null,
        balance_after: Number(rows[0].balance_after),
        created_by: rows[0].created_by ? String(rows[0].created_by) : null,
        created_at: rows[0].created_at,
        notes: rows[0].notes,
    };
};

/**
 * Manual credit void (operator action): reverses the *unconsumed* portion of a
 * 'created' ledger row. Fully-consumed credits are blocked (the money is already
 * sitting in applied bill payments). Returns the amount reversed + new balance.
 */
export const dbVoidCredit = async (
    customerKey: string,
    ledgerId: string,
    createdBy: string | null
): Promise<{ voidedAmount: number; remainingBalance: number }> => {
    const targetRows = await query(
        `SELECT id, amount FROM credit_ledger
         WHERE id = $1 AND bulk_meter_id = $2 AND event_type = 'created'`,
        [ledgerId, customerKey]
    );
    const target = targetRows[0];
    if (!target) throw new Error('Credit not found or is not a created credit.');

    const alreadyVoided = await query(
        `SELECT 1 FROM credit_ledger WHERE voided_ledger_id = $1 AND event_type = 'voided' LIMIT 1`,
        [ledgerId]
    );
    if (alreadyVoided[0]) throw new Error('This credit has already been voided.');

    const balRows = await query(
        `SELECT "creditBalance" FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1)) AND deleted_at IS NULL`,
        [customerKey]
    );
    const currentBalance = roundMoney(Number(balRows[0]?.creditBalance || 0));

    const voidedAmount = roundMoney(Math.min(Number(target.amount), currentBalance));
    if (voidedAmount <= 0.005) {
        throw new Error('This credit has been fully applied to bills and can no longer be voided.');
    }
    const newBalance = roundMoney(currentBalance - voidedAmount);

    await query(
        `INSERT INTO credit_ledger (bulk_meter_id, event_type, amount, reason, voided_ledger_id, balance_after, created_by, notes)
         VALUES ($1, 'voided', $2, 'manual', $3, $4, $5, $6)`,
        [customerKey, voidedAmount, ledgerId, newBalance, createdBy ?? null, 'Manual void of operator credit']
    );
    await query(
        `UPDATE bulk_meters SET "creditBalance" = $1 WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($2))`,
        [newBalance, customerKey]
    );
    return { voidedAmount, remainingBalance: newBalance };
};
