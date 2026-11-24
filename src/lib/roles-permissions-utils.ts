/**
 * Roles & Permissions Domain Utilities & Canonical Category Mappings
 * Provides human-friendly labels, clear descriptions, scope indicators,
 * and intelligent category mapping for all 160+ system permissions.
 */

export type PermissionScope = 'all' | 'branch' | 'master' | 'action';

export interface PermissionMetadata {
  label: string;
  description: string;
  category: string;
  scope: PermissionScope;
}

export const CANONICAL_CATEGORIES = [
  'Dashboard & Overview',
  'Customers & Accounts',
  'Bulk Meters',
  'Meter Readings & Inspection',
  'Bill Management & Payments',
  'Invoices & Statements',
  'Reports & Analytics',
  'Finance & GL Audit',
  'Routes & Field Readers',
  'Field Operations & Data Entry',
  'Staff & Access Management',
  'Branch Management',
  'Customer Support & Help Desk',
  'Notifications & SMS',
  'System Settings & Policies',
] as const;

export type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

/**
 * Mapping legacy / database category strings to canonical category names
 */
export const CANONICAL_CATEGORY_MAP: Record<string, string> = {
  // Dashboard
  'Dashboard': 'Dashboard & Overview',
  'General & Dashboard': 'Dashboard & Overview',
  'General': 'Dashboard & Overview',

  // Customers
  'Individual Customers': 'Customers & Accounts',
  'Customer Management': 'Customers & Accounts',
  'Customers & Accounts': 'Customers & Accounts',

  // Bulk Meters
  'Bulk Meters': 'Bulk Meters',
  'Bulk Meter Management': 'Bulk Meters',

  // Meter Readings
  'Meter Readings': 'Meter Readings & Inspection',
  'Meter Readings & Inspection': 'Meter Readings & Inspection',

  // Billing & Payments
  'Billing': 'Bill Management & Payments',
  'Bill Management': 'Bill Management & Payments',
  'Bill Management & Payments': 'Bill Management & Payments',
  'Credit & Deposit': 'Bill Management & Payments',
  'Payments': 'Bill Management & Payments',

  // Invoices
  'Invoices': 'Invoices & Statements',
  'Invoices & Billing': 'Invoices & Statements',
  'Invoices & Statements': 'Invoices & Statements',

  // Reports
  'Reporting': 'Reports & Analytics',
  'Branch Report': 'Reports & Analytics',
  'Reports & Analytics': 'Reports & Analytics',

  // Finance & GL
  'Finance': 'Finance & GL Audit',
  'Finance & GL Audit': 'Finance & GL Audit',

  // Routes
  'Route Management': 'Routes & Field Readers',
  'Routes & Reader Monitoring': 'Routes & Field Readers',
  'Routes & Field Readers': 'Routes & Field Readers',

  // Field Operations & Data Entry
  'Operations': 'Field Operations & Data Entry',
  'Field Operations': 'Field Operations & Data Entry',
  'Field Operations & Meter Change': 'Field Operations & Data Entry',
  'Field Operations & Data Entry': 'Field Operations & Data Entry',
  'Data Entry': 'Field Operations & Data Entry',
  'Meter Change': 'Field Operations & Data Entry',

  // Staff & Access
  'Staff': 'Staff & Access Management',
  'Staff Management': 'Staff & Access Management',
  'Staff & Access Management': 'Staff & Access Management',
  'Permissions': 'Staff & Access Management',

  // Branches
  'Branches': 'Branch Management',
  'Branch Management': 'Branch Management',

  // Support
  'Customer Support': 'Customer Support & Help Desk',
  'Customer Support & Help Desk': 'Customer Support & Help Desk',
  'Support': 'Customer Support & Help Desk',

  // Notifications
  'Notifications': 'Notifications & SMS',
  'Notifications & SMS': 'Notifications & SMS',

  // Settings
  'Settings': 'System Settings & Policies',
  'System Settings': 'System Settings & Policies',
  'System Settings & Policies': 'System Settings & Policies',
  'Knowledge Base': 'System Settings & Policies',
};

/**
 * Metadata dictionary mapping permission handles to friendly titles,
 * helpful descriptions, canonical category, and operational scope.
 */
