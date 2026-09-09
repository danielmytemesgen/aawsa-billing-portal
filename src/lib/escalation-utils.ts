import type { SupportTicket, TicketPriority } from '@/features/support/types';

export interface EscalationThresholds {
  firstResponseSlaHours: number;
  resolutionSlaHours: number;
  escalateToSupervisorHours: number;
  escalateToHeadofficeHours: number;
}

export const DEFAULT_THRESHOLDS: Record<TicketPriority, EscalationThresholds> = {
  Urgent: { firstResponseSlaHours: 1, resolutionSlaHours: 8, escalateToSupervisorHours: 8, escalateToHeadofficeHours: 16 },
  High: { firstResponseSlaHours: 2, resolutionSlaHours: 16, escalateToSupervisorHours: 16, escalateToHeadofficeHours: 32 },
  Medium: { firstResponseSlaHours: 4, resolutionSlaHours: 24, escalateToSupervisorHours: 24, escalateToHeadofficeHours: 48 },
  Low: { firstResponseSlaHours: 8, resolutionSlaHours: 48, escalateToSupervisorHours: 48, escalateToHeadofficeHours: 96 },
};

/**
 * Calculates time remaining until SLA threshold or overdue hours (client-safe).
 */
export function calculateSlaStatus(ticket: SupportTicket): {
  isOverdue: boolean;
  hoursElapsed: number;
  hoursRemaining: number;
  targetHours: number;
  statusLabel: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  const createdAt = new Date(ticket.createdAt).getTime();
  const now = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : Date.now();
  const hoursElapsed = Math.max(0, (now - createdAt) / (1000 * 60 * 60));

  const priority = (ticket.priority || 'Medium') as TicketPriority;
  const targetHours = DEFAULT_THRESHOLDS[priority]?.resolutionSlaHours || 24;
  const hoursRemaining = targetHours - hoursElapsed;

  if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
    return {
      isOverdue: hoursElapsed > targetHours,
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
      hoursRemaining: 0,
      targetHours,
      statusLabel: hoursElapsed <= targetHours ? 'Resolved within SLA' : 'Resolved (SLA Breached)',
      badgeVariant: hoursElapsed <= targetHours ? 'secondary' : 'destructive',
    };
  }

  if (hoursRemaining <= 0) {
    const overdueBy = Math.abs(Math.round(hoursRemaining * 10) / 10);
    return {
      isOverdue: true,
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
      hoursRemaining: 0,
      targetHours,
      statusLabel: `Overdue by ${overdueBy}h`,
      badgeVariant: 'destructive',
    };
  }

  const remaining = Math.round(hoursRemaining * 10) / 10;
  return {
    isOverdue: false,
    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
    hoursRemaining: remaining,
    targetHours,
    statusLabel: `${remaining}h remaining`,
    badgeVariant: remaining < (targetHours * 0.25) ? 'destructive' : 'default',
  };
}

/**
 * Determines the escalation tier based on elapsed hours and priority thresholds:
 * - Urgent: Supervisor (8h), Head Office (16h)
 * - High: Supervisor (16h), Head Office (32h)
 * - Medium: Supervisor (24h), Head Office (48h)
 * - Low: Supervisor (48h), Head Office (96h)
 */
export function calculateEscalationLevel(
  createdAt: string | Date,
  currentLevel: number = 0,
  priority: TicketPriority = 'Medium'
): number {
  const createdMs = new Date(createdAt).getTime();
  const hoursElapsed = (Date.now() - createdMs) / (1000 * 60 * 60);
  const thresholds = DEFAULT_THRESHOLDS[priority] || DEFAULT_THRESHOLDS.Medium;

  if (hoursElapsed >= thresholds.escalateToHeadofficeHours) return Math.max(currentLevel, 2);
  if (hoursElapsed >= thresholds.escalateToSupervisorHours) return Math.max(currentLevel, 1);
  return currentLevel;
}

