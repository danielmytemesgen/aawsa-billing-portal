'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from './auth';
import { assertCustomerAccess } from './actions';
import { PERMISSIONS } from './constants/auth';
import { 
  dbCreateTicket,
  dbGetCustomerTickets,
  dbGetAllTickets,
  dbGetTicketById,
  dbGetTicketMessages,
  dbAddTicketMessage,
  dbUpdateTicketStatus,
  dbAssignTicket,
  dbSubmitTicketFeedback,
  dbGetCustomer360,
  dbGetSupportDashboardMetrics,
  dbGetMonthlySupportReport,
  dbGetTicketCategories
} from './support-queries';
import { checkAndEscalateTickets } from './escalation';
import {
  CreateTicketSchema,
  AddMessageSchema,
  SubmitFeedbackSchema,
  type CreateTicketInput,
  type AddMessageInput,
  type SubmitFeedbackInput,
  type TicketStatus,
  type SupportTicket,
  type TicketMessage,
  type TicketFeedback,
  type SupportDashboardMetrics,
  type Customer360Summary,
  type SupportMonthlyReportData,
  type TicketCategory
} from '@/features/support/types';

// Standard action response envelope matching AAWSA portal
export interface ActionResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

function success<T>(data: T): ActionResponse<T> {
  return { data, error: null };
}

function failure<T>(message: string, code?: string): ActionResponse<T> {
  return { data: null, error: { message, code } };
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (e) {
    // Non-critical fallback
  }
}

// -------------------------------------------------------------
// Category Actions
// -------------------------------------------------------------
export async function getTicketCategoriesAction(): Promise<ActionResponse<TicketCategory[]>> {
  try {
    const categories = await dbGetTicketCategories();
    return success(categories);
  } catch (err: any) {
    console.error('getTicketCategoriesAction error:', err);
    return failure(err?.message || 'Failed to load categories');
  }
}

