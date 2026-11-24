-- Migration 038: Comprehensive Bill Management RBAC Permissions
-- Defines and maps all 18 granular permissions for Bill Management:
--   - Kanban Stages: Drafts, Pending Approval, Ready to Post, Rework, Posted
--   - Table Access: Outstanding Bills Table (Awaiting Payment, Overdue), Paid Bills Table
--   - Workflow Actions: Submit, Approve, Rework, Post/Send, Correct, Delete
--   - Billing Cycle: Close Cycle and Monthly Generation
--   - Row Actions: View Details, Check Correction, Print/Export, Edit Payment, Dispute, Delete

-- ============================================================================
-- STEP 1: Upsert all 18 Bill Management permissions into permissions table
-- ============================================================================
INSERT INTO permissions (name, description, category)
VALUES
  -- 1. Wildcard & Base Branch Scoping
  ('bill:manage_all',             'Full access to all bills across all branches (master billing admin)',       'Bill Management'),
  ('bill:view_branch',            'View bills restricted to assigned branch only',                            'Bill Management'),

  -- 2. Kanban & Status Visibility
  ('bill:view_drafts',            'View draft bills in the assigned branch',                                  'Bill Management'),
  ('bill:view_pending',           'View bills awaiting manager approval',                                     'Bill Management'),
  ('bill:view_approved',          'View approved bills ready for final posting',                              'Bill Management'),
  ('bill:rework',                 'Send bills back for rework and view rework queue',                         'Bill Management'),

  -- 3. Payment & Settlement Table Visibility
  ('bill:view_paid',              'View paid bills history and display the Paid Bills Table',                 'Bill Management'),
  ('bill:view_awaiting_payment',   'View bills awaiting payment in the Outstanding Bills Table',               'Bill Management'),
  ('bill:view_overdue',           'View overdue aging bills in the Outstanding Bills Table',                  'Bill Management'),

  -- 4. Bill Lifecycle & Workflow Actions
  ('bill:create',                 'Create new bills for customers or bulk meters',                            'Bill Management'),
  ('bill:update',                 'Update existing bill readings and edit payment/settlement details',        'Bill Management'),
  ('bill:delete',                 'Delete bill records and perform batch resets',                             'Bill Management'),
  ('bill:submit',                 'Submit draft bills for manager review and approval',                       'Bill Management'),
  ('bill:approve',                'Approve submitted bills and access audit & inspection controls',           'Bill Management'),
  ('bill:post',                   'Post and finalize approved bills into receivable ledgers',                 'Bill Management'),
  ('bill:send',                   'Post and finalize approved bills for dispatch (alias for post)',           'Bill Management'),
  ('bill:correct',                'Initiate and log audited corrections for previously posted bills',         'Bill Management'),

  -- 5. Billing Cycle Control
  ('billing:close_cycle',         'Close active billing cycles and generate recurring monthly bills',         'Bill Management')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    category    = EXCLUDED.category;

-- ============================================================================
-- STEP 2: Grant Full Administrative Permissions to Global Admin Roles
-- (Admin, System Administrator, Staff Admin, Head Office Management)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('admin', 'system administrator', 'staff admin', 'head office management')
  AND p.name IN (
    'bill:manage_all',
    'bill:view_branch',
    'bill:view_drafts',
    'bill:view_pending',
    'bill:view_approved',
    'bill:rework',
    'bill:view_paid',
    'bill:view_awaiting_payment',
    'bill:view_overdue',
    'bill:create',
    'bill:update',
    'bill:delete',
    'bill:submit',
    'bill:approve',
    'bill:post',
    'bill:send',
    'bill:correct',
    'billing:close_cycle'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3: Grant Managerial & Review Permissions to Branch Managers & Approvers
-- (Branch Manager, Approver, Manager, Supervisor)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('branch manager', 'approver', 'manager', 'supervisor')
  AND p.name IN (
    'bill:view_branch',
    'bill:view_pending',
    'bill:view_approved',
    'bill:rework',
    'bill:view_paid',
    'bill:view_awaiting_payment',
    'bill:view_overdue',
    'bill:approve',
    'bill:post',
    'bill:send',
    'bill:correct'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 4: Grant Operational & Preparation Permissions to Billing Officers & Clerks
-- (Billing Officer, Data Encoder, Staff, Clerk)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('billing officer', 'data encoder', 'staff', 'clerk')
  AND p.name IN (
    'bill:view_branch',
    'bill:view_drafts',
    'bill:view_pending',
    'bill:view_awaiting_payment',
    'bill:create',
    'bill:update',
    'bill:submit'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: Grant Cashier & Settlement Permissions
-- (Cashier, Teller, Payment Collector)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('cashier', 'teller', 'payment collector')
  AND p.name IN (
    'bill:view_branch',
    'bill:view_paid',
    'bill:view_awaiting_payment',
    'bill:view_overdue',
    'bill:update'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 6: Grant Auditor & Compliance Permissions
-- (Auditor, Inspector, GL Auditor)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('auditor', 'inspector', 'gl auditor')
  AND p.name IN (
    'bill:view_branch',
    'bill:view_pending',
    'bill:view_approved',
    'bill:view_paid',
    'bill:view_awaiting_payment',
    'bill:view_overdue',
    'bill:correct'
  )
ON CONFLICT DO NOTHING;

