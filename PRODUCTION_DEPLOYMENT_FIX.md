# CRITICAL: Production Deployment Checklist - CSV Payment Upload

## 🚨 **THE REAL ISSUE**

Your production database is **missing the payment columns**. Here's why:

1. ✅ **Localhost**: Columns get auto-created on first request (via `dbEnsurePaymentColumnsExist()`)
2. ❌ **Production**: The migration file was never executed, so columns don't exist
3. ❌ When the code tries to UPDATE those non-existent columns, it silently fails
4. ✅ The UI shows "success" because the response comes back, but NO DATA WAS UPDATED

---

## 🔍 **Verify Production Database NOW**

### Step 1: Check if payment columns exist
```bash
# SSH into production server
ssh user@production-server

# Connect to PostgreSQL
psql -U aawsa_user -d aawsa_billing -h localhost

# Run this query:
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'bills' 
AND column_name IN ('reconciliation_status', 'payment_channel', 'bank_ref', 'last_payment_date', 'phone', 'route_key', 'walk_order', 'meter_key')
ORDER BY column_name;
```

**Expected output**: 8 rows (all the payment columns)

**If you get 0 rows**: ⚠️ **COLUMNS DON'T EXIST** - Run Step 2 immediately!

---

### Step 2: Apply the migration to production database

```bash
# On production server, navigate to app directory
cd /path/to/aawsa-billing-portal

# Run the migration
psql -U aawsa_user -d aawsa_billing -h localhost -f database/migrations/050_payment_infrastructure_csv.sql

# You should see output like:
# ALTER TABLE
# DO
# CREATE TABLE
# CREATE INDEX
# UPDATE (if any bills are already paid)
```

**If you get errors**, see the troubleshooting section below.

---

### Step 3: Verify data types
```sql
-- Check that payment_status is TEXT (not enum)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bills' 
AND column_name = 'payment_status';

-- Should return: text (NOT payment_status enum)
```

---

### Step 4: Verify indexes
```sql
-- Check all payment-related indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'bills' 
AND indexname LIKE 'idx_bills%'
ORDER BY indexname;

-- Should return at least these:
-- idx_bills_billkey
-- idx_bills_bill_number
-- idx_bills_customerkey
-- idx_bills_ind_customer
-- idx_bills_payment_status
-- idx_bills_reconciliation_status
```

---

### Step 5: Verify payments table exists
```sql
-- Check if payments table exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'payments'
);

-- Should return: true

-- Check payments table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments'
ORDER BY ordinal_position;
```

---

## 📋 **Production Environment Checklist**

### Database Configuration
- [ ] ✅ `POSTGRES_HOST` is set correctly (NOT 127.0.0.1)
- [ ] ✅ `POSTGRES_USER` can connect to database
- [ ] ✅ `POSTGRES_PASSWORD` is correct
- [ ] ✅ `POSTGRES_DB` database exists
- [ ] ✅ `POSTGRES_PORT` is correct (usually 5432)
- [ ] ✅ Firewall allows connection from app server to DB server

### Database Schema
- [ ] ✅ Migration 050_payment_infrastructure_csv.sql has been applied
- [ ] ✅ 8 payment columns exist on bills table
- [ ] ✅ payment_status column is TEXT type (not enum)
- [ ] ✅ payments table exists with correct structure
- [ ] ✅ 7 indexes are created on bills table
- [ ] ✅ Individual customers paymentStatus is TEXT
- [ ] ✅ Bulk meters payment_status is TEXT

### Database Permissions
```sql
-- Verify database user has proper permissions
GRANT SELECT, UPDATE ON bills TO aawsa_user;
GRANT SELECT, UPDATE ON individual_customers TO aawsa_user;
GRANT SELECT, UPDATE ON bulk_meters TO aawsa_user;
GRANT SELECT, INSERT ON payments TO aawsa_user;
```

### Application Configuration (ecosystem.config.js)
- [ ] ✅ `POSTGRES_HOST` is exported to pm2
- [ ] ✅ `POSTGRES_USER` is exported to pm2
- [ ] ✅ `POSTGRES_PASSWORD` is exported to pm2
- [ ] ✅ `POSTGRES_DB` is exported to pm2
- [ ] ✅ `POSTGRES_PORT` is exported to pm2
- [ ] ✅ `NODE_ENV=production` is set

### Verify Environment Variables at Runtime
```bash
# SSH into production
ssh user@production-server

# Check PM2 process environment
pm2 env aawsa-billing-web | grep POSTGRES

# Should show:
# POSTGRES_HOST=<your-db-host>
# POSTGRES_USER=<your-db-user>
# POSTGRES_DB=<your-db-name>
# POSTGRES_PORT=5432
```

---

## 🧪 **Test CSV Upload in Production**

