import { useEffect, useState } from 'react';
import { getTariffs, subscribeToTariffs } from '@/lib/data-store';
import { isPenaltyEngineEnabled } from '@/lib/billing-utils';

/**
 * Returns the current global penalty engine status as a reactive boolean.
 *
 * - Derives state synchronously on mount from the client-side tariff store
 *   (zero extra network calls if tariffs are already loaded).
 * - Re-derives whenever the tariff store notifies subscribers (e.g. after an
 *   admin saves changes to the tariff settings page).
 *
 * Replace all inline `isPenaltyEngineEnabled(getTariffs())` calls in components
 * with this hook to keep the logic in a single place.
 *
 * @returns `true`  when the penalty engine is ON  (penalties accrue normally)
 * @returns `false` when the penalty engine is OFF (all penalties are clamped to 0)
 */
export function usePenaltyEngineStatus(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() =>
    isPenaltyEngineEnabled(getTariffs())
  );

  useEffect(() => {
    // Immediately recompute in case tariffs loaded between render and effect
    setEnabled(isPenaltyEngineEnabled(getTariffs()));

    // Subscribe to store changes - fires whenever tariffs are mutated
    const unsubscribe = subscribeToTariffs((latestTariffs: any[]) => {
      setEnabled(isPenaltyEngineEnabled(latestTariffs));
    });

    return () => unsubscribe();
  }, []);

  return enabled;
}
