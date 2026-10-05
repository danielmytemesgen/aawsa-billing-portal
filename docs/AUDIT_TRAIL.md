# Audit Trail — AAWSA Billing Portal

## Overview

Every significant action performed by a staff member is recorded in the `audit_logs` table. This provides a tamper-evident, chronological history of **who did what, when, and from where** — essential for financial accountability and regulatory compliance.

---

## What Is Logged

| Action | Entity Type | Description |
|---|---|---|
| `PAYMENT_CREATED` | payment | New payment recorded |
| `PAYMENT_UPDATED` | payment | Payment status or amount changed |
| `PAYMENT_CSV_UPLOAD` | payment | Batch CSV upload processed |
| `BILL_APPROVED` | bill | Bill moved to Approved status |
| `BILL_CORRECTED` | bill | Bill correction created (CORR- bill) |
| `BILL_REVERSED` | bill | Bill marked as Reversed |
| `STAFF_CREATED` | staff | New staff member added |
| `STAFF_UPDATED` | staff | Staff record modified |
| `STAFF_ROLE_CHANGED` | staff | Role or permissions changed |
| `STAFF_PASSWORD_CHANGED` | staff | Password updated |
| `ROLE_PERMISSIONS_UPDATED` | role | Role permission set changed |
| `TARIFF_CREATED` | tariff | New tariff configuration created |
| `METER_READING_CREATED` | reading | Meter reading submitted |

---

## Data Structure

Each audit log entry contains:

```json
{
  "id": "uuid",
  "actor_id": "staff-uuid",
  "actor_email": "user@aawsa.et",
  "actor_branch": "Gulele Branch",
  "action": "PAYMENT_UPDATED",
  "entity_type": "bill",
  "entity_id": "bill-uuid-or-bill-number",
  "old_value": { "payment_status": "Unpaid", "amount_paid": "0.00" },
  "new_value":  { "payment_status": "Paid",   "amount_paid": "1500.00" },
  "ip_address": "192.168.1.45",
  "metadata": { "payment_channel": "Bank Transfer", "bank_ref": "ETB-001234" },
  "created_at": "2026-09-10T11:30:00+03:00"
}
```

---

## How to Query Audit Logs

### All actions by a specific staff member
```sql
SELECT * FROM audit_logs
WHERE actor_email = 'staff@aawsa.et'
ORDER BY created_at DESC
LIMIT 100;
```

### All changes to a specific bill
```sql
SELECT * FROM audit_logs
WHERE entity_type = 'bill'
  AND entity_id = 'BILL-2026-001234'
ORDER BY created_at ASC;
```

### All bill reversals in September 2026
```sql
SELECT * FROM audit_logs
WHERE action = 'BILL_REVERSED'
  AND created_at BETWEEN '2026-09-01' AND '2026-09-30'
ORDER BY created_at DESC;
```

### All CSV uploads in the last 7 days
```sql
SELECT actor_email, metadata->>'updatedCount' as rows_updated, created_at
FROM audit_logs
WHERE action = 'PAYMENT_CSV_UPLOAD'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

## Admin Audit Log Viewer

Admins can view audit logs in the dashboard at:
`/admin/audit-log`

Filters available:
- Staff member (by name or email)
- Action type
- Date range
- Entity type / ID

---

## Data Retention Policy

Audit logs are **financial records** and should be retained for a minimum of **3 years** per Ethiopian financial regulations.

To purge records older than 3 years (run during a maintenance window):
```sql
-- Archive first, then delete
CREATE TABLE audit_logs_archive_2023 AS
  SELECT * FROM audit_logs WHERE created_at < '2024-01-01';

DELETE FROM audit_logs WHERE created_at < '2024-01-01';
```

---

## Implementation Files

| File | Purpose |
|---|---|
| [`src/lib/audit-logger.ts`](../src/lib/audit-logger.ts) | Core `auditLog()` function |
| [`database/migrations/022_audit_logs.sql`](../database/migrations/022_audit_logs.sql) | Table creation migration |
| [`src/lib/schema.ts`](../src/lib/schema.ts) | Drizzle `auditLogs` table definition |
