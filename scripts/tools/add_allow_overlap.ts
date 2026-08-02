import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const { query } = await import('./src/lib/db');
    try {
        await query(`ALTER TABLE public.billing_jobs ADD COLUMN allow_overlap BOOLEAN NOT NULL DEFAULT false;`);
        console.log("Migration executed successfully: Added allow_overlap to billing_jobs.");
    } catch (e: any) {
        if (e.code === '42701') {
            console.log("Column allow_overlap already exists.");
        } else {
            console.error("Migration failed:", e);
        }
    }
    process.exit(0);
}

main();
