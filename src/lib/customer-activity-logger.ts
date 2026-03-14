/**
 * Logs customer activity in the portal (page visits, feature usage)
 * This is a client-side utility that calls server actions
 */
export async function logCustomerActivity(
    customerKeyNumber: string,
    activityType: string,
    details?: any
) {
    try {
        // Dynamically import the server action to avoid bundling issues
        const { logSecurityEventAction } = await import('./actions');
        await logSecurityEventAction(
            activityType,
            undefined,
            undefined,
            undefined,
            'Info',
            details || {},
            customerKeyNumber
        );
    } catch (error) {
        console.error('Failed to log customer activity:', error);
    }
}

/**
 * Hook to automatically log page views in customer portal
 */
export function useCustomerActivityLogger(pageName: string) {
    if (typeof window !== 'undefined') {
        const customerData = localStorage.getItem('customer');
        if (customerData) {
            try {
                const customer = JSON.parse(customerData);
                logCustomerActivity(
                    customer.customerKeyNumber,
                    `Viewed ${pageName}`,
                    { page: pageName, timestamp: new Date().toISOString() }
                );
            } catch (e) {
                console.error('Failed to parse customer data', e);
            }
        }
    }
}
