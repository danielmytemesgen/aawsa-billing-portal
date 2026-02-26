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
            sm.email = $1
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

export const dbGetAllCustomers = async () => await query('SELECT * FROM individual_customers WHERE deleted_at IS NULL');

export const dbCreateIndividualCustomer = async (customer: any) => {
    const keys = Object.keys(customer);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO individual_customers (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => customer[k]));
    return rows[0] || customer;
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
    const rows: any = await query('SELECT * FROM individual_customers WHERE "customerKeyNumber" = $1 AND deleted_at IS NULL', [customerKeyNumber]);
    return rows[0] ?? null;
};

export const dbGetCustomersByBookNumber = async (bookNumber: string) => {
    return await query('SELECT * FROM individual_customers WHERE "bookNumber" = $1 AND status = \'Active\' AND deleted_at IS NULL', [bookNumber]);
};

export const dbGetAllBulkMeters = async () => await query('SELECT * FROM bulk_meters WHERE deleted_at IS NULL');

export const dbCreateBulkMeter = async (bulkMeter: any) => {
    const cleanBm = { ...bulkMeter };
    // Map camelCase routeKey to snake_case ROUTE_KEY for DB if needed
    if (cleanBm.routeKey !== undefined) {
        cleanBm.ROUTE_KEY = cleanBm.routeKey;
        delete cleanBm.routeKey;
    }
    const keys = Object.keys(cleanBm);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO bulk_meters (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => cleanBm[k]));
    return rows[0] || cleanBm;
};

export const dbGetBulkMeterById = async (customerKeyNumber: string) => {
    const rows: any = await query('SELECT * FROM bulk_meters WHERE "customerKeyNumber" = $1 AND deleted_at IS NULL', [customerKeyNumber]);
    return rows[0] ?? null;
}

export const dbUpdateBulkMeter = async (customerKeyNumber: string, bulkMeter: any) => {
    const cleanBm = { ...bulkMeter };
    if (cleanBm.routeKey !== undefined) {
        cleanBm.ROUTE_KEY = cleanBm.routeKey;
        delete cleanBm.routeKey;
    }
    const keys = Object.keys(cleanBm);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE bulk_meters SET ${setClause} WHERE "customerKeyNumber" = $${keys.length + 1} RETURNING *`, [...keys.map(k => cleanBm[k]), customerKeyNumber]);
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

export const dbGetAllStaffMembers = async () => await query(`
  SELECT s.*, r.role_name, b.name as branch_name 
  FROM staff_members s 
  LEFT JOIN roles r ON s.role_id = r.id
  LEFT JOIN branches b ON s.branch_id = b.id
  WHERE s.deleted_at IS NULL
`);
export const dbCreateStaffMember = async (staffMember: any) => {
    const keys = Object.keys(staffMember);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO staff_members (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => staffMember[k]));
    return rows[0] || staffMember;
};

export const dbUpdateStaffMember = async (email: string, staffMember: any) => {
    const keys = Object.keys(staffMember);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE staff_members SET ${setClause} WHERE email = $${keys.length + 1} RETURNING *`, [...keys.map(k => staffMember[k]), email]);
    return rows[0] ?? null;
};

export const dbDeleteStaffMember = async (email: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const staffRes = await client.query('SELECT * FROM staff_members WHERE email = $1', [email]);
        const staff = staffRes.rows[0];
        if (!staff) return false;

        await client.query('UPDATE staff_members SET deleted_at = now(), deleted_by = $2 WHERE email = $1', [email, deletedBy]);
        await client.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, deleted_by, original_data) VALUES ($1, $2, $3, $4, $5)',
            ['staff', staff.id, staff.name, deletedBy, JSON.stringify(staff)]);
        return true;
    });
};

export const dbGetDistinctBillingMonths = async () => {
    return await query(`
      SELECT DISTINCT month_year FROM bills
      UNION
      SELECT DISTINCT month FROM bulk_meters
      ORDER BY month_year DESC
    `);
};

