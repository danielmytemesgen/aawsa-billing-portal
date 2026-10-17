/**
 * High-Performance Server-Side In-Memory Cache
 *
 * Drastically reduces PostgreSQL overhead by caching static and slow-changing
 * lookups (staff permissions, branches, tariffs) with short, self-expiring TTLs
 * and instant invalidation on mutations.
 */

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheItem<any>>();

export async function getOrSetCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = memoryStore.get(key);
  const now = Date.now();

  if (existing && existing.expiresAt > now) {
    return existing.value as T;
  }

  const fresh = await fetcher();
  memoryStore.set(key, {
    value: fresh,
    expiresAt: now + ttlMs,
  });
  return fresh;
}

export function invalidateCacheKey(key: string): void {
  memoryStore.delete(key);
}

export function invalidateCachePrefix(prefix: string): void {
  for (const k of memoryStore.keys()) {
    if (k.startsWith(prefix)) {
      memoryStore.delete(k);
    }
  }
}

export function clearServerCache(): void {
  memoryStore.clear();
}

// ── Specialized Cache Helpers ──────────────────────────────────────────────────

/** Staff Permissions Cache: 60s TTL — saves 10-25ms per server action */
const PERMS_CACHE_PREFIX = 'staff_perms:';

export async function getCachedStaffPermissions(
  staffId: string,
  fetcher: (id: string) => Promise<string[]>
): Promise<string[]> {
  const key = `${PERMS_CACHE_PREFIX}${staffId}`;
  return getOrSetCache(key, 60_000, () => fetcher(staffId));
}

export function invalidateStaffPermissions(staffId?: string): void {
  if (staffId) {
    invalidateCacheKey(`${PERMS_CACHE_PREFIX}${staffId}`);
  } else {
    invalidateCachePrefix(PERMS_CACHE_PREFIX);
  }
}

/** Branches Cache: 5 min TTL — saves 10-15ms on every route mount */
const BRANCHES_KEY = 'global_branches_list';

export async function getCachedBranches<T>(fetcher: () => Promise<T>): Promise<T> {
  return getOrSetCache(BRANCHES_KEY, 300_000, fetcher);
}

export function invalidateBranchesCache(): void {
  invalidateCacheKey(BRANCHES_KEY);
}

/** Tariffs Cache: 10 min TTL */
const TARIFFS_KEY = 'active_tariffs_list';

export async function getCachedTariffs<T>(fetcher: () => Promise<T>): Promise<T> {
  return getOrSetCache(TARIFFS_KEY, 600_000, fetcher);
}

export function invalidateTariffsCache(): void {
  invalidateCacheKey(TARIFFS_KEY);
}

/** Penalty Guard Flags Cache: 30s TTL — eliminates 1000+ duplicate hits per billing batch */
const PENALTY_GUARD_KEY = 'penalty_guard_flags';

export async function getCachedPenaltyGuardFlags(
  fetcher: () => Promise<{ penalty_enabled: boolean; effective_date: string }[]>
): Promise<{ penalty_enabled: boolean; effective_date: string }[]> {
  return getOrSetCache(PENALTY_GUARD_KEY, 30_000, fetcher);
}

/** Call this after any tariff create/update/delete to ensure the guard reflects latest data. */
export function invalidatePenaltyGuardCache(): void {
  invalidateCacheKey(PENALTY_GUARD_KEY);
}
