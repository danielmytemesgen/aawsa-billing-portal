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
      hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_BULK) ||
      hasPermission(PERMISSIONS.METER_READINGS_CREATE) ||
      hasPermission(PERMISSIONS.DATA_ENTRY_BULK_CSV) ||
      hasPermission(PERMISSIONS.DATA_ENTRY_ACCESS)
    );
  }

  if (type === 'individual') {
    return (
      hasPermission(PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL) ||
      hasPermission(PERMISSIONS.METER_READINGS_UPLOAD_INDIVIDUAL) ||
      hasPermission(PERMISSIONS.METER_READINGS_CREATE) ||
      hasPermission(PERMISSIONS.DATA_ENTRY_INDIVIDUAL_CSV) ||
      hasPermission(PERMISSIONS.DATA_ENTRY_ACCESS)
    );
  }

  return false;
}

export function isReaderStaff(user?: { role?: string; permissions?: string[] } | null): boolean {
  if (!user) return false;
  const roleLower = (user.role || '').toLowerCase().trim();
  const perms = new Set(user.permissions || []);

  // Recognized as reader if role name contains 'reader' (backward compatibility)
  // OR if user holds field/reader permissions
  return (
    roleLower.includes('reader') ||
    perms.has(PERMISSIONS.ROUTES_VIEW_ASSIGNED) ||
    perms.has(PERMISSIONS.METER_READINGS_CREATE_BULK) ||
    perms.has(PERMISSIONS.METER_READINGS_CREATE_INDIVIDUAL) ||
    perms.has(PERMISSIONS.METER_READINGS_CREATE) ||
    perms.has(PERMISSIONS.DATA_ENTRY_ACCESS)
  );
}

