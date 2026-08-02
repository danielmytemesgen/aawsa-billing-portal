# AAWSA Billing Portal - Comprehensive Roles & Permissions Architecture

**Document Date:** 2026-07-06  
**Project:** AAWSA Billing Portal (Next.js)  
**Purpose:** Complete analysis of roles and permissions system

---

## 1. ROLES DEFINED

### Database Roles (seeded in migrations)

The system defines 5 roles with a clear hierarchy:

| Role | Description | Scope | Primary Use Case |
|------|-------------|-------|------------------|
| **Admin** | Full system access, all permissions | Global | System administration |
| **Head Office Management** | View all data, limited write operations | Global | Executive oversight, approvals |
| **Staff Management** | Full branch-level control | Branch | Branch managers |
| **Staff** | Data entry and basic operations | Branch | Regular staff members |
| **Reader** | View assigned routes only | Route-specific | Mobile meter readers |

**Location:** [database/migrations/002_rbac_setup.sql](database/migrations/002_rbac_setup.sql)

**Seeding Function:** `seed_roles()` - Creates roles in the `roles` table

---

## 2. PERMISSION SYSTEM

### 2.1 Permission Structure

**Database Tables:**
- `roles` - Stores role definitions
- `permissions` - Stores permission definitions with categories
- `role_permissions` - Join table linking roles to permissions
- `staff_members.role_id` - Foreign key assigning roles to staff

### 2.2 Permission Categories (100+ permissions)

Permissions are organized by feature category:

| Category | Key Permissions | Sample Count |
|----------|-----------------|--------------|
| **Dashboard** | dashboard_view_all, dashboard_view_branch | 2 |
| **Customers** | customers_view_all, customers_create, customers_approve, customers_view_branch | 6 |
| **Bulk Meters** | bulk_meters_view_all, bulk_meters_create, bulk_meters_approve | 6 |
| **Staff Management** | staff_view, staff_create, staff_update, staff_delete, staff_view_branch | 5 |
| **Branches** | branches_view, branches_create, branches_update, branches_delete | 4 |
| **Billing** | bill:view_drafts, bill:create, bill:approve, bill:post, bill:manage_all, bill:view_branch | 12+ |
| **Meter Readings** | meter_readings_view_all, meter_readings_create, meter_readings_view_branch | 4 |
| **Reports** | reports_generate_all, reports_generate_branch | 2 |
| **Notifications** | notifications_view, notifications_create | 2 |
| **Tariffs** | tariffs_view, tariffs_manage | 2 |
| **Routes** | routes_view_all, routes_view_assigned | 2 |
| **Data Entry** | data_entry_access | 1 |
| **Settings** | settings_view, settings_manage | 2 |
| **Knowledge Base** | knowledge_base_view, knowledge_base_manage | 2 |
| **Payments** | payments_view, payments_create, payments_delete | 3 |

**Location:** [src/lib/constants/auth.ts](src/lib/constants/auth.ts)

```typescript
export const PERMISSIONS = {
    DASHBOARD_VIEW_ALL: 'dashboard_view_all',
    DASHBOARD_VIEW_BRANCH: 'dashboard_view_branch',
    // ... 100+ more permissions
} as const;
```

### 2.3 Permission Assignment by Role

**Admin Role:**
- All permissions (unrestricted access)

**Head Office Management:**
- `dashboard_view_all` (view aggregated data from all branches)
- `branches_view`, `staff_view`, `customers_view_all`, `bulk_meters_view_all`
- `reports_generate_all`, `notifications_view`, `notifications_create`
- Bill workflow: view_drafts, approve, rework, post, view_paid, view_awaiting_payment, view_overdue
- Read-only access to most features

**Staff Management:**
- `dashboard_view_branch` (their assigned branch only)
- Full CRUD on: staff, customers, bulk_meters
- Data entry and reporting for their branch
- Bill workflow: create, update, submit, approve, rework, post
- `notifications_view`, `notifications_create`

**Staff:**
- `dashboard_view_branch` (their branch)
- Limited customer/meter view: customers_view_branch, bulk_meters_view_branch
- Data entry: meter_readings_create, data_entry_access
- Bill operations: view_drafts, create, update, submit, rework (no approval)
- `notifications_view`

