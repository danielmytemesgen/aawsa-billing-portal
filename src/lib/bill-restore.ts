import { logOperation } from './observability';

export type ReadingRestoreState = {
  previousReading: number | null;
  currentReading: number | null;
  month: string | null;
};

export interface BillReadingRestoreOperation extends ReadingRestoreState {
  entityType: 'bulk_meter' | 'individual_customer';
  entityKey: string;
}

export function resolveReadingRestoreState(params: {
  billPrevRead?: number | null;
  billCurrRead?: number | null;
  monthPrevRead?: number | null;
  monthCurrRead?: number | null;
  existingPrevRead?: number | null;
  existingCurrRead?: number | null;
  monthYear?: string | null;
}): ReadingRestoreState {
  const previousReading =
    params.billPrevRead != null
      ? params.billPrevRead
      : params.monthPrevRead != null
        ? params.monthPrevRead
        : params.existingPrevRead != null
          ? params.existingPrevRead
          : null;

  const currentReading =
    params.billCurrRead != null
      ? params.billCurrRead
      : params.monthCurrRead != null
        ? params.monthCurrRead
        : params.existingCurrRead != null
          ? params.existingCurrRead
          : null;

  return {
    previousReading,
    currentReading,
    month: params.monthYear ?? null,
  };
}

export function buildBillReadingRestoreOperations(
  bill: any,
  monthReadingRows: Array<{ CUST_KEY?: string; PREVIOUS_READING?: number | null; METER_READING?: number | null }> = []
): BillReadingRestoreOperation[] {
  if (!bill) return [];

  const operations: BillReadingRestoreOperation[] = [];

  if (bill.CUSTOMERKEY) {
    operations.push({
      entityType: 'bulk_meter',
      entityKey: bill.CUSTOMERKEY,
      ...resolveReadingRestoreState({
        billPrevRead: bill.PREVREAD,
        billCurrRead: bill.CURRREAD,
        existingPrevRead: bill.PREVREAD,
        existingCurrRead: bill.CURRREAD,
        monthYear: bill.month_year,
      }),
    });

    monthReadingRows.forEach((row) => {
      if (!row?.CUST_KEY) return;
      operations.push({
        entityType: 'individual_customer',
        entityKey: row.CUST_KEY,
        ...resolveReadingRestoreState({
          billPrevRead: bill.PREVREAD,
          billCurrRead: bill.CURRREAD,
          monthPrevRead: row.PREVIOUS_READING,
          monthCurrRead: row.METER_READING,
          existingPrevRead: bill.PREVREAD,
          existingCurrRead: bill.CURRREAD,
          monthYear: bill.month_year,
        }),
      });
    });
  } else if (bill.individual_customer_id) {
    operations.push({
      entityType: 'individual_customer',
      entityKey: bill.individual_customer_id,
      ...resolveReadingRestoreState({
        billPrevRead: bill.PREVREAD,
        billCurrRead: bill.CURRREAD,
        existingPrevRead: bill.PREVREAD,
        existingCurrRead: bill.CURRREAD,
        monthYear: bill.month_year,
      }),
    });
  }

  return operations;
}

export async function restoreBillReadingsForBill(bill: any, client: any) {
  if (!bill || !client) return 0;

  let monthReadingRows: Array<{ CUST_KEY?: string; PREVIOUS_READING?: number | null; METER_READING?: number | null }> = [];

  if (bill.CUSTOMERKEY && bill.month_year && bill.month_year.includes('-')) {
    const [year, month] = bill.month_year.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 1)).toISOString();

    const readingsRes = await client.query(
      `SELECT "CUST_KEY", "METER_READING", "PREVIOUS_READING"
       FROM individual_customer_readings
       WHERE "CUST_KEY" IN (
         SELECT "customerKeyNumber" FROM individual_customers
         WHERE "assignedBulkMeterId" = $1 AND deleted_at IS NULL
       )
       AND deleted_at IS NULL
       AND "READING_DATE" >= $2 AND "READING_DATE" < $3`,
      [bill.CUSTOMERKEY, startDate, endDate]
    );

    monthReadingRows = readingsRes.rows || [];
  }

  const operations = buildBillReadingRestoreOperations(bill, monthReadingRows);

  logOperation({
    operation: 'restoreBillReadingsForBill:start',
    details: { billId: bill?.id, monthYear: bill?.month_year, entityCount: operations.length },
  });

  for (const operation of operations) {
    if (operation.entityType === 'bulk_meter') {
      await client.query(
        `UPDATE bulk_meters
         SET "previousReading" = $1, "currentReading" = $2, month = $3
         WHERE "customerKeyNumber" = $4`,
        [operation.previousReading, operation.currentReading, operation.month, operation.entityKey]
      );
    } else {
      await client.query(
        `UPDATE individual_customers
         SET "previousReading" = $1, "currentReading" = $2, month = $3
         WHERE "customerKeyNumber" = $4`,
        [operation.previousReading, operation.currentReading, operation.month, operation.entityKey]
      );
    }
  }

  logOperation({
    operation: 'restoreBillReadingsForBill:complete',
    details: { billId: bill?.id, restoredCount: operations.length },
  });

  return operations.length;
}
