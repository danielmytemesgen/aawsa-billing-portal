import { PERMISSIONS } from './constants/auth';

export type MeterReadingType = 'bulk' | 'individual';

export function canCreateMeterReadingForType(
  hasPermission: (permission: string) => boolean,
  type: MeterReadingType
) {
  const createPermissions = {
    bulk: [
      PERMISSIONS.METER_READINGS_CREATE_BULK,
      PERMISSIONS.METER_READINGS_CREATE,
      PERMISSIONS.METER_READINGS_ADD_MANUAL,
      PERMISSIONS.METER_READINGS_UPLOAD_BULK,
    ],
    individual: [
      PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL,
      PERMISSIONS.METER_READINGS_CREATE,
      PERMISSIONS.METER_READINGS_ADD_MANUAL,
      PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL,
    ],
  } as const;

  return createPermissions[type].some((permission) => hasPermission(permission));
}
