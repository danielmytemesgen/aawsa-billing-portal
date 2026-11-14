import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../constants/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Simulated permission checker matching usePermissions() and checkPermissionAny()
// ─────────────────────────────────────────────────────────────────────────────
function makeHasPermission(perms: string[]) {
  const set = new Set(perms);
  return (p: string) => {
    if (set.has('*') || set.has('all') || set.has('admin')) return true;
    if (set.has('bill:manage_all') && (p.startsWith('bill:') || p.startsWith('invoice:') || p === 'billing:close_cycle')) return true;
    return set.has(p);
  };
}

// Simulated InvoiceGeneratorView computed flags
function computeInvoiceFlags(hasPermission: (p: string) => boolean) {
  const isFullAdmin = hasPermission(PERMISSIONS.BILL_VIEW_ALL);

  const canViewInvoices = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_VIEW);
  const canPrint = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_PRINT);
  const canExportCSV = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_EXPORT_CSV);
  const canExportExcel = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_EXPORT_EXCEL);
  const canAccessBatch = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_BATCH);
  const canAccessStatement = isFullAdmin || hasPermission(PERMISSIONS.INVOICE_CUSTOMER_STATEMENT);

  const defaultTab: "batch" | "customer" = canAccessBatch ? "batch" : "customer";

  return {
    canViewInvoices,
    canPrint,
    canExportCSV,
    canExportExcel,
    canAccessBatch,
    canAccessStatement,
    defaultTab,
  };
}

describe('Invoice Generator RBAC & Dynamic UI Permissions', () => {
  describe('Global Administrator (Full Access)', () => {
    it('has full access to all invoice features via bill:manage_all', () => {
      const hasPerm = makeHasPermission([PERMISSIONS.BILL_VIEW_ALL]);
      const flags = computeInvoiceFlags(hasPerm);

      expect(flags.canViewInvoices).toBe(true);
      expect(flags.canPrint).toBe(true);
      expect(flags.canExportCSV).toBe(true);
      expect(flags.canExportExcel).toBe(true);
      expect(flags.canAccessBatch).toBe(true);
      expect(flags.canAccessStatement).toBe(true);
      expect(flags.defaultTab).toBe('batch');
    });

    it('has full access via wildcard * permission', () => {
      const hasPerm = makeHasPermission(['*']);
      const flags = computeInvoiceFlags(hasPerm);

      expect(flags.canViewInvoices).toBe(true);
      expect(flags.canPrint).toBe(true);
      expect(flags.canExportCSV).toBe(true);
      expect(flags.canExportExcel).toBe(true);
      expect(flags.canAccessBatch).toBe(true);
      expect(flags.canAccessStatement).toBe(true);
    });
  });

  describe('Branch Manager / Approver', () => {
    const managerPerms = [
      'invoice:view',
      'invoice:print',
      'invoice:batch',
      'invoice:customer_statement',
    ];

    it('can view, print, access both tabs, but cannot export raw CSV/Excel', () => {
      const hasPerm = makeHasPermission(managerPerms);
      const flags = computeInvoiceFlags(hasPerm);

      expect(flags.canViewInvoices).toBe(true);
      expect(flags.canPrint).toBe(true);
      expect(flags.canAccessBatch).toBe(true);
      expect(flags.canAccessStatement).toBe(true);
      expect(flags.canExportCSV).toBe(false);
      expect(flags.canExportExcel).toBe(false);
      expect(flags.defaultTab).toBe('batch');
    });
  });

  describe('Staff / Billing Officer (Data Encoder)', () => {
    const staffPerms = [
      'invoice:view',
      'invoice:print',
      'invoice:batch',
    ];

    it('can view and print batch invoices, but cannot see customer statement tab or export files', () => {
      const hasPerm = makeHasPermission(staffPerms);
      const flags = computeInvoiceFlags(hasPerm);

      expect(flags.canViewInvoices).toBe(true);
      expect(flags.canPrint).toBe(true);
      expect(flags.canAccessBatch).toBe(true);
      expect(flags.canAccessStatement).toBe(false);
      expect(flags.canExportCSV).toBe(false);
      expect(flags.canExportExcel).toBe(false);
      expect(flags.defaultTab).toBe('batch');
    });
  });

  describe('Cashier / Teller (Walk-in Desk)', () => {
    const cashierPerms = [
      'invoice:view',
      'invoice:print',
      'invoice:customer_statement',
    ];

    it('can view and print customer statements, but cannot access batch invoices or export', () => {
      const hasPerm = makeHasPermission(cashierPerms);
      const flags = computeInvoiceFlags(hasPerm);

      expect(flags.canViewInvoices).toBe(true);
      expect(flags.canPrint).toBe(true);
      expect(flags.canAccessBatch).toBe(false);
      expect(flags.canAccessStatement).toBe(true);
      expect(flags.canExportCSV).toBe(false);
      expect(flags.canExportExcel).toBe(false);
      // When batch is not available, defaultTab flips dynamically to customer
      expect(flags.defaultTab).toBe('customer');
    });
  });

  describe('Auditor / Inspector', () => {
    const auditorPerms = [
      'invoice:view',
      'invoice:batch',
      'invoice:customer_statement',
    ];

    it('can view both tabs for inspection, but print and exports are disabled', () => {
      const hasPerm = makeHasPermission(auditorPerms);
      const flags = computeInvoiceFlags(hasPerm);

      expect(flags.canViewInvoices).toBe(true);
      expect(flags.canAccessBatch).toBe(true);
      expect(flags.canAccessStatement).toBe(true);
      expect(flags.canPrint).toBe(false);
      expect(flags.canExportCSV).toBe(false);
      expect(flags.canExportExcel).toBe(false);
    });
  });

  describe('Unauthorized Role', () => {
    it('is completely denied when no invoice permission exists', () => {
      const hasPerm = makeHasPermission(['some_other_permission']);
      const flags = computeInvoiceFlags(hasPerm);

      expect(flags.canViewInvoices).toBe(false);
      expect(flags.canPrint).toBe(false);
      expect(flags.canExportCSV).toBe(false);
      expect(flags.canExportExcel).toBe(false);
      expect(flags.canAccessBatch).toBe(false);
      expect(flags.canAccessStatement).toBe(false);
    });
  });

  describe('Print Route Permission Protection', () => {
    it('allows users with invoice:print to access print route', () => {
      const hasPerm = makeHasPermission(['invoice:print']);
      const isFullAdmin = hasPerm(PERMISSIONS.BILL_VIEW_ALL);
      const canPrint = isFullAdmin || hasPerm(PERMISSIONS.INVOICE_PRINT);
      expect(canPrint).toBe(true);
    });

    it('blocks users without invoice:print from printing', () => {
      const hasPerm = makeHasPermission(['invoice:view']);
      const isFullAdmin = hasPerm(PERMISSIONS.BILL_VIEW_ALL);
      const canPrint = isFullAdmin || hasPerm(PERMISSIONS.INVOICE_PRINT);
      expect(canPrint).toBe(false);
    });
  });
});

