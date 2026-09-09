import type { SupportTicket, TicketPriority } from '@/features/support/types';
export * from './escalation-utils';

/**
 * Sweeps for unresolved tickets reaching SLA escalation thresholds (Server only).
 * Uses priority-specific escalation thresholds from support_escalation_rules:
 *  - Urgent: Supervisor (8h), Head Office (16h)
 *  - High: Supervisor (16h), Head Office (32h)
 *  - Medium: Supervisor (24h), Head Office (48h)
 *  - Low: Supervisor (48h), Head Office (96h)
 */
export async function checkAndEscalateTickets(): Promise<{
  escalatedCount: number;
  totalChecked: number;
  level1Count: number;
  level2Count: number;
  escalatedTickets: Array<{
    id: string;
    ticketNumber: number;
    level: number;
    hours: number;
    branch?: string;
  }>;
}> {
  try {
    const { query } = await import('./db');
    
    // 1. Fetch dynamic escalation rules from database
    const defaultRules: Record<string, { supervisor: number; headoffice: number }> = {
      Urgent: { supervisor: 8, headoffice: 16 },
      High: { supervisor: 16, headoffice: 32 },
      Medium: { supervisor: 24, headoffice: 48 },
      Low: { supervisor: 48, headoffice: 96 },
    };

    let rulesMap = { ...defaultRules };
    try {
      const dbRules: any = await query(`
        SELECT priority, escalate_to_supervisor_hours AS "supervisor", escalate_to_headoffice_hours AS "headoffice"
        FROM support_escalation_rules
      `);
      if (Array.isArray(dbRules) && dbRules.length > 0) {
        for (const r of dbRules) {
          rulesMap[r.priority] = {
            supervisor: Number(r.supervisor || defaultRules[r.priority]?.supervisor || 24),
            headoffice: Number(r.headoffice || defaultRules[r.priority]?.headoffice || 48),
          };
        }
      }
    } catch {
      // Non-critical fallback to defaultRules
    }

    const res: any = await query(`
      SELECT id, ticket_number, priority, status, created_at, escalation_level, branch_id, branch_name
      FROM support_tickets
      WHERE status IN ('Open', 'In Progress', 'Pending Customer')
    `);

    let escalatedCount = 0;
    let level1Count = 0;
    let level2Count = 0;
    const escalatedTickets: Array<{
      id: string;
      ticketNumber: number;
      level: number;
      hours: number;
      branch?: string;
    }> = [];
    const now = Date.now();

    for (const ticket of res || []) {
      const createdAt = new Date(ticket.created_at).getTime();
      const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);
      let newEscalationLevel = ticket.escalation_level || 0;

      const priority = ticket.priority || 'Medium';
      const rule = rulesMap[priority] || rulesMap['Medium'] || { supervisor: 24, headoffice: 48 };

      if (hoursElapsed >= rule.headoffice && newEscalationLevel < 2) {
        newEscalationLevel = 2; // Head Office Escalation
      } else if (hoursElapsed >= rule.supervisor && newEscalationLevel < 1) {
        newEscalationLevel = 1; // Branch Supervisor Escalation
      }

      if (newEscalationLevel > (ticket.escalation_level || 0)) {
        await query(`
          UPDATE support_tickets
          SET 
            escalation_level = $1,
            sla_breached = true,
            updated_at = NOW()
          WHERE id = $2
        `, [newEscalationLevel, ticket.id]);

        await query(`
          INSERT INTO ticket_messages (
            ticket_id, sender_type, sender_name, message, is_internal_note, created_at
          ) VALUES (
            $1, 'system', 'SLA Escalation Engine', $2, true, NOW()
          )
        `, [
          ticket.id,
          `Automatic Escalation Alert: [${priority} Priority] unresolved after ${Math.round(hoursElapsed * 10) / 10}h (Threshold: ${newEscalationLevel === 2 ? rule.headoffice : rule.supervisor}h). Escalated to Level ${newEscalationLevel} (${newEscalationLevel === 2 ? 'Head Office Leadership' : 'Branch Supervisor'}).`
        ]);

        if (newEscalationLevel === 1) level1Count++;
        if (newEscalationLevel === 2) level2Count++;
        escalatedCount++;

        escalatedTickets.push({
          id: ticket.id,
          ticketNumber: ticket.ticket_number,
          level: newEscalationLevel,
          hours: Math.round(hoursElapsed * 10) / 10,
          branch: ticket.branch_name,
        });
      }
    }

    return { 
      escalatedCount,
      totalChecked: (res || []).length,
      level1Count,
      level2Count,
      escalatedTickets
    };
  } catch (err) {
    console.error('checkAndEscalateTickets error:', err);
    return { 
      escalatedCount: 0,
      totalChecked: 0,
      level1Count: 0,
      level2Count: 0,
      escalatedTickets: []
    };
  }
}
