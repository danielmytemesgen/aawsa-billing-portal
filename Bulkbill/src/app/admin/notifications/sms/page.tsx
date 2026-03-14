"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { getBulkMeters, initializeBulkMeters } from "@/lib/data-store";
import type { BulkMeter } from "@/app/admin/bulk-meters/bulk-meter-types";
import { usePermissions } from "@/hooks/use-permissions";
import { AlertCircle, MessageSquareWarning, Download } from "lucide-react";
import { arrayToXlsxBlob, downloadFile } from "@/lib/xlsx";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SmsMessage {
  phoneNumber: string;
  message: string;
  customerKeyNumber: string;
}

export default function SmsNotificationPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [selectedMonth, setSelectedMonth] = React.useState<string>("");
  const [generatedMessages, setGeneratedMessages] = React.useState<SmsMessage[]>([]);
  const [messageTemplate, setMessageTemplate] = React.useState<string>(
    `Dear Customer ({customerKeyNumber}), Your water bill for {month} with the Meter Reading {currentReading} and Consumption {differenceUsage} has been generated with amount of {totalBulkBill} Birr which is due on . Please pay on time via CBE, Awash Bank or telebirr to avoid late payment charges. For more information, contact 906. AAWSA`
  );

  const canSendSms = hasPermission("admin") || hasPermission("staff_management");

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await initializeBulkMeters();
      setBulkMeters(getBulkMeters());
      setIsLoading(false);
    };
    if (canSendSms) {
      fetchData();
    }
  }, [canSendSms]);

  const months = React.useMemo(() => {
    const allMonths = new Set(bulkMeters.map(bm => bm.month));
    return Array.from(allMonths).sort().reverse();
  }, [bulkMeters]);

  const handleGenerateMessages = () => {
    if (!selectedMonth) {
      toast({
        variant: "destructive",
        title: "Month Required",
        description: "Please select a month to generate messages.",
      });
      return;
    }

    setIsGenerating(true);
    const filteredBms = bulkMeters.filter(bm => bm.month === selectedMonth);
    
    const messages = filteredBms.map(bm => {
      // Use phoneNumber from domain bulk meter if available (handles camelCase)
      const phoneNumber = (bm as any).phoneNumber || (bm as any).phone_number || "_PHONE_NUMBER_";
      const message = messageTemplate
        .replace(/{customerKeyNumber}/g, bm.customerKeyNumber)
        .replace(/{month}/g, bm.month)
        .replace(/{currentReading}/g, String(bm.currentReading))
        .replace(/{differenceUsage}/g, String(bm.differenceUsage))
        .replace(/{totalBulkBill}/g, String(bm.totalBulkBill));
      return { phoneNumber, message, customerKeyNumber: bm.customerKeyNumber };
    });

    setGeneratedMessages(messages);
    setIsGenerating(false);

    if (messages.length === 0) {
      toast({
        title: "No Messages Generated",
        description: "No bulk meters found for the selected month.",
      });
    }
  };
  
  const handleExport = () => {
    if (generatedMessages.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data to Export",
        description: "Please generate messages first.",
      });
      return;
    }
    const xlsxBlob = arrayToXlsxBlob(generatedMessages, ["phoneNumber", "message", "customerKeyNumber"]);
    downloadFile(xlsxBlob, `sms_messages_${selectedMonth}.xlsx`);
  };

  if (!canSendSms) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to send SMS notifications.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Send SMS to Bulk Meter Customers</CardTitle>
          <CardDescription>Generate and export SMS messages for bulk meter customers for a selected month.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message-template">Message Template</Label>
            <Textarea
              id="message-template"
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              You can use placeholders like {"{customerKeyNumber}"}, {"{month}"}, {"{currentReading}"}, {"{differenceUsage}"}, and {"{totalBulkBill}"}.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-grow">
              <Label htmlFor="month-select">Select Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="month-select" className="w-full md:w-[200px]">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month} value={month}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateMessages} disabled={isGenerating || !selectedMonth}>
              {isGenerating ? "Generating..." : "Generate Messages"}
            </Button>
            <Button onClick={handleExport} disabled={generatedMessages.length === 0} variant="outline">
              <Download className="mr-2 h-4 w-4" /> Export to XLSX
            </Button>
          </div>
          
          <Alert>
            <MessageSquareWarning className="h-4 w-4" />
            <AlertTitle>Phone Numbers Missing!</AlertTitle>
            <AlertDescription>
              The phone number for bulk meter customers is not available in the database. The "phoneNumber" column in the exported file will be a placeholder. Please update the phone numbers manually in the exported file before sending the SMS messages.
            </AlertDescription>
          </Alert>

          {generatedMessages.length > 0 && (
            <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Generated Messages ({generatedMessages.length})</h3>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Phone Number</TableHead>
                            <TableHead>Message</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {generatedMessages.map((msg, index) => (
                            <TableRow key={index}>
                            <TableCell>{msg.phoneNumber}</TableCell>
                            <TableCell className="text-sm">{msg.message}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
