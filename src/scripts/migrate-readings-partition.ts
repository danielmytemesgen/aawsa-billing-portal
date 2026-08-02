import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { deriveMonthKey, getPartitionName } from './partition-utils';

async function migrateReadingsToPartitionedTables() {
  const { query, withTransaction } = await import('../lib/db');
  console.log('--- Starting Readings Partitioning Migration ---');

  try {
    await withTransaction(async (client: any) => {
      await client.query('DROP TABLE IF EXISTS public.individual_customer_readings_partitioned CASCADE');
      await client.query('DROP TABLE IF EXISTS public.bulk_meter_readings_partitioned CASCADE');

      await client.query(`
        CREATE TABLE public.individual_customer_readings_partitioned (
          id INTEGER GENERATED ALWAYS AS IDENTITY,
          "READ_PROC_ID" text,
          "ROUND_KEY" text,
          "WALK_ORDER" integer,
          "INST_KEY" text,
          "INST_TYPE_CODE" text,
          "CUST_KEY" text,
          "CUST_NAME" text,
          "DISPLAY_ADDRESS" text,
          "BRANCH_NAME" text,
          "METER_KEY" text,
          "PREVIOUS_READING" numeric(12,3),
          "LAST_READING_DATE" timestamp with time zone,
          "NUMBER_OF_DIALS" integer,
          "METER_DIAMETER" numeric,
          "SHADOW_PCNT" numeric,
          "MIN_USAGE_QTY" numeric,
          "MIN_USAGE_AMOUNT" numeric,
          "CHARGE_GROUP" text,
          "USAGE_CODE" text,
          "SELL_CODE" text,
          "FREQUENCY" text,
          "SERVICE_CODE" text,
          "SHADOW_USAGE" numeric,
          "ESTIMATED_READING" numeric,
          "ESTIMATED_READING_LOW" numeric,
          "ESTIMATED_READING_HIGH" numeric,
          "ESTIMATED_READING_IND" text,
          "METER_READING" numeric(12,3) NOT NULL,
          "READING_DATE" timestamp with time zone DEFAULT now(),
          "METER_READER_CODE" text,
          "FAULT_CODE" text,
          "SERVICE_BILLED_UP_TO_DATE" date,
          "METER_MULTIPLY_FACTOR" numeric,
          "LATITUDE" numeric,
          "LONGITUDE" numeric,
          "ALTITUDE" numeric,
          "PHONE_NUMBER" text,
          "isSuccess" boolean,
          "error" text,
          created_at timestamp with time zone DEFAULT now(),
          created_by uuid,
          reading_month text NOT NULL,
          PRIMARY KEY (id, reading_month)
        ) PARTITION BY LIST (reading_month);
      `);

      await client.query(`
        CREATE TABLE public.bulk_meter_readings_partitioned (
          id INTEGER GENERATED ALWAYS AS IDENTITY,
          "READ_PROC_ID" text,
          "ROUND_KEY" text,
          "WALK_ORDER" integer,
          "INST_KEY" text,
          "INST_TYPE_CODE" text,
          "CUST_KEY" text,
          "CUST_NAME" text,
          "DISPLAY_ADDRESS" text,
          "BRANCH_NAME" text,
          "METER_KEY" text,
          "PREVIOUS_READING" numeric(12,3),
          "LAST_READING_DATE" timestamp with time zone,
          "NUMBER_OF_DIALS" integer,
          "METER_DIAMETER" numeric,
          "SHADOW_PCNT" numeric,
          "MIN_USAGE_QTY" numeric,
          "MIN_USAGE_AMOUNT" numeric,
          "CHARGE_GROUP" text,
          "USAGE_CODE" text,
          "SELL_CODE" text,
          "FREQUENCY" text,
          "SERVICE_CODE" text,
          "SHADOW_USAGE" numeric,
          "ESTIMATED_READING" numeric,
          "ESTIMATED_READING_LOW" numeric,
          "ESTIMATED_READING_HIGH" numeric,
          "ESTIMATED_READING_IND" text,
          "METER_READING" numeric(12,3) NOT NULL,
          "READING_DATE" timestamp with time zone DEFAULT now(),
          "METER_READER_CODE" text,
          "FAULT_CODE" text,
          "SERVICE_BILLED_UP_TO_DATE" date,
          "METER_MULTIPLY_FACTOR" numeric,
          "LATITUDE" numeric,
          "LONGITUDE" numeric,
          "ALTITUDE" numeric,
          "PHONE_NUMBER" text,
          "isSuccess" boolean,
          "error" text,
          created_at timestamp with time zone DEFAULT now(),
          created_by uuid,
          reading_month text NOT NULL,
          PRIMARY KEY (id, reading_month)
        ) PARTITION BY LIST (reading_month);
      `);

      const individualRows: any = await client.query('SELECT id, "READING_DATE" FROM individual_customer_readings');
      const bulkRows: any = await client.query('SELECT id, "READING_DATE" FROM bulk_meter_readings');

      const individualMonths = new Set(individualRows.rows.map((row: any) => deriveMonthKey(row.READING_DATE)).filter(Boolean) as string[]);
      const bulkMonths = new Set(bulkRows.rows.map((row: any) => deriveMonthKey(row.READING_DATE)).filter(Boolean) as string[]);

      for (const month of [...individualMonths]) {
        const partitionName = getPartitionName('individual_customer_readings', month);
        await client.query(`CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF individual_customer_readings_partitioned FOR VALUES IN ('${month}')`);
      }

      for (const month of [...bulkMonths]) {
        const partitionName = getPartitionName('bulk_meter_readings', month);
        await client.query(`CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF bulk_meter_readings_partitioned FOR VALUES IN ('${month}')`);
      }

      await client.query('CREATE TABLE IF NOT EXISTS individual_customer_readings_default PARTITION OF individual_customer_readings_partitioned DEFAULT');
      await client.query('CREATE TABLE IF NOT EXISTS bulk_meter_readings_default PARTITION OF bulk_meter_readings_partitioned DEFAULT');

      await client.query(`
        INSERT INTO individual_customer_readings_partitioned (
          "READ_PROC_ID", "ROUND_KEY", "WALK_ORDER", "INST_KEY", "INST_TYPE_CODE", "CUST_KEY", "CUST_NAME",
          "DISPLAY_ADDRESS", "BRANCH_NAME", "METER_KEY", "PREVIOUS_READING", "LAST_READING_DATE", "NUMBER_OF_DIALS",
          "METER_DIAMETER", "SHADOW_PCNT", "MIN_USAGE_QTY", "MIN_USAGE_AMOUNT", "CHARGE_GROUP", "USAGE_CODE",
          "SELL_CODE", "FREQUENCY", "SERVICE_CODE", "SHADOW_USAGE", "ESTIMATED_READING", "ESTIMATED_READING_LOW",
          "ESTIMATED_READING_HIGH", "ESTIMATED_READING_IND", "METER_READING", "READING_DATE", "METER_READER_CODE",
          "FAULT_CODE", "SERVICE_BILLED_UP_TO_DATE", "METER_MULTIPLY_FACTOR", "LATITUDE", "LONGITUDE", "ALTITUDE",
          "PHONE_NUMBER", "isSuccess", "error", created_at, created_by, reading_month
        )
        SELECT
          "READ_PROC_ID", "ROUND_KEY", "WALK_ORDER", "INST_KEY", "INST_TYPE_CODE", "CUST_KEY", "CUST_NAME",
          "DISPLAY_ADDRESS", "BRANCH_NAME", "METER_KEY", "PREVIOUS_READING", "LAST_READING_DATE", "NUMBER_OF_DIALS",
          "METER_DIAMETER", "SHADOW_PCNT", "MIN_USAGE_QTY", "MIN_USAGE_AMOUNT", "CHARGE_GROUP", "USAGE_CODE",
          "SELL_CODE", "FREQUENCY", "SERVICE_CODE", "SHADOW_USAGE", "ESTIMATED_READING", "ESTIMATED_READING_LOW",
          "ESTIMATED_READING_HIGH", "ESTIMATED_READING_IND", "METER_READING", "READING_DATE", "METER_READER_CODE",
          "FAULT_CODE", "SERVICE_BILLED_UP_TO_DATE", "METER_MULTIPLY_FACTOR", "LATITUDE", "LONGITUDE", "ALTITUDE",
          "PHONE_NUMBER", "isSuccess", "error", created_at, created_by,
          COALESCE(TO_CHAR("READING_DATE"::date, 'YYYY-MM'), 'unknown')
        FROM individual_customer_readings
      `);

      await client.query(`
        INSERT INTO bulk_meter_readings_partitioned (
          "READ_PROC_ID", "ROUND_KEY", "WALK_ORDER", "INST_KEY", "INST_TYPE_CODE", "CUST_KEY", "CUST_NAME",
          "DISPLAY_ADDRESS", "BRANCH_NAME", "METER_KEY", "PREVIOUS_READING", "LAST_READING_DATE", "NUMBER_OF_DIALS",
          "METER_DIAMETER", "SHADOW_PCNT", "MIN_USAGE_QTY", "MIN_USAGE_AMOUNT", "CHARGE_GROUP", "USAGE_CODE",
          "SELL_CODE", "FREQUENCY", "SERVICE_CODE", "SHADOW_USAGE", "ESTIMATED_READING", "ESTIMATED_READING_LOW",
          "ESTIMATED_READING_HIGH", "ESTIMATED_READING_IND", "METER_READING", "READING_DATE", "METER_READER_CODE",
          "FAULT_CODE", "SERVICE_BILLED_UP_TO_DATE", "METER_MULTIPLY_FACTOR", "LATITUDE", "LONGITUDE", "ALTITUDE",
          "PHONE_NUMBER", "isSuccess", "error", created_at, created_by, reading_month
        )
        SELECT
          "READ_PROC_ID", "ROUND_KEY", "WALK_ORDER", "INST_KEY", "INST_TYPE_CODE", "CUST_KEY", "CUST_NAME",
          "DISPLAY_ADDRESS", "BRANCH_NAME", "METER_KEY", "PREVIOUS_READING", "LAST_READING_DATE", "NUMBER_OF_DIALS",
          "METER_DIAMETER", "SHADOW_PCNT", "MIN_USAGE_QTY", "MIN_USAGE_AMOUNT", "CHARGE_GROUP", "USAGE_CODE",
          "SELL_CODE", "FREQUENCY", "SERVICE_CODE", "SHADOW_USAGE", "ESTIMATED_READING", "ESTIMATED_READING_LOW",
          "ESTIMATED_READING_HIGH", "ESTIMATED_READING_IND", "METER_READING", "READING_DATE", "METER_READER_CODE",
          "FAULT_CODE", "SERVICE_BILLED_UP_TO_DATE", "METER_MULTIPLY_FACTOR", "LATITUDE", "LONGITUDE", "ALTITUDE",
          "PHONE_NUMBER", "isSuccess", "error", created_at, created_by,
          COALESCE(TO_CHAR("READING_DATE"::date, 'YYYY-MM'), 'unknown')
        FROM bulk_meter_readings
      `);

      await client.query('ALTER TABLE individual_customer_readings RENAME TO individual_customer_readings_legacy');
      await client.query('ALTER TABLE individual_customer_readings_partitioned RENAME TO individual_customer_readings');
      await client.query('ALTER TABLE bulk_meter_readings RENAME TO bulk_meter_readings_legacy');
      await client.query('ALTER TABLE bulk_meter_readings_partitioned RENAME TO bulk_meter_readings');
    });

    console.log('--- Readings Partitioning Migration Complete ---');
  } catch (error) {
    console.error('Readings partitioning migration failed:', error);
    process.exit(1);
  }
}

migrateReadingsToPartitionedTables();
