'use server';

/**
 * @fileOverview A report generation AI agent.
 * This flow uses Genkit tools to understand natural language queries
 * about application data (customers, bills, etc.) and returns structured
 * data for display and download.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  dbGetAllBills,
  dbGetAllCustomers,
  dbGetAllBulkMeters,
  dbGetAllBranches,
  dbGetAllTariffs,
  dbGetAllIndividualCustomerReadings, // Assuming this exists or similar
  dbGetAllStaffMembers,
  dbGetMeterReadings // Need to check if this specific aggregation exists, otherwise might need to fetch individual/bulk readings
} from '@/lib/db-queries';

// We need to make sure we have the types or infer them
import { ReportRequestSchema, ReportResponseSchema, type ReportRequest, type ReportResponse } from './report-flow-types';

// Define tool schemas
const BillFilterSchema = z.object({
  branchName: z.string().optional().describe("The name of a specific branch to filter by, e.g., 'Kality'."),
  paymentStatus: z.enum(['Paid', 'Unpaid']).optional().describe("The payment status of the bills to retrieve."),
  timePeriod: z.enum(['last month', 'this month', 'last week', 'this week', 'all time']).optional().describe("A relative time period to filter bills. Default is 'all time'.")
});

const CustomerFilterSchema = z.object({
  branchName: z.string().optional().describe("The name of a specific branch to filter by, e.g., 'Bole'.")
});

// Tool to get bills
const getBillsTool = ai.defineTool(
  {
    name: 'getBills',
    description: 'Retrieves a list of bills, optionally filtered by branch, payment status, and time period.',
    inputSchema: BillFilterSchema,
    outputSchema: z.array(z.any()),
  },
  async (filters) => {
    // Fetch data directly from DB
    const allBills = await dbGetAllBills();
    const allCustomers = await dbGetAllCustomers();
    const allMeters = await dbGetAllBulkMeters();
    const allBranches = await dbGetAllBranches();

    let filteredBills = allBills;

    if (filters.branchName) {
      const branch = allBranches.find((b: any) => b.name.toLowerCase().includes(filters.branchName!.toLowerCase()));
      if (branch) {
        const branchMeterIds = new Set(allMeters.filter((m: any) => m.branch_id === branch.id).map((m: any) => m.customerKeyNumber));
        const branchCustomerIds = new Set(allCustomers.filter((c: any) => c.branch_id === branch.id).map((c: any) => c.customerKeyNumber));

        filteredBills = filteredBills.filter((bill: any) => {
          const customer = bill.individual_customer_id ? allCustomers.find((c: any) => c.customerKeyNumber === bill.individual_customer_id) : null;
          const meter = bill.CUSTOMERKEY ? allMeters.find((m: any) => m.customerKeyNumber === bill.CUSTOMERKEY) : null;

          return (customer && branchCustomerIds.has(customer.customerKeyNumber)) ||
            (meter && branchMeterIds.has(meter.customerKeyNumber)) ||
            (customer?.assigned_bulk_meter_id && branchMeterIds.has(customer.assigned_bulk_meter_id));
        });
      }
    }

    if (filters.paymentStatus) {
      filteredBills = filteredBills.filter((b: any) => b.payment_status === filters.paymentStatus);
    }

    // Note: Time period filtering would require more complex date logic.
    // This is a simplified example.

    return filteredBills;
  }
);


// Tool to get customers
const getCustomersTool = ai.defineTool(
  {
    name: 'getCustomers',
    description: 'Retrieves a list of individual customers, optionally filtered by branch.',
    inputSchema: CustomerFilterSchema,
    outputSchema: z.array(z.any()),
  },
  async (filters) => {
    const allCustomers = await dbGetAllCustomers();
    const allBranches = await dbGetAllBranches();
    if (filters.branchName) {
      const branch = allBranches.find((b: any) => b.name.toLowerCase().includes(filters.branchName!.toLowerCase()));
      if (branch) {
        return allCustomers.filter((c: any) => c.branch_id === branch.id);
      }
    }
    return allCustomers;
  }
);

// Tool to get tariffs
const getTariffsTool = ai.defineTool(
  {
    name: 'getTariffs',
    description: 'Retrieves a list of all tariffs.',
    inputSchema: z.object({}),
    outputSchema: z.array(z.any()),
  },
  async () => {
    return await dbGetAllTariffs();
  }
);

// Tool to get meter readings (Combining individual and bulk if needed, or just individual for now)
const getMeterReadingsTool = ai.defineTool(
  {
    name: 'getMeterReadings',
    description: 'Retrieves a list of all meter readings.',
    inputSchema: z.object({}),
    outputSchema: z.array(z.any()),
  },
  async () => {
    return await dbGetMeterReadings();
  }
);

// Tool to get staff members
const getStaffTool = ai.defineTool(
  {
    name: 'getStaff',
    description: 'Retrieves a list of staff members.',
    inputSchema: z.object({}),
    outputSchema: z.array(z.any()),
  },
  async () => {
    return await dbGetAllStaffMembers();
  }
);


const reportGeneratorAgent = ai.definePrompt({
  name: 'reportGeneratorAgent',
  input: { schema: z.object({ query: z.string() }) },
  output: { schema: ReportResponseSchema },
  system: `You are an expert data analyst for the AAWSA Billing Portal. Your task is to understand user requests for reports, use the provided tools to fetch the data, and then format the response.

    - Analyze the user's query to determine which tool to use and what parameters to pass.
    - If a user asks for "unpaid bills", use the paymentStatus "Unpaid". If they ask for "paid bills", use "Paid".
    - If a user asks for customers or bills "in a branch" or "from a branch", use the branchName filter.
    - After getting the data from a tool, create a brief, friendly summary of what you found. For example, "I found 5 unpaid bills for the Kality branch."
    - You MUST determine the most appropriate headers for the data you are returning. The headers should be human-readable (e.g., "Customer Name" instead of "customerKeyNumber").
    - ALWAYS return the data in the 'data' field, the summary in the 'summary' field, and the headers in the 'headers' field.
    - If the tool returns no data, provide a summary saying so and return an empty array for data and headers.
    `,
  tools: [getBillsTool, getCustomersTool, getTariffsTool, getMeterReadingsTool, getStaffTool],
});


const generateReportFlow = ai.defineFlow(
  {
    name: 'generateReportFlow',
    inputSchema: ReportRequestSchema,
    outputSchema: ReportResponseSchema,
  },
  async ({ query }) => {
    const response = await reportGeneratorAgent({ query });

    if (!response) {
      console.error("AI response is undefined. Query was:", query);
      throw new Error('The AI model returned an empty response. Please try rephrasing your request.');
    }

    const output = response.output;

    if (!output) {
      console.error("AI response missing output:", JSON.stringify(response, null, 2));
      throw new Error('The AI model did not return a valid report structure. Please try rephrasing your request.');
    }
    return output;
  }
);


export async function generateReport(input: ReportRequest): Promise<ReportResponse> {
  try {
    // Try the AI flow first
    return await generateReportFlow(input);
  } catch (e) {
    console.warn('AI flow failed, falling back to simple parser. Error:', e);
    // Fallback: simple deterministic parser for common queries
    const q = (input.query || '').toLowerCase();

    // Fetch data server-side
    const allBills = await dbGetAllBills();
    const allCustomers = await dbGetAllCustomers();
    const allBranches = await dbGetAllBranches();
    const allMeters = await dbGetAllBulkMeters();

    // Helper to build response
    const buildResponse = (data: any[], headers: string[], summary: string): ReportResponse => ({ data, headers, summary });

    // Unpaid/paid bills
    if (q.includes('unpaid bills') || q.includes('unpaid')) {
      let filtered = allBills.filter((b: any) => b.payment_status === 'Unpaid');
      // optional branch filter
      const m = q.match(/in ([a-z\s]+)/);
      if (m) {
        const branchName = m[1].trim();
        const branch = allBranches.find((b: any) => b.name.toLowerCase().includes(branchName));
        if (branch) {
          const branchMeterIds = new Set(allMeters.filter((m: any) => m.branch_id === branch.id).map((x: any) => x.customerKeyNumber));
          const branchCustIds = new Set(allCustomers.filter((c: any) => c.branch_id === branch.id).map((x: any) => x.customerKeyNumber));
          filtered = filtered.filter((b: any) => (typeof b.individual_customer_id === 'string' && branchCustIds.has(b.individual_customer_id)) || (typeof b.CUSTOMERKEY === 'string' && branchMeterIds.has(b.CUSTOMERKEY)));
        }
      }
      const headers = ['Bill ID', 'Customer', 'Amount', 'Status', 'Due Date'];
      const data = filtered.map((b: any) => ({ id: b.id, customer: b.individual_customer_id || b.CUSTOMERKEY, amount: b.TOTALBILLAMOUNT ?? 0, status: b.payment_status, due_date: b.due_date }));
      return buildResponse(data, headers, `Found ${data.length} unpaid bills.`);
    }

    // Customers in branch
    if (q.includes('customers') && q.includes('branch')) {
      const m = q.match(/in ([a-z\s]+)/);
      if (m) {
        const branchName = m[1].trim();
        const branch = allBranches.find((b: any) => b.name.toLowerCase().includes(branchName));
        if (branch) {
          const customers = allCustomers.filter((c: any) => c.branch_id === branch.id);
          const headers = ['Customer Key', 'Name', 'Meter Number', 'Status'];
          const data = customers.map((c: any) => ({ key: c.customerKeyNumber, name: c.name, meter: c.meterNumber, status: c.status }));
          return buildResponse(data, headers, `Found ${data.length} customers in ${branch.name}.`);
        }
      }
    }

    // Default: return a summary of counts
    return buildResponse([], [], `Unable to parse the query with the fallback parser. Please try: "Show me unpaid bills in <branch>" or "Show customers in <branch>".`);
  }
}