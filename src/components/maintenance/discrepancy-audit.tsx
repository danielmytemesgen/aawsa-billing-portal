"use client";

import * as React from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Search, 
  RefreshCw, 
  Download,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight

} from "lucide-react";
import { runDataAuditAction } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { arrayToCsvBlob, downloadFile } from "@/lib/xlsx";

interface Discrepancy {
  id: string;
  label: string;
  category: string;
  description: string;
  master_value: number;
  comparison_value: number;
  discrepancy: number;
}

export function DiscrepancyAudit() {
  const [results, setResults] = React.useState<Discrepancy[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [hasRun, setHasRun] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 20;

  const { toast } = useToast();


  const handleRunAudit = async () => {
    setIsRunning(true);
    try {
      const res = await runDataAuditAction();
      if (res.error) {
        toast({
          title: "Audit Failed",
          description: res.error.message || "An error occurred while running the audit.",
          variant: "destructive",
        });
      } else {
        setResults(res.data || []);
        setHasRun(true);
        setCurrentPage(1); // Reset to page 1 on new scan
        toast({
          title: "Audit Complete",
          description: `Found ${res.data?.length || 0} potential discrepancies.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleExport = () => {
    if (results.length === 0) return;
    const headers = Object.keys(results[0]);
    const blob = arrayToCsvBlob(results, headers);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(blob, `data-integrity-audit-${date}.csv`);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'Usage Mismatch':
        return <Badge variant="destructive" className="bg-red-500">{category}</Badge>;
      case 'Bill Calculation':
        return <Badge variant="outline" className="text-orange-600 border-orange-600">{category}</Badge>;
      case 'Consumption Mismatch':
        return <Badge variant="secondary">{category}</Badge>;
      case 'Payments':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">{category}</Badge>;
      case 'Aging':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">{category}</Badge>;
      case 'System Orphans':
        return <Badge variant="destructive" className="bg-rose-600">{category}</Badge>;
      case 'System':
        return <Badge variant="outline" className="text-purple-600 border-purple-600">{category}</Badge>;
      default:
        return <Badge>{category}</Badge>;
    }
  };

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Data Integrity & Discrepancy Audit
          </CardTitle>
          <CardDescription>
            Scan for calculation errors, missing data, and master-sub meter usage mismatches.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {hasRun && results.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          )}
          <Button onClick={handleRunAudit} disabled={isRunning} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? "Scanning..." : "Run Full Scan"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasRun ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-slate-50 rounded-lg border-2 border-dashed">
            <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
            <p>No audit has been run recently.</p>
            <p className="text-sm">Click &quot;Run Full Scan&quot; to analyze system consistency.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-green-600 bg-green-50 rounded-lg border-2 border-green-100">
            <CheckCircle2 className="h-12 w-12 mb-4" />
            <h3 className="font-bold text-lg">System Consistent</h3>
            <p className="text-sm">No critical data discrepancies were found in this scan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-md text-sm border border-red-100">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>
                <strong>Warning:</strong> {results.length} issues detected. Please investigate the records below.
              </p>
            </div>
            
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[150px]">Category</TableHead>
                    <TableHead>Identifier</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Master/Expected</TableHead>
                    <TableHead className="text-right">Observed/Sub</TableHead>
                    <TableHead className="text-right font-bold">Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((issue, idx) => (
                    <TableRow key={`${issue.id}-${idx}`}>
                      <TableCell>{getCategoryBadge(issue.category)}</TableCell>
                      <TableCell className="font-medium font-mono text-xs">{issue.label}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{issue.description}</TableCell>
                      <TableCell className="text-right">{issue.master_value.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{issue.comparison_value.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-600 font-bold">
                        {issue.discrepancy.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {results.length > 0 && (
                <div className="flex items-center justify-between p-4 border-t bg-slate-50">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, results.length)} of {results.length} issues
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm font-medium px-2">Page {currentPage} of {Math.ceil(results.length / itemsPerPage)}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(results.length / itemsPerPage), prev + 1))}
                      disabled={currentPage >= Math.ceil(results.length / itemsPerPage)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
