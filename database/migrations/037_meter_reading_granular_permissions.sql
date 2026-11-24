-- Migration 037: Comprehensive Meter Readings Management RBAC Permissions
-- Defines and maps all granular permissions for Meter Readings Management:
--   - Navigation Tabs: Individual Readings, Bulk Readings, Analytics, Analytics Report, Corrections
--   - Action Controls: Add Reading (Manual, CSV Uploads), Shift Month, Export (CSV/DAT), Offline Metrics
--   - Period Toggle: Period Control (Open/Close schedule) vs Period View (Read-Only)
--   - Row Actions: Correct Reading, View Details

-- ============================================================================
-- STEP 1: Upsert all Meter Readings permissions into permissions table
-- ============================================================================
INSERT INTO permissions (name, description, category)
VALUES
  -- Base & Tab Visibility
  ('meter_readings_view_all',          'View all meter readings across all branches (system-wide)',                  'Meter Readings'),
  ('meter_readings_view_branch',       'View meter readings restricted to assigned branch only',                     'Meter Readings'),
  ('meter_readings_view_individual',   'View Individual Customer Readings tab and records',                          'Meter Readings'),
  ('meter_readings_view_bulk',         'View Bulk Meter Readings tab and records',                                   'Meter Readings'),
  ('meter_readings_analytics_view',    'Access Reading Analytics and Reading Analytics Report tabs and buttons',     'Meter Readings'),
  ('meter_readings_corrections_view',  'View Reading Corrections audit tab and inspection certificates',             'Meter Readings'),

  -- Data Entry & Upload Actions
  ('meter_readings_create',            'Create and record new meter readings (general permission)',                  'Meter Readings'),
  ('meter_readings_create_individual', 'Record new individual meter readings',                                       'Meter Readings'),
  ('meter_readings_create_bulk',       'Record new bulk meter readings',                                             'Meter Readings'),
  ('meter_readings_add_manual',        'Manually enter single meter readings via web dialog',                        'Meter Readings'),
  ('meter_readings_upload_individual', 'Upload individual meter readings via CSV batch file',                        'Meter Readings'),
  ('meter_readings_upload_bulk',       'Upload bulk meter readings via CSV batch file',                              'Meter Readings'),

  -- Management & Period Controls
  ('meter_readings_update',            'Update and adjust existing meter readings',                                  'Meter Readings'),
  ('meter_readings_delete',            'Delete or void meter reading records',                                       'Meter Readings'),
  ('meter_readings_correct',           'Initiate and submit verified meter reading corrections with audit trail',    'Meter Readings'),
  ('meter_readings_shift_month',       'Reassign and shift meter readings across billing cycle months',              'Meter Readings'),
  ('meter_readings_period_control',    'Open, close, and configure auto-recurring monthly reading period schedule',  'Meter Readings'),
  ('meter_readings_period_view',       'View reading period schedule and active cycle status in read-only mode',     'Meter Readings'),

  -- Export & Field Operations
  ('meter_readings_export',            'Export meter readings to CSV and .DAT files',                                'Meter Readings'),
  ('meter_readings_offline_metrics',   'View offline reader sync telemetry and route monitoring metrics',            'Meter Readings'),
  ('meter_readings_edit_recalculate',  'Edit reading values with automatic bill recalculation trigger',              'Meter Readings'),
  ('meter_readings_edit_recalculate_view', 'View reading recalculation logs and historical variances',               'Meter Readings')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    category    = EXCLUDED.category;

-- ============================================================================
-- STEP 2: Grant Full Administrative Permissions to Global Roles
-- (Admin, System Administrator, Staff Admin, Head Office Management)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('admin', 'system administrator', 'staff admin', 'head office management')
  AND p.name IN (
    'meter_readings_view_all',
    'meter_readings_view_individual',
    'meter_readings_view_bulk',
    'meter_readings_analytics_view',
    'meter_readings_corrections_view',
    'meter_readings_create',
    'meter_readings_create_individual',
    'meter_readings_create_bulk',
    'meter_readings_add_manual',
    'meter_readings_upload_individual',
    'meter_readings_upload_bulk',
    'meter_readings_update',
    'meter_readings_delete',
    'meter_readings_correct',
    'meter_readings_shift_month',
    'meter_readings_period_control',
    'meter_readings_period_view',
    'meter_readings_export',
    'meter_readings_offline_metrics',
    'meter_readings_edit_recalculate',
    'meter_readings_edit_recalculate_view'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3: Grant Branch Operational Permissions to Branch Management
-- (Staff Management, Branch Manager, Reader Supervisor)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('staff management', 'branch manager', 'reader supervisor')
  AND p.name IN (
    'meter_readings_view_branch',
    'meter_readings_view_individual',
    'meter_readings_view_bulk',
    'meter_readings_analytics_view',
    'meter_readings_corrections_view',
    'meter_readings_create',
    'meter_readings_create_individual',
    'meter_readings_create_bulk',
    'meter_readings_add_manual',
    'meter_readings_correct',
    'meter_readings_period_view',
    'meter_readings_export',
    'meter_readings_offline_metrics'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 4: Grant Data Entry Roles (Data Encoder / Staff)
-- (Data Encoder, Staff)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('data encoder', 'staff')
  AND p.name IN (
    'meter_readings_view_branch',
    'meter_readings_view_individual',
    'meter_readings_view_bulk',
    'meter_readings_corrections_view',
    'meter_readings_add_manual',
    'meter_readings_upload_individual',
    'meter_readings_upload_bulk',
    'meter_readings_period_view',
    'meter_readings_export'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: Grant Field Reader Roles
-- (Field Reader, Reader, Meter Reader)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(TRIM(r.role_name)) IN ('field reader', 'reader', 'meter reader')
  AND p.name IN (
    'meter_readings_create_individual',
    'meter_readings_create_bulk',
    'meter_readings_add_manual',
    'meter_readings_period_view',
    'meter_readings_offline_metrics'
  )
ON CONFLICT DO NOTHING;
