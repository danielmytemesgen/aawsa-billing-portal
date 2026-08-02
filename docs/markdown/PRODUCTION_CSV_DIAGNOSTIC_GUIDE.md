# 🔍 Production CSV Upload Diagnostic Guide

## Status: Critical Diagnostic Logging Implemented

Your code now has **comprehensive logging** that will show exactly why the CSV upload is showing "success" but not updating the database.

---

## 🚀 Step 1: Deploy Updated Code to Production

The new diagnostic logging will help identify the exact issue. Here's what changed:

```
✅ Enhanced error handling in dbEnsurePaymentColumnsExist()
✅ Detailed UPDATE query logging 
✅ Sync operation logging for related tables
✅ Pre-flight database verification
✅ Bill count diagnostics
```

**Deploy the updated code**:
```bash
cd /path/to/aawsa-billing-portal

# Pull the new code with enhanced logging
git pull origin main

# Restart the app to pick up new code
pm2 restart aawsa-billing-web
```

---

## 🔍 Step 2: Watch the Logs When CSV Is Uploaded

**In a terminal, watch the real-time logs**:
```bash
pm2 logs aawsa-billing-web
```

**Then in another terminal/browser, upload a test CSV** with one bill.

**In the logs, look for these sections:**

### A. Server Action Startup
```
[CSV UPLOAD] ⏱️  Started at 2026-07-24T14:30:00Z
[CSV UPLOAD] 📊 Records to process: 1
[CSV UPLOAD] 🔑 Staff ID: <staff-id>
[CSV UPLOAD] 🏢 Branch: <branch>
[CSV UPLOAD] 🌐 Environment: production
[CSV UPLOAD] 🗄️  Database Host: <your-db-host>
```

### B. Database Connection Check
```
[CSV UPLOAD] ✅ Database connection verified
[CSV UPLOAD] ✅ Database schema verified - payment columns exist
[CSV UPLOAD] 📊 Total bills in database: <number>
[CSV UPLOAD] 📋 payment_status column type: text
```

**⚠️ If you see**:
```
[CSV UPLOAD] ❌ Pre-flight check failed:
```
→ Database cannot be connected or columns missing. **Stop and fix database connection.**

### C. Bill Finding (Pre-fetch)
```
[CSV] Row 1 - Found bill: BBPT-2305375013 (id: abc-123-def)
```

**⚠️ If you see**:
```
[CSV] Row 1 - error: Bill not found for Bill Key...
```
→ The BILLKEY doesn't exist in database. **Check if test BILLKEY is correct.**

### D. Update Attempt
```
[CSV] Row 1 - Current state:
  payment_status: Unpaid
  amount_paid: 0
  reconciliation_status: Not reconciled
  bank_ref: null

[CSV] Row 1 - Will update to:
  payment_status: Paid
  amount_paid: 12345.50
  reconciliation_status: Reconciled
  bank_ref: CBE123456
  payment_channel: CBE
  last_payment_date: 2026-07-24T14:30:00Z

[CSV] Row 1 - Primary UPDATE (by id) result: [ { id: 'abc-123-def', "BILLKEY": 'BBPT-2305375013', payment_status: 'Paid', amount_paid: 12345.50, last_payment_date: '2026-07-24T14:30:00.000Z' } ]
```

