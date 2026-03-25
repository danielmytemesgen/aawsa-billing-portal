/**
 * Billing Configuration
 *
 * Supports two cycle modes:
 *  - once_per_month: cycle runs from configurable start day to same day next month
 *  - custom: admin supplies explicit start/end dates per run
 */

// ─── Default constants (used as fallback) ────────────────────────────────────
export const BILLING_CYCLE_START_DAY = 16;
export const BILLING_DUE_DATE_OFFSET_DAYS = 15;

// ─── LocalStorage keys ────────────────────────────────────────────────────────
export const BILLING_CYCLE_DAY_KEY = 'aawsa-billing-cycle-day';
export const BILLING_CYCLE_MODE_KEY = 'aawsa-billing-cycle-mode';
export const BILLING_DUE_DATE_OFFSET_KEY = 'aawsa-billing-due-date-offset';

export type BillingCycleMode = 'once_per_month' | 'custom';

export interface BillingCycleConfig {
    mode: BillingCycleMode;
    cycleStartDay: number;   // 1-28, used in once_per_month mode
    dueDateOffsetDays: number; // days after period end before bill is due
}

/**
 * Read billing cycle configuration from localStorage.
 * Safe to call on the server: returns defaults if typeof window is undefined.
 */
export function getBillingCycleConfig(): BillingCycleConfig {
    if (typeof window === 'undefined') {
        return {
            mode: 'once_per_month',
            cycleStartDay: BILLING_CYCLE_START_DAY,
            dueDateOffsetDays: BILLING_DUE_DATE_OFFSET_DAYS,
        };
    }
    const mode = (localStorage.getItem(BILLING_CYCLE_MODE_KEY) as BillingCycleMode) || 'once_per_month';
    const cycleStartDay = parseInt(localStorage.getItem(BILLING_CYCLE_DAY_KEY) || String(BILLING_CYCLE_START_DAY), 10);
    const dueDateOffsetDays = parseInt(localStorage.getItem(BILLING_DUE_DATE_OFFSET_KEY) || String(BILLING_DUE_DATE_OFFSET_DAYS), 10);
    return { mode, cycleStartDay, dueDateOffsetDays };
}

// ─── Period helpers ───────────────────────────────────────────────────────────

/**
 * Get the billing period start date for a given month using saved config.
 * @param monthYear - Format: YYYY-MM
 */
export function getBillingPeriodStartDate(monthYear: string, startDay?: number): string {
    const day = startDay ?? BILLING_CYCLE_START_DAY;
    return `${monthYear}-${String(day).padStart(2, '0')}`;
}

/**
 * Get the billing period end date (same day, next month).
 * @param monthYear - Format: YYYY-MM
 */
export function getBillingPeriodEndDate(monthYear: string, startDay?: number): string {
    const day = startDay ?? BILLING_CYCLE_START_DAY;
    const [year, month] = monthYear.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Calculate the due date given a period end date and an offset in days.
 */
export function calculateDueDate(periodEndDate: string, offsetDays?: number): Date {
    const offset = offsetDays ?? BILLING_DUE_DATE_OFFSET_DAYS;
    const [year, month, day] = periodEndDate.split('-').map(Number);
    const dueDate = new Date(year, month - 1, day);
    dueDate.setDate(dueDate.getDate() + offset);
    return dueDate;
}

/**
 * Build a complete billing period from config + monthYear (once_per_month mode)
 * or from explicit dates (custom mode).
 */
export function buildBillingPeriod(params: {
    monthYear: string;
    periodStartDate?: string;   // custom mode: explicit start
    periodEndDate?: string;     // custom mode: explicit end
    dueDateOffsetDays?: number;
    cycleStartDay?: number;
}): { startDate: string; endDate: string; dueDate: Date } {
    const { monthYear, periodStartDate, periodEndDate, dueDateOffsetDays, cycleStartDay } = params;

    if (periodStartDate && periodEndDate) {
        // Custom date range mode
        const due = calculateDueDate(periodEndDate, dueDateOffsetDays);
        return { startDate: periodStartDate, endDate: periodEndDate, dueDate: due };
    }

    // Once per month mode
    const startDate = getBillingPeriodStartDate(monthYear, cycleStartDay);
    const endDate = getBillingPeriodEndDate(monthYear, cycleStartDay);
    const due = calculateDueDate(endDate, dueDateOffsetDays);
    return { startDate, endDate, dueDate: due };
}

/** Formatted default billing cycle day for UI display */
export function getDefaultBillingCycleDayString(): string {
    return String(BILLING_CYCLE_START_DAY);
}
