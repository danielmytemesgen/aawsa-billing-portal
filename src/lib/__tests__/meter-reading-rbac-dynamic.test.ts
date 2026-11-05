import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../constants/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: simulate a hasPermission function for a given permission set
// ─────────────────────────────────────────────────────────────────────────────
function makeHasPermission(perms: string[]) {
  const set = new Set(perms);
  return (p: string) => set.has(p);
}

// Simulate the same computed flags used in the React pages
function computeFlags(hasPermission: (p: string) => boolean) {
  const isSuper = hasPermission('*') || hasPermission('all') || hasPermission('admin');
  return {
    canViewIndividualReadings:
      isSuper ||
      hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL) ||
      hasPermission(PERMISSIONS.METER_READINGS_VIEW_BRANCH) ||
      hasPermission(PERMISSIONS.METER_READINGS_VIEW_INDIVIDUAL) ||
      hasPermission(PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL) ||
      hasPermission(PERMISSIONS.METER_READINGS_CREATE) ||
      hasPermission(PERMISSIONS.ROUTES_VIEW_ASSIGNED),
    canViewBulkReadings:
      isSuper ||
      hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL) ||
      hasPermission(PERMISSIONS.METER_READINGS_VIEW_BRANCH) ||
      hasPermission(PERMISSIONS.METER_READINGS_VIEW_BULK) ||
      hasPermission(PERMISSIONS.METER_READINGS_CREATE_BULK) ||
      hasPermission(PERMISSIONS.METER_READINGS_CREATE) ||
      hasPermission(PERMISSIONS.ROUTES_VIEW_ASSIGNED),
    canViewAnalytics:
      isSuper ||
      hasPermission(PERMISSIONS.METER_READINGS_ANALYTICS_VIEW) ||
      hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL),
    canViewCorrections:
      isSuper ||
      hasPermission(PERMISSIONS.METER_READINGS_CORRECTIONS_VIEW) ||
      hasPermission(PERMISSIONS.METER_READINGS_CORRECT) ||
      hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL),
    canExport:
      isSuper ||
      hasPermission(PERMISSIONS.METER_READINGS_EXPORT) ||
      hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL),
    canControlPeriod:
      isSuper ||
      hasPermission(PERMISSIONS.METER_READINGS_PERIOD_CONTROL) ||
      hasPermission(PERMISSIONS.SETTINGS_MANAGE),
    canViewPeriod:
      isSuper ||
      hasPermission(PERMISSIONS.METER_READINGS_PERIOD_CONTROL) ||
      hasPermission(PERMISSIONS.METER_READINGS_PERIOD_VIEW) ||
      hasPermission(PERMISSIONS.SETTINGS_MANAGE),
    canShiftMonth:
      isSuper ||
      hasPermission(PERMISSIONS.METER_READINGS_SHIFT_MONTH) ||
      hasPermission(PERMISSIONS.METER_READINGS_UPDATE) ||
      hasPermission(PERMISSIONS.METER_READINGS_CREATE),
    canCorrect:
      isSuper ||
      hasPermission(PERMISSIONS.METER_READINGS_CORRECT) ||
      hasPermission(PERMISSIONS.METER_READINGS_UPDATE),
    canOfflineMetrics:
      isSuper ||
      hasPermission(PERMISSIONS.METER_READINGS_OFFLINE_METRICS) ||
      hasPermission(PERMISSIONS.READER_PROGRESS_VIEW) ||
      hasPermission(PERMISSIONS.ROUTES_VIEW_ALL) ||
      hasPermission(PERMISSIONS.METER_READINGS_VIEW_ALL),
  };
}

