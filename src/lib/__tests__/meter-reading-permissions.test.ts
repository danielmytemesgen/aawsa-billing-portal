import { describe, expect, it } from 'vitest';
import { canCreateMeterReadingForType } from '../meter-reading-permissions';
import { PERMISSIONS } from '../constants/auth';

describe('canCreateMeterReadingForType', () => {
  it('allows bulk reading when the user has the bulk create permission', () => {
    const hasPermission = (permission: string) => permission === PERMISSIONS.METER_READINGS_CREATE_BULK;

    expect(canCreateMeterReadingForType(hasPermission, 'bulk')).toBe(true);
  });

  it('allows individual reading when the user has the individual create permission', () => {
    const hasPermission = (permission: string) => permission === PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL;

    expect(canCreateMeterReadingForType(hasPermission, 'individual')).toBe(true);
  });

  it('denies access when the user lacks any relevant meter-reading create permission', () => {
    const hasPermission = () => false;

    expect(canCreateMeterReadingForType(hasPermission, 'bulk')).toBe(false);
    expect(canCreateMeterReadingForType(hasPermission, 'individual')).toBe(false);
  });
});
