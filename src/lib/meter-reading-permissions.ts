import { PERMISSIONS } from './constants/auth';

export type MeterReadingType = 'bulk' | 'individual';

export function canCreateMeterReadingForType(
  hasPermission: (permission: string) => boolean,
  type: MeterReadingType
) {
  // Super-admin wildcard check
  if (hasPermission('*') || hasPermission('all') || hasPermission('admin')) {
    return true;
  }

  if (type === 'bulk') {
    return (
      hasPermission(PERMISSIONS.METER_READINGS_CREATE_BULK) ||
      hasPermission('meter_readings:create_bulk') ||
      hasPermission('meter_readings_create_bulk') ||
      hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_BULK) ||
      hasPermission('meter_readings:upload_bulk') ||
      hasPermission('meter_readings_upload_bulk')
    );
  }

  if (type === 'individual') {
    return (
      hasPermission(PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL) ||
      hasPermission('meter_readings:create_individual') ||
      hasPermission('meter_readings_create_individual') ||
      hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL) ||
      hasPermission('meter_readings:upload_individual') ||
      hasPermission('meter_readings_upload_individual')
    );
  }

  return false;
}