function getPermittedTabs(flags: ReturnType<typeof computeFlags>): string[] {
  return [
    flags.canViewIndividualReadings && 'individual',
    flags.canViewBulkReadings && 'bulk',
    flags.canViewAnalytics && 'analytics',
    flags.canViewAnalytics && 'report',
    flags.canViewCorrections && 'corrections',
  ].filter(Boolean) as string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Meter Readings RBAC — Dynamic UI Permission Flags', () => {

  describe('Admin / System Administrator (full access via *)', () => {
    const flags = computeFlags(makeHasPermission(['*']));

    it('grants access to all UI sections', () => {
      expect(flags.canViewIndividualReadings).toBe(true);
      expect(flags.canViewBulkReadings).toBe(true);
      expect(flags.canViewAnalytics).toBe(true);
      expect(flags.canViewCorrections).toBe(true);
      expect(flags.canExport).toBe(true);
      expect(flags.canControlPeriod).toBe(true);
      expect(flags.canViewPeriod).toBe(true);
      expect(flags.canShiftMonth).toBe(true);
      expect(flags.canCorrect).toBe(true);
      expect(flags.canOfflineMetrics).toBe(true);
    });

    it('shows all 5 tabs', () => {
      expect(getPermittedTabs(flags)).toHaveLength(5);
    });
  });

  describe('Field Reader (create individual & bulk only)', () => {
    const flags = computeFlags(makeHasPermission([
      PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL,
      PERMISSIONS.METER_READINGS_CREATE_BULK,
      PERMISSIONS.METER_READINGS_PERIOD_VIEW,
      PERMISSIONS.METER_READINGS_OFFLINE_METRICS,
    ]));

    it('can view both reading tabs', () => {
      expect(flags.canViewIndividualReadings).toBe(true);
      expect(flags.canViewBulkReadings).toBe(true);
    });

    it('cannot view analytics, corrections, or export', () => {
      expect(flags.canViewAnalytics).toBe(false);
      expect(flags.canViewCorrections).toBe(false);
      expect(flags.canExport).toBe(false);
    });

    it('cannot control period but can view it', () => {
      expect(flags.canControlPeriod).toBe(false);
      expect(flags.canViewPeriod).toBe(true);
    });

    it('cannot correct readings or shift months', () => {
      expect(flags.canCorrect).toBe(false);
      expect(flags.canShiftMonth).toBe(false);
    });

    it('can access offline metrics', () => {
      expect(flags.canOfflineMetrics).toBe(true);
    });

    it('shows only 2 tabs (individual + bulk)', () => {
      expect(getPermittedTabs(flags)).toEqual(['individual', 'bulk']);
    });
  });

  describe('Bulk-only Reader (view_bulk only)', () => {
    const flags = computeFlags(makeHasPermission([
      PERMISSIONS.METER_READINGS_VIEW_BULK,
    ]));

    it('can view bulk tab but not individual', () => {
      expect(flags.canViewBulkReadings).toBe(true);
      expect(flags.canViewIndividualReadings).toBe(false);
    });

    it('shows only bulk tab, defaulting to bulk', () => {
      const tabs = getPermittedTabs(flags);
      expect(tabs).toContain('bulk');
      expect(tabs).not.toContain('individual');
      // First tab should be bulk, so active tab default is bulk
      expect(tabs[0]).toBe('bulk');
    });
  });

  describe('Data Encoder (upload individual + bulk CSV)', () => {
    const flags = computeFlags(makeHasPermission([
      PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL,
      PERMISSIONS.METER_READINGS_UPLOAD_BULK,
      PERMISSIONS.METER_READINGS_VIEW_BRANCH,
      PERMISSIONS.METER_READINGS_CORRECTIONS_VIEW,
    ]));

    it('can view both reading types and corrections', () => {
      expect(flags.canViewIndividualReadings).toBe(true);
      expect(flags.canViewBulkReadings).toBe(true);
      expect(flags.canViewCorrections).toBe(true);
    });

    it('cannot perform corrections, control period, shift month, or export', () => {
      expect(flags.canCorrect).toBe(false);
      expect(flags.canControlPeriod).toBe(false);
      expect(flags.canShiftMonth).toBe(false);
      expect(flags.canExport).toBe(false);
    });

    it('shows 3 tabs (individual, bulk, corrections)', () => {
      const tabs = getPermittedTabs(flags);
      expect(tabs).toContain('individual');
      expect(tabs).toContain('bulk');
      expect(tabs).toContain('corrections');
      expect(tabs).not.toContain('analytics');
      expect(tabs).not.toContain('report');
    });
  });

  describe('Branch Manager (view_all within branch + corrections + export + analytics)', () => {
    const flags = computeFlags(makeHasPermission([
      PERMISSIONS.METER_READINGS_VIEW_BRANCH,
      PERMISSIONS.METER_READINGS_ANALYTICS_VIEW,
      PERMISSIONS.METER_READINGS_CORRECTIONS_VIEW,
      PERMISSIONS.METER_READINGS_CORRECT,
      PERMISSIONS.METER_READINGS_EXPORT,
      PERMISSIONS.METER_READINGS_PERIOD_VIEW,
    ]));

    it('can view all tabs', () => {
      expect(flags.canViewIndividualReadings).toBe(true);
      expect(flags.canViewBulkReadings).toBe(true);
      expect(flags.canViewAnalytics).toBe(true);
      expect(flags.canViewCorrections).toBe(true);
    });

    it('can export and correct readings', () => {
      expect(flags.canExport).toBe(true);
      expect(flags.canCorrect).toBe(true);
    });

    it('cannot control period (only view it)', () => {
      expect(flags.canControlPeriod).toBe(false);
      expect(flags.canViewPeriod).toBe(true);
    });

    it('shows all 5 tabs', () => {
      expect(getPermittedTabs(flags)).toHaveLength(5);
    });
  });

  describe('Period Control Guard', () => {
    it('meter_readings_period_control grants both view and control', () => {
      const flags = computeFlags(makeHasPermission([PERMISSIONS.METER_READINGS_PERIOD_CONTROL]));
      expect(flags.canControlPeriod).toBe(true);
      expect(flags.canViewPeriod).toBe(true);
    });

    it('meter_readings_period_view grants view only, not control', () => {
      const flags = computeFlags(makeHasPermission([PERMISSIONS.METER_READINGS_PERIOD_VIEW]));
      expect(flags.canViewPeriod).toBe(true);
      expect(flags.canControlPeriod).toBe(false);
    });

    it('no period permissions hides the period control card entirely', () => {
      const flags = computeFlags(makeHasPermission(['unrelated_permission']));
      expect(flags.canViewPeriod).toBe(false);
      expect(flags.canControlPeriod).toBe(false);
    });

    it('settings_manage grants period control via fallback', () => {
      const flags = computeFlags(makeHasPermission([PERMISSIONS.SETTINGS_MANAGE]));
      expect(flags.canControlPeriod).toBe(true);
      expect(flags.canViewPeriod).toBe(true);
    });
  });

  describe('Export Guard', () => {
    it('meter_readings_export grants export', () => {
      const flags = computeFlags(makeHasPermission([PERMISSIONS.METER_READINGS_EXPORT]));
      expect(flags.canExport).toBe(true);
    });

    it('meter_readings_view_all also grants export', () => {
      const flags = computeFlags(makeHasPermission([PERMISSIONS.METER_READINGS_VIEW_ALL]));
      expect(flags.canExport).toBe(true);
    });

    it('view_individual alone does NOT grant export', () => {
      const flags = computeFlags(makeHasPermission([
        PERMISSIONS.METER_READINGS_VIEW_INDIVIDUAL,
      ]));
      expect(flags.canExport).toBe(false);
    });
  });

  describe('Dynamic tab count / grid columns', () => {
    it('computes 5 tabs for full admin', () => {
      const flags = computeFlags(makeHasPermission(['*']));
      expect(getPermittedTabs(flags).length).toBe(5);
    });

    it('computes 2 tabs for individual+bulk view only', () => {
      const flags = computeFlags(makeHasPermission([
        PERMISSIONS.METER_READINGS_VIEW_INDIVIDUAL,
        PERMISSIONS.METER_READINGS_VIEW_BULK,
      ]));
      expect(getPermittedTabs(flags).length).toBe(2);
    });

    it('computes 1 tab for bulk-only viewer', () => {
      const flags = computeFlags(makeHasPermission([
        PERMISSIONS.METER_READINGS_VIEW_BULK,
      ]));
      expect(getPermittedTabs(flags).length).toBe(1);
    });
  });
});
