import { describe, expect, it } from 'vitest';
import { canCreateMeterReadingForType, isReaderStaff } from '../meter-reading-permissions';
import { PERMISSIONS } from '../constants/auth';
import { getRoutePermissionRule } from '../route-permissions';

describe('canCreateMeterReadingForType', () => {
  it('allows bulk reading and denies individual reading when user only has bulk create permission', () => {
    const hasPermission = (permission: string) => permission === PERMISSIONS.METER_READINGS_CREATE_BULK;

    expect(canCreateMeterReadingForType(hasPermission, 'bulk')).toBe(true);
    expect(canCreateMeterReadingForType(hasPermission, 'individual')).toBe(false);
  });

  it('allows individual reading and denies bulk reading when user only has individual create permission', () => {
    const hasPermission = (permission: string) => permission === PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL;

    expect(canCreateMeterReadingForType(hasPermission, 'individual')).toBe(true);
    expect(canCreateMeterReadingForType(hasPermission, 'bulk')).toBe(false);
  });

  it('locks both bulk and individual when both permissions are unassigned', () => {
    const hasPermission = () => false;

    expect(canCreateMeterReadingForType(hasPermission, 'bulk')).toBe(false);
    expect(canCreateMeterReadingForType(hasPermission, 'individual')).toBe(false);
  });

  it('unlocks both bulk and individual when both permissions are assigned', () => {
    const hasPermission = (permission: string) =>
      permission === PERMISSIONS.METER_READINGS_CREATE_BULK ||
      permission === PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL;

    expect(canCreateMeterReadingForType(hasPermission, 'bulk')).toBe(true);
    expect(canCreateMeterReadingForType(hasPermission, 'individual')).toBe(true);
  });

  it('unlocks both for super-admin wildcard permissions', () => {
    const hasWildcard = (permission: string) => permission === '*';
    expect(canCreateMeterReadingForType(hasWildcard, 'bulk')).toBe(true);
    expect(canCreateMeterReadingForType(hasWildcard, 'individual')).toBe(true);

    const hasAll = (permission: string) => permission === 'all';
    expect(canCreateMeterReadingForType(hasAll, 'bulk')).toBe(true);
    expect(canCreateMeterReadingForType(hasAll, 'individual')).toBe(true);
  });

  it('supports upload-based reading creation permissions', () => {
    const hasUploadBulk = (permission: string) => permission === PERMISSIONS.METER_READINGS_UPLOAD_BULK;
    expect(canCreateMeterReadingForType(hasUploadBulk, 'bulk')).toBe(true);
    expect(canCreateMeterReadingForType(hasUploadBulk, 'individual')).toBe(false);

    const hasUploadIndividual = (permission: string) => permission === PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL;
    expect(canCreateMeterReadingForType(hasUploadIndividual, 'individual')).toBe(true);
    expect(canCreateMeterReadingForType(hasUploadIndividual, 'bulk')).toBe(false);
  });
});

describe('isReaderStaff', () => {
  it('identifies user as reader by role name', () => {
    expect(isReaderStaff({ role: 'Field Reader', permissions: [] })).toBe(true);
    expect(isReaderStaff({ role: 'Meter Reader', permissions: [] })).toBe(true);
    expect(isReaderStaff({ role: 'Branch Manager', permissions: [] })).toBe(false);
  });

  it('identifies user as reader by assigned reader permissions', () => {
    expect(isReaderStaff({ role: 'Staff', permissions: [PERMISSIONS.ROUTES_VIEW_ASSIGNED] })).toBe(true);
    expect(isReaderStaff({ role: 'Staff', permissions: [PERMISSIONS.METER_READINGS_CREATE_BULK] })).toBe(true);
    expect(isReaderStaff({ role: 'Staff', permissions: [PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL] })).toBe(true);
    expect(isReaderStaff({ role: 'Staff', permissions: [PERMISSIONS.DASHBOARD_VIEW_ALL] })).toBe(false);
  });
});

describe('Route Permission Rules for Meter Readings and Portal Features', () => {
  it('allows access to /staff/meter-readings for granular individual or bulk creators', () => {
    const meterReadingsRule = getRoutePermissionRule('/staff/meter-readings', []);
    expect(meterReadingsRule).toBeDefined();
    const allowedPerms = new Set(meterReadingsRule?.anyOf || []);

    expect(allowedPerms.has(PERMISSIONS.METER_READINGS_CREATE_BULK)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.METER_READINGS_VIEW_INDIVIDUAL)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.METER_READINGS_VIEW_BULK)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.METER_READINGS_VIEW_ALL)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.METER_READINGS_VIEW_BRANCH)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.METER_READINGS_ADD_MANUAL)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.ROUTES_VIEW_ASSIGNED)).toBe(true);
  });

  it('allows access to customer routes for granular action permissions', () => {
    const adminCustomerRule = getRoutePermissionRule('/admin/individual-customers', []);
    expect(adminCustomerRule).toBeDefined();
    const allowedPerms = new Set(adminCustomerRule?.anyOf || []);

    expect(allowedPerms.has(PERMISSIONS.CUSTOMERS_VIEW_ALL)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.CUSTOMERS_VIEW_BRANCH)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.CUSTOMERS_CREATE)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.CUSTOMERS_CREATE_RESTRICTED)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.CUSTOMERS_UPDATE)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.CUSTOMERS_DELETE)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.CUSTOMERS_APPROVE)).toBe(true);
  });

  it('allows access to bulk meter routes for granular action permissions', () => {
    const staffBulkMeterRule = getRoutePermissionRule('/staff/bulk-meters', []);
    expect(staffBulkMeterRule).toBeDefined();
    const allowedPerms = new Set(staffBulkMeterRule?.anyOf || []);

    expect(allowedPerms.has(PERMISSIONS.BULK_METERS_VIEW_ALL)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BULK_METERS_VIEW_BRANCH)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BULK_METERS_CREATE)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BULK_METERS_CREATE_RESTRICTED)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BULK_METERS_UPDATE)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BULK_METERS_DELETE)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BULK_METERS_APPROVE)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BULK_METERS_MANAGE_CUSTOMERS)).toBe(true);
  });

  it('allows access to bill management for bill workflow permissions', () => {
    const billRule = getRoutePermissionRule('/admin/bill-management', []);
    expect(billRule).toBeDefined();
    const allowedPerms = new Set(billRule?.anyOf || []);

    expect(allowedPerms.has(PERMISSIONS.BILL_VIEW_ALL)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BILL_CREATE)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BILL_VIEW_DRAFTS)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BILL_VIEW_PENDING)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BILL_VIEW_APPROVED)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BILL_APPROVE)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BILL_POST)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BILL_SEND)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BILL_REWORK)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.BILL_CLOSE_CYCLE)).toBe(true);
  });
});
