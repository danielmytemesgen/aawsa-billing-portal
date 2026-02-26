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
import { getDistinctBillingMonthsAction, getBillsByMonthAction } from "@/lib/actions";
import { AlertCircle, MessageSquareWarning, Download, GripVertical } from "lucide-react";
import { arrayToXlsxBlob, downloadFile } from "@/lib/xlsx";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface SmsMessage {
  phoneNumber: string;
  message: string;
  customerKeyNumber: string;
}

interface FieldOption {
  placeholder: string;
  label: string;
  description: string;
  category: string;
  color: string;
}

const AVAILABLE_FIELDS: FieldOption[] = [
  // Basic Information - Purple
  { placeholder: "{name}", label: "Customer Name", description: "Bulk meter customer name", category: "Basic Info", color: "bg-purple-100 hover:bg-purple-200 text-purple-800" },
  { placeholder: "{customerKeyNumber}", label: "Customer Key", description: "Customer key number", category: "Basic Info", color: "bg-purple-100 hover:bg-purple-200 text-purple-800" },
  { placeholder: "{contractNumber}", label: "Contract Number", description: "Contract number", category: "Basic Info", color: "bg-purple-100 hover:bg-purple-200 text-purple-800" },
  { placeholder: "{meterNumber}", label: "Meter Number", description: "Water meter number", category: "Basic Info", color: "bg-purple-100 hover:bg-purple-200 text-purple-800" },
  { placeholder: "{phoneNumber}", label: "Phone Number", description: "Customer phone number", category: "Basic Info", color: "bg-purple-100 hover:bg-purple-200 text-purple-800" },

  // Billing Period - Blue
  { placeholder: "{month}", label: "Month", description: "Billing month (YYYY-MM)", category: "Billing Period", color: "bg-blue-100 hover:bg-blue-200 text-blue-800" },

  // Meter Readings - Green
  { placeholder: "{currentReading}", label: "Current Reading", description: "Current meter reading (m³)", category: "Meter Readings", color: "bg-green-100 hover:bg-green-200 text-green-800" },
  { placeholder: "{previousReading}", label: "Previous Reading", description: "Previous meter reading (m³)", category: "Meter Readings", color: "bg-green-100 hover:bg-green-200 text-green-800" },
  { placeholder: "{differenceUsage}", label: "Consumption", description: "Water consumption (m³)", category: "Meter Readings", color: "bg-green-100 hover:bg-green-200 text-green-800" },
  { placeholder: "{meterSize}", label: "Meter Size", description: "Meter size (inches)", category: "Meter Readings", color: "bg-green-100 hover:bg-green-200 text-green-800" },

  // Billing Amounts - Orange
  { placeholder: "{totalBulkBill}", label: "Total Bill", description: "Total bill amount (Birr)", category: "Billing Amounts", color: "bg-orange-100 hover:bg-orange-200 text-orange-800" },
  { placeholder: "{bulkUsage}", label: "Bulk Usage", description: "Bulk usage amount", category: "Billing Amounts", color: "bg-orange-100 hover:bg-orange-200 text-orange-800" },
  { placeholder: "{differenceBill}", label: "Difference Bill", description: "Bill difference amount", category: "Billing Amounts", color: "bg-orange-100 hover:bg-orange-200 text-orange-800" },
  { placeholder: "{outStandingbill}", label: "Outstanding Bill", description: "Outstanding bill amount (Birr)", category: "Billing Amounts", color: "bg-orange-100 hover:bg-orange-200 text-orange-800" },
  { placeholder: "{debit_30}", label: "Debt 30 Days", description: "Debt from 30 days ago (Birr)", category: "Billing Amounts", color: "bg-orange-100 hover:bg-orange-200 text-orange-800" },
  { placeholder: "{debit_30_60}", label: "Debt 30-60 Days", description: "Debt from 30-60 days ago (Birr)", category: "Billing Amounts", color: "bg-orange-100 hover:bg-orange-200 text-orange-800" },
  { placeholder: "{debit_60}", label: "Debt >60 Days", description: "Debt older than 60 days (Birr)", category: "Billing Amounts", color: "bg-orange-100 hover:bg-orange-200 text-orange-800" },
];