### 1. Check Server Logs
```bash
# Watch PM2 logs in real-time
pm2 logs aawsa-billing-web

# Look for these log messages:
# [CSV UPLOAD] ⏱️  Started at...
# [CSV UPLOAD] 📊 Records to process: ...
# [CSV UPLOAD] ✅ Database connection verified
# [CSV UPLOAD] ✅ Database schema verified - payment columns exist
# [CSV UPLOAD] ✅ Completed in XXms
```

### 2. Upload a Test CSV with 1 record
- Go to Paid Bills Report
- Click "Upload Payment CSV"
- Download template
- Fill in with one known bill's details
- Click "Apply Payment Updates (1)"

### 3. Check Logs for Errors
```bash
# See if there are errors
pm2 logs aawsa-billing-web --err

# Look for lines starting with:
# [DB] ❌
# [CSV UPLOAD] ❌
# Server Action Error in wrap:
```

### 4. Verify Database Was Updated
```sql
-- Check if payment was actually recorded
SELECT 
    b."BILLKEY",
    b.payment_status,
    b.reconciliation_status,
    b.bank_ref,
    b.amount_paid,
    b.last_payment_date,
    b.updated_at
FROM bills b
WHERE b."BILLKEY" = '<YOUR_TEST_BILL_KEY>'
LIMIT 1;
```

---

## 🆘 **Troubleshooting**

### Problem: "Database schema not initialized" error
**Cause**: Payment columns don't exist on bills table

**Fix**:
```bash
# Run the migration
psql -U postgres -d aawsa_billing -f database/migrations/050_payment_infrastructure_csv.sql
```

---

### Problem: "Permission denied" errors
**Cause**: Database user doesn't have UPDATE permission on bills table

**Fix**:
```sql
-- Grant permissions
GRANT UPDATE ON bills TO aawsa_user;
GRANT UPDATE ON individual_customers TO aawsa_user;
GRANT UPDATE ON bulk_meters TO aawsa_user;
```

---

### Problem: "Connection timeout" in logs
**Cause**: Database connection limit reached or DB server unreachable

**Fix**:
1. Check database server is running: `psql -U postgres -d postgres -c "SELECT 1"`
2. Check firewall allows connection from app server
3. Check max connections: `SELECT setting FROM pg_settings WHERE name = 'max_connections';`
4. Restart PM2 to reset connection pool: `pm2 restart aawsa-billing-web`

---

### Problem: Logs show "ALTER TABLE" errors
**Cause**: Payment columns already exist or syntax error

**Fix**: 
- They use `IF NOT EXISTS`, so they should be idempotent
- Run migration again - it's safe to run multiple times
- If still failing, check PostgreSQL version supports the syntax

---

### Problem: CSV shows "success" but database not updated
**Cause**: This is the main issue being fixed

**Status**: ✅ FIXED - Enhanced logging will now show exact error
- Check PM2 logs for `[CSV UPLOAD] ❌` messages
- Look for schema verification errors
- Verify database columns exist (see verification step above)

---

## 🚀 **Deployment Steps**

1. **Pull latest code**:
   ```bash
   cd /path/to/aawsa-billing-portal
   git pull origin main
   ```

2. **Apply database migration**:
   ```bash
   psql -U postgres -d aawsa_billing -f database/migrations/050_payment_infrastructure_csv.sql
   ```

3. **Verify migration**:
   ```sql
   SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'bills' 
   AND column_name IN ('reconciliation_status', 'payment_channel', 'bank_ref', 'last_payment_date', 'phone', 'route_key', 'walk_order', 'meter_key');
   -- Should return: 8
   ```

4. **Restart application**:
   ```bash
   pm2 restart aawsa-billing-web
   ```

5. **Watch logs**:
   ```bash
   pm2 logs aawsa-billing-web
   ```

6. **Test CSV upload** with a sample payment

7. **Verify database update**:
   ```sql
   SELECT * FROM bills WHERE "BILLKEY" = '<TEST_BILL_KEY>' LIMIT 1;
   ```

---

## 📊 **Summary of Changes**

| Area | Before | After |
|------|--------|-------|
| **Column Errors** | Silently swallowed | ✅ Now throw and log |
| **CSV Upload Logging** | Basic info only | ✅ Detailed step-by-step logs |
| **Schema Verification** | None | ✅ Pre-flight database checks |
| **Error Messages** | Generic | ✅ Specific, actionable errors |
| **Database Monitoring** | Blind | ✅ Full debug trail in PM2 logs |

---

## 📞 **Support**

If CSV still doesn't work after these steps:

1. ✅ Run `pm2 logs aawsa-billing-web` and look for `[CSV UPLOAD]` messages
2. ✅ Share the exact error message from logs
3. ✅ Run verification queries above and share results
4. ✅ Check that POSTGRES_* env vars match your production database

---

**Status**: 🎯 **Ready for Production Deployment**  
**Last Updated**: 2026-07-24
