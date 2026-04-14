import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function migrateToPartitionedBills() {
    const { query, withTransaction } = await import('../lib/db');
    console.log('--- Starting Bills Table Partitioning Migration ---');

    try {
        // 1. Get all unique month_year values to create partitions
        const monthsResult: any = await query('SELECT DISTINCT month_year FROM bills');
        const months = monthsResult.map((r: any) => r.month_year).filter(Boolean);
        console.log(`Found ${months.length} unique months:`, months);

        await withTransaction(async (client) => {
            // 0. Cleanup from failed run
            await client.query('DROP TABLE IF EXISTS bills_partitioned CASCADE');

            // 2. Create the new partitioned table with EXACT column match
            await client.query(`
                CREATE TABLE bills_partitioned (
                    id uuid DEFAULT gen_random_uuid(),
                    individual_customer_id text,
                    "CUSTOMERKEY" text,
                    bill_period_start_date date,
                    bill_period_end_date date,
                    month_year text NOT NULL,
                    "PREVREAD" numeric DEFAULT 0,
                    "CURRREAD" numeric DEFAULT 0,
                    "CONS" numeric DEFAULT 0,
                    difference_usage numeric DEFAULT 0,
                    base_water_charge numeric DEFAULT 0,
                    sewerage_charge numeric DEFAULT 0,
                    maintenance_fee numeric DEFAULT 0,
                    sanitation_fee numeric DEFAULT 0,
                    meter_rent numeric DEFAULT 0,
                    balance_carried_forward numeric DEFAULT 0,
                    "TOTALBILLAMOUNT" numeric DEFAULT 0,
                    amount_paid numeric DEFAULT 0,
                    "OUTSTANDINGAMT" numeric DEFAULT 0,
                    due_date date,
                    payment_status text, -- Simplification for migration
                    bill_number text,
                    notes text,
                    created_at timestamp with time zone DEFAULT now(),
                    updated_at timestamp with time zone DEFAULT now(),
                    status character varying,
                    approval_date timestamp without time zone,
                    approved_by character varying,
                    vat_amount numeric DEFAULT 0,
                    additional_fees_charge numeric DEFAULT 0,
                    additional_fees_breakdown jsonb,
                    "BILLKEY" text,
                    "CUSTOMERNAME" text,
                    "CUSTOMERTIN" text,
                    "CUSTOMERBRANCH" text,
                    "REASON" text,
                    "THISMONTHBILLAMT" numeric DEFAULT 0,
                    "PENALTYAMT" numeric DEFAULT 0,
                    "DRACCTNO" text,
                    "CRACCTNO" text,
                    debit_30 numeric DEFAULT 0,
                    debit_30_60 numeric DEFAULT 0,
                    debit_60 numeric DEFAULT 0,
                    deleted_at timestamp with time zone,
                    deleted_by uuid,
                    snapshot_data jsonb,
                    branch_id uuid,
                    PRIMARY KEY (id, month_year)
                ) PARTITION BY LIST (month_year);
            `);
            console.log('Created bills_partitioned parent table.');

            // 3. Create partitions for each month
            for (const month of months) {
                const partitionName = `bills_${month.replace(/[-\s]/g, '_')}`;
                await client.query(`
                    CREATE TABLE IF NOT EXISTS ${partitionName} 
                    PARTITION OF bills_partitioned 
                    FOR VALUES IN ('${month}');
                `);
                console.log(`Created partition ${partitionName} for month ${month}.`);
            }

            // 4. Create a DEFAULT partition for unexpected data
            await client.query(`
                CREATE TABLE IF NOT EXISTS bills_default 
                PARTITION OF bills_partitioned 
                DEFAULT;
            `);
            console.log('Created bills_default partition.');

            // 5. Migrate existing data
            console.log('Migrating data...');
            // We use explicit column selection to avoid order issues
            await client.query(`
                INSERT INTO bills_partitioned 
                SELECT 
                    id, individual_customer_id, "CUSTOMERKEY", bill_period_start_date, 
                    bill_period_end_date, month_year, "PREVREAD", "CURRREAD", "CONS", 
                    difference_usage, base_water_charge, sewerage_charge, maintenance_fee, 
                    sanitation_fee, meter_rent, balance_carried_forward, "TOTALBILLAMOUNT", 
                    amount_paid, "OUTSTANDINGAMT", due_date, CAST(payment_status AS text), 
                    bill_number, notes, created_at, updated_at, status, approval_date, 
                    approved_by, vat_amount, additional_fees_charge, additional_fees_breakdown, 
                    "BILLKEY", "CUSTOMERNAME", "CUSTOMERTIN", "CUSTOMERBRANCH", "REASON", 
                    "THISMONTHBILLAMT", "PENALTYAMT", "DRACCTNO", "CRACCTNO", debit_30, 
                    debit_30_60, debit_60, deleted_at, deleted_by, snapshot_data, branch_id
                FROM bills;
            `);
            console.log('Data migration complete.');

            // 6. Fix references in payments (add month_year link)
            console.log('Updating payments table...');
            await client.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS bill_month_year text');
            await client.query(`
                UPDATE payments p
                SET bill_month_year = b.month_year
                FROM bills b
                WHERE p.bill_id = b.id
                AND p.bill_month_year IS NULL;
            `);
            console.log('Payments backfilled.');

            // 7. Swap the tables
            console.log('Swapping tables...');
            await client.query('DROP TABLE bills CASCADE');
            await client.query('ALTER TABLE bills_partitioned RENAME TO bills');
            console.log('Table swap complete.');
        });

        console.log('--- Migration Successful! ---');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrateToPartitionedBills();
