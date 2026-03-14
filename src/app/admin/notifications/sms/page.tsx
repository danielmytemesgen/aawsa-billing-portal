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
import { AlertCircle, MessageSquareWarning, Download, GripVertical, Megaphone, PlusCircle, History } from "lucide-react";
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

  const canSendSms = hasPermission('sms_send') || hasPermission('notifications_create');

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
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">SMS Notifications</h1>
          <p className="text-slate-500 mt-1">Broadcast high-priority SMS alerts to bulk meter accounts.</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
          <MessageSquareWarning className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-bold text-blue-800">Direct Outreach Mode</span>
        </div>
      </div>

      <Card className="shadow-2xl border-none bg-white overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
        <CardHeader className="pb-4 bg-slate-50/50 border-b">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Megaphone className="h-7 w-7" />
            </div>
            <div>
              <CardTitle className="text-2xl font-extrabold text-slate-900">SMS Broadcast Console</CardTitle>
              <CardDescription className="text-slate-500 font-medium mt-1">
                Configure your message template and generate batch SMS notifications for bulk meter customers.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 p-8">
          {/* Available Fields - Draggable */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
                <GripVertical className="h-4 w-4" />
              </div>
              <Label className="text-base font-bold text-slate-800">Dynamic Personalization Tokens</Label>
            </div>
            <div className="flex flex-wrap gap-2.5 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
              {AVAILABLE_FIELDS.map((field) => (
                <Badge
                  key={field.placeholder}
                  variant="secondary"
                  className={`cursor-move px-4 py-2.5 text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 hover:shadow-md border-none ${field.color}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, field.placeholder)}
                  title={field.description}
                >
                  <PlusCircle className="h-4 w-4 opacity-70" />
                  {field.label}
                </Badge>
              ))}
            </div>
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2 italic">
              <span className="h-2 w-2 bg-blue-400 rounded-full animate-pulse" />
              Tip: Drag tokens into the editor below to personalize your broadcast.
            </p>
          </div>

          {/* Message Template - Drop Zone */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
                <History className="h-4 w-4" />
              </div>
              <Label htmlFor="message-template" className="text-base font-bold text-slate-800">Message Blueprint</Label>
            </div>
            <div
              className={`relative group ${isDragging ? 'ring-4 ring-blue-500/20' : ''}`}
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
                rows={7}
                className={`bg-slate-50 border-2 text-base font-medium leading-relaxed rounded-2xl focus:bg-white transition-all shadow-inner ${isDragging ? 'border-blue-500' : 'border-slate-200 hover:border-slate-300'}`}
                placeholder="Compose your master template here..."
              />
              {isDragging && (
                <div className="absolute inset-0 bg-blue-600/5 backdrop-blur-[1px] pointer-events-none flex items-center justify-center border-2 border-blue-500 border-dashed rounded-2xl">
                  <div className="bg-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-blue-100 scale-110 animate-in zoom-in-95 duration-200">
                    <PlusCircle className="h-6 w-6 text-blue-600" />
                    <p className="text-blue-700 font-extrabold text-lg">Drop Token to Insert</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-end bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
            <div className="flex-grow w-full">
              <Label htmlFor="month-select" className="text-sm font-bold text-slate-700 mb-2 block">Billing Period Focus</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="month-select" className="w-full h-12 bg-white font-bold text-base rounded-xl border-slate-200 shadow-sm">
                  <SelectValue placeholder="Select Target Month" />
                </SelectTrigger>
                <SelectContent className="rounded-xl font-medium">
                  {months.map(month => (
                    <SelectItem key={month} value={month}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-4 w-full lg:w-auto">
              <Button 
                onClick={handleGenerateMessages} 
                disabled={isGenerating || !selectedMonth}
                className="flex-grow lg:flex-none h-12 px-8 bg-blue-600 hover:bg-blue-700 font-extrabold text-base shadow-lg shadow-blue-100 rounded-xl"
              >
                {isGenerating ? "Compiling..." : "Generate Messages"}
              </Button>
              <Button 
                onClick={handleExport} 
                disabled={generatedMessages.length === 0} 
                variant="outline"
                className="flex-grow lg:flex-none h-12 px-8 border-2 font-extrabold text-base rounded-xl hover:bg-slate-50 transition-colors"
              >
                <Download className="mr-2 h-5 w-5" /> Export XLSX
              </Button>
            </div>
          </div>

          {generatedMessages.length > 0 && (
            <div className="mt-12 space-y-6 pt-12 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 leading-none">Generation Preview</h3>
                  <p className="text-slate-500 font-medium mt-2 italic">{generatedMessages.length} personalized messages ready for broadcast</p>
                </div>
              </div>
              
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="font-extrabold text-slate-900 h-14">Recipient Contact</TableHead>
                      <TableHead className="font-extrabold text-slate-900 h-14">Personalized Content</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generatedMessages.map((msg, index) => (
                      <TableRow key={index} className="hover:bg-blue-50/30 transition-colors border-b border-slate-100">
                        <TableCell className="py-5 font-bold text-slate-900">
                          <code className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm">{msg.phoneNumber}</code>
                        </TableCell>
                        <TableCell className="py-5">
                          <p className="text-slate-700 font-medium leading-relaxed max-w-3xl">{msg.message}</p>
                        </TableCell>
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