// -------------------------------------------------------------
// Customer Ticket Actions
// -------------------------------------------------------------
export async function createTicketAction(
  rawInput: CreateTicketInput,
  customerSessionId?: string
): Promise<ActionResponse<SupportTicket>> {
  try {
    const parsed = CreateTicketSchema.safeParse(rawInput);
    if (!parsed.success) {
      const errMsg = parsed.error.issues.map(i => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
      console.warn('createTicketAction validation error:', errMsg, rawInput);
      return failure(errMsg || 'Invalid ticket data');
    }

    const session = await getSession();
    const isStaff = !!(session && session.id);

    // If caller is not an authenticated staff member, verify customer session against customerKey
    if (!isStaff) {
      const targetType = parsed.data.customerType === 'bulk' ? 'bulk' : 'individual';
      try {
        await assertCustomerAccess(parsed.data.customerKey, customerSessionId, targetType);
      } catch (err: any) {
        return failure('Unauthorized: Invalid customer session for this account', 'UNAUTHORIZED');
      }
    }

    const ticket = await dbCreateTicket(parsed.data);
    safeRevalidatePath('/customer/support');
    safeRevalidatePath('/admin/support');
    safeRevalidatePath('/staff/support');
    return success(ticket);
  } catch (err: any) {
    console.error('createTicketAction error:', err);
    return failure(err?.message || 'Failed to submit ticket');
  }
}

export async function getCustomerTicketsAction(
  customerKey: string, 
  options?: { status?: string; limit?: number; offset?: number },
  customerSessionId?: string
): Promise<ActionResponse<SupportTicket[]>> {
  try {
    if (!customerKey) {
      return failure('Customer key is required');
    }
    const session = await getSession();
    const isStaff = !!(session && session.id);
    if (!isStaff) {
      try {
        await assertCustomerAccess(customerKey, customerSessionId, 'individual');
      } catch (e: any) {
        try {
          await assertCustomerAccess(customerKey, customerSessionId, 'bulk');
        } catch {
          return failure('Unauthorized: Invalid customer session', 'UNAUTHORIZED');
        }
      }
    }
    const tickets = await dbGetCustomerTickets(customerKey, options);
    return success(tickets);
  } catch (err: any) {
    console.error('getCustomerTicketsAction error:', err);
    return failure(err?.message || 'Failed to fetch tickets');
  }
}

// -------------------------------------------------------------
// Granular Dynamic RBAC Helper Functions
// -------------------------------------------------------------
async function getEffectivePermissions(session: any): Promise<string[]> {
  if (!session || !session.id) return [];
  try {
    const { dbGetStaffPermissions } = await import('./db-queries');
    const live = await dbGetStaffPermissions(session.id);
    if (Array.isArray(live) && live.length > 0) return live;
  } catch (e) {
    // Non-critical fallback to session cached permissions
  }
  return session.permissions || [];
}

function hasPermission(session: any, perms: string[], targetPerm: string): boolean {
  if (!session) return false;
  // Super admin wildcard privileges
  if (perms.includes('*') || perms.includes('all') || perms.includes('admin')) return true;
  const role = (session.role || session.roleName || '').toLowerCase();
  if (role === 'admin' || role === 'system administrator') return true;

  // Strict check from assigned role_permissions in PostgreSQL
  return perms.includes(targetPerm);
}

function canViewAllSupport(session: any, perms: string[]): boolean {
  if (!session) return false;
  return hasPermission(session, perms, PERMISSIONS.SUPPORT_VIEW_ALL) ||
         hasPermission(session, perms, 'support:view_all');
}

function canViewBranchSupport(session: any, perms: string[]): boolean {
  if (!session) return false;
  return canViewAllSupport(session, perms) ||
         hasPermission(session, perms, PERMISSIONS.SUPPORT_VIEW_BRANCH) ||
         hasPermission(session, perms, 'support:view_branch');
}

function canAssignSupport(session: any, perms: string[]): boolean {
  if (!session) return false;
  return hasPermission(session, perms, PERMISSIONS.SUPPORT_ASSIGN) ||
         hasPermission(session, perms, 'support:assign') ||
         hasPermission(session, perms, PERMISSIONS.SUPPORT_MANAGE) ||
         hasPermission(session, perms, 'support:manage');
}

function canResolveSupport(session: any, perms: string[]): boolean {
  if (!session) return false;
  return hasPermission(session, perms, PERMISSIONS.SUPPORT_RESOLVE) ||
         hasPermission(session, perms, 'support:resolve') ||
         hasPermission(session, perms, PERMISSIONS.SUPPORT_MANAGE) ||
         hasPermission(session, perms, 'support:manage');
}

// -------------------------------------------------------------
// Staff / Admin Ticket Management Actions
// -------------------------------------------------------------
export async function getAllTicketsAction(filters?: {
  status?: string;
  priority?: string;
  categoryId?: number;
  branchId?: string;
  assignedTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResponse<SupportTicket[]>> {
  try {
    const session = await getSession();
    let queryFilters = { ...filters };

    // Strict Permission & Branch Isolation for Staff:
    if (session && session.id) {
      const perms = await getEffectivePermissions(session);
      if (!canViewBranchSupport(session, perms)) {
        return failure('Forbidden: Missing permission to view support tickets', 'FORBIDDEN');
      }

      // If user does not have global 'support:view_all', restrict strictly to their assigned branch
      if (!canViewAllSupport(session, perms)) {
        if (!session.branchId) {
          return failure('Forbidden: Your staff account is not assigned to any branch', 'NO_BRANCH');
        }
        queryFilters.branchId = session.branchId;
      }
    }

    const tickets = await dbGetAllTickets(queryFilters);
    return success(tickets);
  } catch (err: any) {
    console.error('getAllTicketsAction error:', err);
    return failure(err?.message || 'Failed to load tickets');
  }
}

export async function getTicketDetailAction(
  ticketId: string,
  customerSessionId?: string
): Promise<ActionResponse<{
  ticket: SupportTicket;
  messages: TicketMessage[];
}>> {
  try {
    if (!ticketId) return failure('Ticket ID is required');

    const session = await getSession();
    const isStaff = !!(session && session.id);

    const ticket = await dbGetTicketById(ticketId);
    if (!ticket) return failure('Ticket not found', 'NOT_FOUND');

    // Branch Isolation & View Permission Check for Staff
    if (isStaff) {
      const perms = await getEffectivePermissions(session);
      if (!canViewBranchSupport(session, perms)) {
        return failure('Forbidden: Missing permission to view support tickets', 'FORBIDDEN');
      }
      if (!canViewAllSupport(session, perms)) {
        if (ticket.branchId && session.branchId && ticket.branchId !== session.branchId) {
          return failure('Forbidden: You do not have permission to view tickets belonging to other branches', 'FORBIDDEN');
        }
      }
    } else {
      // Customer ownership validation: ensure caller owns this ticket
      const targetType = ticket.customerType === 'bulk' ? 'bulk' : 'individual';
      try {
        await assertCustomerAccess(ticket.customerKey, customerSessionId, targetType);
      } catch (err: any) {
        return failure('Unauthorized: You do not have permission to view this ticket', 'UNAUTHORIZED');
      }
    }

    const messages = await dbGetTicketMessages(ticketId, isStaff);
    return success({ ticket, messages });
  } catch (err: any) {
    console.error('getTicketDetailAction error:', err);
    return failure(err?.message || 'Failed to load ticket details');
  }
}

// -------------------------------------------------------------
// Message Thread Actions
// -------------------------------------------------------------
export async function addMessageAction(
  rawInput: AddMessageInput,
  customerSessionId?: string
): Promise<ActionResponse<TicketMessage>> {
  try {
    const parsed = AddMessageSchema.safeParse(rawInput);
    if (!parsed.success) {
      const errMsg = parsed.error.issues.map(i => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
      return failure(errMsg || 'Invalid message');
    }

    const session = await getSession();
    const isStaff = !!(session && session.id);

    // Verify branch isolation and view/reply permission before adding staff reply/note
    if (isStaff) {
      const perms = await getEffectivePermissions(session);
      if (!canViewBranchSupport(session, perms)) {
        return failure('Forbidden: Missing permission to view or reply to support tickets', 'FORBIDDEN');
      }
      if (!canViewAllSupport(session, perms)) {
        const ticket = await dbGetTicketById(parsed.data.ticketId);
        if (ticket && ticket.branchId && session.branchId && ticket.branchId !== session.branchId) {
          return failure('Forbidden: You can only reply to tickets belonging to your branch', 'FORBIDDEN');
        }
      }
    } else {
      // Customer access check before allowing message post
      const ticket = await dbGetTicketById(parsed.data.ticketId);
      if (ticket) {
        const targetType = ticket.customerType === 'bulk' ? 'bulk' : 'individual';
        try {
          await assertCustomerAccess(ticket.customerKey, customerSessionId, targetType);
        } catch {
          return failure('Unauthorized: You cannot post to this ticket', 'UNAUTHORIZED');
        }
      }
    }

    let senderName = parsed.data.senderName;
    let senderId = parsed.data.senderId;

    if (isStaff) {
      senderName = session.name || session.email || 'Staff Member';
      senderId = session.id;
    }

    const newMsg = await dbAddTicketMessage({
      ...parsed.data,
      senderName,
      senderId,
      senderType: isStaff ? 'staff' : (parsed.data.senderType || 'customer'),
    });

    safeRevalidatePath(`/customer/support/${parsed.data.ticketId}`);
    safeRevalidatePath(`/admin/support/${parsed.data.ticketId}`);
    safeRevalidatePath(`/staff/support/${parsed.data.ticketId}`);

    return success(newMsg);
  } catch (err: any) {
    console.error('addMessageAction error:', err);
    return failure(err?.message || 'Failed to send message');
  }
}

// -------------------------------------------------------------
// Status & Assignment Actions
// -------------------------------------------------------------
export async function updateTicketStatusAction(
  ticketId: string, 
  newStatus: TicketStatus,
  customerSessionId?: string
): Promise<ActionResponse<SupportTicket>> {
  try {
    if (!ticketId || !newStatus) return failure('Ticket ID and status are required');

    const session = await getSession();
    const isStaff = !!(session && session.id);
    const userId = session?.id || 'customer';
    const userName = session?.name || session?.email || 'Customer';

    // Granular RBAC & Branch check for staff
    if (isStaff) {
      const perms = await getEffectivePermissions(session);
      if (!canResolveSupport(session, perms)) {
        return failure('Forbidden: Missing permission to resolve/change ticket status', 'FORBIDDEN');
      }

      if (!canViewAllSupport(session, perms)) {
        const ticket = await dbGetTicketById(ticketId);
        if (ticket && ticket.branchId && session.branchId && ticket.branchId !== session.branchId) {
          return failure('Forbidden: You cannot update status of tickets outside your assigned branch', 'FORBIDDEN');
        }
      }
    } else {
      // Customer access check before allowing status transition
      const ticket = await dbGetTicketById(ticketId);
      if (ticket) {
        const targetType = ticket.customerType === 'bulk' ? 'bulk' : 'individual';
        try {
          await assertCustomerAccess(ticket.customerKey, customerSessionId, targetType);
        } catch {
          return failure('Unauthorized: You cannot update the status of this ticket', 'UNAUTHORIZED');
        }
      }
    }

    const updated = await dbUpdateTicketStatus(ticketId, newStatus, userId, userName);
    if (!updated) return failure('Ticket not found or update failed');

    safeRevalidatePath(`/customer/support/${ticketId}`);
    safeRevalidatePath(`/admin/support/${ticketId}`);
    safeRevalidatePath(`/staff/support/${ticketId}`);
    safeRevalidatePath('/customer/support');
    safeRevalidatePath('/admin/support');
    safeRevalidatePath('/staff/support');

    return success(updated);
  } catch (err: any) {
    console.error('updateTicketStatusAction error:', err);
    return failure(err?.message || 'Failed to update ticket status');
  }
}

export async function assignTicketAction(
  ticketId: string, 
  staffId: string
): Promise<ActionResponse<SupportTicket>> {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return failure('Unauthorized: Staff login required to assign tickets', 'UNAUTHORIZED');
    }

    const perms = await getEffectivePermissions(session);
    if (!canAssignSupport(session, perms)) {
      return failure('Forbidden: Missing permission to assign support tickets', 'FORBIDDEN');
    }

    // Branch check for staff assignment
    if (!canViewAllSupport(session, perms)) {
      const ticket = await dbGetTicketById(ticketId);
      if (ticket && ticket.branchId && session.branchId && ticket.branchId !== session.branchId) {
        return failure('Forbidden: You can only assign tickets belonging to your assigned branch', 'FORBIDDEN');
      }
    }

    const assignedByName = session?.name || session?.email || 'Supervisor';
    const updated = await dbAssignTicket(ticketId, staffId, assignedByName);
    if (!updated) return failure('Failed to assign ticket');

    safeRevalidatePath(`/admin/support/${ticketId}`);
    safeRevalidatePath(`/staff/support/${ticketId}`);
    safeRevalidatePath('/admin/support');
    safeRevalidatePath('/staff/support');

    return success(updated);
  } catch (err: any) {
    console.error('assignTicketAction error:', err);
    return failure(err?.message || 'Failed to assign ticket');
  }
}

// -------------------------------------------------------------
// CSAT Feedback Actions
// -------------------------------------------------------------
export async function submitFeedbackAction(
  rawInput: SubmitFeedbackInput,
  customerSessionId?: string
): Promise<ActionResponse<TicketFeedback>> {
  try {
    const parsed = SubmitFeedbackSchema.safeParse(rawInput);
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message || 'Invalid feedback data');
    }

    const session = await getSession();
    const isStaff = !!(session && session.id);

    // Customer validation: verify ownership before saving customer feedback
    if (!isStaff) {
      const ticket = await dbGetTicketById(parsed.data.ticketId);
      if (ticket) {
        const targetType = ticket.customerType === 'bulk' ? 'bulk' : 'individual';
        try {
          await assertCustomerAccess(ticket.customerKey, customerSessionId, targetType);
        } catch {
          return failure('Unauthorized: You cannot submit feedback for this ticket', 'UNAUTHORIZED');
        }
      }
    }

    const feedback = await dbSubmitTicketFeedback(parsed.data);
    safeRevalidatePath(`/customer/support/${parsed.data.ticketId}`);
    safeRevalidatePath(`/admin/support/${parsed.data.ticketId}`);
    safeRevalidatePath('/admin/support');
    return success(feedback);
  } catch (err: any) {
    console.error('submitFeedbackAction error:', err);
    return failure(err?.message || 'Failed to record feedback');
  }
}

