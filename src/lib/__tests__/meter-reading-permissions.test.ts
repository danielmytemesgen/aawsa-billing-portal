import { describe, expect, it } from 'vitest';
import { canCreateMeterReadingForType } from '../meter-reading-permissions';
import { PERMISSIONS } from '../constants/auth';

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
});
