/**
 * Audit Logger
 *
 * Records a tamper-evident log of every significant action taken by staff members.
 * Each entry captures: who did it, what they did, on which entity, what changed,
 * when, and from which IP address.
 *
 * The audit_logs table must exist in the database before this module is used.
 * Run migration: drizzle/migrations/add_audit_logs.sql
 *
 * Usage:
 *   import { auditLog } from '@/lib/audit-logger';
 *   await auditLog({
 *     actorId: session.id,
 *     actorEmail: session.email,
 *     action: 'PAYMENT_UPDATED',
 *     entityType: 'payment',
 *     entityId: paymentId,
 *     oldValue: { status: 'Unpaid' },
 *     newValue: { status: 'Paid' },
 *     ipAddress,
 *   });
 */

import { query } from './db';

// ─── Action Constants ─────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  // Payments
  PAYMENT_CREATED: 'PAYMENT_CREATED',
  PAYMENT_UPDATED: 'PAYMENT_UPDATED',
  PAYMENT_DELETED: 'PAYMENT_DELETED',
  PAYMENT_CSV_UPLOAD: 'PAYMENT_CSV_UPLOAD',

  // Bills
  BILL_CREATED: 'BILL_CREATED',
  BILL_APPROVED: 'BILL_APPROVED',
  BILL_CORRECTED: 'BILL_CORRECTED',
  BILL_REVERSED: 'BILL_REVERSED',
  BILL_DELETED: 'BILL_DELETED',
  BILL_STATUS_UPDATED: 'BILL_STATUS_UPDATED',

  // Staff / Users
  STAFF_CREATED: 'STAFF_CREATED',
  STAFF_UPDATED: 'STAFF_UPDATED',
  STAFF_DELETED: 'STAFF_DELETED',
  STAFF_ROLE_CHANGED: 'STAFF_ROLE_CHANGED',
  STAFF_PASSWORD_CHANGED: 'STAFF_PASSWORD_CHANGED',

  // Customer / Meter
  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED: 'CUSTOMER_UPDATED',
  CUSTOMER_DELETED: 'CUSTOMER_DELETED',
  METER_READING_CREATED: 'METER_READING_CREATED',
  METER_READING_UPDATED: 'METER_READING_UPDATED',

  // System
  ROLE_PERMISSIONS_UPDATED: 'ROLE_PERMISSIONS_UPDATED',
  TARIFF_CREATED: 'TARIFF_CREATED',
  TARIFF_UPDATED: 'TARIFF_UPDATED',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

// ─── Audit Entry Interface ────────────────────────────────────────────────────

export interface AuditEntry {
  /** UUID of the staff member performing the action */
  actorId?: string;
  /** Email of the staff member (for human-readable logs) */
  actorEmail?: string;
  /** Branch name of the actor, if applicable */
  actorBranch?: string;
  /** One of the AUDIT_ACTIONS constants */
  action: AuditAction | string;
  /** Type of entity being changed (e.g. 'bill', 'payment', 'staff') */
  entityType: string;
  /** Primary key / ID of the entity being changed */
  entityId?: string;
  /** Snapshot of the record BEFORE the change (JSONB) */
  oldValue?: Record<string, unknown> | null;
  /** Snapshot of the record AFTER the change (JSONB) */
  newValue?: Record<string, unknown> | null;
  /** IP address of the request */
  ipAddress?: string;
  /** Optional extra context (e.g. number of rows processed) */
  metadata?: Record<string, unknown>;
}

// ─── Core Logging Function ────────────────────────────────────────────────────

/**
 * Write an audit log entry to the database.
 *
 * This function is deliberately non-throwing — a failed audit log must never
 * block a legitimate user operation. Errors are printed to stderr only.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs
         (actor_id, actor_email, actor_branch, action, entity_type, entity_id,
          old_value, new_value, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.actorId ?? null,
        entry.actorEmail ?? null,
        entry.actorBranch ?? null,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        entry.oldValue ? JSON.stringify(entry.oldValue) : null,
        entry.newValue ? JSON.stringify(entry.newValue) : null,
        entry.ipAddress ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]
    );
  } catch (err) {
    // Audit logging must never crash the calling action
    console.error('[AUDIT] Failed to write audit log entry:', {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Convenience helper — fire-and-forget audit log (no await needed).
 * Use when you want to log without delaying the response.
 */
export function auditLogAsync(entry: AuditEntry): void {
  auditLog(entry).catch(() => {
    // Silently swallow — auditLog already logs internally
  });
}
