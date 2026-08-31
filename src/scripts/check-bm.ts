import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkBulkMeter() {
    const { encrypt } = await import('../lib/session');
    const token = await encrypt({
        id: '6ee3b9cb-4636-418d-aea6-e9cb8d932e05',
        email: 'admin@aawsa.gov.et',
        role: 'Admin',
        permissions: ['*'],
        type: 'device'
    });

    const { query } = await import('../lib/db');
    const { getBulkAndSubmeterPeriodReadingsAction } = await import('../lib/actions');
    
    // We can also test the exact SQL query used by getBulkAndSubmeterPeriodReadingsAction
    const monthYear = '2026-06';
    const [year, month] = monthYear.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 1)).toISOString();
    const resolvedKey = 'BM-33033546';

    console.log("Testing resolution for BM-33033546, month: 2026-06...");
    const subSql = `
      SELECT 
        ic."customerKeyNumber",
        ic.name,
        ic."meterSize",
        ic."customerType",
        ic."sewerageConnection",
        ic."previousReading" as "icPrevReading",
        ic."currentReading" as "icCurrReading",
        r."PREVIOUS_READING" as "rPrevReading",
        r."METER_READING" as "rCurrReading",
        r."READING_DATE" as "readingDate",
        prev_r."METER_READING" as "priorReading",
        b.id as "billId",
        b.status as "billStatus",
        b."THISMONTHBILLAMT" as "billAmount",
        b."PREVREAD" as "billPrevRead",
        b."CURRREAD" as "billCurrRead",
        last_b."CURRREAD" as "lastMonthCurr"
      FROM individual_customers ic
      LEFT JOIN LATERAL (
        SELECT "PREVIOUS_READING", "METER_READING", "READING_DATE"
        FROM individual_customer_readings
        WHERE "CUST_KEY" = ic."customerKeyNumber"
          AND deleted_at IS NULL
          AND (
            ("READING_DATE" >= $1 AND "READING_DATE" < $2)
            OR (TO_CHAR("READING_DATE" AT TIME ZONE 'Africa/Addis_Ababa', 'YYYY-MM') = $3)
          )
        ORDER BY "READING_DATE" DESC
        LIMIT 1
      ) r ON true
      LEFT JOIN LATERAL (
        SELECT "METER_READING", "READING_DATE"
        FROM individual_customer_readings
        WHERE "CUST_KEY" = ic."customerKeyNumber"
          AND deleted_at IS NULL
          AND "READING_DATE" < COALESCE(r."READING_DATE", $1::timestamptz)
        ORDER BY "READING_DATE" DESC
        LIMIT 1
      ) prev_r ON true
      LEFT JOIN bills b ON ic."customerKeyNumber" = b.individual_customer_id
        AND b.month_year = $3
        AND b.status != 'Reversed'
      LEFT JOIN bills last_b ON ic."customerKeyNumber" = last_b.individual_customer_id
        AND last_b.month_year = (SELECT TO_CHAR(TO_DATE($3, 'YYYY-MM') - INTERVAL '1 month', 'YYYY-MM'))
        AND last_b.status != 'Reversed'
      WHERE (
        LOWER(TRIM(ic."assignedBulkMeterId")) = LOWER(TRIM($4))
        OR LOWER(TRIM(ic."assignedBulkMeterId")) = (SELECT LOWER(TRIM("customerKeyNumber")) FROM bulk_meters WHERE LOWER(TRIM("customerKeyNumber")) = LOWER(TRIM($4)) LIMIT 1)
      )
        AND ic.deleted_at IS NULL
      ORDER BY ic.name ASC, ic."customerKeyNumber" ASC
    `;
    const subRows: any[] = await query(subSql, [startDate, endDate, monthYear, resolvedKey]);

    const assignedCustomers = subRows.map((row: any) => {
      let curr = Number(row.billCurrRead ?? row.rCurrReading ?? row.icCurrReading ?? 0);
      let prev: number;

      if (row.billPrevRead != null) {
        prev = Number(row.billPrevRead);
      } else if (row.rPrevReading != null && Number(row.rPrevReading) !== Number(row.rCurrReading) && Number(row.rPrevReading) > 0) {
        prev = Number(row.rPrevReading);
      } else if (row.priorReading != null) {
        prev = Number(row.priorReading);
      } else if (row.lastMonthCurr != null) {
        prev = Number(row.lastMonthCurr);
      } else if (Number(row.icPrevReading ?? 0) !== Number(row.icCurrReading ?? 0)) {
        prev = Number(row.icPrevReading);
      } else {
        prev = curr;
      }

      return {
        customerKeyNumber: row.customerKeyNumber,
        name: row.name,
        previous: prev,
        current: curr,
        usage: curr - prev
      };
    });

    console.log(`Total assigned customers: ${assignedCustomers.length}`);
    const nonZero = assignedCustomers.filter(c => c.usage > 0);
    console.log(`Customers with usage > 0: ${nonZero.length}`);
    console.log("First 10 customers:");
    console.table(assignedCustomers.slice(0, 10));

    const totalIndivUsage = assignedCustomers.reduce((acc, c) => acc + c.usage, 0);
    console.log(`Total submeter usage: ${totalIndivUsage} m³`);
    process.exit(0);
}

checkBulkMeter();
