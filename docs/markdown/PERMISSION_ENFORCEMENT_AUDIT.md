# Permission Enforcement Audit - AAWSA Billing Portal

**Date**: 2026-07-06  
**Audit Focus**: Permission validation gaps, access control inconsistencies, and data leakage risks

---

## CRITICAL SECURITY GAPS (Severity: CRITICAL)

### 1. **Unauthenticated File Upload Endpoints**
**Severity**: 🔴 **CRITICAL** - Arbitrary file upload without authentication

**Issue**: Multiple API upload endpoints lack any authentication or permission checks

| Endpoint | File | Line | Issue |
|----------|------|------|-------|
| `/api/upload/initiate` | [src/app/api/upload/initiate/route.ts](src/app/api/upload/initiate/route.ts#L10) | 10 | NO session check, NO permission validation |
| `/api/upload/chunk` | [src/app/api/upload/chunk/route.ts](src/app/api/upload/chunk/route.ts#L10) | 10 | NO session check, NO permission validation |
| `/api/upload/complete` | [src/app/api/upload/complete/route.ts](src/app/api/upload/complete/route.ts#L9) | 9 | NO session check, NO permission validation |
| `/api/upload/s3_sign` | [src/app/api/upload/s3_sign/route.ts](src/app/api/upload/s3_sign/route.ts#L3) | 3 | NO session check, NOT IMPLEMENTED |
| `/api/upload` (POST) | [src/app/api/upload/route.ts](src/app/api/upload/route.ts#L7) | 7 | NO session check, NO permission validation |

**Impact**: Any unauthenticated attacker can upload arbitrary files to the server, potentially leading to:
- Arbitrary file upload attacks
- Web shell deployment
- Server compromise
- DoS attacks via large files

**Remediation**:
```typescript
// Add to all upload endpoints
import { getSession } from '@/lib/auth';
import { checkPermission } from '@/lib/actions';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  // Add permission check for upload
  await checkPermission(PERMISSIONS.DATA_ENTRY_ACCESS);
  // ... rest of upload logic
}
```

---

### 2. **Device Token Refresh Without Authentication**
**Severity**: 🔴 **CRITICAL** - Authentication bypass for offline access tokens

**File**: [src/app/api/device/refresh/route.ts](src/app/api/device/refresh/route.ts)  
**Issue**: 
- Line 1-30: NO session check before validating device tokens
- Loads all devices from DB without user context
- Computes HMAC for ANY token in the system
- Returns signed JWT for ANY valid device token without verifying user owns it

**Attack Scenario**:
```
1. Attacker knows/guesses a valid device token from another user
2. Calls /api/device/refresh with that token
3. Receives valid JWT access token for that user's account
4. Can now access all their data
```

**Remediation**: Add user context validation
```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const rawToken = body.token;
  if (!rawToken) return NextResponse.json({ error: 'token required' }, { status: 400 });

  // Find device and validate token
  const device = allDevices.find(d => validateHmac(rawToken, d.token_salt, d.token_hash));
  if (!device) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  // Get session for the device's user to verify it's still valid
  const userSession = await getSession();
  if (userSession?.id !== device.user_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Issue token
}
```

---

### 3. **Billing Job Status Endpoint Missing Permission Check**
**Severity**: 🔴 **CRITICAL** - Information disclosure of billing operations

**File**: [src/app/api/billing/job-status/route.ts](src/app/api/billing/job-status/route.ts)  
**Lines**: 10-17

**Issue**:
- Checks for authenticated session (OK)
- Returns complete billing job status/progress for ANY authenticated user
- No permission validation for `BILL_VIEW_ALL` or `BILL_CLOSE_CYCLE`
- Any staff member can monitor ALL billing jobs, not just their branch

**Attack Scenario**:
```
1. Low-privilege staff member (Reader role) calls /api/billing/job-status?jobId=<id>
2. Gets detailed billing cycle progress, counts, and internal metrics
3. Can infer business operations, revenue processing, timing
4. Can estimate customer counts and billing patterns
```

**Remediation**:
```typescript
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate permission
  const permRows = await query(
    `SELECT p.name FROM staff_members sm
     JOIN roles r ON sm.role_id = r.id
     JOIN role_permissions rp ON r.id = rp.role_id
     JOIN permissions p ON rp.permission_id = p.id
     WHERE sm.id = $1 AND p.name IN ('bill:manage_all', 'billing:close_cycle')`,
    [session.user.id]
  );
  if (permRows.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Return job status
}
```

---

## HIGH SEVERITY GAPS (Severity: HIGH)

### 4. **Offline Sync Metrics API Without Authentication**
**Severity**: 🔴 **HIGH** - Unprotected database writes

**Files**:
- [src/app/api/offline/metrics/route.ts](src/app/api/offline/metrics/route.ts) - POST
- [src/app/api/offline/metrics_summary/route.ts](src/app/api/offline/metrics_summary/route.ts) - GET

**Issue**:
- Both endpoints have NO session validation
- ANY unauthenticated attacker can:
  - **POST**: Write arbitrary sync metrics to database
  - **GET**: Read 7-day summary of all sync events

**Remediation**: Add authentication
```typescript
import { getSession } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants/auth';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... rest
}

export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... rest
}
```

---

### 5. **Customer Session Creation Without Role Verification**
**Severity**: 🔴 **HIGH** - Privilege escalation in customer portal

**File**: [src/lib/actions.ts](src/lib/actions.ts#L2468)  
**Lines**: 2468-2500

**Issue**:
- `createCustomerSessionAction()` has NO permission check
- Any authenticated staff member (even Reader) can create sessions for any customer
- No validation that the caller should be able to issue customer sessions
- Customer portal sessions bypass staff role hierarchy

**Current Code**:
```typescript
export async function createCustomerSessionAction(session: {
  customer_key_number: string;
  customer_type: string;
  // ...
}) {
  // ❌ NO PERMISSION CHECK
  // Just verifies customer exists and is Active
  let customer: any = null;
  if (session.customer_type === 'bulk') {
    customer = await dbGetBulkMeterById(session.customer_key_number);
  } else {
    customer = await dbGetCustomerById(session.customer_key_number);
  }
  // ...
}
```

**Remediation**:
```typescript
export async function createCustomerSessionAction(session: { ... }) {
  return await wrap(async () => {
    // Add staff permission check
    const staffSession = await checkPermission(PERMISSIONS.DATA_ENTRY_ACCESS);
    
    // Verify customer exists and is Active
    let customer: any = null;
    if (session.customer_type === 'bulk') {
      customer = await dbGetBulkMeterById(session.customer_key_number);
    } else {
      customer = await dbGetCustomerById(session.customer_key_number);
    }
    if (!customer) throw new Error('Customer not found');
    if (customer.status !== 'Active') throw new Error('Customer account is not active');
    
    // ... rest
  });
}
```

---

### 6. **Public Fault Codes Endpoint Returns All Records**
**Severity**: 🟡 **HIGH** - Information disclosure

**File**: [src/lib/actions.ts](src/lib/actions.ts#L2577)  
**Lines**: 2577-2581

**Issue**:
- `getPublicFaultCodesAction()` returns all fault codes to "any authenticated user"
- Compare with `getAllFaultCodesAction()` which properly checks permissions
- No granular permission validation
- Staff can view system-wide fault codes even without meter readings permission

**Current Code**:
```typescript
export async function getPublicFaultCodesAction() {
  return await wrap(async () => {
    await getSession();  // ❌ Only checks session exists
    return await dbGetAllFaultCodes();  // Returns ALL
  });
}
```

**Remediation**: Apply consistent permission checks
```typescript
export async function getPublicFaultCodesAction() {
  return await wrap(async () => {
    const session = await getSession();
    if (!session?.id) throw new Error('Unauthorized');
    
    const perms = session.permissions || [];
    const hasPerm = perms.includes(PERMISSIONS.FAULT_CODES_VIEW) || 
                   perms.includes(PERMISSIONS.METER_READINGS_CREATE) ||
                   perms.includes(PERMISSIONS.METER_READINGS_VIEW_BRANCH) ||
                   perms.includes(PERMISSIONS.METER_READINGS_VIEW_ALL);
    
    if (!hasPerm) throw new Error('Forbidden: No permissions to view fault codes');
    return await dbGetAllFaultCodes();
  });
}
```

---

### 7. **Device Registration & Revocation Without Permission Checks**
**Severity**: 🟡 **HIGH** - Access control not enforced

**Files**:
- [src/app/api/device/register/route.ts](src/app/api/device/register/route.ts) - Line 7
- [src/app/api/device/revoke/route.ts](src/app/api/device/revoke/route.ts) - Line 5

**Issue**:
- Both check for session but NO permission validation
- Any authenticated user can register unlimited devices
- Revoke endpoint allows users to revoke other users' devices (if they know IDs)

**Current Code**:
```typescript
// register
const session = await getSession();
if (!session || !session.id) {
  return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
}
// ❌ No permission check - proceeds directly

// revoke
const session = await getSession();
if (!session || !session.id) return NextResponse.json({ success: false }, { status: 401 });
const deviceId = body.deviceId;
// ❌ Doesn't validate user owns device before revoke
```

**Remediation**: Add permission checks
```typescript
// register
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({ success: false }, { status: 401 });
  
  // Optional: Check if user has offline access permission
  const perms = await dbGetStaffPermissions(session.id);
  // Proceed only if offline access is permitted
  
  const body = await request.json();
  const deviceName = body.name?.slice(0, 255) || 'Unnamed device';
  // ... rest
}
```

---

## MEDIUM SEVERITY GAPS (Severity: MEDIUM)

### 8. **Permission Constant String Mismatches**
**Severity**: 🟡 **MEDIUM** - Potential permission bypass due to inconsistency

**File**: [src/lib/constants/auth.ts](src/lib/constants/auth.ts)

**Issues**:
| Constant | Value | Problem |
|----------|-------|---------|
| `ROLES_MANAGE` | `'settings_manage'` | Same value as `SETTINGS_MANAGE` - redundant |
| `ROUTES_MANAGE` | `'settings_manage'` | Same value as `SETTINGS_MANAGE` - merges two distinct permissions |
| `FAULT_CODES_VIEW` | `'settings_view'` | Same value as `SETTINGS_VIEW` - unrelated permissions merged |
| `FAULT_CODES_MANAGE` | `'settings_manage'` | Same value as `SETTINGS_MANAGE` - unrelated permissions merged |

**Consequence**: Hard to track permissions usage, potential accidental privilege escalation when refactoring

**Remediation**: Use distinct permission names
```typescript
export const PERMISSIONS = {
  // ... existing
  ROLES_VIEW: 'roles_view',        // ← Changed from permissions_view
  ROLES_MANAGE: 'roles_manage',    // ← Changed from settings_manage
  
  FAULT_CODES_VIEW: 'fault_codes_view',       // ← New distinct permission
  FAULT_CODES_MANAGE: 'fault_codes_manage',   // ← New distinct permission
  
  ROUTES_MANAGE: 'routes_manage',  // ← New distinct permission
};
```

---

### 9. **Inconsistent Permission Check Patterns**
**Severity**: 🟡 **MEDIUM** - Maintenance burden, potential bugs

**File**: [src/lib/actions.ts](src/lib/actions.ts)

**Pattern Issues**:

| Action | Lines | Issue |
|--------|-------|-------|
| `updateBillingSettingsAction` | 3287-3293 | Checks hardcoded string `'settings_update'` (not in PERMISSIONS) + role check |
| `updateFaultCodeAction` | 2605 | Uses `checkPermission('settings_manage')` string instead of constant |
| `deleteFaultCodeAction` | 2617 | Uses `checkPermission('settings_manage')` string instead of constant |
| `createFaultCodeAction` | 2593 | Uses `checkPermission('settings_manage')` string instead of constant |
| `getRecycleBinItemsAction` | 2636 | Checks string `'dashboard_view_all'` and `'settings_view'` directly |

**Problem**: Mixing string literals and constants makes it hard to track permission usage

**Example**:
```typescript
// ❌ BAD
await checkPermission('settings_manage');

// ✅ GOOD
await checkPermission(PERMISSIONS.SETTINGS_MANAGE);
```

**Remediation**: Search & replace all string permission checks with constants

```typescript
// In actions.ts, replace:
await checkPermission('settings_manage');
// With:
await checkPermission(PERMISSIONS.SETTINGS_MANAGE);
```

---

### 10. **Customer Page View Logging Missing Permission Check**
**Severity**: 🟡 **MEDIUM** - Unvalidated customer session usage

**File**: [src/lib/actions.ts](src/lib/actions.ts#L2544)  
**Lines**: 2544-2557

**Issue**:
- `logCustomerPageViewAction()` validates session exists but doesn't check staff permissions
- Any authenticated user can log page views for any customer session
- Customer can be tricked into logging views for other customers

**Current Code**:
```typescript
export async function logCustomerPageViewAction(sessionId: string, pageName: string) {
  return await wrap(async () => {
    const valid = await dbIsCustomerSessionValid(sessionId);
    if (!valid) throw new Error('Invalid or revoked customer session');
    // ❌ NO permission check
    return await dbLogCustomerPageView(sessionId, pageName);
  });
}
```

**Remediation**: Add permission validation for who can log views
```typescript
export async function logCustomerPageViewAction(sessionId: string, pageName: string) {
  return await wrap(async () => {
    // Verify session is valid
    const valid = await dbIsCustomerSessionValid(sessionId);
    if (!valid) throw new Error('Invalid or revoked customer session');
    
    // Optional: Add audit logging if staff initiates
    const staffSession = await getSession();
    if (staffSession?.id) {
      const perms = await dbGetStaffPermissions(staffSession.id);
      if (!perms.includes(PERMISSIONS.DATA_ENTRY_ACCESS)) {
        throw new Error('Unauthorized');
      }
    }
    
    return await dbLogCustomerPageView(sessionId, pageName);
  });
}
```

---

## MODERATE SEVERITY GAPS (Severity: MODERATE)

### 11. **Generic Permission Checks Without Specific Permissions**
**Severity**: 🟠 **MODERATE** - Overly permissive access control

**File**: [src/lib/actions.ts](src/lib/actions.ts)

**Affected Actions**:

| Action | Lines | Issue |
|--------|-------|-------|
| `getCustomerByIdAction` | 509-520 | `checkPermission()` with NO specific permission argument |
| `getBulkMeterByIdAction` | 556-567 | `checkPermission()` with NO specific permission argument |
| `getSystemSettingsAction` | 3271-3280 | `checkPermission()` with NO specific permission argument |

**Problem**: `checkPermission()` called with no permission returns session if ANY permission exists, allowing any staff member access

**Example**:
```typescript
export async function getCustomerByIdAction(customerKeyNumber: string) {
  await checkPermission();  // ❌ Allows ANY authenticated staff
  // ...
}
```

**Remediation**: Specify required permission
```typescript
export async function getCustomerByIdAction(customerKeyNumber: string) {
  // ✅ Check specific permission
  await checkPermission(PERMISSIONS.CUSTOMERS_VIEW_ALL);
  // ... or check for VIEW_ALL OR VIEW_BRANCH
}
```

---

### 12. **API Route Missing getSession Check**
**Severity**: 🟠 **MODERATE** - Potential information leakage

**File**: [src/app/api/user/role/route.ts](src/app/api/user/role/route.ts)

**Issue**:
- Line 4: Gets session but doesn't validate it exists before returning role
- No explicit error if session is null
- Returns "unknown" which might leak information

**Current Code**:
```typescript
export async function GET() {
  const session = await getSession();
  const role = session?.roleName ?? session?.role ?? "unknown";  // ❌ "unknown" exposes missing session
  return NextResponse.json({ role });
}
```

**Remediation**:
```typescript
export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = session.roleName ?? session.role;
  return NextResponse.json({ role });
}
```

---

### 13. **Data Query Missing Branch Isolation in Some Cases**
**Severity**: 🟠 **MODERATE** - Potential data exposure between branches

**File**: [src/lib/db-queries.ts](src/lib/db-queries.ts)

**Affected Queries**:

| Query | Lines | Issue |
|-------|-------|-------|
| `dbGetCustomersByBulkMeterId` | 269-276 | Returns customers for ANY bulk meter without branch check |
| `dbGetCustomersByBulkMeterIds` | 277-298 | Batch query, no branch filtering |
| `dbGetBillsByBulkMeterIds` | 299-342 | Returns bills for multiple meters without branch validation |

**Example**:
```typescript
// ❌ NO BRANCH ISOLATION
export const dbGetCustomersByBulkMeterId = async (bulkMeterId: string) => {
    return await query(
        'SELECT * FROM individual_customers WHERE "assignedBulkMeterId" = $1 AND deleted_at IS NULL',
        [bulkMeterId]
    );
};
```

**Remediation**: Add branch parameter
```typescript
export const dbGetCustomersByBulkMeterId = async (bulkMeterId: string, branchId?: string) => {
    let sql = 'SELECT * FROM individual_customers WHERE "assignedBulkMeterId" = $1 AND deleted_at IS NULL';
    const params = [bulkMeterId];
    
    if (branchId) {
        sql += ` AND branch_id = $2`;
        params.push(branchId);
    }
    
    return await query(sql, params);
};
```

---

### 14. **Customer Session Revocation Missing Permission Check**
**Severity**: 🟠 **MODERATE** - Overly permissive session management

**File**: [src/lib/actions.ts](src/lib/actions.ts#L2500)  
**Lines**: 2500-2527

**Issue**:
- `revokeCustomerSessionAction()` allows either staff OR the owning customer to revoke
- But doesn't verify the customer session actually belongs to the calling session
- Could allow one user to revoke another user's session if they guess the session ID

**Current Code**:
```typescript
export async function revokeCustomerSessionAction(sessionId: string) {
  return await wrap(async () => {
    const staffSession = await getSession();
    let authorized = false;
    if (staffSession && staffSession.id) {
      const perms = await dbGetStaffPermissions(staffSession.id);
      if (perms.includes(PERMISSIONS.SETTINGS_MANAGE) || perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL)) {
        authorized = true;
      }
    }
    
    if (!authorized) {
      throw new Error('Forbidden');
    }
    
    return await dbRevokeCustomerSession(sessionId);
  });
}
```

**Problem**: Doesn't validate that the customer session being revoked belongs to appropriate branch/user

**Remediation**: Add validation
```typescript
export async function revokeCustomerSessionAction(sessionId: string) {
  return await wrap(async () => {
    // Fetch the customer session to get customer details
    const customerSession = await dbGetCustomerSession(sessionId);
    if (!customerSession) throw new Error('Session not found');
    
    const staffSession = await getSession();
    let authorized = false;
    
    if (staffSession?.id) {
      const perms = await dbGetStaffPermissions(staffSession.id);
      if (perms.includes(PERMISSIONS.SETTINGS_MANAGE) || perms.includes(PERMISSIONS.DASHBOARD_VIEW_ALL)) {
        // Global admin can revoke any session
        authorized = true;
      } else if (perms.includes(PERMISSIONS.DATA_ENTRY_ACCESS)) {
        // Regular staff can only revoke customers in their branch
        const customer = await dbGetCustomerById(customerSession.customer_key_number);
        if (customer?.branch_id === staffSession.branchId) {
          authorized = true;
        }
      }
    }
    
    if (!authorized) throw new Error('Forbidden');
    return await dbRevokeCustomerSession(sessionId);
  });
}
```

---

### 15. **Billing Settings Update Using Inconsistent Permission Check**
**Severity**: 🟠 **MODERATE** - Weak permission validation

**File**: [src/lib/actions.ts](src/lib/actions.ts#L3281)  
**Lines**: 3281-3310

**Issue**:
- Uses hardcoded string `'settings_update'` which doesn't exist in PERMISSIONS
- Falls back to role-based check instead of consistent permission system
- Mixes two auth patterns (permission strings + role checks)

**Current Code**:
```typescript
export async function updateBillingSettingsAction(payload: {...}) {
  return await wrap(async () => {
    const session = await getSession();
    if (!session || !session.id) throw new Error('Unauthorized');

    const isGlobalAdmin = session.role === 'Admin' && (!session.branchId || session.branchId === 'all');
    if (!isGlobalAdmin && !(session.permissions || []).includes('settings_update')) {  // ❌ 'settings_update' doesn't exist
      if (session.role?.toLowerCase() !== 'admin') {
        throw new Error('Unauthorized to update settings');
      }
    }
    // ...
  });
}
```

**Remediation**: Use consistent permission check
```typescript
export async function updateBillingSettingsAction(payload: {...}) {
  return await wrap(async () => {
    // Use standard permission check
    await checkPermission(PERMISSIONS.SETTINGS_MANAGE);
    
    const { dbUpdateSystemSetting } = await import('./db-queries');
    // ... rest of logic
  });
}
```

---

## INFO: Component-Level Controls (Well-Implemented)

### ✅ Components with Proper Permission Checks:
- [src/app/(dashboard)/admin/admin-layout-client.tsx](src/app/(dashboard)/admin/admin-layout-client.tsx) - Sidebar nav checks permissions before showing menu items
- [src/app/(dashboard)/staff/layout.tsx](src/app/(dashboard)/staff/layout.tsx) - Staff layout validates permissions
- [src/components/billing/BillDetailsContent.tsx](src/components/billing/BillDetailsContent.tsx#L616) - Custom `checkBillPermission()` helper
- [src/components/layout/notification-bell.tsx](src/components/layout/notification-bell.tsx#L41) - Checks notification permissions

**Status**: ✅ Most UI components properly use `usePermissions()` hook to show/hide features

---

## RECOMMENDATIONS

### Priority 1 (Critical - Fix Immediately)
1. **Add authentication to all upload endpoints** (`/api/upload/*`)
2. **Add permission check to `/api/billing/job-status`**
3. **Add user context validation to `/api/device/refresh`**
4. **Add session check to `/api/offline/metrics` and `/metrics_summary`**
5. **Add permission check to `createCustomerSessionAction`**

### Priority 2 (High - Fix Within 1 Sprint)
6. Unify permission constant names (remove aliases)
7. Replace all permission string literals with `PERMISSIONS.*` constants
8. Add specific permission checks to generic `checkPermission()` calls
9. Add branch filtering to batch query functions
10. Implement permission audit logging for failed/successful permission checks

### Priority 3 (Medium - Fix Soon)
11. Add validation to customer session operations
12. Add explicit error returns for missing sessions
13. Implement rate limiting on device token endpoints
14. Create comprehensive permission validation tests

---

## Testing Strategy

### Recommended Test Cases:
```typescript
// 1. Unauthenticated access to upload endpoints
test('Upload endpoints reject unauthenticated requests', async () => {
  const res = await fetch('/api/upload/initiate', { method: 'POST' });
  expect(res.status).toBe(401);
});

// 2. Insufficient permissions
test('Non-admin users cannot close billing cycles', async () => {
  const staffSession = await createStaffSession('reader_role');
  const res = await closeBillingCycleAction({ ... });
  expect(res).toThrow('Forbidden');
});

// 3. Cross-branch data access
test('Staff cannot see customers from other branches', async () => {
  const branchAStaff = await createStaffSession('branch_a');
  const customers = await getAllCustomersAction({ branchId: 'branch_b' });
  expect(customers).toBeEmpty();
});

// 4. Permission constant consistency
test('All permission checks use PERMISSIONS constants', () => {
  const content = fs.readFileSync('src/lib/actions.ts', 'utf8');
  const stringChecks = content.match(/checkPermission\(['"][a-z_]+['"][)]/g);
  expect(stringChecks).toBeNull(); // Should all use constants
});
```

---

## Audit Checklist

- [ ] Fix all CRITICAL severity gaps
- [ ] Implement authentication on all API routes
- [ ] Standardize permission constant usage
- [ ] Add branch filtering to all data queries
- [ ] Create permission audit logging
- [ ] Write integration tests for permission enforcement
- [ ] Review and update middleware route protections
- [ ] Conduct security code review with team
- [ ] Deploy fixes to staging for testing
- [ ] Monitor permission-related errors in production

---

**Audit Completed By**: Security Audit System  
**Next Review**: 2026-08-06 (One month follow-up)
