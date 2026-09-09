import { z } from 'zod';

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TicketStatus = 'Open' | 'In Progress' | 'Pending Customer' | 'Resolved' | 'Closed';
export type SenderType = 'customer' | 'staff' | 'system';

export interface TicketCategory {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface TicketAttachment {
  id: string;
  ticketId?: string;
  messageId?: string;
  fileUrl: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  uploadedByType?: 'customer' | 'staff';
  createdAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: SenderType;
  senderId?: string | null;
  senderName?: string | null;
  message: string;
  isInternalNote: boolean;
  attachments?: TicketAttachment[] | any;
  createdAt: string;
}

export interface TicketFeedback {
  id: string;
  ticketId: string;
  rating: number; // 1-5
  wasResolved: boolean;
  comment?: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: number;
  customerKey: string;
  customerType: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  subject: string;
  description: string;
  categoryId?: number | null;
  categoryName?: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: string | null;
  assignedStaffName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  slaBreached?: boolean;
  escalationLevel?: number;
  messagesCount?: number;
  latestMessage?: string;
  feedback?: TicketFeedback | null;
}

export interface SupportDashboardMetrics {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  urgentTickets: number;
  averageResponseTimeHours: number;
  averageResolutionTimeHours: number;
  slaComplianceRate: number; // 0-100%
  averageCsatRating: number; // 1-5
  totalFeedbackCount: number;
  ticketsByCategory: { category: string; count: number }[];
  ticketsByBranch: { branch: string; count: number }[];
  ticketsByPriority: { priority: TicketPriority; count: number }[];
  recentTickets: SupportTicket[];
}

export interface Customer360Summary {
  customerKey: string;
  name: string;
  phone?: string;
  email?: string;
  specificArea?: string;
  subCity?: string;
  woreda?: string;
  branchName?: string;
  meterKey?: string;
  previousReading?: string | number;
  currentReading?: string | number;
  paymentStatus?: string;
  outstandingBill?: string | number;
  creditBalance?: string | number;
  totalTicketsCount: number;
  resolvedTicketsCount: number;
  xCoordinate?: number | null;
  yCoordinate?: number | null;
  recentBills: Array<{
    id?: string;
    month: string;
    totalAmount: string | number;
    status: string;
    consumption?: string | number;
  }>;
}

export interface BranchSlaReportRow {
  branchName: string;
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  slaBreachedCount: number;
  slaBreachPercent: number;
  avgResolutionHours: number;
  avgCsatRating: number;
}

export interface CsatDistributionRow {
  rating: number;
  count: number;
  percentage: number;
}

export interface SupportMonthlyReportData {
  reportPeriod: string;
  generatedAt: string;
  totalTickets: number;
  totalResolved: number;
  overallResolutionRate: number;
  overallSlaBreachPercent: number;
  overallAvgResolutionHours: number;
  overallAvgCsat: number;
  totalFeedbackCount: number;
  branchBreakdown: BranchSlaReportRow[];
  csatDistribution: CsatDistributionRow[];
}

// Zod Validation Schemas
export const CreateTicketSchema = z.object({
  customerKey: z.string().min(1, "Customer Key is required"),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  customerType: z.string().default("individual"),
  branchId: z.string().nullable().optional(),
  branchName: z.string().nullable().optional(),
  categoryId: z.coerce.number().int().positive("Please select a valid category"),
  categoryName: z.string().nullable().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200, "Subject must be under 200 characters"),
  description: z.string().min(10, "Please provide a detailed description (at least 10 characters)"),
  attachments: z.array(z.object({
    fileUrl: z.string(),
    fileName: z.string(),
    fileType: z.string().nullable().optional(),
    fileSize: z.number().nullable().optional(),
  })).optional().default([]),
});

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;

export const AddMessageSchema = z.object({
  ticketId: z.string().uuid("Invalid Ticket ID"),
  message: z.string().min(1, "Message cannot be empty"),
  senderType: z.enum(['customer', 'staff', 'system']).default('customer'),
  senderId: z.string().nullable().optional(),
  senderName: z.string().nullable().optional(),
  isInternalNote: z.boolean().default(false),
  attachments: z.array(z.object({
    fileUrl: z.string(),
    fileName: z.string(),
    fileType: z.string().nullable().optional(),
    fileSize: z.number().nullable().optional(),
  })).optional().default([]),
});

export type AddMessageInput = z.infer<typeof AddMessageSchema>;

export const SubmitFeedbackSchema = z.object({
  ticketId: z.string().uuid("Invalid Ticket ID"),
  rating: z.number().int().min(1).max(5),
  wasResolved: z.boolean(),
  comment: z.string().max(1000).nullable().optional(),
});

export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackSchema>;
