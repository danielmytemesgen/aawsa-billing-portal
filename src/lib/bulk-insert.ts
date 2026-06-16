import { db } from './db';
import { Readable } from 'stream';
// @ts-ignore
import * as pgCopy from 'pg-copy-streams';

/**
 * Bulk insert an array of bill objects into the `bills` table using COPY.
 * @param bills Array of bill records. All objects must have the same keys.
 */
export async function bulkInsertBills(bills: Record<string, any>[]) {
  if (!bills.length) return;
  const columns = Object.keys(bills[0]);
  const copyQuery = `COPY bills (${columns.map(c => `"${c}"`).join(',')}) FROM STDIN WITH (FORMAT csv)`;
  const client = await db.$client.connect();
  try {
    await client.query('BEGIN');
    const stream = client.query(pgCopy.from(copyQuery));
    const readable = new Readable({
      read() {
        for (const row of bills) {
          const line = columns.map(col => {
            const val = row[col];
            // Escape double quotes and commas for CSV
            if (val == null) return '';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
          }).join(',');
          this.push(line + '\n');
        }
        this.push(null);
      }
    });
    await new Promise((resolve, reject) => {
      readable.pipe(stream).on('finish', resolve).on('error', reject);
    });
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
