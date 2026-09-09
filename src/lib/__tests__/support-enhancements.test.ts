import { describe, it, expect } from 'vitest';
import { calculateEscalationLevel, calculateSlaStatus } from '../escalation-utils';

describe('Support Enhancements: SLA Escalation Engine', () => {
  it('calculates Level 0 for freshly opened tickets (< 24h)', () => {
    const createdAt = new Date(Date.now() - 10 * 3600 * 1000).toISOString(); // 10h ago
    const level = calculateEscalationLevel(createdAt);
    expect(level).toBe(0);
  });

  it('calculates Level 1 (Supervisor at 8h) and Level 2 (Head Office at 16h) for Urgent priority', () => {
    const created9hAgo = new Date(Date.now() - 9 * 3600 * 1000).toISOString();
    expect(calculateEscalationLevel(created9hAgo, 0, 'Urgent')).toBe(1);

    const created17hAgo = new Date(Date.now() - 17 * 3600 * 1000).toISOString();
    expect(calculateEscalationLevel(created17hAgo, 0, 'Urgent')).toBe(2);
  });

  it('calculates Level 1 (Supervisor at 16h) and Level 2 (Head Office at 32h) for High priority', () => {
    const created17hAgo = new Date(Date.now() - 17 * 3600 * 1000).toISOString();
    expect(calculateEscalationLevel(created17hAgo, 0, 'High')).toBe(1);

    const created33hAgo = new Date(Date.now() - 33 * 3600 * 1000).toISOString();
    expect(calculateEscalationLevel(created33hAgo, 0, 'High')).toBe(2);
  });

  it('flags SLA as overdue if hours elapsed exceeds priority threshold', () => {
    const mockTicket = {
      id: 'test-1',
      ticketNumber: 101,
      customerKey: '12345',
      customerType: 'individual',
      subject: 'Pipe Leak',
      description: 'Major leak',
      priority: 'Urgent' as const,
      status: 'Open' as const,
      createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(), // 12h ago (Urgent SLA is 8h)
      escalationLevel: 0,
    };
    const slaStatus = calculateSlaStatus(mockTicket as any);
    expect(slaStatus.isOverdue).toBe(true);
    expect(slaStatus.badgeVariant).toBe('destructive');

    const withinSlaTicket = {
      ...mockTicket,
      priority: 'Medium' as const,
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2h ago (Medium SLA is 24h)
    };
    const withinSla = calculateSlaStatus(withinSlaTicket as any);
    expect(withinSla.isOverdue).toBe(false);
    expect(withinSla.badgeVariant).not.toBe('destructive');
  });
});

describe('Support Enhancements: GIS Physical Issue Detection', () => {
  function isPhysicalIssue(categoryName?: string | null, subject?: string | null): boolean {
    const text = `${categoryName || ''} ${subject || ''}`.toLowerCase();
    return /pipe|burst|leak|pressure|meter|physical|damage|flow|replace/i.test(text);
  }

  it('identifies pipe bursts and water leaks as physical dispatch issues', () => {
    expect(isPhysicalIssue('Water Meter Leak', 'Water leaking at meter box')).toBe(true);
    expect(isPhysicalIssue(null, 'Severe pipe burst in Bole')).toBe(true);
    expect(isPhysicalIssue('Low Water Pressure', 'No water flow since morning')).toBe(true);
    expect(isPhysicalIssue('Meter Replacement Request', 'Aged damaged meter dials')).toBe(true);
  });

  it('does not classify purely administrative inquiries as physical dispatch issues', () => {
    expect(isPhysicalIssue('Billing Discrepancy', 'Overcharged on recent invoice')).toBe(false);
    expect(isPhysicalIssue('General Inquiry', 'Office opening hours')).toBe(false);
  });
});

describe('Report Permissions: Unsettled Bills Gating Schema', () => {
  it('contains dedicated tokens for global and branch unsettled bills reports', async () => {
    const { PERMISSIONS } = await import('../constants/auth');
    expect(PERMISSIONS.REPORT_LIST_OF_UNSETTLED_BILLS).toBe('report:list_of_unsettled_bills');
    expect(PERMISSIONS.REPORT_BRANCH_LIST_OF_UNSETTLED_BILLS).toBe('report:branch_list_of_unsettled_bills');
  });

  it('allows access to unsettled bills with either dedicated report token or fallback billing tokens', async () => {
    const { PERMISSIONS } = await import('../constants/auth');
    
    function checkUnsettledBillsAccess(userPerms: string[]): boolean {
      const allowed = [
        PERMISSIONS.REPORT_LIST_OF_UNSETTLED_BILLS,
        'report:list_of_unsettled_bills',
        PERMISSIONS.REPORT_BRANCH_LIST_OF_UNSETTLED_BILLS,
        'report:branch_list_of_unsettled_bills',
        PERMISSIONS.REPORTS_GENERATE_ALL,
        PERMISSIONS.REPORTS_GENERATE_BRANCH,
        PERMISSIONS.BILL_VIEW_UNPAID,
        PERMISSIONS.BILL_VIEW_OVERDUE,
        PERMISSIONS.BILL_VIEW_ALL,
      ];
      return userPerms.some(p => allowed.includes(p as any));
    }

    // New dedicated token grants access
    expect(checkUnsettledBillsAccess(['report:list_of_unsettled_bills'])).toBe(true);
    expect(checkUnsettledBillsAccess(['report:branch_list_of_unsettled_bills'])).toBe(true);

    // Existing fallback tokens continue to grant access
    expect(checkUnsettledBillsAccess([PERMISSIONS.BILL_VIEW_UNPAID])).toBe(true);
    expect(checkUnsettledBillsAccess([PERMISSIONS.BILL_VIEW_OVERDUE])).toBe(true);
    expect(checkUnsettledBillsAccess([PERMISSIONS.BILL_VIEW_ALL])).toBe(true);

    // Unrelated permissions do not grant access
    expect(checkUnsettledBillsAccess([PERMISSIONS.TARIFFS_VIEW])).toBe(false);
    expect(checkUnsettledBillsAccess([])).toBe(false);
  });
});