export default function SmsNotificationPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [bulkMeters, setBulkMeters] = React.useState<BulkMeter[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [selectedMonth, setSelectedMonth] = React.useState<string>("");
  const [months, setMonths] = React.useState<string[]>([]);
  const [generatedMessages, setGeneratedMessages] = React.useState<SmsMessage[]>([]);
  const [messageTemplate, setMessageTemplate] = React.useState<string>(
    `Dear Customer ({customerKeyNumber}), Your water bill for {month} with the Meter Reading {currentReading} and Consumption {differenceUsage} has been generated with amount of {totalBulkBill} Birr which is due on . Please pay on time via CBE, Awash Bank or telebirr to avoid late payment charges. For more information, contact 906. AAWSA`
  );
  const [isDragging, setIsDragging] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = React.useState<number>(0);

  const canSendSms = hasPermission("admin") || hasPermission("staff_management");

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const res = await getDistinctBillingMonthsAction();
      if (res.data) {
        setMonths(res.data as string[]);
      }
      setIsLoading(false);
    };
    if (canSendSms) {
      fetchData();
    }
  }, [canSendSms]);

  const handleDragStart = (e: React.DragEvent, placeholder: string) => {
    e.dataTransfer.setData("text/plain", placeholder);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const placeholder = e.dataTransfer.getData("text/plain");
    if (!placeholder) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    // Get current cursor position or use stored position
    const position = textarea.selectionStart ?? cursorPosition;

    // Insert placeholder at cursor position
    const before = messageTemplate.substring(0, position);
    const after = messageTemplate.substring(position);
    const newTemplate = before + placeholder + after;

    setMessageTemplate(newTemplate);

    // Set cursor position after the inserted placeholder
    setTimeout(() => {
      if (textarea) {
        const newPosition = position + placeholder.length;
        textarea.focus();
        textarea.setSelectionRange(newPosition, newPosition);
        setCursorPosition(newPosition);
      }
    }, 0);
  };

  const handleTextareaClick = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  const handleTextareaKeyUp = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  const handleGenerateMessages = async () => {
    if (!selectedMonth) {
      toast({
        variant: "destructive",
        title: "Month Required",
        description: "Please select a month to generate messages.",
      });
      return;
    }

    setIsGenerating(true);
    const res = await getBillsByMonthAction(selectedMonth);

    if (res.error || !res.data) {
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: res.error || "Failed to fetch billing data for the selected month.",
      });
      setIsGenerating(false);
      return;
    }

    const bills = res.data as any[];

    const messages = bills.map(bill => {
      const phoneNumber = bill.phoneNumber || bill.phone_number || "_PHONE_NUMBER_";
      const message = messageTemplate
        // Basic Information
        .replace(/{name}/g, bill.name || "")
        .replace(/{customerKeyNumber}/g, bill.CUSTOMERKEY)
        .replace(/{contractNumber}/g, bill.contractNumber || "")
        .replace(/{meterNumber}/g, bill.meterNumber || "")
        .replace(/{phoneNumber}/g, phoneNumber)
        // Billing Period
        .replace(/{month}/g, bill.month_year)
        // Meter Readings
        .replace(/{currentReading}/g, String(bill.CURRREAD))
        .replace(/{previousReading}/g, String(bill.PREVREAD || 0))
        .replace(/{differenceUsage}/g, String(bill.difference_usage || 0))
        .replace(/{meterSize}/g, String(bill.meterSize || ""))
        // Billing Amounts
        .replace(/{totalBulkBill}/g, String(bill.TOTALBILLAMOUNT || 0))
        .replace(/{bulkUsage}/g, String(bill.CONS || 0))
        .replace(/{differenceBill}/g, String(bill.TOTALBILLAMOUNT || 0)) // Using total bill for now or calculate diff
        .replace(/{outStandingbill}/g, String(bill.balance_carried_forward || 0))
        .replace(/{debit_30}/g, String(bill.debit_30 || 0))
        .replace(/{debit_30_60}/g, String(bill.debit_30_60 || 0))
        .replace(/{debit_60}/g, String(bill.debit_60 || 0))
        // Location Information
        .replace(/{specificArea}/g, bill.specificArea || "")
        .replace(/{subCity}/g, bill.subCity || "")
        .replace(/{woreda}/g, bill.woreda || "")
        .replace(/{location}/g, bill.location || "")
        // Account Details
        .replace(/{chargeGroup}/g, bill.charge_group || "")
        .replace(/{sewerageConnection}/g, bill.sewerage_connection || "")
        .replace(/{status}/g, bill.status || "")
        .replace(/{paymentStatus}/g, bill.payment_status || "");
      return { phoneNumber, message, customerKeyNumber: bill.CUSTOMERKEY };
    });

    setGeneratedMessages(messages);
    setIsGenerating(false);

    if (messages.length === 0) {
      toast({
        title: "No Messages Generated",
        description: "No billing records found for the selected month.",
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
          {/* Available Fields - Draggable */}
          <div className="space-y-2">
            <Label>Available Fields (Drag to insert into message)</Label>
            <div className="flex flex-wrap gap-2 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              {AVAILABLE_FIELDS.map((field) => (
                <Badge
                  key={field.placeholder}
                  variant="secondary"
                  className={`cursor-move px-3 py-2 text-sm font-medium flex items-center gap-1 transition-colors ${field.color}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, field.placeholder)}
                  title={field.description}
                >
                  <GripVertical className="h-3 w-3" />
                  {field.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Tip: Drag any field above and drop it into the message template below
            </p>
          </div>

          {/* Message Template - Drop Zone */}
          <div className="space-y-2 bg-green-50 border-2 border-green-200 rounded-lg p-4">
            <Label htmlFor="message-template">Message Template (Drop fields here)</Label>
            <div
              className={`relative ${isDragging ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Textarea
                ref={textareaRef}
                id="message-template"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                onClick={handleTextareaClick}
                onKeyUp={handleTextareaKeyUp}
                rows={6}
                className={isDragging ? 'border-blue-500' : ''}
                placeholder="Type your message or drag fields from above..."
              />
              {isDragging && (
                <div className="absolute inset-0 bg-blue-100 bg-opacity-20 pointer-events-none flex items-center justify-center">
                  <p className="text-blue-700 font-semibold">Drop field here</p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Available placeholders: {AVAILABLE_FIELDS.map(f => f.placeholder).join(", ")}
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
