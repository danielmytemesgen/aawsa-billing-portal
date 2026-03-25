import { pgTable, text, timestamp, smallint, uuid, numeric, integer, jsonb, date, boolean, primaryKey, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. RBAC
export const roles = pgTable('roles', {
  id: smallint('id').primaryKey().generatedAlwaysAsIdentity(),
  roleName: text('role_name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const permissions = pgTable('permissions', {
  id: smallint('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(),
  description: text('description'),
  category: text('category').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: smallint('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: smallint('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
}));

export const staffMembers = pgTable('staff_members', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password'),
  phone: text('phone'),
  branch: text('branch'),
  role: text('role').notNull(),
  roleId: smallint('role_id').references(() => roles.id, { onDelete: 'set null' }),
  status: text('status').default('Active'),
  hireDate: date('hire_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Branches & Customers
export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  location: text('location').notNull(),
  contactPerson: text('contactPerson'),
  contactPhone: text('contactPhone'),
  status: text('status').default('Active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const routes = pgTable('routes', {
  routeKey: text('route_key').primaryKey(),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  readerId: uuid('reader_id').references(() => staffMembers.id, { onDelete: 'set null' }),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const bulkMeters = pgTable('bulk_meters', {
  customerKeyNumber: text('customerKeyNumber').primaryKey(),
  instKey: text('INST_KEY'),
  name: text('name').notNull(),
  contractNumber: text('contractNumber').notNull().unique(),
  meterSize: numeric('meterSize').notNull(),
  meterKey: text('METER_KEY').notNull().unique(),
  previousReading: numeric('previousReading').notNull(),
  currentReading: numeric('currentReading').notNull(),
  month: text('month').notNull(),
  specificArea: text('specificArea'),
  subCity: text('subCity'),
  woreda: text('woreda'),
  branchId: uuid('branch_id').references(() => branches.id),
  numberOfDials: integer('NUMBER_OF_DIALS'),
  status: text('status').default('Active'),
  paymentStatus: text('paymentStatus').default('Unpaid'),
  chargeGroup: text('charge_group'),
  routeKey: text('ROUTE_KEY').references(() => routes.routeKey, { onDelete: 'set null' }),
  sewerageConnection: text('sewerage_connection'),
  approvedBy: uuid('approved_by').references(() => staffMembers.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
});

export const individualCustomers = pgTable('individual_customers', {
  customerKeyNumber: text('customerKeyNumber').primaryKey(),
  instKey: text('INST_KEY'),
  name: text('name').notNull(),
  contractNumber: text('contractNumber').notNull().unique(),
  customerType: text('customerType'),
  bookNumber: text('bookNumber'),
  ordinal: integer('ordinal'),
  meterSize: numeric('meterSize'),
  meterKey: text('METER_KEY').notNull().unique(),
  previousReading: numeric('previousReading'),
  currentReading: numeric('currentReading'),
  month: text('month'),
  assignedBulkMeterId: text('assignedBulkMeterId').references(() => bulkMeters.customerKeyNumber),
  branchId: uuid('branch_id').references(() => branches.id),
  numberOfDials: integer('NUMBER_OF_DIALS'),
  status: text('status').default('Active'),
  paymentStatus: text('paymentStatus').default('Unpaid'),
  approvedBy: uuid('approved_by').references(() => staffMembers.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 3. Billing & Readings
export const bills = pgTable('bills', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  billKey: text('BILLKEY'),
  customerKey: text('CUSTOMERKEY'), // For bulk meters
  customerName: text('CUSTOMERNAME'),
  customerTin: text('CUSTOMERTIN'),
  customerBranch: text('CUSTOMERBRANCH'),
  reason: text('REASON'),
  currRead: numeric('CURRREAD').notNull().default('0.000'),
  prevRead: numeric('PREVREAD').notNull().default('0.000'),
  cons: numeric('CONS').default('0.000'),
  totalBillAmount: numeric('TOTALBILLAMOUNT').notNull().default('0.00'),
  thisMonthBillAmt: numeric('THISMONTHBILLAMT'),
  outstandingAmt: numeric('OUTSTANDINGAMT').default('0.00'),
  penaltyAmt: numeric('PENALTYAMT'),
  drAcctNo: text('DRACCTNO'),
  crAcctNo: text('CRACCTNO'),
  individualCustomerId: text('individual_customer_id').references(() => individualCustomers.customerKeyNumber),
  billPeriodStartDate: date('bill_period_start_date').notNull(),
  billPeriodEndDate: date('bill_period_end_date').notNull(),
  monthYear: text('month_year').notNull(),
  differenceUsage: numeric('difference_usage').default('0.000'),
  baseWaterCharge: numeric('base_water_charge').notNull().default('0.00'),
  sewerageCharge: numeric('sewerage_charge').default('0.00'),
  maintenanceFee: numeric('maintenance_fee').default('0.00'),
  sanitationFee: numeric('sanitation_fee').default('0.00'),
  meterRent: numeric('meter_rent').default('0.00'),
  balanceCarriedForward: numeric('balance_carried_forward').default('0.00'),
  amountPaid: numeric('amount_paid').default('0.00'),
  dueDate: date('due_date').notNull(),
  paymentStatus: text('payment_status').default('Unpaid'),
  status: text('status').default('Draft'),
  billNumber: text('bill_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  approvalDate: timestamp('approval_date', { withTimezone: true }),
  approvedBy: text('approved_by'),
  vatAmount: numeric('vat_amount').default('0'),
  additionalFeesCharge: numeric('additional_fees_charge').default('0'),
  additionalFeesBreakdown: jsonb('additional_fees_breakdown'),
  snapshotData: jsonb('snapshot_data'),
  branchId: uuid('branch_id').references(() => branches.id),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  billId: uuid('bill_id').references(() => bills.id),
  individualCustomerId: text('individual_customer_id').references(() => individualCustomers.customerKeyNumber),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method'),
  transactionReference: text('transaction_reference'),
  processedByStaffId: uuid('processed_by_staff_id').references(() => staffMembers.id),
  paymentDate: timestamp('payment_date', { withTimezone: true }).defaultNow(),
  notes: text('notes'),
});

export const tariffs = pgTable('tariffs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  customerType: text('customer_type').notNull(),
  year: integer('year').notNull(),
  tiers: jsonb('tiers').notNull(),
  maintenancePercentage: numeric('maintenance_percentage').default('0.01'),
  sanitationPercentage: numeric('sanitation_percentage'),
  sewerageRatePerM3: numeric('sewerage_rate_per_m3'),
  vatRate: numeric('vat_rate').default('0.15'),
  fixedTierIndex: integer('fixed_tier_index'), // Which tier to use for rental types (0-based), null = default (3 = 4th tier)
  useRuleOfThree: boolean('use_rule_of_three').default(true), // If true, consumption < 3 is treated as 3
}, (t) => ({
  unq: sql`UNIQUE(${t.customerType}, ${t.year})`, // Drizzle workaround for unique constraints in earlier versions or specific needs
}));

// 10. System Settings
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
