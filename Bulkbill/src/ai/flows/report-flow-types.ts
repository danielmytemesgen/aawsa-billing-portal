
import { z } from 'zod';

// Main Flow Schema
export const ReportRequestSchema = z.object({
  query: z.string(),
});
export type ReportRequest = z.infer<typeof ReportRequestSchema>;

export const ReportResponseSchema = z.object({
  summary: z.string().describe("A brief, natural language summary of the report that was generated."),
  data: z.array(z.any()).describe("The structured data array of the report results."),
  headers: z.array(z.string()).describe("An array of suggested header strings for displaying the data in a table."),
});
export type ReportResponse = z.infer<typeof ReportResponseSchema>;
