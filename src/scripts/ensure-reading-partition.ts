import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../lib/db';
import { getPartitionName } from './partition-utils';

async function partitionExists(partitionName: string): Promise<boolean> {
  const rows: any = await query(
    `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1 AND n.nspname = 'public'`,
    [partitionName]
  );
  return rows.length > 0;
}

async function createPartition(parentTable: string, partitionMonth: string): Promise<void> {
  const partitionName = getPartitionName(parentTable, partitionMonth);
  const sql = `CREATE TABLE IF NOT EXISTS public.${partitionName} PARTITION OF public.${parentTable} FOR VALUES IN ($1)`;
  await query(sql, [partitionMonth]);
}

async function ensurePartition(parentTable: string, partitionMonth: string): Promise<string> {
  const partitionName = getPartitionName(parentTable, partitionMonth);
  const exists = await partitionExists(partitionName);
  if (!exists) {
    console.log(`Creating missing partition ${partitionName} for ${parentTable} month ${partitionMonth}`);
    await createPartition(parentTable, partitionMonth);
  } else {
    console.log(`Partition already exists: ${partitionName}`);
  }
  return partitionName;
}

function parseMonthArg(): string {
  const arg = process.argv[2];
  if (arg) {
    if (!/^\d{4}-\d{2}$/.test(arg)) {
      throw new Error('Month argument must be in YYYY-MM format');
    }
    return arg;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function main() {
  try {
    const month = parseMonthArg();
    console.log(`Ensuring reading partitions exist for month ${month}`);

    await ensurePartition('individual_customer_readings', month);
    await ensurePartition('bulk_meter_readings', month);

    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to ensure partitions:', error);
    process.exit(1);
  }
}

main();
