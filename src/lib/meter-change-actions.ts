'use server';

import { revalidatePath } from 'next/cache';
import { query, withTransaction } from './db';
import { checkPermissionAny, logSecurityEventAction } from './actions';
import { PERMISSIONS } from './constants/auth';
import { dbGetCustomerById, dbGetBulkMeterById } from './db-queries';

export interface MeterChangePayload {
  meterType: 'individual' | 'bulk';
  customerKeyNumber: string;
  oldMeterNumber: string;
  oldMeterClosingReading: number;
  newMeterNumber: string;
  newMeterOpeningReading: number;
  changeDate: string;
  notes?: string;
  newMeterSize?: number;
  newDialCount?: number;
  newSealNumber?: string;
}

export interface MeterChangeRecord {
  id: string;
  meterType: 'individual' | 'bulk';
  customerKeyNumber: string;
  oldMeterNumber: string;
  oldMeterClosingReading: number;
  newMeterNumber: string;
  newMeterOpeningReading: number;
  changeDate: string;
  notes?: string;
  performedBy?: string;
  performedByEmail?: string;
  createdAt: string;
  oldMeterSize?: number;
  newMeterSize?: number;
  newSealNumber?: string;
  newDialCount?: number;
  closingConsumption?: number;
  status?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export interface GetMeterChangeLogsParams {
  customerKeyNumber?: string;
  meterType?: 'individual' | 'bulk';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  status?: string;
}

let tableChecked = false;
export async function ensureMeterChangeTable() {
  if (tableChecked) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS meter_change_log (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        meter_type text NOT NULL CHECK (meter_type IN ('individual', 'bulk')),
        customer_key_number text NOT NULL,
        old_meter_number text NOT NULL,
        old_meter_closing_reading numeric NOT NULL DEFAULT 0,
        new_meter_number text NOT NULL,
        new_meter_opening_reading numeric NOT NULL DEFAULT 0,
        change_date date NOT NULL,
        notes text,
        performed_by text,
        performed_by_email text,
        created_at timestamptz DEFAULT now(),
        old_meter_size numeric,
        new_meter_size numeric,
        new_seal_number text,
        new_dial_count integer,
        closing_consumption numeric DEFAULT 0,
        status text DEFAULT 'Active',
        voided_at timestamptz,
        voided_by text,
        void_reason text
      );
      CREATE INDEX IF NOT EXISTS idx_mcl_customer_key ON meter_change_log(customer_key_number);
      CREATE INDEX IF NOT EXISTS idx_mcl_change_date ON meter_change_log(change_date DESC);
      CREATE INDEX IF NOT EXISTS idx_mcl_status ON meter_change_log(status);
    `);
    tableChecked = true;
  } catch (err) {
    console.error('Failed to ensure meter_change_log table:', err);
  }
}

function verifyBranchAccess(
  entityBranchId: string | undefined | null,
  session: any,
  viewAllPermission: string,
  entityLabel = 'record'
) {
  const perms: string[] = session?.permissions || [];
  const hasGlobalAccess =
    perms.includes('*') ||
    perms.includes('all') ||
    perms.includes('admin') ||
    perms.includes(viewAllPermission);

  if (hasGlobalAccess) return;

  const userBranchId = session?.branchId;
  if (!userBranchId || userBranchId === 'all') {
    return;
  }

  if (entityBranchId && userBranchId !== entityBranchId) {
    throw new Error(`Forbidden: You can only modify a ${entityLabel} that belongs to your branch.`);
  }
}

/**
 * Fetch existing meter information for pre-populating and validating meter change
 */
export async function getMeterDetailsForChangeAction(meterType: 'individual' | 'bulk', customerKeyNumber: string) {
  try {
    await checkPermissionAny(
      PERMISSIONS.METER_CHANGE_VIEW,
      PERMISSIONS.METER_CHANGE_CREATE,
      PERMISSIONS.METER_CHANGE_MANAGE,
      PERMISSIONS.CUSTOMERS_UPDATE,
      PERMISSIONS.CUSTOMERS_VIEW_ALL,
      PERMISSIONS.CUSTOMERS_VIEW_BRANCH,
      PERMISSIONS.BULK_METERS_UPDATE,
      PERMISSIONS.BULK_METERS_VIEW_ALL,
      PERMISSIONS.BULK_METERS_VIEW_BRANCH,
      PERMISSIONS.DASHBOARD_VIEW_ALL,
      PERMISSIONS.SETTINGS_MANAGE
    );

    if (!customerKeyNumber?.trim()) {
      return { data: null, error: { message: 'Customer Key Number is required.' } };
    }

    const entity = meterType === 'individual'
      ? await dbGetCustomerById(customerKeyNumber.trim())
      : await dbGetBulkMeterById(customerKeyNumber.trim());

    if (!entity) {
      return { data: null, error: { message: `${meterType === 'individual' ? 'Customer' : 'Bulk meter'} not found.` } };
    }

    return {
      data: {
        customerKeyNumber: entity.customerKeyNumber || customerKeyNumber.trim(),
        name: entity.name || entity.customerName || 'N/A',
        meterNumber: entity.METER_KEY || entity.meterNumber || entity.meter_number || entity.meterKey || '',
        currentReading: Number(entity.currentReading ?? entity.current_reading ?? 0),
        previousReading: Number(entity.previousReading ?? entity.previous_reading ?? 0),
        meterSize: Number(entity.meterSize ?? 0.5),
        numberOfDials: Number(entity.NUMBER_OF_DIALS ?? entity.numberOfDials ?? 5),
        branchId: entity.branch_id || entity.branchId || '',
        status: entity.status || '',
      },
      error: null
    };
  } catch (error: any) {
    return { data: null, error: { message: error.message || 'Failed to fetch meter details' } };
  }
}

/**
 * Executes a meter swap:
 * 1. Validates permissions & branch access
 * 2. Calculates closing unbilled consumption
 * 3. Writes full audit log to meter_change_log (including specs and seal)
 * 4. Updates live customer/bulk meter record with new METER_KEY, readings baseline, and meter size
 * 5. Logs security audit trail
 */
export async function meterChangeAction(payload: MeterChangePayload) {
  try {
    await ensureMeterChangeTable();
    const session = await checkPermissionAny(
      PERMISSIONS.METER_CHANGE_CREATE,
      PERMISSIONS.METER_CHANGE_MANAGE,
      PERMISSIONS.CUSTOMERS_UPDATE,
      PERMISSIONS.BULK_METERS_UPDATE
    );

    const {
      meterType,
      customerKeyNumber,
      oldMeterNumber,
      oldMeterClosingReading,
      newMeterNumber,
      newMeterOpeningReading,
      changeDate,
      notes,
      newMeterSize,
      newDialCount,
      newSealNumber
    } = payload;

    if (!customerKeyNumber?.trim() || !oldMeterNumber?.trim() || !newMeterNumber?.trim() || !changeDate) {
      return { data: null, error: { message: 'Customer Key, Old Meter, New Meter, and Change Date are required.' } };
    }

    if (oldMeterClosingReading < 0 || newMeterOpeningReading < 0) {
      return { data: null, error: { message: 'Meter readings cannot be negative.' } };
    }

    // Check entity exists
    const entity = meterType === 'individual'
      ? await dbGetCustomerById(customerKeyNumber.trim())
      : await dbGetBulkMeterById(customerKeyNumber.trim());

    if (!entity) {
      return { data: null, error: { message: `${meterType === 'individual' ? 'Customer' : 'Bulk meter'} '${customerKeyNumber}' not found.` } };
    }

    // Branch verification
    verifyBranchAccess(
      (entity as any).branch_id || (entity as any).branchId,
      session,
      meterType === 'individual' ? PERMISSIONS.CUSTOMERS_VIEW_ALL : PERMISSIONS.BULK_METERS_VIEW_ALL,
      meterType === 'individual' ? 'customer' : 'bulk meter'
    );

    const performedBy = session.id || session.sub || 'unknown';
    const performedByEmail = session.email || 'unknown';

    // Calculate closing unbilled consumption
    const prevReading = Number(entity.previousReading ?? entity.previous_reading ?? 0);
    const closingConsumption = Math.max(0, oldMeterClosingReading - prevReading);
    const oldMeterSize = Number(entity.meterSize ?? 0.5);

    // Execute in transaction
    const logRecord = await withTransaction(async (client) => {
      // 1. Insert audit log
      const insertSql = `
        INSERT INTO meter_change_log (
          meter_type, customer_key_number, old_meter_number,
          old_meter_closing_reading, new_meter_number, new_meter_opening_reading,
          change_date, notes, performed_by, performed_by_email,
          old_meter_size, new_meter_size, new_seal_number, new_dial_count,
          closing_consumption, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'Active')
        RETURNING *
      `;
      const insertParams = [
        meterType,
        customerKeyNumber.trim(),
        oldMeterNumber.trim(),
        oldMeterClosingReading,
        newMeterNumber.trim(),
        newMeterOpeningReading,
        changeDate,
        notes || null,
        performedBy,
        performedByEmail,
        oldMeterSize,
        newMeterSize || oldMeterSize,
        newSealNumber || null,
        newDialCount || 5,
        closingConsumption
      ];
      const logRes = await client.query(insertSql, insertParams);
      const row = logRes.rows[0];

      // 2. Update entity with new meter serial, baseline readings, and meter size
      const targetMeterSize = newMeterSize || oldMeterSize;
      const targetDialCount = newDialCount || 5;

      if (meterType === 'individual') {
        await client.query(`
          UPDATE individual_customers 
          SET "METER_KEY" = $1, "previousReading" = $2, "currentReading" = $3, 
              "meterSize" = $4, "NUMBER_OF_DIALS" = $5, updated_at = NOW() 
          WHERE "customerKeyNumber" = $6
        `, [newMeterNumber.trim(), newMeterOpeningReading, newMeterOpeningReading, targetMeterSize, targetDialCount, customerKeyNumber.trim()]);
      } else {
        await client.query(`
          UPDATE bulk_meters 
          SET "METER_KEY" = $1, "previousReading" = $2, "currentReading" = $3, 
              "meterSize" = $4, "NUMBER_OF_DIALS" = $5, "updatedAt" = NOW() 
          WHERE "customerKeyNumber" = $6
        `, [newMeterNumber.trim(), newMeterOpeningReading, newMeterOpeningReading, targetMeterSize, targetDialCount, customerKeyNumber.trim()]);
      }

      return row;
    });

    // Log security audit event
    try {
      await logSecurityEventAction({
        event: 'Meter Change',
        customerKeyNumber: customerKeyNumber.trim(),
        details: {
          meterType,
          oldMeterNumber,
          oldMeterClosingReading,
          newMeterNumber,
          newMeterOpeningReading,
          newMeterSize: newMeterSize || oldMeterSize,
          newSealNumber,
          closingConsumption,
          changeDate,
          performedBy,
          performedByEmail,
        }
      });
    } catch (e) {
      console.warn('Failed to log security event for meter change:', e);
    }

    try {
      revalidatePath('/admin/meter-change');
      revalidatePath('/staff/meter-change');
      if (meterType === 'individual') {
        revalidatePath('/admin/individual-customers');
        revalidatePath('/staff/individual-customers');
      } else {
        revalidatePath('/admin/bulk-meters');
        revalidatePath('/staff/bulk-meters');
      }
    } catch (_) {}

    return {
      data: {
        id: logRecord.id,
        meterType: logRecord.meter_type,
        customerKeyNumber: logRecord.customer_key_number,
        oldMeterNumber: logRecord.old_meter_number,
        oldMeterClosingReading: Number(logRecord.old_meter_closing_reading),
        newMeterNumber: logRecord.new_meter_number,
        newMeterOpeningReading: Number(logRecord.new_meter_opening_reading),
        changeDate: logRecord.change_date,
        notes: logRecord.notes,
        performedBy: logRecord.performed_by,
        performedByEmail: logRecord.performed_by_email,
        createdAt: logRecord.created_at,
        oldMeterSize: Number(logRecord.old_meter_size ?? 0.5),
        newMeterSize: Number(logRecord.new_meter_size ?? 0.5),
        newSealNumber: logRecord.new_seal_number,
        newDialCount: Number(logRecord.new_dial_count ?? 5),
        closingConsumption: Number(logRecord.closing_consumption ?? 0),
        status: logRecord.status || 'Active',
      } as MeterChangeRecord,
      error: null
    };
  } catch (error: any) {
    console.error('Error in meterChangeAction:', error);
    return { data: null, error: { message: error.message || 'Meter change failed' } };
  }
}

/**
 * Retrieve paginated audit history of meter changes
 */
export async function getMeterChangeLogsAction(params?: GetMeterChangeLogsParams) {
  try {
    await ensureMeterChangeTable();
    await checkPermissionAny(
      PERMISSIONS.METER_CHANGE_VIEW,
      PERMISSIONS.METER_CHANGE_CREATE,
      PERMISSIONS.METER_CHANGE_MANAGE,
      PERMISSIONS.CUSTOMERS_UPDATE,
      PERMISSIONS.BULK_METERS_UPDATE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.DASHBOARD_VIEW_ALL
    );

    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params?.customerKeyNumber) {
      conditions.push(`customer_key_number ILIKE $${idx++}`);
      values.push(`%${params.customerKeyNumber.trim()}%`);
    }
    if (params?.meterType) {
      conditions.push(`meter_type = $${idx++}`);
      values.push(params.meterType);
    }
    if (params?.from) {
      conditions.push(`change_date >= $${idx++}`);
      values.push(params.from);
    }
    if (params?.to) {
      conditions.push(`change_date <= $${idx++}`);
      values.push(params.to);
    }
    if (params?.status && params.status !== 'all') {
      conditions.push(`status = $${idx++}`);
      values.push(params.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as count FROM meter_change_log ${whereClause}`;
    const countRes = await query(countSql, values);
    const totalCount = parseInt(countRes[0]?.count || '0', 10);

    const dataSql = `
      SELECT * FROM meter_change_log 
      ${whereClause} 
      ORDER BY change_date DESC, created_at DESC 
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    const rows = await query(dataSql, [...values, pageSize, offset]);

    const formattedRows: MeterChangeRecord[] = (rows || []).map((r: any) => ({
      id: r.id,
      meterType: r.meter_type,
      customerKeyNumber: r.customer_key_number,
      oldMeterNumber: r.old_meter_number,
      oldMeterClosingReading: Number(r.old_meter_closing_reading ?? 0),
      newMeterNumber: r.new_meter_number,
      newMeterOpeningReading: Number(r.new_meter_opening_reading ?? 0),
      changeDate: r.change_date ? (typeof r.change_date === 'string' ? r.change_date.split('T')[0] : new Date(r.change_date).toISOString().split('T')[0]) : '',
      notes: r.notes || '',
      performedBy: r.performed_by || '',
      performedByEmail: r.performed_by_email || '',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
      oldMeterSize: Number(r.old_meter_size ?? 0.5),
      newMeterSize: Number(r.new_meter_size ?? 0.5),
      newSealNumber: r.new_seal_number || '',
      newDialCount: Number(r.new_dial_count ?? 5),
      closingConsumption: Number(r.closing_consumption ?? 0),
      status: r.status || 'Active',
      voidedAt: r.voided_at ? new Date(r.voided_at).toISOString() : undefined,
      voidedBy: r.voided_by || undefined,
      voidReason: r.void_reason || undefined,
    }));

    return { data: { rows: formattedRows, totalCount }, error: null };
  } catch (error: any) {
    console.error('Error in getMeterChangeLogsAction:', error);
    return { data: null, error: { message: error.message || 'Failed to fetch meter change logs' } };
  }
}

/**
 * Supervisor Rollback / Void of an erroneous meter change.
 * Restores the previous meter serial number, reading baselines, and meter size.
 */
export async function voidMeterChangeAction(changeId: string, reason: string) {
  try {
    const session = await checkPermissionAny(
      PERMISSIONS.METER_CHANGE_MANAGE,
      PERMISSIONS.CUSTOMERS_UPDATE,
      PERMISSIONS.BULK_METERS_UPDATE,
      PERMISSIONS.SETTINGS_MANAGE
    );

    if (!changeId?.trim() || !reason?.trim()) {
      return { data: null, error: { message: 'Change Record ID and Reason are required for voiding.' } };
    }

    const rows = await query('SELECT * FROM meter_change_log WHERE id = $1', [changeId.trim()]);
    const record = rows[0];
    if (!record) {
      return { data: null, error: { message: 'Meter change record not found.' } };
    }

    if (record.status === 'Voided') {
      return { data: null, error: { message: 'This meter change has already been voided.' } };
    }

    const voidedBy = session.email || session.id || 'supervisor';

    // Execute rollback in transaction
    await withTransaction(async (client) => {
      // 1. Mark log record as voided
      await client.query(`
        UPDATE meter_change_log 
        SET status = 'Voided', voided_at = NOW(), voided_by = $1, void_reason = $2 
        WHERE id = $3
      `, [voidedBy, reason.trim(), changeId.trim()]);

      // 2. Revert entity back to old meter serial and closing reading
      const meterType = record.meter_type;
      const custKey = record.customer_key_number;
      const oldMeter = record.old_meter_number;
      const oldReading = Number(record.old_meter_closing_reading);
      const oldSize = Number(record.old_meter_size ?? 0.5);

      if (meterType === 'individual') {
        await client.query(`
          UPDATE individual_customers 
          SET "METER_KEY" = $1, "previousReading" = $2, "currentReading" = $2, 
              "meterSize" = $3, updated_at = NOW() 
          WHERE "customerKeyNumber" = $4
        `, [oldMeter, oldReading, oldSize, custKey]);
      } else {
        await client.query(`
          UPDATE bulk_meters 
          SET "METER_KEY" = $1, "previousReading" = $2, "currentReading" = $2, 
              "meterSize" = $3, "updatedAt" = NOW() 
          WHERE "customerKeyNumber" = $4
        `, [oldMeter, oldReading, oldSize, custKey]);
      }
    });

    try {
      await logSecurityEventAction({
        event: 'Void Meter Change',
        customerKeyNumber: record.customer_key_number,
        details: {
          changeId,
          reason,
          voidedBy,
          revertedToMeter: record.old_meter_number,
        }
      });
    } catch (_) {}

    try {
      revalidatePath('/admin/meter-change');
      revalidatePath('/staff/meter-change');
      if (record.meter_type === 'individual') {
        revalidatePath('/admin/individual-customers');
        revalidatePath('/staff/individual-customers');
      } else {
        revalidatePath('/admin/bulk-meters');
        revalidatePath('/staff/bulk-meters');
      }
    } catch (_) {}

    return { data: { success: true }, error: null };
  } catch (error: any) {
    console.error('Error in voidMeterChangeAction:', error);
    return { data: null, error: { message: error.message || 'Failed to void meter change' } };
  }
}