export const dbGetBillsByMonth = async (monthYear: string) => {
    return await query('SELECT * FROM bills WHERE month_year = $1', [monthYear]);
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

export const dbGetAllBills = async (branchId?: string) => {
    if (branchId) {
        return await query(`
            SELECT b.* 
            FROM bills b
            LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
            LEFT JOIN individual_customers ic ON b.individual_customer_id = ic."customerKeyNumber"
            WHERE b.deleted_at IS NULL 
            AND (bm.branch_id = $1 OR ic.branch_id = $1)
        `, [branchId]);
    }
    return await query('SELECT * FROM bills WHERE deleted_at IS NULL');
};


export const dbCreateBill = async (bill: any) => {
    const keys = Object.keys(bill);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO bills (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => bill[k]));
    return rows[0] || bill;
};

export const dbUpdateBill = async (id: string, bill: any) => {
    const keys = Object.keys(bill);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE bills SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => bill[k]), id]);
    return rows[0] ?? null;
};

export const dbDeleteBill = async (id: string, deletedBy?: string) => {
    return await withTransaction(async (client) => {
        const billRes = await client.query('SELECT * FROM bills WHERE id = $1', [id]);
        const bill = billRes.rows[0];
        if (!bill) return false;

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

export const dbGetBillsByCustomerId = async (customerKeyNumber: string, branchId?: string) => {
    if (branchId) {
        return await query(`
            SELECT b.* FROM bills b 
            LEFT JOIN individual_customers ic ON b.individual_customer_id = ic."customerKeyNumber"
            LEFT JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
            WHERE (b.individual_customer_id = $1 OR b."CUSTOMERKEY" = $1) 
            AND b.deleted_at IS NULL 
            AND (ic.branch_id = $2 OR bm.branch_id = $2)
            ORDER BY b.created_at DESC
        `, [customerKeyNumber, branchId]);
    }
    return await query(
        'SELECT * FROM bills WHERE (individual_customer_id = $1 OR "CUSTOMERKEY" = $1) AND deleted_at IS NULL ORDER BY created_at DESC',
        [customerKeyNumber]
    );
};

export const dbGetBillsByBulkMeterId = async (customerKeyNumber: string, branchId?: string) => {
    if (branchId) {
        return await query(`
            SELECT b.* FROM bills b
            JOIN bulk_meters bm ON b."CUSTOMERKEY" = bm."customerKeyNumber"
            WHERE b."CUSTOMERKEY" = $1 AND b.deleted_at IS NULL AND bm.branch_id = $2
            ORDER BY b.created_at DESC
        `, [customerKeyNumber, branchId]);
    }
    return await query(
        'SELECT * FROM bills WHERE "CUSTOMERKEY" = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
        [customerKeyNumber]
    );
};

export const dbUpdateBillStatus = async (id: string, status: string, approvalDate: Date | null = null, approvedBy: string | null = null) => {
    let sql = 'UPDATE bills SET status = $1'; // Start building the query
    const params: any[] = [status, id];

    if (approvalDate) {
        sql = 'UPDATE bills SET status = $1, approval_date = $3, approved_by = $4 WHERE id = $2 RETURNING *';
        params.push(approvalDate, approvedBy);
    } else {
        sql = 'UPDATE bills SET status = $1 WHERE id = $2 RETURNING *';
    }

    const rows = await query(sql, params);
    return rows[0] ?? null;
};

export const dbCreateBillWorkflowLog = async (log: { bill_id: string, from_status: string, to_status: string, changed_by: string, reason?: string }) => {
    const keys = Object.keys(log);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO bill_workflow_logs (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => (log as any)[k]));
    return rows[0] || log;
};

export const dbGetBillWorkflowLogs = async (billId: string) => {
    return await query('SELECT * FROM bill_workflow_logs WHERE bill_id = $1 ORDER BY created_at DESC', [billId]);
};

export const dbGetAllIndividualCustomerReadings = async () => await query('SELECT * FROM individual_customer_readings WHERE deleted_at IS NULL');

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

export const dbGetAllBulkMeterReadings = async () => await query('SELECT * FROM bulk_meter_readings WHERE deleted_at IS NULL');

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

export const dbGetMeterReadings = async () => {
    const individual = await query('SELECT * FROM individual_customer_readings WHERE deleted_at IS NULL');
    const bulk = await query('SELECT * FROM bulk_meter_readings WHERE deleted_at IS NULL');

    const individualWithType = (individual as any[]).map(r => ({ ...r, reading_type: 'Individual' }));
    const bulkWithType = (bulk as any[]).map(r => ({ ...r, reading_type: 'Bulk' }));

    return [...individualWithType, ...bulkWithType];
};

export const dbGetAllPayments = async () => await query('SELECT * FROM payments WHERE deleted_at IS NULL');

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

export const dbGetAllReportLogs = async () => await query('SELECT * FROM reports WHERE deleted_at IS NULL');

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

export const dbGetAllNotifications = async () => await query('SELECT * FROM notifications WHERE deleted_at IS NULL');

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

export const dbGetAllSecurityLogs = async (page: number = 1, pageSize: number = 10, sortBy: string = 'created_at', sortOrder: 'asc' | 'desc' = 'desc') => {
    try {
        const offset = (page - 1) * pageSize;
        const validSortColumns = ['id', 'created_at', 'event', 'staff_email', 'ip_address'];
        const validatedSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const validatedSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

        const sql = `
            SELECT id, created_at, event, branch_name, staff_email, customer_key_number, ip_address, severity, details
            FROM security_logs
            ORDER BY ${validatedSortBy} ${validatedSortOrder}
            LIMIT $2 OFFSET $1`;
        const countSql = `SELECT COUNT(*) as total FROM security_logs`;

        const logs = await query(sql, [offset, pageSize]);
        const totalResult: any = await query(countSql);
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

export const dbLogSecurityEvent = async (event: string, staff_email?: string, branch_name?: string, ipAddress?: string, severity: 'Info' | 'Warning' | 'Critical' = 'Info', details: any = {}, customer_key_number?: string) => {
    try {
        let ip_address = ipAddress ?? 'unknown';

        if (!ip_address) ip_address = 'unknown';

        // Try to dynamically import `next/headers` when available (Server Components).
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const maybeHeaders = await import('next/headers');
            if (maybeHeaders && typeof maybeHeaders.headers === 'function') {
                const h = (maybeHeaders as any).headers();

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
        const sql = 'INSERT INTO security_logs (event, staff_email, branch_name, ip_address, severity, details, customer_key_number) VALUES ($1, $2, $3, $4, $5, $6, $7)';
        await query(sql, [event, staff_email, branch_name, ip_address, severity, JSON.stringify(details), customer_key_number]);
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

export const dbGetReaderAssignments = async (staffId: string) => {
    return await query('SELECT * FROM reader_assignments WHERE staff_id = $1 AND status != \'Completed\'', [staffId]);
};

export const dbCreateReaderAssignment = async (assignment: any) => {
    const keys = Object.keys(assignment);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO reader_assignments (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => assignment[k]));
    return rows[0] || assignment;
};

export const dbUpdateAssignmentStatus = async (id: string, status: string) => {
    const rows = await query('UPDATE reader_assignments SET status = $1, updated_at = now() WHERE id = $2 RETURNING *', [status, id]);
    return rows[0] ?? null;
};

// =====================================================
// Route Management Queries
// =====================================================

export const dbGetAllRoutes = async () => await query('SELECT * FROM routes WHERE deleted_at IS NULL');

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

export const dbGetDashboardMetrics = async () => {
    // Detect the latest month with billing data
    const latestMonthRes: any = await query('SELECT month_year FROM bills ORDER BY month_year DESC LIMIT 1');
    const latestMonth = latestMonthRes[0]?.month_year || new Date().toISOString().substring(0, 7);

    // 1. Get Bill Statuses Aggregation for the latest month (Only for POSTED bills)
    const billStatusSql = `
        SELECT payment_status as status, COUNT(*) as count 
        FROM bills 
        WHERE month_year = $1 AND status = 'Posted'
        GROUP BY payment_status
    `;
    const billStatuses = await query(billStatusSql, [latestMonth]);

    // 2. Get Revenue Aggregation for the latest month (Only for POSTED bills)
    // Collected = Sum of Total Bill Amount for bills marked as 'Paid'
    const revenueSql = `
        SELECT 
            SUM("TOTALBILLAMOUNT") as total_billed,
            SUM(CASE WHEN payment_status = 'Paid' THEN "TOTALBILLAMOUNT" ELSE 0 END) as total_collected
        FROM bills
        WHERE status = 'Posted' AND month_year = $1
    `;
    const revenueData: any = await query(revenueSql, [latestMonth]);
    const revenue = revenueData[0] || { total_billed: 0, total_collected: 0 };

    // 3. Meter Reading Progress (Bulk Meters)
    const totalCustomersSql = `SELECT COUNT(*) as count FROM bulk_meters`;
    const totalCustomersData: any = await query(totalCustomersSql);
    const totalCustomers = parseInt(totalCustomersData[0].count || 0);

    // Count bulk meter readings for the latest month
    const currentReadingsSql = `
        SELECT COUNT(DISTINCT "CUST_KEY") as count 
        FROM bulk_meter_readings 
        WHERE TO_CHAR("READING_DATE", 'YYYY-MM') = $1
    `;
    const currentReadingsData: any = await query(currentReadingsSql, [latestMonth]);
    const currentReadings = parseInt(currentReadingsData[0].count || 0);

    // 4. Counts
    const bulkMeterCountData: any = await query('SELECT COUNT(*) as count FROM bulk_meters');
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
            "TOTALBILLAMOUNT" as outstanding,
            CASE 
                WHEN "CUSTOMERKEY" IS NOT NULL THEN 'Bulk' 
                ELSE 'Individual' 
            END as type
        FROM bills
        WHERE month_year = $1 AND payment_status = 'Unpaid' AND status = 'Posted'
        ORDER BY "TOTALBILLAMOUNT" DESC
        LIMIT 5
    `;
    const topDelinquent: any = await query(delinquentSql, [latestMonth]);

    // 6. Branch Performance (Linking bills to branches via meter tables branch_id if CUSTOMERBRANCH is null - ONLY POSTED)
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
        WHERE b.name != 'Head Office'
        GROUP BY b.name
    `;
    const branchPerformance: any = await query(branchPerformanceSql, [latestMonth]);

    // 7. Overall Water Usage Trend (Last 6 months from POSTED bills)
    const usageTrendSql = `
        SELECT 
            "month_year" as month,
            SUM("CONS") as usage
        FROM bills
        WHERE "CONS" IS NOT NULL AND status = 'Posted'
        GROUP BY month
        ORDER BY month DESC
        LIMIT 6
    `;
    const usageTrend: any = await query(usageTrendSql);

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
            individualCustomers: totalCustomers,
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

export const dbGetRecycleBinItems = async () => {
    const sql = `
        SELECT rb.*, sm.name as deleted_by_name
        FROM recycle_bin rb
        LEFT JOIN staff_members sm ON rb.deleted_by = sm.id
        ORDER BY rb.deleted_at DESC
    `;
    return await query(sql);
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
            case 'bill': tableName = 'bills'; idColumn = 'id'; break;
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
            case 'bill': tableName = 'bills'; idColumn = 'id'; break;
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
