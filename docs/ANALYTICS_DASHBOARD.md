# Analytics Dashboard — AAWSA Billing Portal

## Overview

The Analytics Dashboard (`/admin/analytics`) provides real-time KPIs for billing performance across all branches.

---

## KPI Definitions

### 1. Billed This Month
**Definition**: Total `TOTALBILLAMOUNT` of all `Approved` bills issued in the current billing month.

**SQL**:
```sql
SELECT SUM(total_bill_amount) FROM bills
WHERE status = 'Approved' AND month_year = 'YYYY-MM';
```

---

### 2. Collected This Month
**Definition**: Total `amount_paid` on all `Approved` bills in the current billing month.

```sql
SELECT SUM(amount_paid) FROM bills
WHERE status = 'Approved' AND month_year = 'YYYY-MM';
```

---

### 3. Collection Rate
**Definition**: Percentage of billed amount that has been collected.

```
Collection Rate = (Collected / Billed) × 100
```

**Benchmark**:
- 🟢 80%+ = Good
- 🟡 50–79% = Acceptable
- 🔴 <50% = Needs attention

---

### 4. Overdue Aging Buckets
Bills are grouped by how long past due they are:

| Bucket | Days Overdue | Risk |
|---|---|---|
| 1–30 days | ≤ 30 | 🟡 Low |
| 31–60 days | 31–60 | 🟠 Medium |
| 61–90 days | 61–90 | 🔴 High |
| 90+ days | > 90 | 🔴🔴 Critical |

---

### 5. Branch Collection Rate
Collection rate broken down per branch for the last 3 months.

---

### 6. Top Defaulters
Top 10 customers with the highest cumulative outstanding balance across all unpaid, overdue bills.

---

## Data Source

All analytics data is queried live from the `bills` table via `/api/analytics`.
There is no caching — refresh the page for the latest data.

---

## Access Control

Only users with the **Admin** role can view the analytics dashboard.
The `/api/analytics` endpoint returns `403 Forbidden` for non-admin users.

---

## Implementation Files

| File | Purpose |
|---|---|
| [`src/app/(dashboard)/admin/analytics/page.tsx`](../src/app/(dashboard)/admin/analytics/page.tsx) | Dashboard UI |
| [`src/app/api/analytics/route.ts`](../src/app/api/analytics/route.ts) | Data API with SQL aggregations |