**Reader:**
- `dashboard_view_branch`
- `routes_view_assigned` (only routes assigned to this reader)
- Can be filtered by reader_id in customer/meter queries

**Location:** [database/migrations/022_add_granular_permissions.sql](database/migrations/022_add_granular_permissions.sql)

---

## 3. PERMISSION CHECKING IMPLEMENTATION

### 3.1 Session & Permission Loading

**Login Flow:**

1. **User submits login form** → `loginAction()` in [src/lib/auth-actions.ts](src/lib/auth-actions.ts)
2. **Query for user** → `getStaffMemberForAuth()` in [src/lib/db-queries.ts](src/lib/db-queries.ts#L53)
   ```sql
   SELECT sm.*, r.role_name, STRING_AGG(p.name, ',') AS permissions
   FROM staff_members sm
   LEFT JOIN roles r ON sm.role_id = r.id
   LEFT JOIN role_permissions rp ON r.id = rp.role_id
   LEFT JOIN permissions p ON rp.permission_id = p.id
   WHERE LOWER(TRIM(sm.email)) = LOWER(TRIM($1))
   GROUP BY sm.id, r.role_name
   ```
3. **Create session** with permissions array
4. **Encrypt & store** in HTTP-only cookie (2-hour expiration)
5. **Cache for offline** in IndexedDB via `saveSessionToken()`

**Permission Refresh:**

- Manual refresh via `getLatestPermissionsAction()` in [src/lib/actions.ts](src/lib/actions.ts#L2698)
- Calls `dbGetStaffPermissions()` to fetch latest from database
- Triggered by:
  - Manual refresh button click
  - Window event: `'user-permissions-updated'`
  - Component mount in admin/staff layouts

### 3.2 Middleware-Level Protection

**File:** [src/middleware.ts](src/middleware.ts)

**Route Protection Patterns:**

```
Protected Routes: /admin/*, /staff/*
├── Auth Required (all)
├── Admin Routes: /admin/dashboard
│   └── Requires: DASHBOARD_VIEW_ALL permission
├── Role-Based Route Checks:
│   ├── /admin/roles-and-permissions → PERMISSIONS.ROLES_VIEW
│   ├── /admin/security-logs → PERMISSIONS.SETTINGS_MANAGE
│   ├── /admin/settings → PERMISSIONS.SETTINGS_VIEW
│   ├── /admin/tariffs → PERMISSIONS.TARIFFS_VIEW
│   ├── /admin/reports → REPORTS_GENERATE_ALL || REPORTS_GENERATE_BRANCH
│   ├── /admin/staff-management → PERMISSIONS.STAFF_VIEW
│   ├── /admin/individual-customers → CUSTOMERS_VIEW_ALL || CUSTOMERS_VIEW_BRANCH
│   ├── /admin/bulk-meters → BULK_METERS_VIEW_ALL || BULK_METERS_VIEW_BRANCH
│   ├── /admin/bill-management → Multiple bill permissions
│   ├── /admin/meter-readings → METER_READINGS_VIEW_* || CREATE
│   ├── /admin/data-entry → PERMISSIONS.DATA_ENTRY_ACCESS
│   └── ... (similar for /staff routes)
```

**Security Features:**
- Redirects to dashboard if permission denied
- Sets security headers (CSP, HSTS, X-Frame-Options, etc.)
- Exempts static assets (/public/, /_next/, /api/)

### 3.3 Server Action Permission Checks

**File:** [src/lib/actions.ts](src/lib/actions.ts)

**Core Function:** `checkPermission(permission?: string)`

```typescript
export async function checkPermission(permission?: string) {
  const session = await getSession();
  if (!session || !session.id) {
    throw new Error('User not authenticated');
  }

  // Refresh permissions from DB to avoid staleness
  const perms = await dbGetStaffPermissions(session.id);
  
  // Bypass for bill:manage_all on bill operations
  if (permission && perms.includes('bill:manage_all') && permission.startsWith('bill:')) {
    return { ...session, permissions: perms };
  }

  if (permission && !perms.includes(permission)) {
    throw new Error(`Forbidden: Missing permission ${permission}`);
  }

  return { ...session, permissions: perms };
}
```

**Usage Pattern:**

All ~100 server actions follow this pattern:

```typescript
export async function createCustomerAction(customer: IndividualCustomerInsert) {
  return await wrap(async () => {
    const session = await checkPermission(PERMISSIONS.CUSTOMERS_CREATE);
    // ... perform operation
  });
}
```

**Branch Isolation:**

Function: `getEffectiveBranchId(session, optionsBranchId, permissionViewAll)`

Enforces strict branch isolation:
- Users with `*_view_all` permission can view any branch
- Users assigned to a branch are locked to that branch
- Staff members get reader_id filter if they don't have view_all permissions

### 3.4 Client-Side Permission Checks

**Hook:** [src/hooks/use-permissions.ts](src/hooks/use-permissions.ts)

```typescript
export interface PermissionsContextType {
  permissions: Set<string>;
  hasPermission: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    return {
      permissions: new Set<string>(),
      hasPermission: () => false,
      refreshPermissions: async () => { }
    };
  }
  return context;
}
```

**Providers:**
- [src/app/(dashboard)/admin/admin-layout-client.tsx](src/app/(dashboard)/admin/admin-layout-client.tsx#L167) - Admin routes
- [src/app/(dashboard)/staff/layout.tsx](src/app/(dashboard)/staff/layout.tsx#L192) - Staff routes

**Usage:**

```typescript
const { hasPermission } = usePermissions();

if (hasPermission(PERMISSIONS.STAFF_VIEW)) {
  // Show staff management link
}
```

### 3.5 Sidebar Navigation Permission-Based

**Location:** [src/app/(dashboard)/admin/admin-layout-client.tsx#L24](src/app/(dashboard)/admin/admin-layout-client.tsx#L24)

Function: `buildSidebarNavItems(user)`

Dynamically builds sidebar based on user permissions:
- Shows/hides menu items based on permission checks
- Different default dashboard URLs per role
- Customizes navigation per role (Reader, Staff, Staff Management, Head Office, Admin)

---

## 4. CUSTOMER PORTAL ACCESS CONTROL

**File:** [src/lib/actions.ts#L282](src/lib/actions.ts#L282)

**Function:** `assertCustomerAccess(customerKeyNumber, customerSessionId, type)`

Implements dual-access pattern:

```
Customer Resource Access = Staff Session OR Customer Session
├── Staff Path
│   └── Check: CUSTOMERS_VIEW_ALL or CUSTOMERS_VIEW_BRANCH or bill:manage_all
├── Customer Path
│   └── Check: Valid customer_sessions entry with matching customer_key_number
└── Both validated, no unauthorized access possible
```

**Customer Sessions:**
- Temporary sessions created in customer portal login
- Encrypted session tokens stored in IndexedDB
- Can be revoked
- Limited scope to that specific customer's data

---

## 5. PROTECTED ROUTES & COMPONENTS

### 5.1 Route Protection Hierarchy

```
/ (public login/home)
├── /admin/** (admin dashboard & management)
│   ├── Middleware: Require DASHBOARD_VIEW_ALL or throw to /staff/dashboard
│   ├── Routes protected individually by permission
│   └── All protected components within
│
├── /staff/** (staff dashboard & operations)
│   ├── Middleware: Require valid staff session
│   ├── Routes protected individually by permission
│   └── All protected components within
│
├── /customer/** (customer portal - public portal)
│   ├── Requires customer session OR staff session
│   ├── assertCustomerAccess() checks on data access
│   └── No middleware restriction, enforced at action layer
│
└── /api/** (API endpoints)
    ├── No middleware protection (exempted)
    ├── Individual route protection via checkPermission()
    └── Example: /api/upload/pdf requires BILL_VIEW_ALL
```

### 5.2 Component-Level Checks

**Sidebar Navigation:** Uses `hasPermission()` to show/hide menu items
**Page Components:** Redirect to dashboard if permission denied
**Form Components:** Disable/hide actions based on permissions
**Bill Management:** Complex multi-permission checks for workflow states

---

## 6. DATABASE QUERY ENFORCEMENT

### 6.1 Staff Permissions Query

**File:** [src/lib/db-queries.ts#L102](src/lib/db-queries.ts#L102)

```typescript
export const dbGetStaffPermissions = async (staffId: string) => {
  const sql = `
    SELECT STRING_AGG(p.name, ',') AS permissions
    FROM staff_members sm
    JOIN roles r ON sm.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE sm.id = $1
  `;
  const rows = await query(sql, [staffId]);
  if (rows && rows[0] && rows[0].permissions) {
    return rows[0].permissions.split(',');
  }
  return [];
};
```

### 6.2 Branch Isolation Implementation

**Multiple patterns used:**

1. **Query-level filtering:**
   ```typescript
   // In dbGetAllCustomers
   if (options?.branchId) {
     sql += ` AND ic.branch_id = $${paramIndex++}`;
   }
   ```

2. **Function-level enforcement:**
   ```typescript
   const branchId = getEffectiveBranchId(
     session, 
     options?.branchId, 
     PERMISSIONS.CUSTOMERS_VIEW_ALL
   );
   ```

3. **Permission-level bypass:**
   ```typescript
   if (perms.includes('bill:manage_all')) {
     return; // Can access all bills
   }
   ```

### 6.3 Soft Delete & Archive Support

Queries consistently check `WHERE deleted_at IS NULL` to respect soft deletes, which interacts with permission system:
- Delete operations log to security_logs
- Deleted records stored in recycle_bin (only admins can restore)
- Requires appropriate delete permission + settings_manage for restore

---

## 7. PERMISSION ENFORCEMENT IN ACTIONS

### 7.1 Action Permission Check Patterns

**Pattern 1: Simple Permission Check**
```typescript
export async function getTariffAction() {
  return await wrap(async () => {
    await checkPermission(PERMISSIONS.TARIFFS_VIEW);
    return await dbGetAllTariffs();
  });
}
```

**Pattern 2: Conditional Permission Based on Role**
```typescript
export async function createCustomerAction(customer: IndividualCustomerInsert) {
  const session = await checkPermission(PERMISSIONS.CUSTOMERS_CREATE);
  
  if (session.permissions?.includes(PERMISSIONS.CUSTOMERS_CREATE_RESTRICTED)) {
    customer.branch_id = session.branchId;
    customer.status = 'Pending Approval';
  }
  // ... create customer
}
```

**Pattern 3: Multiple Permission Options**
```typescript
export async function getBillsByMonthAction(monthYear: string) {
  const perms = session.permissions || [];
  if (!perms.includes(PERMISSIONS.REPORTS_GENERATE_ALL) && 
      !perms.includes(PERMISSIONS.REPORTS_GENERATE_BRANCH) && 
      !perms.includes(PERMISSIONS.METER_READINGS_ANALYTICS_VIEW)) {
    throw new Error('Forbidden: Missing reports view permissions');
  }
}
```

### 7.2 Comprehensive Action Coverage

**Actions with explicit permission checks:** ~70 actions
**Actions with role/branch checks:** ~30 actions
**Total protected actions:** ~100

---

## 8. API ROUTES PROTECTION

### 8.1 Protected API Routes

**File:** [src/app/api/upload/pdf/route.ts](src/app/api/upload/pdf/route.ts)

```typescript
export async function POST(request: NextRequest) {
  try {
    const session = await checkPermission(PERMISSIONS.BILL_VIEW_ALL);
    if (!session || !session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // ... upload file
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Other Protected Routes:**
- `/api/billing/job-status` - Requires auth
- `/api/billing/process-job` - Requires auth
- `/api/device/register` - Requires auth
- `/api/device/revoke` - Requires auth
- `/api/upload/*` - Requires auth + specific permissions

**Note:** API routes are **not** protected by middleware (excluded in middleware.ts), but each route must implement its own permission checks.

---

## 9. IDENTIFIED ISSUES & GAPS

### 9.1 Potential Security Issues

**Issue 1: Inconsistent Permission Refresh**
- **Severity:** Medium
- **Description:** Permissions are fetched during login and cached in the session cookie (2-hour expiration). If an admin changes a user's permissions, the user won't see the changes until the session expires or they manually refresh.
- **Location:** [src/app/(dashboard)/admin/admin-layout-client.tsx#L115](src/app/(dashboard)/admin/admin-layout-client.tsx#L115)
- **Affected:** Admin layout provider, staff layout provider
- **Mitigation:** Manual refresh button exists, but no automatic refresh mechanism
- **Recommendation:** Implement WebSocket/polling to sync permission changes in real-time

**Issue 2: API Routes Not Protected by Middleware**
- **Severity:** Medium
- **Description:** API routes are explicitly exempted from middleware (`/api/` prefix), requiring each route to implement permission checks manually
- **Location:** [src/middleware.ts#L54](src/middleware.ts#L54)
- **Risk:** Easy to forget permission checks on new API endpoints
- **Recommendation:** Create a wrapper function for all API routes that enforces authentication/permission checks

**Issue 3: Customer Sessions Unlimited Duration**
- **Severity:** Low
- **Description:** Customer portal sessions don't appear to have expiration in the current implementation
- **Location:** [src/lib/actions.ts#L2460+](src/lib/actions.ts)
- **Risk:** Stale sessions could be replayed
- **Recommendation:** Add session expiration logic to `dbGetCustomerSession()`

**Issue 4: Permission Naming Inconsistencies**
- **Severity:** Low
- **Description:** Some permissions use different names:
  - Constant: `ROLES_MANAGE` = `'settings_manage'` (not `'roles_manage'`)
  - Some billing permissions use colon prefix: `'bill:manage_all'`
  - Others don't: `'tariffs_manage'`
- **Location:** [src/lib/constants/auth.ts](src/lib/constants/auth.ts)
- **Risk:** Confusion, potential typos in permission checks
- **Recommendation:** Standardize naming convention across all permissions

**Issue 5: Branch Isolation in Individual Customer Access**
- **Severity:** Low
- **Description:** `getCustomerByIdAction()` calls `checkPermission()` without a specific permission, then manually checks for view permissions. This is inconsistent with other patterns.
- **Location:** [src/lib/actions.ts#L509](src/lib/actions.ts#L509)
- **Recommendation:** Use explicit permission check like other actions

### 9.2 Implementation Gaps

**Gap 1: Missing Permission Checks on Some Read Operations**
- `getBillWorkflowLogsAction()` - May not check permission
- Some summary/count actions - May have incomplete checks

**Gap 2: No Centralized Permission Audit Log**
- Security events are logged, but no dedicated permission denial log
- **Location:** `logSecurityEventAction()` exists but not called for permission checks
- **Recommendation:** Log all permission denial attempts

**Gap 3: No Permission Change Audit Trail**
- When role permissions are updated, should log what changed
- **Location:** `rpcUpdateRolePermissionsAction()` does log, but only high-level

**Gap 4: Restricted Creation Permissions Inconsistently Applied**
- Only implemented for: customers, bulk_meters
- Not for: branches, staff, tariffs, routes, etc.
- **Recommendation:** Extend pattern to all creatable entities if needed

---

## 10. WORKING EXAMPLES

### 10.1 Complete Permission Flow Example

**Scenario:** Create a new customer as a Staff member

1. **Frontend Form Submit** (customer-form.tsx)
   ```typescript
   const { hasPermission } = usePermissions();
   if (!hasPermission(PERMISSIONS.CUSTOMERS_CREATE)) {
     return <div>Unauthorized</div>; // Disabled at UI level
   }
   ```

2. **Submit Action** (calls server action)
   ```typescript
   const result = await createCustomerAction(formData);
   ```

3. **Server Action Check** (src/lib/actions.ts)
   ```typescript
   const session = await checkPermission(PERMISSIONS.CUSTOMERS_CREATE);
   ```

4. **Permission Fetch** (src/lib/db-queries.ts)
   ```typescript
   // Query joins: staff_members → roles → role_permissions → permissions
   // Gets permission: 'customers_create' or 'customers_create_restricted'
   ```

5. **Conditional Logic** (src/lib/actions.ts)
   ```typescript
   if (session.permissions?.includes(PERMISSIONS.CUSTOMERS_CREATE_RESTRICTED)) {
     customer.branch_id = session.branchId; // Lock to user's branch
     customer.status = 'Pending Approval'; // Requires approval
   }
   ```

6. **Database Insert** (src/lib/db-queries.ts)
   ```sql
   INSERT INTO individual_customers (...)
   VALUES (...) 
   RETURNING *
   ```

7. **Security Log** (src/lib/actions.ts)
   ```typescript
   await logSecurityEventAction({
     event: 'Create Customer',
     customerKeyNumber: result?.customerKeyNumber,
     details: { customer }
   });
   ```

---

## 11. PERMISSION MATRIX BY ROLE

| Permission | Admin | Head Office | Staff Mgmt | Staff | Reader |
|-----------|-------|------------|-----------|-------|--------|
| dashboard_view_all | ✓ | ✓ | - | - | - |
| dashboard_view_branch | ✓ | - | ✓ | ✓ | ✓ |
| branches_view | ✓ | ✓ | - | - | - |
| staff_view | ✓ | ✓ | ✓ | - | - |
| customers_view_all | ✓ | ✓ | - | - | - |
| customers_view_branch | ✓ | - | ✓ | ✓ | - |
| customers_create | ✓ | - | ✓ | ✓ | - |
| customers_create_restricted | - | - | ✓ | ✓ | - |
| bulk_meters_view_all | ✓ | ✓ | - | - | - |
| bulk_meters_view_branch | ✓ | - | ✓ | ✓ | - |
| data_entry_access | ✓ | - | ✓ | ✓ | - |
| meter_readings_view_all | ✓ | ✓ | - | - | - |
| meter_readings_view_branch | ✓ | - | ✓ | ✓ | - |
| meter_readings_create | ✓ | - | ✓ | ✓ | - |
| reports_generate_all | ✓ | ✓ | - | - | - |
| reports_generate_branch | ✓ | - | ✓ | ✓ | ✓* |
| bill:view_drafts | ✓ | ✓ | ✓ | ✓ | - |
| bill:create | ✓ | - | ✓ | ✓ | - |
| bill:approve | ✓ | ✓ | ✓ | - | - |
| bill:post | ✓ | ✓ | ✓ | - | - |
| bill:manage_all | ✓ | - | - | - | - |
| routes_view_assigned | ✓ | - | - | - | ✓ |
| notifications_view | ✓ | ✓ | ✓ | ✓ | - |
| notifications_create | ✓ | ✓ | ✓ | - | - |
| tariffs_view | ✓ | ✓ | - | - | - |
| tariffs_manage | ✓ | - | - | - | - |
| settings_view | ✓ | - | - | - | - |
| settings_manage | ✓ | - | - | - | - |
| permissions_view | ✓ | - | - | - | - |
| permissions_manage | ✓ | - | - | - | - |
| knowledge_base_view | ✓ | - | - | - | - |
| knowledge_base_manage | ✓ | - | - | - | - |

**Legend:** ✓ = Has permission, ✓* = Limited context, - = No permission

---

## 12. KEY FILES REFERENCE

### Database/Schema
- [database/migrations/002_rbac_setup.sql](database/migrations/002_rbac_setup.sql) - Initial RBAC setup
- [database/migrations/022_add_granular_permissions.sql](database/migrations/022_add_granular_permissions.sql) - Granular permission enhancements
- [database/migrations/006_grant_staff_management_approval_permission.sql](database/migrations/006_grant_staff_management_approval_permission.sql)
- [database/migrations/010_add_notification_permissions.sql](database/migrations/010_add_notification_permissions.sql)
- [database/migrations/015_add_missing_bill_permissions.sql](database/migrations/015_add_missing_bill_permissions.sql)
- [database/migrations/023_add_missing_bill_action_permissions.sql](database/migrations/023_add_missing_bill_action_permissions.sql)
- [database/migrations/025_add_tariffs_create_permission.sql](database/migrations/025_add_tariffs_create_permission.sql)
- [database/migrations/028_reading_analytics_permission.sql](database/migrations/028_reading_analytics_permission.sql)
- [database/migrations/031_add_staff_view_all_permission.sql](database/migrations/031_add_staff_view_all_permission.sql)
- [database/migrations/033_add_route_permissions.sql](database/migrations/033_add_route_permissions.sql)

### Type Definitions
- [src/lib/action-types.ts](src/lib/action-types.ts) - RoleRow, PermissionRow, RolePermissionRow types
- [src/lib/schema.ts](src/lib/schema.ts) - Drizzle ORM schema definitions

### Constants
- [src/lib/constants/auth.ts](src/lib/constants/auth.ts) - PERMISSIONS object (100+ permissions)

### Authentication & Authorization
- [src/lib/auth.ts](src/lib/auth.ts) - Session management utilities
- [src/lib/auth-actions.ts](src/lib/auth-actions.ts) - loginAction, logoutAction
- [src/middleware.ts](src/middleware.ts) - Route-level protection middleware
- [src/lib/session.ts](src/lib/session.ts) - Session encryption/decryption

### Server Actions
- [src/lib/actions.ts](src/lib/actions.ts) - Core server actions (100+ functions with permission checks)
  - `checkPermission()` - Main permission check function
  - `assertCustomerAccess()` - Customer portal access control
  - `getLatestPermissionsAction()` - Refresh permissions
  - ~100 other protected actions

### Database Queries
- [src/lib/db-queries.ts](src/lib/db-queries.ts)
  - `getStaffMemberForAuth()` - Load user with permissions during login
  - `dbGetStaffPermissions()` - Fetch current user permissions
  - `dbGetAllPermissions()` - Admin permission management
  - `dbRpcUpdateRolePermissions()` - Role permission assignment

### Client Components
- [src/hooks/use-permissions.ts](src/hooks/use-permissions.ts) - usePermissions hook
- [src/app/(dashboard)/admin/admin-layout-client.tsx](src/app/(dashboard)/admin/admin-layout-client.tsx) - Admin layout with permission context
- [src/app/(dashboard)/staff/layout.tsx](src/app/(dashboard)/staff/layout.tsx) - Staff layout with permission context

### UI Components Using Permissions
- [src/components/layout/sidebar-nav.tsx](src/components/layout/sidebar-nav.tsx) - Permission-based navigation
- [src/components/billing/BillManagementContent.tsx](src/components/billing/BillManagementContent.tsx) - Bill workflow permissions
- [src/components/layout/notification-bell.tsx](src/components/layout/notification-bell.tsx) - Notification permissions
- [src/features/billing/components/BillManagementContent.tsx](src/features/billing/components/BillManagementContent.tsx)

### API Routes
- [src/app/api/upload/pdf/route.ts](src/app/api/upload/pdf/route.ts) - PDF upload with permission check
- [src/app/api/billing/job-status/route.ts](src/app/api/billing/job-status/route.ts)
- [src/app/api/billing/process-job/route.ts](src/app/api/billing/process-job/route.ts)

---

## 13. SECURITY RECOMMENDATIONS

1. **Implement Real-Time Permission Sync**
   - Add WebSocket or polling mechanism to sync permission changes
   - Notify users when their permissions change
   - Force session refresh on significant permission changes

2. **API Route Protection Wrapper**
   - Create a generic wrapper for API routes to enforce authentication/permission checks
   - Standardize error responses across all API routes
   - Add rate limiting for sensitive operations

3. **Permission Audit Trail**
   - Log all permission checks that fail
   - Log all permission modifications with before/after state
   - Create admin dashboard showing permission activity

4. **Centralized Permission Validator**
   - Create a utility function to validate all permission constants against database
   - Run validation on application startup
   - Detect orphaned permissions or roles

5. **Implement Permission Caching Strategy**
   - Consider caching permissions with a shorter TTL than session
   - Only refresh when explicitly requested or session expires
   - Add cache invalidation hooks for permission changes

6. **Document Permission Requirements**
   - Create a matrix of feature → required permissions
   - Maintain permission documentation in version control
   - Review permissions during code review for new features

7. **Test Permission Enforcement**
   - Add automated tests for each permission check
   - Test role-based access control for all sensitive operations
   - Test permission denial scenarios

---

## 14. CONCLUSION

The AAWSA Billing Portal implements a **comprehensive, multi-layered permission system** with:
- ✓ Clear role hierarchy (5 roles)
- ✓ Granular permission control (100+ permissions)
- ✓ Three layers of enforcement (middleware, server actions, database)
- ✓ Branch-level isolation for multi-branch operations
- ✓ Customer portal dual-access pattern
- ✓ Security logging and audit trails

**However, some areas need attention:**
- Permission refresh timing and synchronization
- Consistent API route protection wrapper
- Customer session expiration
- Permission naming standardization

The system is **fundamentally sound** with good separation of concerns, but would benefit from the recommended enhancements for production hardening.