**⚠️ If you see**:
```
[CSV] Row 1 - Primary UPDATE (by id) result: []
[CSV] Row 1 - Fallback: trying BILLKEY="BBPT-2305375013"
[CSV] Row 1 - Fallback UPDATE result: []
[CSV] Row 1 ❌ UPDATE FAILED - No rows affected
```
→ **This is the smoking gun!** The bill exists but UPDATE returned 0 rows. Possible causes:
- Database permissions issue (app user can't UPDATE)
- Connection pool issue
- Transaction isolation issue

### E. Sync Operations
```
[CSV] Row 1 ✅ Synced individual_customers for customer IND-12345
[CSV] Row 1 ✅ Synced bulk_meters for customer BM-98765
[CSV] Row 1 ✅ Payment logged to payments table (id: 550e8400-e29b-41d4-a716-446655440000)
```

**⚠️ If you see**:
```
[CSV] Row 1 ❌ Individual customer sync failed: Error: permission denied for schema public
```
→ Database user doesn't have UPDATE permission on these tables.

### F. Final Result
```
[CSV UPLOAD] ✅ Completed in 234ms
[CSV UPLOAD] 📈 Result: {
  success: true,
  updatedCount: 1,
  errorCount: 0,
  duration: '234ms'
}
```

---

## 🆘 Diagnostic Scenarios

### Scenario 1: "Bill not found" error
```
[CSV] Row 1 - error: Bill not found for Bill Key "BBPT-2305375013"
```

**Diagnosis**: BILLKEY format wrong or bill doesn't exist  
**Fix**:
```bash
psql -U postgres -d aawsa_billing -c "
SELECT \"BILLKEY\", id, payment_status FROM bills LIMIT 1;
"
```
- Copy exact BILLKEY from output
- Use that in your CSV test

---

### Scenario 2: "UPDATE FAILED - No rows affected"
```
[CSV] Row 1 ❌ UPDATE FAILED - No rows affected
  billId: abc-123-def
  billKey: BBPT-2305375013
```

**Diagnosis**: Bill found but UPDATE didn't work  
**Possible Causes**:

1. **Database permissions**:
   ```bash
   psql -U postgres -d aawsa_billing -c "
   GRANT SELECT, UPDATE ON bills TO aawsa_user;
   GRANT SELECT, UPDATE ON individual_customers TO aawsa_user;
   GRANT SELECT, UPDATE ON bulk_meters TO aawsa_user;
   "
   ```

2. **Try manual UPDATE**:
   ```bash
   psql -U aawsa_user -d aawsa_billing -c "
   UPDATE bills SET payment_status = 'Paid' WHERE id = 'abc-123-def' RETURNING id;
   "
   ```
   - If this works, permissions are OK
   - If fails with "permission denied", see #1 above

3. **Check if connection pool is stale**:
   ```bash
   pm2 restart aawsa-billing-web
   pm2 logs aawsa-billing-web
   ```

---

### Scenario 3: "Pre-flight check failed"
```
[CSV UPLOAD] ❌ Pre-flight check failed: Error: connect ECONNREFUSED 192.168.1.10:5432
```

**Diagnosis**: Cannot connect to database  
**Fix**:
```bash
# Verify database server is running
psql -U postgres -h 192.168.1.10 -d postgres -c "SELECT 1"

# Check connection pool on app server
netstat -an | grep 5432

# Check if firewall blocks port 5432
ping 192.168.1.10
```

---

### Scenario 4: Sync operations fail
```
[CSV] Row 1 ❌ Individual customer sync failed: Error: permission denied for schema public
```

**Diagnosis**: Missing UPDATE permission on related tables  
**Fix**:
```bash
psql -U postgres -d aawsa_billing -c "
GRANT UPDATE ON individual_customers TO aawsa_user;
GRANT UPDATE ON bulk_meters TO aawsa_user;
"
```

---

## 📋 Complete Diagnostic Checklist

### Before Testing CSV Upload:

- [ ] ✅ Deployed updated code with diagnostic logging
- [ ] ✅ PM2 restarted: `pm2 restart aawsa-billing-web`
- [ ] ✅ PM2 logs are accessible: `pm2 logs aawsa-billing-web`
- [ ] ✅ Verified at least 1 bill exists: `SELECT COUNT(*) FROM bills`
- [ ] ✅ Known test BILLKEY identified from database
- [ ] ✅ Database user has UPDATE permissions (see "Database Permissions" above)

### During CSV Upload Test:

1. Open terminal watching logs: `pm2 logs aawsa-billing-web`
2. In another window, upload CSV with 1 test record
3. Watch logs for output
4. Note which section fails (Pre-flight? Finding bill? Updating? Sync?)
5. **Screenshot the full log output**

### After Getting Error:

1. Go to Scenario section matching your error
2. Run diagnostic query provided
3. Share results with any error messages

---

## 📊 Database Verification Queries

### Before CSV Upload Test
```sql
-- 1. Count total bills
SELECT COUNT(*) as total_bills FROM bills;

-- 2. Check one sample bill (to get exact format)
SELECT "BILLKEY", id, payment_status, amount_paid, reconciliation_status FROM bills LIMIT 1;

-- 3. Verify schema columns exist
SELECT COUNT(*) as payment_columns FROM information_schema.columns 
WHERE table_name = 'bills' 
AND column_name IN ('reconciliation_status', 'payment_channel', 'bank_ref', 'last_payment_date', 'phone', 'route_key', 'walk_order', 'meter_key');
-- Should return: 8

-- 4. Check user permissions
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'bills' AND grantee = 'aawsa_user';
-- Should include: SELECT, UPDATE
```

### After Failed CSV Upload
```sql
-- 5. Manually test UPDATE with same parameters
UPDATE bills 
SET payment_status = 'Paid', 
    amount_paid = <test_amount>, 
    last_payment_date = NOW(),
    reconciliation_status = 'Reconciled'
WHERE "BILLKEY" = '<test_billkey>'
RETURNING id, "BILLKEY", payment_status, amount_paid;

-- 6. If manual UPDATE works but CSV didn't, check app connection
-- (This suggests connection pooling issue or transaction isolation problem)
```

---

## 🔧 Quick Fixes to Try

### If columns don't exist (despite migration being applied):
```bash
psql -U postgres -d aawsa_billing -f database/migrations/050_payment_infrastructure_csv.sql
```

### If permissions are wrong:
```bash
psql -U postgres -d aawsa_billing -c "
GRANT SELECT, UPDATE ON bills TO aawsa_user;
GRANT SELECT, UPDATE ON individual_customers TO aawsa_user;
GRANT SELECT, UPDATE ON bulk_meters TO aawsa_user;
GRANT SELECT, INSERT ON payments TO aawsa_user;
"
```

### If connection pool is stuck:
```bash
pm2 restart aawsa-billing-web
```

### If database won't respond:
```bash
# Restart database
sudo systemctl restart postgresql

# Or on Windows Server:
NET STOP PostgreSQL12
NET START PostgreSQL12
```

---

## 📞 What to Capture for Support

When you test and see an error, capture:

1. **Full PM2 log output** (all lines with `[CSV]` prefix)
2. **BILLKEY you're testing with** (copy from database)
3. **Error message** (exact text)
4. **Output of**: `psql -U postgres -d aawsa_billing -c "SELECT \"BILLKEY\", id, payment_status FROM bills WHERE \"BILLKEY\" = '<your-test-key>'"`
5. **Output of**: `SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'bills'`
6. **Output of**: `SELECT column_name FROM information_schema.columns WHERE table_name = 'bills' AND column_name IN ('reconciliation_status', 'payment_channel', 'bank_ref', 'last_payment_date')`

---

## ✅ Expected Success Output

When everything works, you should see:

```
[CSV UPLOAD] ⏱️  Started at 2026-07-24T14:30:00Z
[CSV UPLOAD] 📊 Records to process: 1
[CSV UPLOAD] ✅ Database connection verified
[CSV UPLOAD] ✅ Database schema verified - payment columns exist
[CSV UPLOAD] 📊 Total bills in database: 15234
[CSV UPLOAD] 📋 payment_status column type: text

[CSV] Row 1 - Found bill: BBPT-2305375013 (id: 550e8400-e29b-41d4-a716-446655440000)
[CSV] Row 1 - Primary UPDATE (by id) result: [ { id: '550e8400-e29b-41d4-a716-446655440000', "BILLKEY": 'BBPT-2305375013', payment_status: 'Paid', amount_paid: 12345.50, ... } ]
[CSV] Row 1 ✅ UPDATE SUCCESS: { id: '550e8400-e29b-41d4-a716-446655440000', "BILLKEY": 'BBPT-2305375013', payment_status: 'Paid', amount_paid: 12345.50, ... }
[CSV] Row 1 ✅ Synced individual_customers for customer IND-12345
[CSV] Row 1 ✅ Synced bulk_meters for customer BM-98765
[CSV] Row 1 ✅ Payment logged to payments table (id: 550e8400-e29b-41d4-a716-446655440000)

[CSV UPLOAD] ✅ Completed in 234ms
[CSV UPLOAD] 📈 Result: { success: true, updatedCount: 1, errorCount: 0, duration: '234ms' }
```

Then verify in database:
```sql
SELECT payment_status, amount_paid, reconciliation_status, bank_ref, last_payment_date 
FROM bills 
WHERE "BILLKEY" = 'BBPT-2305375013';

-- Should show: Paid, 12345.50, Reconciled, <bank_ref>, <recent_date>
```

---

## 📌 Key Takeaways

1. **The logging now shows EXACTLY where it fails** - no more silent failures
2. **Pre-flight checks verify database connectivity** before any operations
3. **Each update is logged with before/after state** so you see what should have changed
4. **Sync operations are logged separately** so you know if related tables failed
5. **All 4 scenarios have diagnostic procedures** to pinpoint the issue

---

**Next Steps**:
1. Deploy this updated code to production
2. Test CSV upload with one bill
3. Check PM2 logs for error scenario
4. Follow diagnostic steps for that scenario
5. Fix the underlying issue
6. Test again

**Status**: 🟡 **Ready for production diagnostic testing**  
**Last Updated**: 2026-07-24
