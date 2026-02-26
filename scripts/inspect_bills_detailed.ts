
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
        const res = await query("SELECT column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'bills' ORDER BY ordinal_position");
        console.log('START_JSON');
        console.log(JSON.stringify(res, null, 2));
        console.log('END_JSON');
    } catch (err) {
        console.error(err);
    } finally {
        await closePool();
        process.exit();
    }
};
f();
