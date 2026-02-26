# Database Migration Strategy for Production

To prepare the production database for the AAWSA Billing Portal, follow these steps to ensure the schema is up-to-date and consistent with the application code.

## 1. Initial Schema Setup
If you are starting with a fresh database, you should first apply the base schema. 
> [!NOTE]
> Most migrations expect the existing Supabase Auth schema to be present.

## 2. Apply Incremental Migrations
Run the SQL scripts located in the `database_migrations/` folder in numerical order. These scripts handle RBAC, Tariffs, Meter Readings, and Billing logic.

### Critical Migrations Order:
1. `002_rbac_setup.sql` through `010_...`
2. `011_recreate_schema.sql` (Note: This is a major schema consolidation)
3. `012_...` through `020_reorder_bills_columns.sql`

## 3. Post-Reorder Fixes (Required)
The following manual adjustments are required after running the standard migrations to support the new `BILLKEY` format and writable columns.

```sql
-- 1. Remove the generated property from BILLKEY to allow manual updates
ALTER TABLE bills ALTER COLUMN "BILLKEY" DROP EXPRESSION IF EXISTS;

-- 2. Ensure BILLKEY is of type TEXT
ALTER TABLE bills ALTER COLUMN "BILLKEY" TYPE TEXT;

-- 3. (Optional) If you have existing data, run a backfill
-- The application will automatically handle new bills, but older ones can be updated via the backfill script.
```

## 4. Verification
After applying migrations, verify the following tables exist and have the correct structure:
- `branches`
- `bills` (Check that `BILLKEY` is a plain `TEXT` column)
- `individual_customers`
- `bulk_meters`
- `tariffs`

## 5. Seed Data
Ensure that the `fault_codes` and `tariffs` are seeded with at least one active record before staff members begin data entry.