// -------------------------------------------------------------
// Customer 360° View Action
// -------------------------------------------------------------
export async function getCustomer360Action(customerKey: string): Promise<ActionResponse<Customer360Summary>> {
  try {
    if (!customerKey) return failure('Customer key is required');

    const session = await getSession();
    if (!session || !session.id) {
      return failure('Unauthorized: Staff session required to view Customer 360 data', 'UNAUTHORIZED');
    }

    const perms = await getEffectivePermissions(session);
    if (!canViewBranchSupport(session, perms)) {
      return failure('Forbidden: Missing permission to view customer 360 data', 'FORBIDDEN');
    }

    const summary = await dbGetCustomer360(customerKey);
    if (!summary) return failure('Customer summary not found');
    return success(summary);
  } catch (err: any) {
    console.error('getCustomer360Action error:', err);
    return failure(err?.message || 'Failed to load Customer 360 data');
  }
}

// -------------------------------------------------------------
// Support Dashboard Action
// -------------------------------------------------------------
export async function getSupportDashboardAction(branchId?: string): Promise<ActionResponse<SupportDashboardMetrics>> {
  try {
    const session = await getSession();
    const isStaff = !!(session && session.id);
    let targetBranchId = branchId;

    if (isStaff) {
      const perms = await getEffectivePermissions(session);
      if (!canViewBranchSupport(session, perms)) {
        return failure('Forbidden: Missing permission to view support dashboard', 'FORBIDDEN');
      }
      if (!canViewAllSupport(session, perms)) {
        targetBranchId = session.branchId || '00000000-0000-0000-0000-000000000000';
      }
    }

    const metrics = await dbGetSupportDashboardMetrics(targetBranchId);
    return success(metrics);
  } catch (err: any) {
    console.error('getSupportDashboardAction error:', err);
    return failure(err?.message || 'Failed to load support dashboard metrics');
  }
}

