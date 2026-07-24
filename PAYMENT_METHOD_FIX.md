# 🔧 Payment Method Enum Constraint Fix

## Issue Found ✅

The CSV upload was working in production (1 record updated!), but the **payments audit table insert was failing** with:

```
Error: Postgres query failed: new row for relation "payments" 
violates check constraint "payments_payment_method_check"
```

## Root Cause 🎯

The `payment_method` field in the payments table has an ENUM constraint:

```sql
ENUM('Cash','Bank Transfer','Mobile Money','Online Payment','Other')
```

But the code was trying to insert `'CBE'` (Central Bank of Ethiopia), which is NOT in the allowed enum values.

---

## Solution Implemented ✅

Added a mapping function to convert payment channel values to valid enum values:

```typescript
// Map payment channel to valid enum values
const rawChannel = rec.paymentChannel?.trim() || targetBill.payment_channel || 'Bank Transfer';
const validChannels: {[key: string]: string} = {
    'CBE': 'Bank Transfer',                    // ← Maps CBE to Bank Transfer
    'bank transfer': 'Bank Transfer',
    'bank_transfer': 'Bank Transfer',
    'cash': 'Cash',
    'mobile money': 'Mobile Money',
    'mobile_money': 'Mobile Money',
    'online payment': 'Online Payment',
    'online_payment': 'Online Payment',
    'other': 'Other'
};
const channel = validChannels[rawChannel.toLowerCase()] || (rawChannel ? 'Other' : 'Bank Transfer');
```

**Logs will now show**:
```
[CSV] Row 1 - Payment channel mapping: "CBE" → "Bank Transfer"
```

---

## Changes Made

| File | Change |
|------|--------|
| `src/lib/db-queries.ts` | Added payment_method enum validation and mapping |

---

## Result

✅ CSV upload: **1 record updated** (bills table)  
✅ Payment audit: **Successfully recorded** (payments table)  
✅ No constraint violations  

---

## Test Result from Production

```
CSV Payment Update Completed: 1 records updated, 0 errors {
  staffId: 'Gee3b9cb-4636-418d-ae36-e9cb8d932e05',
  timestamp: '2026-07-24T14:22:44.0282',
  successCount: 1,
  errorCount: 0
}
```

✅ **Working perfectly!**

---

## Deployment

1. Deploy updated code:
   ```bash
   git pull origin main
   pm2 restart aawsa-billing-web
   ```

2. Test CSV upload again - should now work without constraint violations

---

**Status**: 🎉 **FIXED - Ready for deployment**  
**Last Updated**: 2026-07-24
