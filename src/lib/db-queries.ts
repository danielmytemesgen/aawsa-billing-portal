import { query, withTransaction } from './db';
import { randomUUID } from 'crypto';

// Postgres-backed implementations for common DB operations.
// These functions keep `any` shapes to match the existing codebase.

export const getStaffMemberForAuth = async (email: string, password?: string) => {
    let sql = `
        SELECT
            sm.*,
            r.role_name,
            STRING_AGG(p.name, ',') AS permissions
        FROM
            staff_members sm
        LEFT JOIN
            roles r ON sm.role_id = r.id
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
            STRING_AGG(p.name, ',') AS permissions
        FROM
            staff_members sm
        JOIN
            roles r ON sm.role_id = r.id
        JOIN
            role_permissions rp ON r.id = rp.role_id
        JOIN
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

export const dbGetAllCustomers = async (options?: { branchId?: string; limit?: number; offset?: number; searchTerm?: string; excludePending?: boolean }) => {
    let sql = 'SELECT ic.*, b.name as branch_name FROM individual_customers ic LEFT JOIN branches b ON ic.branch_id = b.id WHERE ic.deleted_at IS NULL';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.branchId) {
        sql += ` AND ic.branch_id = $${paramIndex++}`;
        params.push(options.branchId);
    }

    if (options?.excludePending) {
        sql += " AND ic.status != 'Pending Approval'";
    }

    if (options?.searchTerm) {
        // Search by Name, Meter Key, Customer Key, or Branch Name (via join)
        sql += ` AND (ic.name ILIKE $${paramIndex} OR ic."METER_KEY" ILIKE $${paramIndex} OR ic."customerKeyNumber" ILIKE $${paramIndex} OR ic."contractNumber" ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
        params.push(`%${options.searchTerm}%`);
        paramIndex++;
    }

    sql += ' ORDER BY created_at DESC';

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

export const dbCountCustomers = async (options?: { branchId?: string; searchTerm?: string; excludePending?: boolean }) => {
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
 */
export const dbGetBillsByBulkMeterIds = async (customerKeys: string[]): Promise<Map<string, any[]>> => {
    if (customerKeys.length === 0) return new Map();
    const placeholders = customerKeys.map((_, i) => `$${i + 1}`).join(',');
    const rows: any[] = await query(
        `SELECT * FROM bills WHERE "CUSTOMERKEY" IN (${placeholders}) AND deleted_at IS NULL ORDER BY created_at DESC`,
        customerKeys
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
 */
export const dbGetBillsByIndividualCustomerIds = async (customerKeys: string[]): Promise<Map<string, any[]>> => {
    if (customerKeys.length === 0) return new Map();
    const placeholders = customerKeys.map((_, i) => `$${i + 1}`).join(',');
    const rows: any[] = await query(
        `SELECT * FROM bills WHERE individual_customer_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY created_at DESC`,
        customerKeys
    );
    const map = new Map<string, any[]>();
    for (const row of rows) {
        const key = row.individual_customer_id;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(row);
    }
    return map;
};

export const dbCreateIndividualCustomer = async (customer: any) => {
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

    const keys = Object.keys(cleanCust);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO individual_customers (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => cleanCust[k]));
    return rows[0] || cleanCust;
};

export const dbUpdateCustomer = async (customerKeyNumber: string, customer: any) => {
    const keys = Object.keys(customer);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE individual_customers SET ${setClause} WHERE "customerKeyNumber" = $${keys.length + 1} RETURNING *`, [...keys.map(k => customer[k]), customerKeyNumber]);
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

export const dbGetCustomerById = async (customerKeyNumber: string) => {
    const rows: any = await query('SELECT * FROM individual_customers WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1)) AND deleted_at IS NULL', [customerKeyNumber]);
    return rows[0] ?? null;
};

export const dbGetCustomersByBookNumber = async (bookNumber: string) => {
    return await query('SELECT * FROM individual_customers WHERE "bookNumber" = $1 AND status = \'Active\' AND deleted_at IS NULL', [bookNumber]);
};

export const dbGetAllBulkMeters = async (options?: { branchId?: string; limit?: number; offset?: number; searchTerm?: string; excludePending?: boolean }) => {
    let sql = 'SELECT bm.*, b.name as branch_name FROM bulk_meters bm LEFT JOIN branches b ON bm.branch_id = b.id WHERE bm.deleted_at IS NULL';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.branchId) {
        sql += ` AND bm.branch_id = $${paramIndex++}`;
        params.push(options.branchId);
    }

    if (options?.excludePending) {
        sql += " AND bm.status != 'Pending Approval'";
    }

    if (options?.searchTerm) {
        // Search by Name, Meter Key, Customer Key, or Branch Name
        sql += ` AND (bm.name ILIKE $${paramIndex} OR bm."METER_KEY" ILIKE $${paramIndex} OR bm."customerKeyNumber" ILIKE $${paramIndex} OR bm."contractNumber" ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
        params.push(`%${options.searchTerm}%`);
        paramIndex++;
    }

    sql += ' ORDER BY "createdAt" DESC';

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

export const dbCountBulkMeters = async (options?: { branchId?: string; searchTerm?: string; excludePending?: boolean }) => {
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

    if (options?.searchTerm) {
        // Search by Name, Meter Key, Customer Key, or Branch Name
        sql += ` AND (bm.name ILIKE $${paramIndex} OR bm."METER_KEY" ILIKE $${paramIndex} OR bm."customerKeyNumber" ILIKE $${paramIndex} OR bm."contractNumber" ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
        params.push(`%${options.searchTerm}%`);
        paramIndex++;
    }

    const rows: any = await query(sql, params);
    return parseInt(rows[0]?.total || '0', 10);
};

export const dbCreateBulkMeter = async (bulkMeter: any) => {
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
    const rows: any = await query(sql, keys.map(k => cleanBm[k]));
    return rows[0] || cleanBm;
};

export const dbGetBulkMeterById = async (customerKeyNumber: string) => {
    console.log(`[DB Query] Fetching bulk meter by ID: "${customerKeyNumber}"`);
    const rows: any = await query('SELECT * FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($1)) AND deleted_at IS NULL', [customerKeyNumber]);
    console.log(`[DB Query] Result: ${rows.length > 0 ? 'Found' : 'Not Found'}`);
    return rows[0] ?? null;
}

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
            JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
            WHERE b.month_year = $1 AND b.deleted_at IS NULL AND bm.branch_id = $2
        `, [monthYear, branchId]);
    }
    return await query(`
      SELECT b.*, bm.name, bm."phoneNumber", bm."contractNumber", bm."METER_KEY" as "meterNumber", bm."meterSize", bm."specificArea", bm."subCity", bm.woreda, bm.charge_group, bm.sewerage_connection
      FROM bills b
      JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
      WHERE b.month_year = $1 AND b.deleted_at IS NULL
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

export const dbGetAllBills = async (options?: { branchId?: string; excludeUnfinalized?: boolean }) => {
    let sql = 'SELECT b.* FROM bills b';
    const params: any[] = [];
    let paramIndex = 1;

    let whereClauses = ['b.deleted_at IS NULL'];

    if (options?.branchId) {
        sql += ' LEFT JOIN individual_customers ic ON b.individual_customer_id = ic."customerKeyNumber"';
        sql += ' LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"';
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


export const dbCreateBill = async (bill: any, client?: any) => {
    const keys = Object.keys(bill);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO bills (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const params = keys.map(k => bill[k]);

    if (client) {
        const res = await client.query(sql, params);
        return res.rows[0] || bill;
    }
    const rows: any = await query(sql, params);
    return rows[0] || bill;
};

export const dbUpdateBill = async (id: string, bill: any, client?: any) => {
    const keys = Object.keys(bill);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const sql = `UPDATE bills SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
    const params = [...keys.map(k => bill[k]), id];

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

        await client.query('UPDATE bills SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['bill', id, bill.bill_number || `Bill ${id}`, deletedBy, JSON.stringify(bill)]);
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

    let whereClauses = ['(b.individual_customer_id = $1 OR b."CUSTOMERKEY" = $1)', 'b.deleted_at IS NULL'];

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

    let whereClauses = ['b."CUSTOMERKEY" = $1', 'b.deleted_at IS NULL'];

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

export const dbUpdateBillStatus = async (id: string, status: string, approvalDate: Date | null = null, approvedBy: string | null = null, client?: any) => {
    let sql = 'UPDATE bills SET status = $1';
    const params: any[] = [status, id];

    if (approvalDate) {
        sql = 'UPDATE bills SET status = $1, approval_date = $3, approved_by = $4 WHERE id = $2 RETURNING *';
        params.push(approvalDate, approvedBy);
    } else {
        sql = 'UPDATE bills SET status = $1 WHERE id = $2 RETURNING *';
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

export const dbGetAllIndividualCustomerReadings = async (branchId?: string) => {
    if (branchId) {
        return await query(`
            SELECT r.* FROM individual_customer_readings r
            JOIN individual_customers ic ON r."CUST_KEY" = ic."customerKeyNumber"
            WHERE r.deleted_at IS NULL AND ic.branch_id = $1
        `, [branchId]);
    }
    return await query('SELECT * FROM individual_customer_readings WHERE deleted_at IS NULL');
};

export const dbCreateIndividualCustomerReading = async (reading: any) => {
    const keys = Object.keys(reading);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO individual_customer_readings (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => reading[k]));
    return rows[0] || reading;
};

export const dbUpdateIndividualCustomerReading = async (id: string, reading: any) => {
    const keys = Object.keys(reading);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE individual_customer_readings SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => reading[k]), id]);
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

export const dbGetAllBulkMeterReadings = async (branchId?: string) => {
    if (branchId) {
        return await query(`
            SELECT r.* FROM bulk_meter_readings r
            JOIN bulk_meters bm ON r."CUST_KEY" = bm."customerKeyNumber"
            WHERE r.deleted_at IS NULL AND bm.branch_id = $1
        `, [branchId]);
    }
    return await query('SELECT * FROM bulk_meter_readings WHERE deleted_at IS NULL');
};

export const dbCreateBulkMeterReading = async (reading: any) => {
    try {
        const keys = Object.keys(reading);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
        const sql = `INSERT INTO bulk_meter_readings (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
        const rows: any = await query(sql, keys.map(k => reading[k]));
        return rows[0] || reading;
    } catch (error) {
        console.error('dbCreateBulkMeterReading error:', error);
        throw error;
    }
};

export const dbUpdateBulkMeterReading = async (id: string, reading: any) => {
    const keys = Object.keys(reading);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE bulk_meter_readings SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => reading[k]), id]);
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

export const dbCreatePayment = async (payment: any) => {
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

export const dbGetTariffByTypeAndDate = async (customerType: string, effectiveDate: string) => {
    const rows: any = await query('SELECT * FROM tariffs WHERE customer_type = $1 AND effective_date = $2 LIMIT 1', [customerType, effectiveDate]);
    return rows[0] ?? null;
};

export const dbGetLatestApplicableTariff = async (customerType: string, date: string) => {
    const rows: any = await query(
        'SELECT * FROM tariffs WHERE customer_type = $1 AND effective_date <= $2 ORDER BY effective_date DESC LIMIT 1',
        [customerType, date]
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
    const rows = await query(`UPDATE tariffs SET ${setClause} WHERE customer_type = $${keys.length + 1} AND effective_date = $${keys.length + 2} RETURNING *`, [...keys.map(k => tariff[k]), customerType, effectiveDate]);
    return rows[0] ?? null;
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

        // Map application severity to database ENUM severity_level
        let dbSeverity = 'Medium';
        if (severity === 'info') dbSeverity = 'Low';
        else if (severity === 'warning') dbSeverity = 'Medium';
        else if (severity === 'critical') dbSeverity = 'Critical';

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

export const dbRevokeCustomerSession = async (sessionId: string) => {
    const sql = 'UPDATE customer_sessions SET is_revoked = true WHERE id = $1 RETURNING *';
    const rows: any = await query(sql, [sessionId]);
    return rows[0];
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

export const dbLogCustomerPageView = async (sessionId: string, pageName: string) => {
    // Append page to pages_viewed array only if not already present
    const sql = `
        UPDATE customer_sessions 
        SET pages_viewed = array_append(pages_viewed, $2), last_active_at = now()
        WHERE id = $1 AND is_revoked = false AND NOT ($2 = ANY(COALESCE(pages_viewed, '{}')))
        RETURNING *
    `;
    const rows: any = await query(sql, [sessionId, pageName]);
    return rows[0] ?? null;
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

export const dbGetAllRoutes = async (branchId?: string) => {
    if (branchId) {
        return await query('SELECT * FROM routes WHERE deleted_at IS NULL AND branch_id = $1', [branchId]);
    }
    return await query('SELECT * FROM routes WHERE deleted_at IS NULL');
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
    const keys = Object.keys(routeUpdates);
    if (keys.length === 0) return null;
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE routes SET ${setClause} WHERE route_key = $${keys.length + 1} RETURNING *`, [...keys.map(k => routeUpdates[k]), routeKey]);
    return rows[0] ?? null;
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
    // Always use the current calendar month (YYYY-MM)
    const latestMonth = new Date().toISOString().substring(0, 7);

    const params = [latestMonth];
    let branchFilter = '';
    if (branchId) {
        branchFilter = ' AND branch_id = $2';
        params.push(branchId);
    }

    // 1. Get Bill Statuses Aggregation for the latest month (Only for POSTED bills)
    const billStatusSql = `
        SELECT payment_status as status, COUNT(*) as count 
        FROM bills 
        WHERE month_year = $1 AND status = 'Posted' AND deleted_at IS NULL ${branchFilter}
        GROUP BY payment_status
    `;
    const billStatuses = await query(billStatusSql, params);

    // 2. Get Revenue Aggregation for the latest month (Only for POSTED bills)
    const revenueSql = `
        SELECT 
            SUM(COALESCE("PENALTYAMT", 0) + COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0))) + COALESCE("THISMONTHBILLAMT", GREATEST(0, COALESCE("TOTALBILLAMOUNT", 0) - COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0)))))) as total_billed,
            SUM(CASE WHEN payment_status = 'Paid' THEN (COALESCE("PENALTYAMT", 0) + COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0))) + COALESCE("THISMONTHBILLAMT", GREATEST(0, COALESCE("TOTALBILLAMOUNT", 0) - COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0)))))) ELSE 0 END) as total_collected
        FROM bills
        WHERE status = 'Posted' AND month_year = $1 AND deleted_at IS NULL ${branchFilter}
    `;
    const revenueData: any = await query(revenueSql, params);
    const revenue = revenueData[0] || { total_billed: 0, total_collected: 0 };

    // 3. Meter Reading Progress (Bulk Meters)
    let meterFilter = '';
    if (branchId) {
        meterFilter = ' WHERE branch_id = $1';
    }
    const totalCustomersSql = `SELECT COUNT(*) as count FROM bulk_meters ${meterFilter ? meterFilter + ' AND status = \'Active\'' : ' WHERE status = \'Active\''}`;
    const totalCustomersData: any = await query(totalCustomersSql, branchId ? [branchId] : []);
    const totalCustomers = parseInt(totalCustomersData[0].count || 0);

    // Count bulk meter readings for the latest month
    let currentReadingsSql = `
        SELECT COUNT(DISTINCT bmr."CUST_KEY") as count 
        FROM bulk_meter_readings bmr
        JOIN bulk_meters bm ON bmr."CUST_KEY" = bm."customerKeyNumber"
        WHERE TO_CHAR(bmr."READING_DATE", 'YYYY-MM') = $1
    `;
    if (branchId) {
        currentReadingsSql += ' AND bm.branch_id = $2';
    }
    const currentReadingsData: any = await query(currentReadingsSql, params);
    const currentReadings = parseInt(currentReadingsData[0].count || 0);

    // 4. Counts
    const bulkMeterCountData: any = await query(`SELECT COUNT(*) as count FROM bulk_meters ${meterFilter ? meterFilter + ' AND status != \'Pending Approval\'' : ' WHERE status != \'Pending Approval\''}`, branchId ? [branchId] : []);

    // Only count active individual customers, exclude pending/inactive
    let individualFilter = 'WHERE status != \'Pending Approval\'';
    if (branchId) {
        individualFilter += ' AND branch_id = $1';
    }
    const individualCustomerCountData: any = await query(`SELECT COUNT(*) as count FROM individual_customers ${individualFilter}`, branchId ? [branchId] : []);

    const branchCountData: any = await query('SELECT COUNT(*) as count FROM branches');

    // 5. Top Delinquent Accounts (Filtered by latest month as requested)
    const delinquentSql = `
        SELECT 
            COALESCE("CUSTOMERKEY", individual_customer_id) as key, 
            COALESCE(
                (SELECT name FROM individual_customers WHERE "customerKeyNumber" = bills.individual_customer_id),
                (SELECT name FROM bulk_meters WHERE "customerKeyNumber" = bills."CUSTOMERKEY"),
                'Unknown'
            ) as name,
            (COALESCE("PENALTYAMT", 0) + COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0))) + COALESCE("THISMONTHBILLAMT", GREATEST(0, COALESCE("TOTALBILLAMOUNT", 0) - COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0)))))) as outstanding,
            CASE 
                WHEN "CUSTOMERKEY" IS NOT NULL THEN 'Bulk' 
                ELSE 'Individual' 
            END as type
        FROM bills
        WHERE month_year = $1 AND payment_status = 'Unpaid' AND status = 'Posted' ${branchFilter}
        ORDER BY (COALESCE("PENALTYAMT", 0) + COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0))) + COALESCE("THISMONTHBILLAMT", GREATEST(0, COALESCE("TOTALBILLAMOUNT", 0) - COALESCE("OUTSTANDINGAMT", (COALESCE(debit_30, 0) + COALESCE(debit_30_60, 0) + COALESCE(debit_60, 0)))))) DESC
        LIMIT 5
    `;
    const topDelinquent: any = await query(delinquentSql, params);

    // 6. Branch Performance
    let perfBranchFilter = "WHERE b.name != 'Head Office'";
    if (branchId) {
        perfBranchFilter += " AND b.id = $2";
    }
    const branchPerformanceSql = `
        SELECT 
            b.name as branch_name,
            COUNT(CASE WHEN bi.payment_status = 'Paid' THEN 1 END) as paid,
            COUNT(CASE WHEN bi.payment_status = 'Unpaid' THEN 1 END) as unpaid
        FROM branches b
        LEFT JOIN (
            SELECT 
                COALESCE(
                    "CUSTOMERBRANCH", 
                    (SELECT br.name FROM branches br JOIN bulk_meters bm ON br.id = bm.branch_id WHERE bm."customerKeyNumber" = bills."CUSTOMERKEY" LIMIT 1),
                    (SELECT br.name FROM branches br JOIN individual_customers ic ON br.id = ic.branch_id WHERE ic."customerKeyNumber" = bills.individual_customer_id LIMIT 1)
                ) as inferred_branch,
                payment_status,
                month_year
            FROM bills
            WHERE month_year = $1 AND status = 'Posted'
        ) bi ON TRIM(BOTH '\t' FROM TRIM(bi.inferred_branch)) = TRIM(BOTH '\t' FROM TRIM(b.name))
        ${perfBranchFilter}
        GROUP BY b.name
    `;
    const branchPerformance: any = await query(branchPerformanceSql, params);

    // 7. Overall Water Usage Trend (Last 6 months from POSTED bills)
    const usageBranchFilter = branchId ? 'AND branch_id = $1' : '';
    const usageTrendSql = `
        SELECT 
            "month_year" as month,
            SUM("CONS") as usage
        FROM bills
        WHERE "CONS" IS NOT NULL AND status = 'Posted' ${usageBranchFilter}
        GROUP BY month
        ORDER BY month DESC
        LIMIT 6
    `;
    const usageTrend: any = await query(usageTrendSql, branchId ? [branchId] : []);


    return {
        latestMonth,
        billStatuses,
        revenue: {
            totalBilled: Number(revenue.total_billed || 0),
            totalCollected: Number(revenue.total_collected || 0),
            efficiency: (revenue.total_billed && Number(revenue.total_billed) > 0) ? (Number(revenue.total_collected || 0) / Number(revenue.total_billed)) * 100 : 0
        },
        readings: {
            totalCustomers,
            completedReadings: currentReadings,
            progress: totalCustomers > 0 ? (currentReadings / totalCustomers) * 100 : 0
        },
        counts: {
            bulkMeters: parseInt(bulkMeterCountData[0].count || 0),
            individualCustomers: parseInt(individualCustomerCountData[0].count || 0),
            branches: parseInt(branchCountData[0].count || 0)
        },
        delinquent: {
            combined: topDelinquent
        },
        branchPerformance: branchPerformance.map((bp: any) => ({
            branch: bp.branch_name,
            paid: parseInt(bp.paid || 0),
            unpaid: parseInt(bp.unpaid || 0)
        })),
        usageTrend: usageTrend.reverse().map((ut: any) => ({
            month: ut.month,
            usage: Number(ut.usage || 0)
        }))
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

export const dbUpdateBillingJob = async (id: string, updates: any) => {
    const keys = Object.keys(updates);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const sql = `UPDATE billing_jobs SET ${setClause} WHERE id = $1 RETURNING *`;
    const rows: any = await query(sql, [id, ...keys.map(k => updates[k])]);
    return rows[0];
};

export const dbGetBillingJob = async (id: string) => {
    const rows: any = await query('SELECT * FROM billing_jobs WHERE id = $1', [id]);
    return rows[0];
};

export const dbGetActiveBillingJobs = async (monthYear: string, type: string) => {
    return await query(`
        SELECT * FROM billing_jobs 
        WHERE month_year = $1 AND type = $2 AND status IN ('pending', 'processing')
        ORDER BY created_at DESC
    `, [monthYear, type]);
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
export const dbBatchInsertBills = async (bills: any[]) => {
    if (bills.length === 0) return [];

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
    ];

    const colNames = columnDefs.map(c => `"${c.name}"`).join(', ');
    // Each placeholder is cast to its explicit type so PostgreSQL can resolve unnest()
    const placeholders = columnDefs.map((c, i) => `unnest($${i + 1}::${c.pgType}[])`).join(', ');

    const sql = `
        INSERT INTO bills (${colNames})
        SELECT ${placeholders}
        RETURNING *
    `;

    // Build one array per column
    const columnData = columnDefs.map(c => bills.map(b => {
        const val = (b as any)[c.name];
        return val === undefined ? null : val;
    }));

    const rows = await query(sql, columnData);
    return rows;
};


// --- Paginated Reports ---

export const dbGetUnsettledBillsPaginated = async (params: {
    limit: number;
    offset: number;
    searchTerm?: string;
    branchId?: string;
    excludeUnfinalized?: boolean;
}) => {
    let sql = `
        SELECT b.* FROM bills b
        WHERE b.payment_status = 'Unpaid'
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
    excludeUnfinalized?: boolean;
}) => {
    let sql = `SELECT COUNT(*) FROM bills WHERE payment_status = 'Unpaid'`;
    if (params.excludeUnfinalized) {
        sql += " AND status = 'Posted'";
    }
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.branchId && params.branchId !== 'all') {
        sql += ` AND branch_id = $${paramIndex++}`;
        queryParams.push(params.branchId);
    }

    if (params.searchTerm) {
        sql += ` AND ("BILLKEY" ILIKE $${paramIndex} OR "CUSTOMERNAME" ILIKE $${paramIndex} OR "CUSTOMERKEY" ILIKE $${paramIndex} OR individual_customer_id ILIKE $${paramIndex})`;
        queryParams.push(`%${params.searchTerm}%`);
    }

    const rows: any = await query(sql, queryParams);
    return parseInt(rows[0].count);
};

export const dbGetPaidBillsPaginated = async (params: {
    limit: number;
    offset: number;
    searchTerm?: string;
    branchId?: string;
    excludeUnfinalized?: boolean;
}) => {
    let sql = `
        SELECT b.* FROM bills b
        WHERE b.payment_status = 'Paid'
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

    if (params.searchTerm) {
        sql += ` AND (b."BILLKEY" ILIKE $${paramIndex} OR b."CUSTOMERNAME" ILIKE $${paramIndex} OR b."CUSTOMERKEY" ILIKE $${paramIndex} OR b.individual_customer_id ILIKE $${paramIndex})`;
        queryParams.push(`%${params.searchTerm}%`);
        paramIndex++;
    }

    sql += ` ORDER BY b.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(params.limit, params.offset);

    return await query(sql, queryParams);
};

export const dbGetPaidBillsCount = async (params: {
    searchTerm?: string;
    branchId?: string;
    excludeUnfinalized?: boolean;
}) => {
    let sql = `SELECT COUNT(*) FROM bills WHERE payment_status = 'Paid'`;
    if (params.excludeUnfinalized) {
        sql += " AND status = 'Posted'";
    }
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.branchId && params.branchId !== 'all') {
        sql += ` AND branch_id = $${paramIndex++}`;
        queryParams.push(params.branchId);
    }

    if (params.searchTerm) {
        sql += ` AND ("BILLKEY" ILIKE $${paramIndex} OR "CUSTOMERNAME" ILIKE $${paramIndex} OR "CUSTOMERKEY" ILIKE $${paramIndex} OR individual_customer_id ILIKE $${paramIndex})`;
        queryParams.push(`%${params.searchTerm}%`);
    }

    const rows: any = await query(sql, queryParams);
    return parseInt(rows[0].count);
};

export const dbGetAllSentBillsPaginated = async (params: {
    limit: number;
    offset: number;
    searchTerm?: string;
    branchId?: string;
}) => {
    let sql = `
        SELECT b.* FROM bills b
        WHERE b.status = 'Posted'
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.branchId && params.branchId !== 'all') {
        sql += ` AND b.branch_id = $${paramIndex++}`;
        queryParams.push(params.branchId);
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
}) => {
    let sql = `SELECT COUNT(*) FROM bills WHERE status = 'Posted'`;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.branchId && params.branchId !== 'all') {
        sql += ` AND branch_id = $${paramIndex++}`;
        queryParams.push(params.branchId);
    }

    if (params.searchTerm) {
        sql += ` AND ("BILLKEY" ILIKE $${paramIndex} OR "CUSTOMERNAME" ILIKE $${paramIndex} OR "CUSTOMERKEY" ILIKE $${paramIndex} OR individual_customer_id ILIKE $${paramIndex})`;
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

export const dbUpdateSystemSetting = async (key: string, value: string) => {
    return await query(`
        INSERT INTO system_settings (key, value, updated_at) 
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [key, value]);
};


