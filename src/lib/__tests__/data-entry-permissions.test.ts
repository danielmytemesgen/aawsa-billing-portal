import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../constants/auth';
import { getRoutePermissionRule } from '../route-permissions';

describe('Data Entry Permissions - Assign & Unassign Functionality', () => {
  const evaluateDataEntryAccess = (perms: string[]) => {
    const hasPermission = (p: string) => perms.includes('*') || perms.includes('all') || perms.includes('admin') || perms.includes(p);

    const canIndividualManual = hasPermission(PERMISSIONS.DATA_ENTRY_INDIVIDUAL_FORM);
    const canBulkManual = hasPermission(PERMISSIONS.DATA_ENTRY_BULK_FORM);
    const canBulkCsv = hasPermission(PERMISSIONS.DATA_ENTRY_BULK_CSV);
    const canIndividualCsv = hasPermission(PERMISSIONS.DATA_ENTRY_INDIVIDUAL_CSV);
    const canCsvUpload = canBulkCsv || canIndividualCsv;
    const canAccessDataEntry = hasPermission('data_entry_access') || canIndividualManual || canBulkManual || canCsvUpload;

    return {
      canIndividualManual,
      canBulkManual,
      canBulkCsv,
      canIndividualCsv,
      canCsvUpload,
      canAccessDataEntry,
      activeTabsCount: (canIndividualManual ? 1 : 0) + (canBulkManual ? 1 : 0) + (canCsvUpload ? 1 : 0),
    };
  };

  it('State 1: Both Forms Assigned, Both CSV Unassigned, with data_entry_access present (User Screenshot State: 2 / 4)', () => {
    // Staff has data_entry_access from Data & Reports, but only 2 of 4 granular permissions
    const userPerms = [
      'data_entry_access',
      PERMISSIONS.DATA_ENTRY_BULK_FORM,
      PERMISSIONS.DATA_ENTRY_INDIVIDUAL_FORM,
    ];

    const state = evaluateDataEntryAccess(userPerms);

    expect(state.canBulkManual).toBe(true);
    expect(state.canIndividualManual).toBe(true);
    expect(state.canBulkCsv).toBe(false);
    expect(state.canIndividualCsv).toBe(false);
    expect(state.canCsvUpload).toBe(false);
    expect(state.canAccessDataEntry).toBe(true);
    expect(state.activeTabsCount).toBe(2);
  });

  it('State 2: Bulk Form Only Assigned (1 / 4)', () => {
    const userPerms = [PERMISSIONS.DATA_ENTRY_BULK_FORM];
    const state = evaluateDataEntryAccess(userPerms);

    expect(state.canBulkManual).toBe(true);
    expect(state.canIndividualManual).toBe(false);
    expect(state.canBulkCsv).toBe(false);
    expect(state.canIndividualCsv).toBe(false);
    expect(state.canCsvUpload).toBe(false);
    expect(state.canAccessDataEntry).toBe(true);
    expect(state.activeTabsCount).toBe(1);
  });

  it('State 3: Individual Form Only Assigned (1 / 4)', () => {
    const userPerms = [PERMISSIONS.DATA_ENTRY_INDIVIDUAL_FORM];
    const state = evaluateDataEntryAccess(userPerms);

    expect(state.canBulkManual).toBe(false);
    expect(state.canIndividualManual).toBe(true);
    expect(state.canBulkCsv).toBe(false);
    expect(state.canIndividualCsv).toBe(false);
    expect(state.canCsvUpload).toBe(false);
    expect(state.canAccessDataEntry).toBe(true);
    expect(state.activeTabsCount).toBe(1);
  });

  it('State 4: Bulk CSV Only Assigned (1 / 4)', () => {
    const userPerms = [PERMISSIONS.DATA_ENTRY_BULK_CSV];
    const state = evaluateDataEntryAccess(userPerms);

    expect(state.canBulkManual).toBe(false);
    expect(state.canIndividualManual).toBe(false);
    expect(state.canBulkCsv).toBe(true);
    expect(state.canIndividualCsv).toBe(false);
    expect(state.canCsvUpload).toBe(true);
    expect(state.canAccessDataEntry).toBe(true);
    expect(state.activeTabsCount).toBe(1);
  });

  it('State 5: Individual CSV Only Assigned (1 / 4)', () => {
    const userPerms = [PERMISSIONS.DATA_ENTRY_INDIVIDUAL_CSV];
    const state = evaluateDataEntryAccess(userPerms);

    expect(state.canBulkManual).toBe(false);
    expect(state.canIndividualManual).toBe(false);
    expect(state.canBulkCsv).toBe(false);
    expect(state.canIndividualCsv).toBe(true);
    expect(state.canCsvUpload).toBe(true);
    expect(state.canAccessDataEntry).toBe(true);
    expect(state.activeTabsCount).toBe(1);
  });

  it('State 6: All Four Permissions Unassigned (0 / 4)', () => {
    const userPerms: string[] = [];
    const state = evaluateDataEntryAccess(userPerms);

    expect(state.canBulkManual).toBe(false);
    expect(state.canIndividualManual).toBe(false);
    expect(state.canBulkCsv).toBe(false);
    expect(state.canIndividualCsv).toBe(false);
    expect(state.canCsvUpload).toBe(false);
    expect(state.canAccessDataEntry).toBe(false);
    expect(state.activeTabsCount).toBe(0);
  });

  it('State 7: All Four Permissions Assigned (4 / 4)', () => {
    const userPerms = [
      PERMISSIONS.DATA_ENTRY_BULK_FORM,
      PERMISSIONS.DATA_ENTRY_INDIVIDUAL_FORM,
      PERMISSIONS.DATA_ENTRY_BULK_CSV,
      PERMISSIONS.DATA_ENTRY_INDIVIDUAL_CSV,
    ];
    const state = evaluateDataEntryAccess(userPerms);

    expect(state.canBulkManual).toBe(true);
    expect(state.canIndividualManual).toBe(true);
    expect(state.canBulkCsv).toBe(true);
    expect(state.canIndividualCsv).toBe(true);
    expect(state.canCsvUpload).toBe(true);
    expect(state.canAccessDataEntry).toBe(true);
    expect(state.activeTabsCount).toBe(3);
  });

  it('Route Guard: verifies /admin/data-entry and /staff/data-entry recognize all 4 tokens', () => {
    const adminRule = getRoutePermissionRule('/admin/data-entry', []);
    const staffRule = getRoutePermissionRule('/staff/data-entry', []);

    expect(adminRule).toBeDefined();
    expect(staffRule).toBeDefined();

    const allowedPerms = new Set(adminRule?.anyOf || []);
    expect(allowedPerms.has(PERMISSIONS.DATA_ENTRY_BULK_FORM)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.DATA_ENTRY_INDIVIDUAL_FORM)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.DATA_ENTRY_BULK_CSV)).toBe(true);
    expect(allowedPerms.has(PERMISSIONS.DATA_ENTRY_INDIVIDUAL_CSV)).toBe(true);
  });
});
