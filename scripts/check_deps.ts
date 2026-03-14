
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
        const deps = await query(`
      SELECT 
          n.nspname AS schema_name,
          c.relname AS view_name
      FROM pg_rewrite r
      JOIN pg_class c ON c.oid = r.ev_class
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_depend d ON d.objid = r.oid
      WHERE d.refobjid = 'bills'::regclass
      AND c.relkind = 'v'
      GROUP BY n.nspname, c.relname
    `);
        console.log('START_JSON');
        console.log(JSON.stringify(deps, null, 2));
        console.log('END_JSON');
    } catch (err) {
        console.error(err);
    } finally {
        await closePool();
        process.exit();
    }
};
f();
