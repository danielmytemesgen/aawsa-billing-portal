/**
 * Billing Configuration
 * 
 * This module defines the billing cycle configuration for the AAWSA billing system.
 * The billing cycle runs from day X of month A to day X of month B.
 * 
 * Example: If BILLING_CYCLE_START_DAY is 16:
 * - December billing period: December 16 - January 16
 * - January billing period: January 16 - February 16
 */

/**
 * The day of the month when the billing cycle starts.
 * This is the primary configuration for the billing period.
 * Default: 16 (meaning bills run from 16th to 16th of the next month)
 */
export const BILLING_CYCLE_START_DAY = 16;

/**
 * Get the billing period start date for a given month
 * @param monthYear - Format: YYYY-MM (e.g., "2026-01")
 * @returns The billing period start date in YYYY-MM-DD format
 */
export function getBillingPeriodStartDate(monthYear: string): string {
    return `${monthYear}-${String(BILLING_CYCLE_START_DAY).padStart(2, '0')}`;
}

/**
 * Get the billing period end date for a given month
 * The end date is the start day of the next month
 * @param monthYear - Format: YYYY-MM (e.g., "2026-01")
 * @returns The billing period end date in YYYY-MM-DD format
 */
export function getBillingPeriodEndDate(monthYear: string): string {
    const [year, month] = monthYear.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(BILLING_CYCLE_START_DAY).padStart(2, '0')}`;
}

/**
 * Calculate the due date based on the period end date
 * Default: 15 days after the period end date
 * @param periodEndDate - The billing period end date in YYYY-MM-DD format
 * @returns The due date as a Date object
 */
export function calculateDueDate(periodEndDate: string): Date {
    const [year, month, day] = periodEndDate.split('-').map(Number);
    const dueDate = new Date(year, month - 1, day);
    dueDate.setDate(dueDate.getDate() + 15);
    return dueDate;
}

/**
 * Get formatted default billing cycle day for UI display
 */
export function getDefaultBillingCycleDayString(): string {
    return String(BILLING_CYCLE_START_DAY);
}
