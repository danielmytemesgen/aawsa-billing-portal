import { pgTable, text, timestamp, smallint, uuid, numeric, integer, jsonb, date, boolean, primaryKey, check, index } from 'drizzle-orm/pg-core';
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
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
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
  status: text('status').default('Active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
}, (t) => ({
  readerIdx: index('idx_routes_reader').on(t.readerId),
}));

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
  ordinal: integer('ordinal'),
  xCoordinate: numeric('x_coordinate'),
  yCoordinate: numeric('y_coordinate'),
  zCoordinate: numeric('z_coordinate'),
  approvedBy: uuid('approved_by').references(() => staffMembers.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
  outStandingbill: numeric('outStandingbill').default('0.00'),
  bulkUsage: numeric('bulk_usage').default('0.000'),
  differenceBill: numeric('difference_bill').default('0.00'),
  differenceUsage: numeric('difference_usage').default('0.000'),
  totalBulkBill: numeric('total_bulk_bill').default('0.00'),
  phoneNumber: text('phoneNumber'),
  roundKey: text('ROUND_KEY'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
}, (t) => ({
  routeKeyIdx: index('idx_bulk_route_key').on(t.routeKey),
}));


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
  routeKey: text('ROUTE_KEY').references(() => routes.routeKey, { onDelete: 'set null' }),
  roundKey: text('ROUND_KEY'),
  calculatedBill: numeric('calculatedBill'),
  outStandingbill: numeric('outStandingbill'),
  sewerageConnection: text('sewerageConnection'),
  specificArea: text('specificArea'),
  subCity: text('subCity'),
  woreda: text('woreda'),
  xCoordinate: numeric('x_coordinate'),
  yCoordinate: numeric('y_coordinate'),
  zCoordinate: numeric('z_coordinate'),
  approvedBy: uuid('approved_by').references(() => staffMembers.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  assignedBulkIdx: index('idx_individual_assigned_bulk').on(t.assignedBulkMeterId),
  routeKeyIdx: index('idx_individual_route_key').on(t.routeKey),
}));

// 3. Billing & Readings
export const bills = pgTable('bills', {
  id: uuid('id').default(sql`gen_random_uuid()`),
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
}, (t) => ({
  pk: primaryKey({ columns: [t.id, t.monthYear] }),
  customerKeyIdx: index('idx_bills_customer').on(t.customerKey, t.monthYear),
  individualCustomerIdx: index('idx_bills_individual').on(t.individualCustomerId, t.monthYear),
}));

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  billId: uuid('bill_id'),
  billMonthYear: text('bill_month_year'), // Must match the partition key of bills
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
  effectiveDate: date('effective_date').notNull(),
  tiers: jsonb('tiers').notNull(),
  sewerageTiers: jsonb('sewerage_tiers'),
  maintenancePercentage: numeric('maintenance_percentage').default('0.01'),
  sanitationPercentage: numeric('sanitation_percentage'),
  vatRate: numeric('vat_rate').default('0.15'),
  domesticVatThresholdM3: numeric('domestic_vat_threshold_m3'),
  meterRentPrices: jsonb('meter_rent_prices'),
  fixedTierIndex: integer('fixed_tier_index'),
  useRuleOfThree: boolean('use_rule_of_three').default(true),
  penaltyMonthThreshold: integer('penalty_month_threshold').default(3),
  bankLendingRate: numeric('bank_lending_rate').default('0.15'),
  penaltyTieredRates: jsonb('penalty_tiered_rates').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
}, (t) => ({
  unq: sql`UNIQUE(${t.customerType}, ${t.effectiveDate})`,
}));

// 10. System Settings
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessionSettings = pgTable('session_settings', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sessionDurationSeconds: integer('session_duration_seconds'),
  warningBeforeExpirySeconds: integer('warning_before_expiry_seconds'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 11. Spatial Data Management
export const spatialRecords = pgTable('spatial_records', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(), // 'individual_customer' or 'bulk_meter'
  xCoordinate: numeric('x_coordinate'),
  yCoordinate: numeric('y_coordinate'),
  zCoordinate: numeric('z_coordinate'),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => staffMembers.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => staffMembers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  tokenSalt: text('token_salt'),
  deviceName: text('device_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
});

export const offlineSyncMetrics = pgTable('offline_sync_metrics', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  event: text('event').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  localId: text('local_id'),
  serverId: text('server_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});


