
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

async function f() {
    const { query, closePool } = await import('../src/lib/db');
    try {
        const constraints = await query(`
      SELECT conname, pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c 
      JOIN pg_namespace n ON n.oid = c.connamespace 
      WHERE nspname = 'public' AND conrelid = 'bills'::regclass
    `);
        const indexes = await query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'bills'
    `);
        console.log('START_JSON');
        console.log(JSON.stringify({ constraints, indexes }, null, 2));
        console.log('END_JSON');
    } catch (err) {
        console.error(err);
    } finally {
        await closePool();
        process.exit();
    }
};
f();
