
"use client";

import * as React from "react";
import { Sparkles, Bot, User, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ReportDataView } from "./report-data-view";
import { generateReport } from "@/ai/flows/report-flow";
import { arrayToXlsxBlob, downloadFile } from '@/lib/xlsx';
import type { ReportRequest, ReportResponse } from '@/ai/flows/report-flow-types';


export function ReportAIAssistant() {
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [reportResponse, setReportResponse] = React.useState<ReportResponse | null>(null);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setReportResponse(null);

    try {
      const response = await generateReport({ query });
      setReportResponse(response);
    } catch (error) {
      console.error("AI report generation failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "The AI assistant failed to generate the report. Please try a different query.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!reportResponse || !reportResponse.data || reportResponse.data.length === 0) {
      toast({ title: "No Data", description: "There is no data to download." });
      return;
    }
    const headers = reportResponse.headers.length > 0 ? reportResponse.headers : Object.keys(reportResponse.data[0]);
    const blob = arrayToXlsxBlob(reportResponse.data, headers);
    const filename = `ai_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    downloadFile(blob, filename);
  };

  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <CardTitle>AI Report Assistant</CardTitle>
        </div>
        <CardDescription>
          Ask for a report in plain English. For example: "Show me all unpaid bills from the Kality branch."
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            value={query}
            onChange={handleQueryChange}
            placeholder="Type your report request here..."
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !query.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            <span className="ml-2">Generate</span>
          </Button>
        </form>

        {reportResponse && (
          <div className="space-y-4 rounded-lg border bg-background p-4">
            <p className="text-sm text-muted-foreground">{reportResponse.summary}</p>
            {reportResponse.data && reportResponse.data.length > 0 && (
              <>
                <ReportDataView data={reportResponse.data} headers={reportResponse.headers} />
                <Button onClick={handleDownload} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download as XLSX
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
