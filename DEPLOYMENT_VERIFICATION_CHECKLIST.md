# CSV Payment Update - Deployment Verification Checklist

## Issue Fixed
The "Update Payment with CSV Upload" feature was showing success messages but not actually updating the database in production.

## Root Causes Identified & Fixed
1. ✅ UPDATE query WHERE clause had complex OR logic that could fail to match rows
2. ✅ No fallback strategy when primary match failed  
3. ✅ Silent error swallowing in sync operations
4. ✅ Insufficient error logging for debugging

## Code Changes Applied
- `src/lib/db-queries.ts`: Implemented two-step UPDATE with fallback logic
- `src/lib/actions.ts`: Added detailed logging to track CSV imports

## Pre-Deployment Verification Checklist

### 1. Environment Variables
- [ ] `POSTGRES_HOST` is set correctly (not `DATABASE_URL`)
- [ ] `POSTGRES_USER` is configured
- [ ] `POSTGRES_PASSWORD` is set (use secrets manager, not hardcoded)
- [ ] `POSTGRES_DB` is set (e.g., `aawsa_billing`)
- [ ] `POSTGRES_PORT` is set (default: 5432)
- [ ] `NODE_ENV` is set to `production`

### 2. Database Connection
- [ ] PostgreSQL is running and accessible from app server
- [ ] Firewall rules allow connection from app server to DB server
- [ ] Database user has `UPDATE` permission on `bills` table
- [ ] Database user has `SELECT` permission on `individual_customers` and `bulk_meters` tables
- [ ] Test connection: `psql -h <POSTGRES_HOST> -U <POSTGRES_USER> -d <POSTGRES_DB> -c "SELECT 1"`

### 3. Database Schema
- [ ] Required columns exist on `bills` table:
  - `reconciliation_status`
  - `payment_channel`
  - `bank_ref`
  - `last_payment_date`
  - `phone`
  - `route_key`
  - `walk_order`
  - `meter_key`
- [ ] Run migration to add missing columns (auto-runs on first CSV upload)
- [ ] Verify `payments` table exists with required columns

### 4. Application Logs
After deploying and testing CSV upload:
- [ ] Check server logs for "CSV Payment Update Started" message
- [ ] Check server logs for "CSV Payment Update Completed" message with record counts
- [ ] Verify no "CSV Payment Update - Row X Failed" errors in logs
- [ ] Look for any database connection errors or timeouts

### 5. Testing CSV Upload in Production
1. **Prepare test data**:
   - Export a known paid bill from the application
   - Use its Bill Key and Customer Key in a test CSV

2. **Upload and verify**:
   - [ ] Upload CSV via "Upload Payment CSV" button
   - [ ] Confirm success message appears
   - [ ] Check database directly:
     ```sql
     SELECT "BILLKEY", payment_status, reconciliation_status, last_payment_date 
     FROM bills 
     WHERE "BILLKEY" = '<TEST_BILL_KEY>'
     ```
   - [ ] Verify `payment_status` = 'Paid' and `last_payment_date` is updated

3. **Check related tables**:
   - [ ] Verify `individual_customers.paymentStatus` updated to 'Paid'
   - [ ] Verify `bulk_meters.payment_status` updated to 'Paid'
   - [ ] Verify entry exists in `payments` table

### 6. Performance Considerations
- [ ] Monitor database connection pool for leaks
- [ ] Watch for slow queries in CSV processing (large batches >1000 rows)
- [ ] Ensure `max connections` in pg pool is sufficient (current: 20)

## Troubleshooting If Issues Persist

### Logs to Check
```bash
# Nginx/reverse proxy logs
tail -f /var/log/nginx/error.log

# PM2 logs
pm2 logs aawsa-billing-portal --err

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql.log
```

### Direct Database Test
```sql
-- Verify database connection works
SELECT version();

-- Check bills table structure
\d bills

-- Test UPDATE manually with a known bill
UPDATE bills 
SET payment_status = 'Paid', amount_paid = 100, updated_at = NOW()
WHERE "BILLKEY" = 'KNOWN_BILL_KEY'
RETURNING id;
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Unauthorized" error | Verify session and JWT token in browser cookies |
| "No bills found" errors in CSV | Ensure BILLKEY format matches database exactly (with/without prefixes) |
| Timeout errors | Check database is accessible, connection pool size |
| Silent failures (success but no update) | Check server logs for "CSV Payment Update" messages and errors |
| Permission denied on `bills` table | Verify `POSTGRES_USER` has UPDATE grant on `bills` table |

### Grant Permissions (if needed)
```sql
GRANT SELECT, UPDATE ON bills TO <POSTGRES_USER>;
GRANT SELECT, UPDATE ON individual_customers TO <POSTGRES_USER>;
GRANT SELECT, UPDATE ON bulk_meters TO <POSTGRES_USER>;
GRANT SELECT, INSERT ON payments TO <POSTGRES_USER>;
```

## Deployment Steps

1. **Build locally first**:
   ```bash
   npm run build
   ```

2. **Commit and push changes**:
   ```bash
   git add src/lib/db-queries.ts src/lib/actions.ts
   git commit -m "Fix CSV Payment Update: two-step fallback strategy with enhanced logging"
   git push origin main
   ```

3. **Deploy** (using your deployment method - Vercel, Docker, etc.)

4. **Monitor logs immediately after deployment**

5. **Test CSV upload with small batch first** (5-10 rows)

## Success Indicators
- ✅ CSV shows success message
- ✅ Database records are actually updated
- ✅ Server logs show "CSV Payment Update Started" and "Completed" 
- ✅ No errors in related tables sync operations
- ✅ Payment status visible in UI after refresh

---

**Last Updated**: 2026-07-24  
**Status**: Changes ready for deployment
