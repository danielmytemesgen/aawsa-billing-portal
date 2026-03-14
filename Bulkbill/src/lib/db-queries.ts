import { query } from './db';
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

export const dbGetAllBranches = async () => {
    return await query('SELECT * FROM branches');
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

export const dbDeleteBranch = async (id: string) => {
    await query('DELETE FROM branches WHERE id = $1', [id]);
    return true;
};

export const dbGetAllCustomers = async () => await query('SELECT * FROM individual_customers');

export const dbCreateCustomer = async (customer: any) => {
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

export const dbDeleteCustomer = async (customerKeyNumber: string) => { await query('DELETE FROM individual_customers WHERE "customerKeyNumber" = $1', [customerKeyNumber]); return true; };

export const dbGetAllBulkMeters = async () => await query('SELECT * FROM bulk_meters');

export const dbCreateBulkMeter = async (bulkMeter: any) => {
    const keys = Object.keys(bulkMeter);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO bulk_meters (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => bulkMeter[k]));
    return rows[0] || bulkMeter;
};

export const dbGetBulkMeterById = async (customerKeyNumber: string) => {
    const rows: any = await query('SELECT * FROM bulk_meters WHERE "customerKeyNumber" = $1', [customerKeyNumber]);
    return rows[0] ?? null;
}

export const dbUpdateBulkMeter = async (customerKeyNumber: string, bulkMeter: any) => {
    const keys = Object.keys(bulkMeter);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE bulk_meters SET ${setClause} WHERE "customerKeyNumber" = $${keys.length + 1} RETURNING *`, [...keys.map(k => bulkMeter[k]), customerKeyNumber]);
    return rows[0] ?? null;
};

export const dbDeleteBulkMeter = async (customerKeyNumber: string) => { await query('DELETE FROM bulk_meters WHERE "customerKeyNumber" = $1', [customerKeyNumber]); return true; };

export const dbGetAllStaffMembers = async () => await query(`
  SELECT s.*, r.role_name, b.name as branch_name 
  FROM staff_members s 
  LEFT JOIN roles r ON s.role_id = r.id
  LEFT JOIN branches b ON s.branch_id = b.id
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

export const dbDeleteStaffMember = async (email: string) => { await query('DELETE FROM staff_members WHERE email = $1', [email]); return true; };

export const dbGetAllBills = async () => await query('SELECT * FROM bills');

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

export const dbDeleteBill = async (id: string) => { await query('DELETE FROM bills WHERE id = $1', [id]); return true; };

export const dbGetAllIndividualCustomerReadings = async () => await query('SELECT * FROM individual_customer_readings');

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

export const dbDeleteIndividualCustomerReading = async (id: string) => { await query('DELETE FROM individual_customer_readings WHERE id = $1', [id]); return true; };

export const dbGetAllBulkMeterReadings = async () => await query('SELECT * FROM bulk_meter_readings');

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

export const dbDeleteBulkMeterReading = async (id: string) => { await query('DELETE FROM bulk_meter_readings WHERE id = $1', [id]); return true; };

export const dbGetAllPayments = async () => await query('SELECT * FROM payments');

export const dbCreatePayment = async (payment: any) => {
    const keys = Object.keys(payment);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO payments (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => payment[k]));
    return rows[0] || payment;
};

export const dbUpdatePayment = async (id: string, payment: any) => {
    const keys = Object.keys(payment);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE payments SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => payment[k]), id]);
    return rows[0] ?? null;
};

export const dbDeletePayment = async (id: string) => { await query('DELETE FROM payments WHERE id = $1', [id]); return true; };

export const dbGetAllReportLogs = async () => await query('SELECT * FROM reports');

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

export const dbDeleteReportLog = async (id: string) => { await query('DELETE FROM reports WHERE id = $1', [id]); return true; };

export const dbGetAllNotifications = async () => await query('SELECT * FROM notifications');

export const dbDeleteNotification = async (id: string) => { await query('DELETE FROM notifications WHERE id = $1', [id]); return true; };

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
    await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
    if (permissionIds && permissionIds.length > 0) {
        // Construct ($1, $2), ($1, $3), ...
        // We need to flatten parameters.
        const values: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;
        permissionIds.forEach(pid => {
            values.push(`($${paramIndex}, $${paramIndex + 1})`);
            params.push(roleId, pid);
            paramIndex += 2;
        });
        const sql = `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values.join(',')}`;
        await query(sql, params);
    }
    return true;
};

export const dbGetAllTariffs = async () => await query('SELECT * FROM tariffs');

export const dbGetTariffByTypeAndYear = async (customerType: string, year: number) => {
    const rows: any = await query('SELECT * FROM tariffs WHERE customer_type = $1 AND year = $2 LIMIT 1', [customerType, year]);
    return rows[0] ?? null;
};

export const dbCreateTariff = async (tariff: any) => {
    const keys = Object.keys(tariff);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO tariffs (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
    const rows: any = await query(sql, keys.map(k => tariff[k]));
    return rows[0] || tariff;
};

export const dbUpdateTariff = async (customerType: string, year: number, tariff: any) => {
    const keys = Object.keys(tariff);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
    const rows = await query(`UPDATE tariffs SET ${setClause} WHERE customer_type = $${keys.length + 1} AND year = $${keys.length + 2} RETURNING *`, [...keys.map(k => tariff[k]), customerType, year]);
    return rows[0] ?? null;
};

export const dbGetAllKnowledgeBaseArticles = async () => await query('SELECT * FROM knowledge_base_articles');

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

export const dbDeleteKnowledgeBaseArticle = async (id: number) => { await query('DELETE FROM knowledge_base_articles WHERE id = $1', [id]); return true; };

export const dbGetAllSecurityLogs = async (page: number = 1, pageSize: number = 10, sortBy: string = 'created_at', sortOrder: 'asc' | 'desc' = 'desc') => {
    try {
        const offset = (page - 1) * pageSize;
        const validSortColumns = ['id', 'created_at', 'event', 'staff_email', 'ip_address'];
        const validatedSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const validatedSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

        const sql = `
            SELECT id, created_at, event, branch_name, staff_email, ip_address
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

export const dbUpdateSecurityLog = async (id: string, log: { event?: string; branch_name?: string; staff_email?: string; ip_address?: string }) => {
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

export const dbLogSecurityEvent = async (event: string, staff_email?: string, branch_name?: string, ipAddress?: string) => {
    try {
        let ip_address = ipAddress ?? 'unknown';

        if (!ip_address) ip_address = 'unknown';

        // Try to dynamically import `next/headers` when available (Server Components).
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const maybeHeaders = await import('next/headers');
            if (maybeHeaders && typeof maybeHeaders.headers === 'function') {
                const h = (maybeHeaders as any).headers();
                const forwarded = h.get?.('x-forwarded-for') ?? h.get?.('x-real-ip');
                if (forwarded) ip_address = forwarded;
            }
        } catch (e) {
            // ignore: `next/headers` not available in this runtime
        }

        console.log('Logging security event:', { event, staff_email, branch_name, ip_address });
        const sql = 'INSERT INTO security_logs (event, staff_email, branch_name, ip_address) VALUES ($1, $2, $3, $4)';
        await query(sql, [event, staff_email, branch_name, ip_address]);
        return { success: true };
    } catch (error) {
        console.error('Error logging security event:', error);
        return { success: false, message: 'Failed to log security event' };
    }
};