export const PERMISSION_METADATA_REGISTRY: Record<string, PermissionMetadata> = {
  // Dashboard & Overview
  'dashboard_view_all': {
    label: 'All-Branches Executive Dashboard',
    description: 'View macro KPIs, system revenue, active meters, and branch comparisons across all city branches.',
    category: 'Dashboard & Overview',
    scope: 'all',
  },
  'dashboard_view_branch': {
    label: 'Assigned Branch Dashboard',
    description: 'View operational KPIs, monthly collections, and active routes restricted to the user’s assigned branch.',
    category: 'Dashboard & Overview',
    scope: 'branch',
  },

  // Customers & Accounts
  'customers_view_all': {
    label: 'View All Customers (City-Wide)',
    description: 'Access and search individual customer records across all branches in the portal.',
    category: 'Customers & Accounts',
    scope: 'all',
  },
  'customers_view_branch': {
    label: 'View Branch Customers',
    description: 'View customer accounts registered within the user’s assigned branch.',
    category: 'Customers & Accounts',
    scope: 'branch',
  },
  'customers_create': {
    label: 'Create Customer Account',
    description: 'Register new individual customer accounts and link water meter serial numbers.',
    category: 'Customers & Accounts',
    scope: 'action',
  },
  'customers_create_restricted': {
    label: 'Create Customer (Branch-Restricted Mode)',
    description: 'Register new customers with strict branch locking and automated branch attribution.',
    category: 'Customers & Accounts',
    scope: 'branch',
  },
  'customers_update': {
    label: 'Edit Customer Information',
    description: 'Modify customer contact details, phone numbers, and address properties.',
    category: 'Customers & Accounts',
    scope: 'action',
  },
  'customers_delete': {
    label: 'Delete Customer Account',
    description: 'Permanently remove customer records from the system (requires supervisor authorization).',
    category: 'Customers & Accounts',
    scope: 'action',
  },
  'customers_approve': {
    label: 'Approve Customer Registrations',
    description: 'Review and approve newly submitted customer applications in the Approvals queue.',
    category: 'Customers & Accounts',
    scope: 'action',
  },

  // Bulk Meters
  'bulk_meters_view_all': {
    label: 'View All Bulk Meters (City-Wide)',
    description: 'Access master bulk meter hubs and sub-meters across all branches.',
    category: 'Bulk Meters',
    scope: 'all',
  },
  'bulk_meters_view_branch': {
    label: 'View Branch Bulk Meters',
    description: 'View bulk meters assigned to the staff member’s branch.',
    category: 'Bulk Meters',
    scope: 'branch',
  },
  'bulk_meters_create': {
    label: 'Create Bulk Meter Hub',
    description: 'Register a new primary bulk water meter with GPS coordinates and line dimensions.',
    category: 'Bulk Meters',
    scope: 'action',
  },
  'bulk_meters_create_restricted': {
    label: 'Create Bulk Meter (Branch-Restricted)',
    description: 'Register new bulk meters constrained exclusively to the assigned branch.',
    category: 'Bulk Meters',
    scope: 'branch',
  },
  'bulk_meters_update': {
    label: 'Edit Bulk Meter Configuration',
    description: 'Update bulk meter properties, multiplier constants, and meter hardware specs.',
    category: 'Bulk Meters',
    scope: 'action',
  },
  'bulk_meters_delete': {
    label: 'Delete Bulk Meter Hub',
    description: 'Remove bulk meter hubs (requires that no active customers remain attached).',
    category: 'Bulk Meters',
    scope: 'action',
  },
  'bulk_meters_approve': {
    label: 'Approve Bulk Meters',
    description: 'Review and approve bulk meter creation and structural changes in the Approvals queue.',
    category: 'Bulk Meters',
    scope: 'action',
  },
  'bulk_meters_manage_customers': {
    label: 'Manage Bulk Customer Associations',
    description: 'Assign or reassign individual consumer meters to a bulk master meter for difference apportionment.',
    category: 'Bulk Meters',
    scope: 'action',
  },
  'bulk_meters_edit_readings_view': {
    label: 'View Bulk Reading Recalculation',
    description: 'View bulk meter historical consumption recalculations and apportionment difference audit logs.',
    category: 'Bulk Meters',
    scope: 'action',
  },
  'bulk_meters_edit_readings': {
    label: 'Recalculate Bulk Consumption',
    description: 'Adjust master readings and trigger automated customer apportioned difference re-billing.',
    category: 'Bulk Meters',
    scope: 'action',
  },

  // Meter Readings & Inspection
  'meter_readings_view_all': {
    label: 'Master: View All Meter Readings',
    description: 'Full city-wide access to all individual and bulk meter readings, consumption histories, and anomalies.',
    category: 'Meter Readings & Inspection',
    scope: 'master',
  },
  'meter_readings_view_branch': {
    label: 'View Branch Meter Readings',
    description: 'Inspect reading logs, submitted reader entries, and flags within the assigned branch.',
    category: 'Meter Readings & Inspection',
    scope: 'branch',
  },
  'meter_readings_view_individual': {
    label: 'View Individual Customer Readings',
    description: 'Review monthly meter readings recorded for residential and commercial customers.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_view_bulk': {
    label: 'View Bulk Hub Readings',
    description: 'Review monthly parent bulk meter reading logs and feeder line consumption.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_create': {
    label: 'Record Meter Readings',
    description: 'Submit new meter readings manually or via field reader handheld devices.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_create_individual': {
    label: 'Enter Individual Customer Reading',
    description: 'Record single meter reading entries for individual consumer meters.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_create_bulk': {
    label: 'Enter Bulk Meter Reading',
    description: 'Record monthly consumption for bulk water distribution hubs.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_add_manual': {
    label: 'Manual Single Reading Entry Form',
    description: 'Access the quick manual meter reading form in the web interface.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_upload_individual': {
    label: 'CSV Upload: Individual Readings',
    description: 'Bulk import thousands of individual customer readings via CSV file upload.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_upload_bulk': {
    label: 'CSV Upload: Bulk Meter Readings',
    description: 'Bulk import master hub readings via CSV batch files.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_update': {
    label: 'Edit Meter Readings',
    description: 'Modify recorded reading figures before billing cycle approval.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_delete': {
    label: 'Delete Meter Reading Entries',
    description: 'Remove errant or duplicated reading entries from the ledger.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_analytics_view': {
    label: 'Meter Reading Analytics & Trends',
    description: 'Access graphical analytics on consumption spikes, zero-usage accounts, and reader metrics.',
    category: 'Meter Readings & Inspection',
    scope: 'all',
  },
  'meter_readings_corrections_view': {
    label: 'View Reading Corrections Audit Log',
    description: 'Audit historical meter reading corrections, prior values, and justification notes.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_correct': {
    label: 'Submit Official Reading Correction',
    description: 'Post an authorized reading correction that recalculates consumption and updates ledger entries.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_edit_recalculate_view': {
    label: 'View Reading Recalculation Section',
    description: 'Access the preview section for recalculating bills after reading modifications.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_edit_recalculate': {
    label: 'Execute Reading Recalculation',
    description: 'Modify readings and trigger real-time regeneration of draft bills and customer balances.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_period_view': {
    label: 'View Billing Period Controls',
    description: 'Monitor active reading cycles, cut-off dates, and period closure statuses.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_period_control': {
    label: 'Open / Close Reading Periods',
    description: 'Authorize the transition between monthly reading cycles and lock past periods against modifications.',
    category: 'Meter Readings & Inspection',
    scope: 'master',
  },
  'meter_readings_shift_month': {
    label: 'Shift Reading Cycle Month',
    description: 'Reassign unbilled readings to subsequent billing months during adjustment periods.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_export': {
    label: 'Export Reading Datasets',
    description: 'Export raw reading records, timestamps, and coordinates to CSV/Excel.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },
  'meter_readings_offline_metrics': {
    label: 'View Reader Device Sync Health',
    description: 'Inspect mobile sync timestamps, offline queue depths, and device battery metrics.',
    category: 'Meter Readings & Inspection',
    scope: 'action',
  },

  // Bill Management & Payments
  'bill:manage_all': {
    label: 'Master: Full Bill Management (City-Wide)',
    description: 'Comprehensive authority over all bill states, drafts, approvals, posting, and rework city-wide.',
    category: 'Bill Management & Payments',
    scope: 'master',
  },
  'bill:view_branch': {
    label: 'View Assigned Branch Bills',
    description: 'Access billing records and summaries restricted to the user’s assigned branch.',
    category: 'Bill Management & Payments',
    scope: 'branch',
  },
  'bill:create': {
    label: 'Generate Monthly Bills',
    description: 'Run automated tariff calculations and generate draft billing invoices for active cycles.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:update': {
    label: 'Edit Bill Line Items & Tariffs',
    description: 'Adjust sanitation fees, sewer charges, meter rent, or discount line items on unapproved bills.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:delete': {
    label: 'Delete Draft Bills',
    description: 'Discard unposted draft bills before cycle finalization.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:submit': {
    label: 'Submit Bills for Approval',
    description: 'Move draft bills to the Pending Approval review workflow.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:approve': {
    label: 'Approve Pending Bills',
    description: 'Supervisor approval authorizing bills for final posting and distribution.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:post': {
    label: 'Post & Finalize Approved Bills',
    description: 'Lock approved bills, assign official bill numbers, and post debits to customer accounts.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:send': {
    label: 'Distribute & Deliver Bills',
    description: 'Deliver finalized bills via electronic SMS dispatch or prepare for courier delivery.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:rework': {
    label: 'Reject / Send Bill for Rework',
    description: 'Reject a pending bill and send it back to draft status with corrective notes.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:correct': {
    label: 'Create Official Bill Correction',
    description: 'Issue official post-finalization bill corrections, adjustments, and debit/credit memos.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:correct_view': {
    label: 'View Bill Correction History',
    description: 'Inspect past bill revisions, reasons for correction, and adjusting officers.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:view_drafts': {
    label: 'View Drafts Tab',
    description: 'Access the Draft Bills list in Bill Management.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:view_pending': {
    label: 'View Pending Approval Tab',
    description: 'Access the Pending Approval queue in Bill Management.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:view_approved': {
    label: 'View Approved Bills Tab',
    description: 'Access the Approved Bills list awaiting final posting.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:view_paid': {
    label: 'View Settled (Paid) Bills Tab',
    description: 'Access paid bill records and settlement confirmations.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:view_awaiting_payment': {
    label: 'View Awaiting Payment Tab',
    description: 'Access active outstanding bills currently awaiting customer settlement.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'bill:view_overdue': {
    label: 'View Overdue Bills Tab',
    description: 'Inspect delinquent accounts past their payment cut-off date.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'billing:close_cycle': {
    label: 'Close Billing Cycle',
    description: 'Officially close the monthly billing cycle, archive records, and prepare period transitions.',
    category: 'Bill Management & Payments',
    scope: 'master',
  },
  'payments_view': {
    label: 'View Payment Transactions',
    description: 'Access customer payment receipts, bank reference codes, and cashier logs.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'payments_create': {
    label: 'Record Customer Payment',
    description: 'Process and record customer payments against outstanding water bills.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'payments_delete': {
    label: 'Void / Revert Payment Record',
    description: 'Void an errant payment entry (reopens the customer bill for settlement).',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'credit_view_all': {
    label: 'View All Customer Credits (City-Wide)',
    description: 'Inspect customer overpayment balances, deposits, and advance credit ledgers across all branches.',
    category: 'Bill Management & Payments',
    scope: 'all',
  },
  'credit_view_branch': {
    label: 'View Branch Customer Credits',
    description: 'View customer credit ledgers for accounts registered in the assigned branch.',
    category: 'Bill Management & Payments',
    scope: 'branch',
  },
  'credit_create': {
    label: 'Add Customer Credit / Advance',
    description: 'Credit customer accounts for overpayments, security deposits, or goodwill adjustments.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'credit_void': {
    label: 'Void Customer Credit',
    description: 'Void an unused credit balance or reverse duplicate advance deposits.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },
  'credit_delete': {
    label: 'Delete Customer Credit Record',
    description: 'Permanently remove voided credit ledger entries.',
    category: 'Bill Management & Payments',
    scope: 'action',
  },

  // Invoices & Statements
  'invoice:view': {
    label: 'Access Invoicing Hub',
    description: 'Access the Invoice Generator workspace and customer invoice lookup.',
    category: 'Invoices & Statements',
    scope: 'action',
  },
  'invoice:print': {
    label: 'Print Single & Batch Invoices',
    description: 'Generate printer-ready PDF invoices with official AAWSA branding and barcodes.',
    category: 'Invoices & Statements',
    scope: 'action',
  },
  'invoice:export_csv': {
    label: 'Export Invoices to CSV',
    description: 'Export invoice register summaries to comma-separated values files.',
    category: 'Invoices & Statements',
    scope: 'action',
  },
  'invoice:export_excel': {
    label: 'Export Invoices to Excel',
    description: 'Export invoice books with formulas, breakdowns, and customer tables to XLSX spreadsheets.',
    category: 'Invoices & Statements',
    scope: 'action',
  },
  'invoice:batch': {
    label: 'Batch Invoice Management',
    description: 'Generate, zip, and download multi-customer monthly billing batches.',
    category: 'Invoices & Statements',
    scope: 'action',
  },
  'invoice:customer_statement': {
    label: 'Generate Customer Account Statement',
    description: 'Produce complete historical ledger statements showing all billings and payments for a customer.',
    category: 'Invoices & Statements',
    scope: 'action',
  },

  // Reports & Analytics
  'reports_generate_all': {
    label: 'Master: Generate All Reports (City-Wide)',
    description: 'Generate any report across all branches with system-wide aggregation.',
    category: 'Reports & Analytics',
    scope: 'master',
  },
  'reports_generate_branch': {
    label: 'Generate Reports (Assigned Branch)',
    description: 'Generate operational reports restricted to the user’s branch data.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'reports_create': {
    label: 'Schedule & Configure Reports',
    description: 'Create automated periodic report generation tasks and email exports.',
    category: 'Reports & Analytics',
    scope: 'action',
  },
  'report:billing_summary': {
    label: 'Billing Summary Report (City-Wide)',
    description: 'Consolidated report of billed amounts, sewer charges, and volume across all branches.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_billing_summary': {
    label: 'Branch Billing Summary Report',
    description: 'Billing summary report scoped strictly to the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:list_of_paid_bills': {
    label: 'Paid Bills Report (City-Wide)',
    description: 'Comprehensive ledger of all settled bills and collection channels across the city.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_list_of_paid_bills': {
    label: 'Branch Paid Bills Report',
    description: 'Settled bills and collections for the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:list_of_sent_bills': {
    label: 'Dispatched Bills Report (City-Wide)',
    description: 'Audit log of distributed invoices across all city zones.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_list_of_sent_bills': {
    label: 'Branch Dispatched Bills Report',
    description: 'Dispatched and delivered bill receipts for the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:list_of_unsettled_bills': {
    label: 'Unsettled / Aging Debt Report (City-Wide)',
    description: 'Aging debt analysis for unpaid invoices across all branches.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_list_of_unsettled_bills': {
    label: 'Branch Unsettled Bills Report',
    description: 'Outstanding unpaid bills ledger for the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:list_of_corrected_bills': {
    label: 'Corrected Bills Report (City-Wide)',
    description: 'Full audit ledger of revised, adjusted, and recalculated bills city-wide.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_list_of_corrected_bills': {
    label: 'Branch Corrected Bills Report',
    description: 'Bill adjustments and corrections executed within the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:water_usage': {
    label: 'Water Consumption Trend Report (City-Wide)',
    description: 'Aggregated volumetric water usage, peak consumption, and cubic meter trends city-wide.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_water_usage': {
    label: 'Branch Water Usage Report',
    description: 'Volumetric consumption records for meters in the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:payment_history': {
    label: 'Payment Collection History (City-Wide)',
    description: 'Historical payment audit trail across all payment gateways and branch cashiers.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_payment_history': {
    label: 'Branch Payment Collection History',
    description: 'Payment receipts registered in the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:meter_reading_accuracy': {
    label: 'Meter Reading Accuracy Audit (City-Wide)',
    description: 'Comparison of reader inputs against baseline consumption to detect reading anomalies.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_meter_reading_accuracy': {
    label: 'Branch Reading Accuracy Audit',
    description: 'Reading variance and accuracy metrics for the assigned branch field readers.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:monthly_bill_export': {
    label: 'Monthly Bill Export (City-Wide)',
    description: 'Export all monthly billing line items and metadata across all branches.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_monthly_bill_export': {
    label: 'Branch Monthly Bill Export',
    description: 'Export monthly bill records for the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:customer_data_export': {
    label: 'Customer Register Export (City-Wide)',
    description: 'Full export of all customer accounts, tariff codes, and contact records.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_customer_data_export': {
    label: 'Branch Customer Register Export',
    description: 'Export customer details for the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:bulk_meter_data_export': {
    label: 'Bulk Meter Network Export (City-Wide)',
    description: 'Export bulk meter distribution hierarchy, parent-child mappings, and coordinates.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_bulk_meter_data_export': {
    label: 'Branch Bulk Meter Export',
    description: 'Export bulk meter records situated within the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:tariffs_data_export': {
    label: 'Tariff Matrix Export (City-Wide)',
    description: 'Export historical tariff tier rates, effective dates, and wastewater percentages.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_tariffs_data_export': {
    label: 'Branch Tariff Matrix Export',
    description: 'Export tariff table reference for the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },
  'report:staff_data_export': {
    label: 'Staff Directory Export (City-Wide)',
    description: 'Export staff roster, roles, assigned branches, and contact info.',
    category: 'Reports & Analytics',
    scope: 'all',
  },
  'report:branch_staff_data_export': {
    label: 'Branch Staff Directory Export',
    description: 'Export staff member roster for the assigned branch.',
    category: 'Reports & Analytics',
    scope: 'branch',
  },

  // Finance & GL Audit
  'report:gl_audit_view': {
    label: 'GL Financial & Audit: Base Hub View',
    description: 'Base access required to view General Ledger audit summaries and accounting reconciliations.',
    category: 'Finance & GL Audit',
    scope: 'action',
  },
  'report:gl_audit_view_all': {
    label: 'GL Audit: All-Branch Monthly Inspection Tab',
    description: 'City-wide monthly general ledger account postings and balance reconciliations.',
    category: 'Finance & GL Audit',
    scope: 'all',
  },
  'report:gl_audit_view_branch': {
    label: 'GL Audit: Assigned Branch Monthly Tab',
    description: 'Branch-specific monthly general ledger entries and account reconciliations.',
    category: 'Finance & GL Audit',
    scope: 'branch',
  },
  'report:gl_audit_view_matrix': {
    label: 'GL Audit: Component Breakdown Matrix Tab',
    description: 'Detailed revenue component matrix breaking down water, sanitation, and penalty accounts.',
    category: 'Finance & GL Audit',
    scope: 'action',
  },
  'report:gl_audit_view_anomaly': {
    label: 'GL Audit: Anomaly & Variance Inspector Tab',
    description: 'Automated auditing tool highlighting discrepancies between bill totals and GL ledger entries.',
    category: 'Finance & GL Audit',
    scope: 'action',
  },
  'report:gl_monthly_summary_by_code': {
    label: 'GL Monthly Summary by Account Code',
    description: 'Exportable trial balance mapped directly to AAWSA chart of account numbers.',
    category: 'Finance & GL Audit',
    scope: 'all',
  },
  'report:gl_finance_monthly': {
    label: 'GL Finance Monthly Report (City-Wide)',
    description: 'Official monthly accounting report for executive finance management.',
    category: 'Finance & GL Audit',
    scope: 'all',
  },
  'report:branch_gl_finance_monthly': {
    label: 'Branch GL Finance Monthly Report',
    description: 'Monthly accounting summary for the assigned branch.',
    category: 'Finance & GL Audit',
    scope: 'branch',
  },
  'report:gl_finance_yearly': {
    label: 'GL Finance Annual / Yearly Report (City-Wide)',
    description: 'Comprehensive annual financial closure statement across all city operations.',
    category: 'Finance & GL Audit',
    scope: 'all',
  },
  'report:branch_gl_finance_yearly': {
    label: 'Branch GL Finance Yearly Report',
    description: 'Annual financial summary for the assigned branch.',
    category: 'Finance & GL Audit',
    scope: 'branch',
  },

  // Routes & Field Readers
  'routes_view_all': {
    label: 'View All Meter Routes (City-Wide)',
    description: 'Inspect reading route sequences, assigned field readers, and street corridors city-wide.',
    category: 'Routes & Field Readers',
    scope: 'all',
  },
  'routes_view': {
    label: 'View General Route Schedules',
    description: 'Access the basic routes listing and calendar schedules.',
    category: 'Routes & Field Readers',
    scope: 'action',
  },
  'routes_view_branch': {
    label: 'View Branch Routes',
    description: 'Inspect meter reading routes belonging to the assigned branch.',
    category: 'Routes & Field Readers',
    scope: 'branch',
  },
  'routes_view_assigned': {
    label: 'View My Assigned Routes',
    description: 'Field reader access to view only their assigned route sequence on mobile/web.',
    category: 'Routes & Field Readers',
    scope: 'action',
  },
  'routes_manage': {
    label: 'Master: Full Route Management',
    description: 'Create, modify, reorder stops, and reassign route territories among field staff.',
    category: 'Routes & Field Readers',
    scope: 'master',
  },
  'routes_create': {
    label: 'Create New Meter Route',
    description: 'Define a new meter reading zone and assign starting sequence numbers.',
    category: 'Routes & Field Readers',
    scope: 'action',
  },
  'routes_update': {
    label: 'Update Route Assignment & Stops',
    description: 'Reorder customer meters along a route or change assigned field officers.',
    category: 'Routes & Field Readers',
    scope: 'action',
  },
  'routes_delete': {
    label: 'Delete Route',
    description: 'Remove obsolete route definitions.',
    category: 'Routes & Field Readers',
    scope: 'action',
  },
  'reader_progress_view': {
    label: 'Monitor Field Reader Progress',
    description: 'Live dashboard showing reader completion percentages and GPS check-in timestamps.',
    category: 'Routes & Field Readers',
    scope: 'action',
  },

  // Field Operations & Data Entry
  'meter_change_view': {
    label: 'View Meter Replacement Logs',
    description: 'Inspect logs of physical water meters swapped due to age, defect, or tampering.',
    category: 'Field Operations & Data Entry',
    scope: 'action',
  },
  'meter_change_create': {
    label: 'Record Meter Replacement',
    description: 'Log final reading on decommissioned meter and initial zero-reading on new meter.',
    category: 'Field Operations & Data Entry',
    scope: 'action',
  },
  'meter_change_manage': {
    label: 'Authorize & Manage Meter Swaps',
    description: 'Supervisor approval verifying meter swap documentation and seal numbers.',
    category: 'Field Operations & Data Entry',
    scope: 'master',
  },
  'data_entry_access': {
    label: 'Access Data Entry Workspace',
    description: 'Access dedicated bulk and individual customer fast-entry screens.',
    category: 'Field Operations & Data Entry',
    scope: 'action',
  },
  'data_entry_bulk_form': {
    label: 'Bulk Meter Data Entry Form',
    description: 'Manual entry screen for bulk meter specifications.',
    category: 'Field Operations & Data Entry',
    scope: 'action',
  },
  'data_entry_individual_form': {
    label: 'Individual Customer Entry Form',
    description: 'Rapid registration form for individual customer meters.',
    category: 'Field Operations & Data Entry',
    scope: 'action',
  },
  'data_entry_bulk_csv': {
    label: 'Bulk Meter CSV File Upload',
    description: 'Direct CSV file importer for bulk meter records.',
    category: 'Field Operations & Data Entry',
    scope: 'action',
  },
  'data_entry_individual_csv': {
    label: 'Individual Customer CSV Upload',
    description: 'Direct CSV file importer for individual customer registrations.',
    category: 'Field Operations & Data Entry',
    scope: 'action',
  },

  // Staff & Access Management
  'staff_view': {
    label: 'Access Staff Directory',
    description: 'View basic staff directory and contact profiles.',
    category: 'Staff & Access Management',
    scope: 'action',
  },
  'staff_view_all': {
    label: 'View All Staff Members (City-Wide)',
    description: 'Full city-wide directory of all employees, roles, and branch assignments.',
    category: 'Staff & Access Management',
    scope: 'all',
  },
  'staff_view_branch': {
    label: 'View Branch Staff Directory',
    description: 'Directory restricted to employees stationed in the assigned branch.',
    category: 'Staff & Access Management',
    scope: 'branch',
  },
  'staff_create': {
    label: 'Create Staff Account',
    description: 'Add new staff members, set up login credentials, and assign initial roles.',
    category: 'Staff & Access Management',
    scope: 'action',
  },
  'staff_update': {
    label: 'Update Staff Profile & Role',
    description: 'Modify employee job titles, assigned branch, and assigned system role.',
    category: 'Staff & Access Management',
    scope: 'action',
  },
  'staff_delete': {
    label: 'Deactivate / Remove Staff Account',
    description: 'Revoke system access and deactivate employee login credentials.',
    category: 'Staff & Access Management',
    scope: 'action',
  },
  'permissions_view': {
    label: 'View Roles & Permissions Matrix',
    description: 'Inspect assigned role privileges and underlying system permission tokens.',
    category: 'Staff & Access Management',
    scope: 'action',
  },
  'roles_manage': {
    label: 'Manage Roles & Privilege Tokens',
    description: 'Create new roles, assign privilege tokens, and customize permission sets.',
    category: 'Staff & Access Management',
    scope: 'master',
  },

  // Branch Management
  'branches_view': {
    label: 'View Branch Directory',
    description: 'Inspect list of AAWSA branch offices, head office links, and regional codes.',
    category: 'Branch Management',
    scope: 'action',
  },
  'branches_create': {
    label: 'Create Branch Office',
    description: 'Register a new regional branch office in the portal.',
    category: 'Branch Management',
    scope: 'action',
  },
  'branches_update': {
    label: 'Update Branch Information',
    description: 'Edit branch office addresses, contact numbers, and sub-city jurisdictions.',
    category: 'Branch Management',
    scope: 'action',
  },
  'branches_delete': {
    label: 'Deactivate Branch Office',
    description: 'Deactivate a branch (requires all active staff and meters to be reassigned).',
    category: 'Branch Management',
    scope: 'action',
  },

  // Customer Support & Help Desk
  'support:view_all': {
    label: 'View All Support Tickets (City-Wide)',
    description: 'Monitor complaints, billing inquiries, and leak reports across all branches.',
    category: 'Customer Support & Help Desk',
    scope: 'all',
  },
  'support:view_branch': {
    label: 'View Branch Support Tickets',
    description: 'Access tickets logged by or assigned to the user’s branch.',
    category: 'Customer Support & Help Desk',
    scope: 'branch',
  },
  'support:create': {
    label: 'Create Support Ticket',
    description: 'Log a new customer inquiry, dispute, or field inspection request.',
    category: 'Customer Support & Help Desk',
    scope: 'action',
  },
  'support:assign': {
    label: 'Assign Ticket to Staff',
    description: 'Delegate open tickets to specific technical or customer care officers.',
    category: 'Customer Support & Help Desk',
    scope: 'action',
  },
  'support:resolve': {
    label: 'Resolve / Close Support Ticket',
    description: 'Record resolution notes and officially resolve customer tickets.',
    category: 'Customer Support & Help Desk',
    scope: 'action',
  },
  'support:manage': {
    label: 'Master: Help Desk Administration',
    description: 'Full control over ticket priorities, category escalations, and assignment transfers.',
    category: 'Customer Support & Help Desk',
    scope: 'master',
  },

  // Call Center Operations
  'callcenter:access': {
    label: 'Access Call Center Module',
    description: 'Access the AAWSA Call Center workspace and caller inquiry console.',
    category: 'Customer Support & Help Desk',
    scope: 'action',
  },
  'callcenter:view_all': {
    label: 'View All Call Center Logs (City-Wide)',
    description: 'Monitor caller interaction history across all authority branches.',
    category: 'Customer Support & Help Desk',
    scope: 'all',
  },
  'callcenter:view_branch': {
    label: 'View Branch Call Center Logs',
    description: 'Access call logs for customers assigned to the agent’s branch.',
    category: 'Customer Support & Help Desk',
    scope: 'branch',
  },
  'callcenter:log_call': {
    label: 'Log Customer Telephone Interaction',
    description: 'Record customer inquiries, caller identity, and resolution notes.',
    category: 'Customer Support & Help Desk',
    scope: 'action',
  },
  'callcenter:dispatch_sms': {
    label: 'Dispatch On-Call Bill SMS',
    description: 'Instantly resend bill details and payment reference SMS to caller.',
    category: 'Customer Support & Help Desk',
    scope: 'action',
  },
  'callcenter:supervisor': {
    label: 'Call Center Supervisor & Operations',
    description: 'Oversight of call queues, agent interactions, and ticket escalations.',
    category: 'Customer Support & Help Desk',
    scope: 'master',
  },

  // Notifications & SMS
  'notifications_view': {
    label: 'View Notification Bell & Alerts',
    description: 'Receive real-time in-app alerts on approvals, sync jobs, and system events.',
    category: 'Notifications & SMS',
    scope: 'action',
  },
  'notifications_view_all': {
    label: 'View System Broadcast Feed',
    description: 'View all announcements sent across the entire organization.',
    category: 'Notifications & SMS',
    scope: 'all',
  },
  'notifications_manage': {
    label: 'Manage Notification Broadcasts',
    description: 'Edit, schedule, and dismiss platform-wide broadcast alerts.',
    category: 'Notifications & SMS',
    scope: 'master',
  },
  'notifications_create': {
    label: 'Send In-App Notification',
    description: 'Publish notifications to all staff or targeted branch groups.',
    category: 'Notifications & SMS',
    scope: 'action',
  },
  'sms_send': {
    label: 'Send Customer SMS Notifications',
    description: 'Dispatch bill readiness alerts, payment confirmations, and maintenance SMS messages.',
    category: 'Notifications & SMS',
    scope: 'action',
  },

  // System Settings & Policies
  'settings_view': {
    label: 'View System Settings',
    description: 'View organization details, logo branding, and default period configurations.',
    category: 'System Settings & Policies',
    scope: 'action',
  },
  'settings_manage': {
    label: 'Manage System Settings & Backups',
    description: 'Modify portal configurations, database backup parameters, and security policies.',
    category: 'System Settings & Policies',
    scope: 'master',
  },
  'tariffs_view': {
    label: 'View Water Tariff Structure',
    description: 'Inspect tiered pricing bands per cubic meter for residential, commercial, and bulk users.',
    category: 'System Settings & Policies',
    scope: 'action',
  },
  'tariffs_manage': {
    label: 'Configure Tariff Rates & Tiers',
    description: 'Update tariff prices, tier thresholds, and sewer percentage rates.',
    category: 'System Settings & Policies',
    scope: 'master',
  },
  'fault_codes_view': {
    label: 'View Reading Fault & Anomaly Codes',
    description: 'Inspect standard reader fault codes (e.g. meter obstructed, glass broken, reversed meter).',
    category: 'System Settings & Policies',
    scope: 'action',
  },
  'fault_codes_manage': {
    label: 'Manage Fault & Anomaly Codes',
    description: 'Add or modify fault code definitions and automated flagging thresholds.',
    category: 'System Settings & Policies',
    scope: 'action',
  },
  'promotions_view': {
    label: 'View Billing Promotions & Rebates',
    description: 'Inspect active promotional rebate rules and customer discount programs.',
    category: 'System Settings & Policies',
    scope: 'action',
  },
  'promotions_manage': {
    label: 'Manage Billing Promotions & Rebates',
    description: 'Configure new promotional discounts, effective dates, and eligibility rules.',
    category: 'System Settings & Policies',
    scope: 'action',
  },
  'knowledge_base_view': {
    label: 'Browse Knowledge Base & Manual',
    description: 'Access the operational knowledge base, standard operating procedures, and user manual.',
    category: 'System Settings & Policies',
    scope: 'action',
  },
  'knowledge_base_manage': {
    label: 'Manage Knowledge Base Articles',
    description: 'Write, edit, and publish training guides, standard operating procedures, and FAQ articles.',
    category: 'System Settings & Policies',
    scope: 'action',
  },
};

/**
 * Intelligently returns the appropriate canonical category for a permission.
 * If rawCategory is unassigned or generic, it infers the true category from the permission handle.
 */
export function getCanonicalCategory(rawCategory?: string | null, permissionName?: string): string {
  // 1. If permission handle is in metadata registry, use its dedicated canonical category
  if (permissionName && PERMISSION_METADATA_REGISTRY[permissionName]) {
    return PERMISSION_METADATA_REGISTRY[permissionName].category;
  }

  // 2. If rawCategory maps directly in CANONICAL_CATEGORY_MAP, use it
  if (rawCategory && CANONICAL_CATEGORY_MAP[rawCategory]) {
    return CANONICAL_CATEGORY_MAP[rawCategory];
  }

  // 3. Fallback inference by permission name prefix
  if (permissionName) {
    if (permissionName.startsWith('dashboard')) return 'Dashboard & Overview';
    if (permissionName.startsWith('customers')) return 'Customers & Accounts';
    if (permissionName.startsWith('bulk_meters')) return 'Bulk Meters';
    if (permissionName.startsWith('meter_readings')) return 'Meter Readings & Inspection';
    if (permissionName.startsWith('bill:') || permissionName.startsWith('billing:') || permissionName.startsWith('payments') || permissionName.startsWith('credit')) return 'Bill Management & Payments';
    if (permissionName.startsWith('invoice:')) return 'Invoices & Statements';
    if (permissionName.startsWith('report:gl') || permissionName.startsWith('report:branch_gl')) return 'Finance & GL Audit';
    if (permissionName.startsWith('report:') || permissionName.startsWith('reports_')) return 'Reports & Analytics';
    if (permissionName.startsWith('routes_') || permissionName.startsWith('reader_')) return 'Routes & Field Readers';
    if (permissionName.startsWith('meter_change') || permissionName.startsWith('data_entry')) return 'Field Operations & Data Entry';
    if (permissionName.startsWith('staff_') || permissionName === 'permissions_view' || permissionName === 'roles_manage') return 'Staff & Access Management';
    if (permissionName.startsWith('branches_')) return 'Branch Management';
    if (permissionName.startsWith('support:') || permissionName.startsWith('callcenter:')) return 'Customer Support & Help Desk';
    if (permissionName.startsWith('notifications') || permissionName.startsWith('sms_')) return 'Notifications & SMS';
    if (permissionName.startsWith('settings_') || permissionName.startsWith('tariffs_') || permissionName.startsWith('fault_codes') || permissionName.startsWith('promotions') || permissionName.startsWith('knowledge_base')) return 'System Settings & Policies';
  }

  // 4. Default fallback
  return rawCategory || 'System Settings & Policies';
}

/**
 * Returns user-friendly formatted title for a permission handle.
 */
export const formatPermissionName = (name: string): string => {
  if (PERMISSION_METADATA_REGISTRY[name]) {
    return PERMISSION_METADATA_REGISTRY[name].label;
  }

  return name
    .replace(/:/g, ': ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Returns clear, helpful description explaining what this permission allows.
 */
export const getPermissionDescription = (name: string, fallbackDescription?: string | null): string => {
  if (fallbackDescription && fallbackDescription.trim().length > 10) {
    return fallbackDescription;
  }

  if (PERMISSION_METADATA_REGISTRY[name]) {
    return PERMISSION_METADATA_REGISTRY[name].description;
  }

  return fallbackDescription || `Grants access to execute ${name.replace(/[:_]/g, ' ')}.`;
};

/**
 * Returns the operational scope of a permission.
 */
export const getPermissionScope = (name: string): PermissionScope => {
  if (PERMISSION_METADATA_REGISTRY[name]) {
    return PERMISSION_METADATA_REGISTRY[name].scope;
  }

  if (name.includes('view_all') || name.includes('manage_all') || name.endsWith('_all')) {
    return 'all';
  }
  if (name.includes('branch')) {
    return 'branch';
  }
  if (name.includes('manage')) {
    return 'master';
  }
  return 'action';
};

/**
 * Category badge styles
 */
export const getCategoryColor = (category: string): string => {
  const canonical = getCanonicalCategory(category);
  const cats: Record<string, string> = {
    'Dashboard & Overview': 'bg-blue-100 text-blue-700 border-blue-200',
    'Customers & Accounts': 'bg-amber-100 text-amber-700 border-amber-200',
    'Bulk Meters': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'Meter Readings & Inspection': 'bg-violet-100 text-violet-800 border-violet-200',
    'Bill Management & Payments': 'bg-green-100 text-green-700 border-green-200',
    'Invoices & Statements': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Reports & Analytics': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Finance & GL Audit': 'bg-teal-100 text-teal-800 border-teal-200',
    'Routes & Field Readers': 'bg-rose-100 text-rose-800 border-rose-200',
    'Field Operations & Data Entry': 'bg-orange-100 text-orange-800 border-orange-200',
    'Staff & Access Management': 'bg-purple-100 text-purple-700 border-purple-200',
    'Branch Management': 'bg-sky-100 text-sky-800 border-sky-200',
    'Customer Support & Help Desk': 'bg-pink-100 text-pink-800 border-pink-200',
    'Notifications & SMS': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'System Settings & Policies': 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return cats[canonical] || 'bg-gray-100 text-gray-700 border-gray-200';
};

/**
 * 16 Mutually exclusive report pairs (Global vs Branch)
 */
export const MUTUALLY_EXCLUSIVE_REPORT_PAIRS: [string, string][] = [
  ['report:customer_data_export', 'report:branch_customer_data_export'],
  ['report:bulk_meter_data_export', 'report:branch_bulk_meter_data_export'],
  ['report:billing_summary', 'report:branch_billing_summary'],
  ['report:list_of_paid_bills', 'report:branch_list_of_paid_bills'],
  ['report:list_of_sent_bills', 'report:branch_list_of_sent_bills'],
  ['report:list_of_unsettled_bills', 'report:branch_list_of_unsettled_bills'],
  ['report:list_of_corrected_bills', 'report:branch_list_of_corrected_bills'],
  ['report:water_usage', 'report:branch_water_usage'],
  ['report:payment_history', 'report:branch_payment_history'],
  ['report:meter_reading_accuracy', 'report:branch_meter_reading_accuracy'],
  ['report:tariffs_data_export', 'report:branch_tariffs_data_export'],
  ['report:staff_data_export', 'report:branch_staff_data_export'],
  ['report:gl_finance_monthly', 'report:branch_gl_finance_monthly'],
  ['report:gl_finance_yearly', 'report:branch_gl_finance_yearly'],
  ['report:gl_audit_view_all', 'report:gl_audit_view_branch'],
  ['report:monthly_bill_export', 'report:branch_monthly_bill_export'],
];

/**
 * Master Bundles mapping
 */
export const MASTER_BUNDLE_MAP: Record<string, string[]> = {
  'bill:manage_all': [
    'bill:view_branch',
    'bill:view_drafts',
    'bill:view_pending',
    'bill:view_approved',
    'bill:view_paid',
    'bill:view_awaiting_payment',
    'bill:view_overdue',
    'invoice:view',
    'invoice:batch',
  ],
  'meter_readings_view_all': [
    'meter_readings_view_individual',
    'meter_readings_view_bulk',
    'meter_readings_analytics_view',
  ],
  'routes_manage': [
    'routes_view',
    'routes_view_all',
    'routes_create',
    'routes_update',
    'routes_delete',
  ],
  'reports_generate_all': [
    'reports_generate_branch',
  ],
};