// -------------------------------------------------------------
// SLA Escalation Sweep Action
// -------------------------------------------------------------
export async function runEscalationSweepAction(): Promise<ActionResponse<{
  escalatedCount: number;
  totalChecked: number;
  level1Count: number;
  level2Count: number;
  message: string;
}>> {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return failure('Unauthorized: Active staff session required', 'UNAUTHORIZED');
    }
    const perms = await getEffectivePermissions(session);
    if (!canViewBranchSupport(session, perms)) {
      return failure('Forbidden: Missing support permissions to trigger escalation sweep', 'FORBIDDEN');
    }

    const res = await checkAndEscalateTickets();
    revalidatePath('/admin/support');
    revalidatePath('/staff/support');

    return success({
      escalatedCount: res.escalatedCount,
      totalChecked: res.totalChecked,
      level1Count: res.level1Count,
      level2Count: res.level2Count,
      message: res.escalatedCount > 0 
        ? `Escalation sweep complete: ${res.escalatedCount} ticket(s) escalated.`
        : 'All tickets are within SLA thresholds. No escalations needed.'
    });
  } catch (err: any) {
    console.error('runEscalationSweepAction error:', err);
    return failure(err?.message || 'Failed to execute SLA escalation sweep');
  }
}

// -------------------------------------------------------------
// Monthly Support & SLA Report Action
// -------------------------------------------------------------
export async function getSupportReportAction(
  month?: string,
  branchId?: string
): Promise<ActionResponse<SupportMonthlyReportData>> {
  try {
    const session = await getSession();
    const isStaff = !!(session && session.id);
    let targetBranchId = branchId;

    if (isStaff) {
      const perms = await getEffectivePermissions(session);
      if (!canViewBranchSupport(session, perms)) {
        return failure('Forbidden: Missing permission to view support report', 'FORBIDDEN');
      }
      if (!canViewAllSupport(session, perms)) {
        targetBranchId = session.branchId || '00000000-0000-0000-0000-000000000000';
      }
    }

    const reportData = await dbGetMonthlySupportReport(month, targetBranchId);
    return success(reportData);
  } catch (err: any) {
    console.error('getSupportReportAction error:', err);
    return failure(err?.message || 'Failed to generate support report');
  }
}

