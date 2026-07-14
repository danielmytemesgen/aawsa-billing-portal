import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { withTransaction } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/process-job
//
// Runs a billing job ENTIRELY on the server side.
// The browser fires this endpoint ONCE after starting a job, then polls
// /api/billing/job-status for progress. No browser tab required to stay open.
//
// Security: Requires a valid staff session with billing:close_cycle permission.
// ─────────────────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 1000;
const MAX_RUNTIME_MS = 4.5 * 60 * 1000; // 4.5-minute safety ceiling per request (for 300s maxDuration on Hobby plan)

export const maxDuration = 300; // 5 minutes max limit for Vercel Hobby plan

export async function POST(request: Request) {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session || !session.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate billing permission
  const permRows: any[] = await query(
    `SELECT p.name FROM staff_members sm
     JOIN roles r ON sm.role_id = r.id
     JOIN role_permissions rp ON r.id = rp.role_id
     JOIN permissions p ON rp.permission_id = p.id
     WHERE sm.id = $1 AND p.name = 'billing:close_cycle'`,
    [session.id]
  );
  if (permRows.length === 0) {
    return NextResponse.json({ error: 'Forbidden: billing:close_cycle permission required' }, { status: 403 });
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  let jobId: string;
  try {
    const body = await request.json();
    jobId = body.jobId;
    if (!jobId || typeof jobId !== 'string') throw new Error('Missing jobId');
  } catch {
    return NextResponse.json({ error: 'Invalid request body — jobId required' }, { status: 400 });
  }

  // ── 3. Load job ────────────────────────────────────────────────────────────
  const jobRows: any[] = await query('SELECT * FROM billing_jobs WHERE id = $1', [jobId]);
  const job = jobRows[0];
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  if (job.status === 'completed' || job.status === 'failed') {
    return NextResponse.json({ job }, { status: 200 });
  }

  // ── 4. Mark processing ─────────────────────────────────────────────────────
  await query(`UPDATE billing_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1`, [jobId]);

  // ── 5. Import heavy dependencies once ─────────────────────────────────────
  const {
    dbGetUnprocessedMetersForJob,
    dbGetUnprocessedIndividualCustomersForJob,
    dbGetCustomersByBulkMeterIds,
    dbGetBillsByBulkMeterIds,
    dbGetBillsByIndividualCustomerIds,
    dbGetLatestApplicableTariff,
    dbGetReadingsForMonth,
    dbBatchInsertBills,
    dbBatchRolloverBulkMeters,
    dbBatchRolloverIndividualCustomersOfBulkMeters,
    dbBatchRolloverIndividualCustomers,
  } = await import('@/lib/db-queries');

  const { calculateBill, calculateBillFromTariff } = await import('@/lib/billing');
  const { calculateDebtAging, normalizeTariff } = await import('@/lib/billing-utils');
  const { buildBillingPeriod } = await import('@/lib/billing-config');
  const { randomUUID } = await import('crypto');

  // ── 6. Build period constants ──────────────────────────────────────────────
  const period = buildBillingPeriod({
    monthYear: job.month_year,
    periodStartDate: job.period_start_date,
    periodEndDate: job.period_end_date,
    dueDateOffsetDays: job.due_date_offset_days,
  });
  const periodStartDate = period.startDate;
  const periodEndDate = period.endDate;
  const dueDate = period.dueDate;
  const pStart = new Date(periodStartDate).getTime();
  const pEnd = new Date(periodEndDate).getTime();

  // Helper — generate BBPT-XXXXXXXXXX bill key from UUID
  const generateBillKey = (billId: string) => {
    const idHex = (billId || '').replace(/-/g, '').substring(0, 8);
    const idNumeric = parseInt(idHex, 16);
    return isNaN(idNumeric) ? 'BBPT-0000000000' : `BBPT-${String(idNumeric).padStart(10, '0')}`;
  };

  // Pre-fetch branch id→name map once (avoids N+1 per item in the loop)
  const branchRows: any[] = await query('SELECT id, name FROM branches');
  const branchNameMap = new Map<string, string>();
  for (const br of branchRows) {
    branchNameMap.set(br.id, br.name);
  }

  // ── 7. Main processing loop (server-side, no browser involvement) ──────────
  let currentJob = job;
  const startedAt = Date.now();
  let totalFailed = 0;

  while (true) {
    // Safety ceiling — prevents runaway request
    if (Date.now() - startedAt > MAX_RUNTIME_MS) {
      await query(`UPDATE billing_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1`, [jobId]);
      const finalRows: any[] = await query('SELECT * FROM billing_jobs WHERE id = $1', [jobId]);
      return NextResponse.json({ job: finalRows[0], resumed: true }, { status: 200 });
    }

    // Fetch next chunk of unprocessed items
    const items: any[] = currentJob.type === 'bulk_meters'
      ? await dbGetUnprocessedMetersForJob(currentJob, CHUNK_SIZE)
      : await dbGetUnprocessedIndividualCustomersForJob(currentJob, CHUNK_SIZE);

    if (items.length === 0) break; // All done

    // ── Pre-fetch bulk data for this chunk ────────────────────────────────
    const customerKeys = items.map((i: any) => i.customerKeyNumber);

    const subCustomersMap = currentJob.type === 'bulk_meters'
      ? await dbGetCustomersByBulkMeterIds(customerKeys)
      : new Map<string, any[]>();

    const historicalBillsMap = currentJob.type === 'bulk_meters'
      ? await dbGetBillsByBulkMeterIds(customerKeys, currentJob.month_year)
      : await dbGetBillsByIndividualCustomerIds(customerKeys, currentJob.month_year);

    // Pre-fetch readings for this chunk
    let currentMonthReadingsMap = new Map<string, any>();
    if (customerKeys.length > 0) {
      const readings = await dbGetReadingsForMonth(currentJob.type, customerKeys, currentJob.month_year);
      for (const r of readings as any[]) {
        currentMonthReadingsMap.set(r.CUST_KEY, r);
      }
    }

    // Pre-fetch tariff cache
    const tariffCache = new Map<string, any>();
    const uniqueChargeGroups = [...new Set(items.map((i: any) => i.charge_group || i.customerType || 'Non-domestic'))];
    await Promise.all(uniqueChargeGroups.map(async (cg) => {
      const tariff = await dbGetLatestApplicableTariff(cg as string, currentJob.month_year);
      tariffCache.set(cg as string, tariff ? normalizeTariff(tariff) : null);
    }));

    // ── Process each item in memory ───────────────────────────────────────
    const billsToInsert: any[] = [];
    let lastId = currentJob.last_processed_id;
    const failedItems: string[] = [];

    for (const item of items) {
      try {
        const customerKey = item.customerKeyNumber;
        const chargeGroup = (item.charge_group || item.customerType || 'Non-domestic');
        const sewerageConn = item.sewerage_connection || 'No';

        let currRead = Number(item.currentReading ?? item.current_reading ?? 0);
        let prevRead = Number(item.previousReading ?? item.previous_reading ?? 0);

        const readingRecord = currentMonthReadingsMap.get(customerKey);
        if (readingRecord) {
          currRead = readingRecord.METER_READING != null ? Number(readingRecord.METER_READING) : currRead;
          prevRead = readingRecord.PREVIOUS_READING != null ? Number(readingRecord.PREVIOUS_READING) : prevRead;
        }

        const usage = currRead - prevRead;
        let diffUsage = usage;

        if (currentJob.type === 'bulk_meters') {
          const associatedCustomers = subCustomersMap.get(customerKey) || [];
          const totalIndivUsage = associatedCustomers.reduce((sum: number, cust: any) =>
            sum + ((Number(cust.currentReading) || 0) - (Number(cust.previousReading) || 0)), 0);
          diffUsage = usage - totalIndivUsage;
        }

        const cachedTariff = tariffCache.get(chargeGroup as string);
        if (diffUsage < 0) {
          const useRuleOfThree = cachedTariff ? (cachedTariff.use_rule_of_three !== undefined && cachedTariff.use_rule_of_three !== null ? Boolean(cachedTariff.use_rule_of_three) : true) : true;
          if (!useRuleOfThree) {
            throw new Error(
              `Negative consumption detected (${diffUsage} m³) for ${chargeGroup} in ${currentJob.month_year}. ` +
              `Individual sub-meter usage exceeds bulk meter reading. ` +
              `Please verify meter readings before generating a bill.`
            );
          } else {
            failedItems.push(`${customerKey}: Negative consumption detected (${diffUsage} m³). Billed at 3 m³ (Rule of 3 active), but readings need attention.`);
          }
        }
        const billBreakdown = cachedTariff
          ? calculateBillFromTariff(
              cachedTariff,
              diffUsage,
              item.meterSize || item.meter_size || 0.5,
              sewerageConn as any
            )
          : await calculateBill(
              diffUsage,
              chargeGroup as any,
              sewerageConn as any,
              item.meterSize || item.meter_size || 0.5,
              currentJob.month_year
            );
        diffUsage = billBreakdown.effectiveUsage;

        const historicalBills = historicalBillsMap.get(customerKey) || [];

        // Overlap protection
        const hasOverlap = historicalBills.some((bill: any) => {
          if (!bill.bill_period_start_date || !bill.bill_period_end_date) return false;
          const bStart = new Date(bill.bill_period_start_date).getTime();
          const bEnd = new Date(bill.bill_period_end_date).getTime();
          return pStart <= bEnd && pEnd >= bStart;
        });

        if (hasOverlap && !currentJob.allow_overlap) {
          failedItems.push(`${customerKey}: Billing period overlaps with an existing bill.`);
          lastId = customerKey;
          continue;
        }

        const balanceFromPreviousPeriods = Number(item.outStandingbill || item.balance_carried_forward || 0);
        const { debit30, debit30_60, debit60, penaltyAmt } = calculateDebtAging(
          balanceFromPreviousPeriods, historicalBills, undefined, currentJob.month_year
        );

        const outstandingAmt = Number((debit30 + debit30_60 + debit60).toFixed(2));
        const totalPayable = Number((penaltyAmt + outstandingAmt + billBreakdown.totalBill).toFixed(2));
        const carryBalance = Boolean(currentJob.carry_balance);

        const billId = randomUUID();
        const branchId: string | null = item.branch_id || null;
        const branchName: string | null = branchId ? (branchNameMap.get(branchId) || null) : null;

        // Snapshot captures usage breakdown for PDF generation
        const snapshotData = currentJob.type === 'bulk_meters' ? {
          chargeGroup: item.charge_group || item.customerType,
          sewerageConnection: sewerageConn,
          individualCustomerCount: (subCustomersMap.get(customerKey) || []).length,
          totalIndividualUsage: currentJob.type === 'bulk_meters'
            ? (subCustomersMap.get(customerKey) || []).reduce((s: number, c: any) =>
                s + ((Number(c.currentReading) || 0) - (Number(c.previousReading) || 0)), 0)
            : 0,
        } : null;

        billsToInsert.push({
          id: billId,
          BILLKEY: generateBillKey(billId),
          CUSTOMERKEY: currentJob.type === 'bulk_meters' ? customerKey : null,
          individual_customer_id: currentJob.type === 'individual_customers' ? customerKey : null,
          CUSTOMERNAME: item.name,
          CUSTOMERBRANCH: branchName,
          branch_id: branchId,
          month_year: currentJob.month_year,
          bill_period_start_date: periodStartDate,
          bill_period_end_date: periodEndDate,
          due_date: dueDate,
          PREVREAD: prevRead,
          CURRREAD: currRead,
          CONS: usage,
          difference_usage: diffUsage,
          THISMONTHBILLAMT: billBreakdown.totalBill,
          OUTSTANDINGAMT: outstandingAmt,
          PENALTYAMT: penaltyAmt,
          TOTALBILLAMOUNT: totalPayable,
          base_water_charge: billBreakdown.baseWaterCharge,
          maintenance_fee: billBreakdown.maintenanceFee,
          sanitation_fee: billBreakdown.sanitationFee,
          sewerage_charge: billBreakdown.sewerageCharge,
          meter_rent: billBreakdown.meterRent,
          vat_amount: billBreakdown.vatAmount,
          additional_fees_breakdown: billBreakdown.additionalFeesBreakdown,
          balance_carried_forward: outstandingAmt,
          amount_paid: carryBalance ? 0 : totalPayable,
          payment_status: carryBalance ? 'Unpaid' : 'Paid',
          debit_30: debit30,
          debit_30_60: debit30_60,
          debit_60: debit60,
          status: 'Draft',
          bill_number: `BILL-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          snapshot_data: snapshotData,
        });

        lastId = customerKey;
      } catch (err: any) {
        const reason = err?.message || String(err);
        console.error(`[billing-job] Error on item ${item.customerKeyNumber}: ${reason}`);
        failedItems.push(`${item.customerKeyNumber}: ${reason}`);
        lastId = item.customerKeyNumber;
      }
    }

    // ── Atomic commit: insert bills + rollover readings + update progress ──
    const jobUpdate: any = {
      processed_items: currentJob.processed_items + items.length,
      last_processed_id: lastId,
      updated_at: new Date(),
    };
    if (failedItems.length > 0) {
      const existingLog = currentJob.error_log ? currentJob.error_log + '\n' : '';
      jobUpdate.error_log = existingLog + failedItems.join('\n');
    }
    totalFailed += failedItems.length;

    currentJob = await withTransaction(async (client) => {
      if (billsToInsert.length > 0) {
        await dbBatchInsertBills(billsToInsert, client);
        if (currentJob.type === 'bulk_meters') {
          const successes = billsToInsert.map(b => b.CUSTOMERKEY).filter(Boolean);
          await dbBatchRolloverBulkMeters(successes, client);
          await dbBatchRolloverIndividualCustomersOfBulkMeters(successes, client);
          const bulkMetersToUpdate = billsToInsert
            .filter(b => b.CUSTOMERKEY)
            .map(b => [
              b.CUSTOMERKEY,
              String(currentJob.carry_balance ? b.TOTALBILLAMOUNT : 0),
              currentJob.carry_balance ? 'Unpaid' : 'Paid'
            ]);

          if (bulkMetersToUpdate.length > 0) {
            const placeholders = bulkMetersToUpdate.map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}::numeric, $${idx * 3 + 3})`).join(', ');
            const flatValues = bulkMetersToUpdate.flat();
            await client.query(`
              UPDATE bulk_meters AS m 
              SET "outStandingbill" = v.balance, "paymentStatus" = v.status
              FROM (VALUES ${placeholders}) AS v(key, balance, status)
              WHERE m."customerKeyNumber" = v.key
            `, flatValues);
          }
        } else {
          const successes = billsToInsert.map(b => b.individual_customer_id).filter(Boolean);
          await dbBatchRolloverIndividualCustomers(successes, client);

          const individualCustomersToUpdate = billsToInsert
            .filter(b => b.individual_customer_id)
            .map(b => [
              b.individual_customer_id,
              String(currentJob.carry_balance ? b.TOTALBILLAMOUNT : 0),
              currentJob.carry_balance ? 'Unpaid' : 'Paid'
            ]);

          if (individualCustomersToUpdate.length > 0) {
            const placeholders = individualCustomersToUpdate.map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}::numeric, $${idx * 3 + 3})`).join(', ');
            const flatValues = individualCustomersToUpdate.flat();
            await client.query(`
              UPDATE individual_customers AS m 
              SET "outStandingbill" = v.balance, "paymentStatus" = v.status
              FROM (VALUES ${placeholders}) AS v(key, balance, status)
              WHERE m."customerKeyNumber" = v.key
            `, flatValues);
          }
        }
      }

      // Update job progress inside the same transaction
      const keys = Object.keys(jobUpdate);
      const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      const sql = `UPDATE billing_jobs SET ${setClause} WHERE id = $1 RETURNING *`;
      const res = await client.query(sql, [jobId, ...keys.map(k => jobUpdate[k])]);
      return res.rows[0];
    });

    // If fewer items than chunk size, we've reached the end
    if (items.length < CHUNK_SIZE) break;
  }

  // ── 8. Mark job as completed ───────────────────────────────────────────────
  const completedRows: any[] = await query(
    `UPDATE billing_jobs SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [jobId]
  );
  const completedJob = completedRows[0];

  return NextResponse.json({ job: completedJob }, { status: 200 });
}
