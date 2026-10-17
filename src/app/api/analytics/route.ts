import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

/**
 * Analytics API — /api/analytics
 *
 * Returns aggregated KPI data for the admin analytics dashboard:
 * - Revenue trend (last 6 months): billed vs collected
 * - Collection rate by branch
 * - Overdue aging buckets (30 / 60 / 90 / 120+ days)
 * - Top 10 defaulters by outstanding balance
 *
 * Requires: authenticated admin session
 * Fix: All queries now include `deleted_at IS NULL` to exclude soft-deleted bills.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admins can access analytics
  const isAdmin =
    session.role?.toLowerCase() === 'admin' ||
    (Array.isArray(session.permissions) && session.permissions.includes('*'));

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // ── Execute all analytics queries concurrently in parallel ───────────────
    const [revenueRows, branchRows, agingRows, defaulterRows] = await Promise.all([
      // 1. Revenue Trend (last 6 months)
      query(`
        SELECT
          month_year                                              AS month,
          SUM(COALESCE("TOTALBILLAMOUNT", 0))::numeric(14,2)      AS billed,
          SUM(COALESCE(amount_paid, 0))::numeric(14,2)            AS collected,
          CASE
            WHEN SUM(COALESCE("TOTALBILLAMOUNT", 0)) > 0
            THEN ROUND(SUM(COALESCE(amount_paid, 0)) / SUM("TOTALBILLAMOUNT") * 100, 1)
            ELSE 0
          END                                                     AS collection_rate
        FROM bills
        WHERE status = 'Approved'
          AND deleted_at IS NULL
          AND bill_period_start_date >= NOW() - INTERVAL '6 months'
        GROUP BY month_year
        ORDER BY MIN(bill_period_start_date) ASC
      `),

      // 2. Branch Collection Rates
      query(`
        SELECT
          COALESCE(b.name, bills."CUSTOMERBRANCH", 'Unknown')    AS branch,
          COUNT(*)                                                AS total_bills,
          COUNT(*) FILTER (WHERE bills.payment_status = 'Paid')   AS paid_bills,
          CASE
            WHEN COUNT(*) > 0
            THEN ROUND(
              COUNT(*) FILTER (WHERE bills.payment_status = 'Paid')::numeric
              / COUNT(*) * 100, 1)
            ELSE 0
          END                                                     AS rate
        FROM bills
        LEFT JOIN branches b ON bills.branch_id = b.id
        WHERE bills.status = 'Approved'
          AND bills.deleted_at IS NULL
          AND bills.bill_period_start_date >= NOW() - INTERVAL '3 months'
        GROUP BY COALESCE(b.name, bills."CUSTOMERBRANCH", 'Unknown')
        ORDER BY rate DESC
        LIMIT 10
      `),

      // 3. Overdue Aging Buckets
      query(`
        SELECT
          CASE
            WHEN NOW() - due_date <= INTERVAL '30 days'  THEN '1–30 days'
            WHEN NOW() - due_date <= INTERVAL '60 days'  THEN '31–60 days'
            WHEN NOW() - due_date <= INTERVAL '90 days'  THEN '61–90 days'
            ELSE '90+ days'
          END                                                     AS bucket,
          COUNT(*)                                                AS count,
          SUM(COALESCE("OUTSTANDINGAMT", 0))::numeric(14,2)       AS amount
        FROM bills
        WHERE payment_status = 'Unpaid'
          AND status = 'Approved'
          AND deleted_at IS NULL
          AND due_date < NOW()
        GROUP BY 1
        ORDER BY MIN(due_date) DESC
      `),

      // 4. Top 10 Defaulters
      query(`
        SELECT
          bills."CUSTOMERKEY"                                    AS customer_key,
          bills."CUSTOMERNAME"                                   AS customer_name,
          COALESCE(b.name, bills."CUSTOMERBRANCH", '')           AS branch,
          SUM(COALESCE(bills."OUTSTANDINGAMT", 0))::numeric(14,2) AS outstanding,
          COUNT(DISTINCT bills.month_year)                       AS months_overdue
        FROM bills
        LEFT JOIN branches b ON bills.branch_id = b.id
        WHERE bills.payment_status = 'Unpaid'
          AND bills.status = 'Approved'
          AND bills.deleted_at IS NULL
          AND bills.due_date < NOW()
          AND bills."CUSTOMERKEY" IS NOT NULL
        GROUP BY bills."CUSTOMERKEY", bills."CUSTOMERNAME", COALESCE(b.name, bills."CUSTOMERBRANCH", '')
        ORDER BY outstanding DESC
        LIMIT 10
      `),
    ]);

    // ── Shape response ────────────────────────────────────────────────────────
    const response = NextResponse.json({
      revenue: revenueRows.map((r: any) => ({
        month: r.month,
        billed: Number(r.billed),
        collected: Number(r.collected),
        collectionRate: Number(r.collection_rate),
      })),
      branchRates: branchRows.map((r: any) => ({
        branch: r.branch,
        totalBills: Number(r.total_bills),
        paidBills: Number(r.paid_bills),
        rate: Number(r.rate),
      })),
      aging: agingRows.map((r: any) => ({
        bucket: r.bucket,
        count: Number(r.count),
        amount: Number(r.amount),
      })),
      topDefaulters: defaulterRows.map((r: any) => ({
        customerKey: r.customer_key,
        customerName: r.customer_name,
        branch: r.branch,
        outstanding: Number(r.outstanding),
        monthsOverdue: Number(r.months_overdue),
      })),
      generatedAt: new Date().toISOString(),
    });

    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return response;
  } catch (err) {
    console.error('[Analytics API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate analytics data.' },
      { status: 500 }
    );
  }
}
