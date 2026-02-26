import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

import { query } from '../src/lib/db';
async function f() {
    try {
        const cols = await query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'bills' ORDER BY ordinal_position");
        const constraints = await query("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE nspname = 'public' AND conrelid = 'bills'::regclass");
        console.log('COLUMNS:');
        console.log(JSON.stringify(cols, null, 2));
        console.log('CONSTRAINTS:');
        console.log(JSON.stringify(constraints, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
};
f();
