"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Smartphone,
  Copy,
  Check,
  Receipt,
  FileText,
  Ticket,
  AlertTriangle,
  Info,
  RotateCcw,
  Eye,
  Pencil,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface SmsTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any | null;
  latestBill?: any | null;
  reconstructedData?: any | null;
  initialTemplateId?: string;
  onTemplateCopied?: (templateName: string, text: string) => void;
}

interface TemplateDef {
  id: string;
  title: string;
  shortLabel: string;
  description: string;
  category: "Billing" | "Payment" | "Support" | "Arrears";
  icon: React.ComponentType<{ className?: string }>;
  generateText: (ctx: {
    customerKey: string;
    customerName: string;
    phone: string;
    amount: string;
    dueDate: string;
    monthYear: string;
    meterNumber: string;
  }) => string;
}

const TEMPLATE_DEFS: TemplateDef[] = [
  {
    id: "bill_notice",
    title: "Bill & Due Date Notice",
    shortLabel: "Bill Notice",
    description: "Standard monthly billing notice with payable balance and settlement deadline.",
    category: "Billing",
    icon: Receipt,
    generateText: ({ customerKey, customerName, amount, dueDate }) =>
      `AAWSA Notice: Dear ${customerName} (${customerKey}), your current water bill is ${amount} ETB. Due date: ${dueDate}. Reference No: ${customerKey}. Pay via Telebirr or CBE Birr. Thank you!`,
  },
  {
    id: "telebirr_guide",
    title: "Telebirr & CBE Birr Payment Guide",
    shortLabel: "Paybill Guide",
    description: "Step-by-step instructions for USSD and mobile banking settlement.",
    category: "Payment",
    icon: Smartphone,
    generateText: ({ customerKey, amount }) =>
      `AAWSA Payment Guide: Pay via Telebirr or CBE Birr Paybill. Biller: AAWSA, Customer/Bill Ref: ${customerKey}. Dial *127# or use Telebirr app. Amount: ${amount} ETB. Receipts update within 24h.`,
  },
  {
    id: "bill_breakdown",
    title: "Line-Item Bill Breakdown",
    shortLabel: "Breakdown",
    description: "Detailed current charge vs overdue aging debt for callers disputing charges.",
    category: "Billing",
    icon: FileText,
    generateText: ({ customerKey, monthYear, amount, dueDate }) =>
      `AAWSA Breakdown: Account ${customerKey} (${monthYear}). Total Payable: ${amount} ETB (Due: ${dueDate}). Pay via Telebirr/CBE Birr Ref: ${customerKey}. Inquiries: 991.`,
  },
  {
    id: "portal_link",
    title: "Self-Service Customer Portal Link",
    shortLabel: "Portal Link",
    description: "Direct web link for customer to view monthly meter reads and digital bills.",
    category: "Billing",
    icon: FileText,
    generateText: ({ customerKey }) =>
      `AAWSA Self-Service: Dear customer, view your water meter reading history and digital bills online anytime at: https://portal.aawsa.gov.et/customer/bills?ref=${customerKey}`,
  },
  {
    id: "ticket_logged",
    title: "Support Ticket Confirmation",
    shortLabel: "Ticket Logged",
    description: "Acknowledges receipt of field complaint or meter inspection request.",
    category: "Support",
    icon: Ticket,
    generateText: ({ customerKey }) =>
      `AAWSA Support: Your service request for account ${customerKey} has been recorded and assigned to our field operations team. For follow-up, call 991.`,
  },
  {
    id: "disconnection_warning",
    title: "Overdue Arrears Warning",
    shortLabel: "Arrears Warning",
    description: "Notice for accounts with chronic arrears past 60 days.",
    category: "Arrears",
    icon: AlertTriangle,
    generateText: ({ customerKey, customerName, amount }) =>
      `AAWSA Urgent Notice: Account ${customerKey} (${customerName}) has unsettled overdue arrears of ${amount} ETB. Please settle within 5 business days to prevent water service suspension. Ref: ${customerKey}.`,
  },
];

export function SmsTemplatesModal({
  open,
  onOpenChange,
  customer,
  latestBill,
  reconstructedData,
  initialTemplateId = "bill_notice",
  onTemplateCopied,
}: SmsTemplatesModalProps) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>(initialTemplateId);
  const [customText, setCustomText] = React.useState<string>("");
  const [isEdited, setIsEdited] = React.useState<boolean>(false);
  const [copied, setCopied] = React.useState<boolean>(false);

  // Sync initial template when prop changes
  React.useEffect(() => {
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId);
    }
  }, [initialTemplateId, open]);

  // Derived customer context
  const customerKey = customer?.customerKey || "N/A";
  const customerName = customer?.name || "Customer";
  const phone = customer?.phone || "N/A";
  const meterNumber = customer?.meterNumber || "N/A";
  const totalAmt = reconstructedData
    ? Number(reconstructedData.totalPayable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    : Number(customer?.outstandingBill || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const dueDate = latestBill?.due_date
    ? (() => {
        try {
          return format(new Date(latestBill.due_date), "MMM d, yyyy");
        } catch {
          return String(latestBill.due_date);
        }
      })()
    : "End of month";
  const monthYear = latestBill?.month_year || "Current";

  // Context bundle
  const ctx = React.useMemo(
    () => ({
      customerKey,
      customerName,
      phone,
      amount: totalAmt,
      dueDate,
      monthYear,
      meterNumber,
    }),
    [customerKey, customerName, phone, totalAmt, dueDate, monthYear, meterNumber]
  );

  const selectedTemplate = React.useMemo(() => {
    return TEMPLATE_DEFS.find((t) => t.id === selectedTemplateId) || TEMPLATE_DEFS[0];
  }, [selectedTemplateId]);

  // Default text for currently selected template
  const defaultText = React.useMemo(() => {
    return selectedTemplate.generateText(ctx);
  }, [selectedTemplate, ctx]);

  // Reset custom text when template changes
  React.useEffect(() => {
    setCustomText(defaultText);
    setIsEdited(false);
    setCopied(false);
  }, [defaultText]);

  const handleTextChange = (newVal: string) => {
    setCustomText(newVal);
    setIsEdited(newVal !== defaultText);
  };

  const handleReset = () => {
    setCustomText(defaultText);
    setIsEdited(false);
  };

  const handleCopy = () => {
    const textToCopy = customText.trim();
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast({
      title: "SMS Copied to Clipboard!",
      description: `Copied "${selectedTemplate.title}" (${textToCopy.length} chars). Ready to paste.`,
    });

    if (onTemplateCopied) {
      onTemplateCopied(selectedTemplate.title, textToCopy);
    }

    setTimeout(() => setCopied(false), 2500);
  };

  const charCount = customText.length;
  const segmentCount = Math.max(1, Math.ceil(charCount / 160));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] sm:max-w-4xl max-w-4xl md:max-w-[940px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-gray-200"
        style={{ width: "95vw", maxWidth: "940px" }}
      >
        {/* Header */}
        <DialogHeader className="p-4 border-b bg-gradient-to-r from-blue-50/90 to-indigo-50/40 shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                View & Copy SMS Template
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 mt-0.5">
                Preview populated figures and customize the message before copying to your messaging app.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono bg-white text-gray-700">
                To: {phone}
              </Badge>
              <Badge variant="secondary" className="text-xs font-mono">
                {customerKey}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Informational banner */}
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200/60 text-xs text-amber-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Manual Dispatch:</strong> Select a template on the left, view the live preview on the right, and click <strong>Copy SMS to Clipboard</strong>.
            </span>
          </div>
          {isEdited && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              className="h-6 text-[11px] text-amber-700 hover:text-amber-900 gap-1 px-2 shrink-0"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
        </div>

        {/* Master-Detail Layout: Flexbox ensures right panel is NEVER squished */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-[420px]">
          {/* Left Column: Template Selection Sidebar (Fixed 300px width) */}
          <div className="w-full md:w-[300px] shrink-0 border-r border-gray-200 bg-gray-50/70 p-3 overflow-y-auto space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1 mb-1">
              Select Template ({TEMPLATE_DEFS.length})
            </p>

            {TEMPLATE_DEFS.map((t) => {
              const Icon = t.icon;
              const isSelected = selectedTemplateId === t.id;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 group cursor-pointer",
                    isSelected
                      ? "border-blue-500 bg-white shadow-xs ring-1 ring-blue-500"
                      : "border-gray-200 bg-white/70 hover:bg-white hover:border-gray-300"
                  )}
                >
                  <div
                    className={cn(
                      "p-1.5 rounded-md shrink-0 mt-0.5",
                      isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 group-hover:text-blue-600"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("text-xs font-semibold truncate", isSelected ? "text-blue-900 font-bold" : "text-gray-800")}>
                        {t.title}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-gray-200 shrink-0 font-normal">
                        {t.category}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                      {t.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Live View & Editor (Takes ALL remaining space, min-w-0) */}
          <div className="flex-1 min-w-0 p-5 flex flex-col justify-between bg-white overflow-y-auto space-y-4">
            <div className="space-y-3">
              {/* Template Title & Metadata */}
              <div className="flex items-start justify-between gap-2 border-b pb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 truncate">
                      {React.createElement(selectedTemplate.icon, { className: "h-4 w-4 text-blue-600 shrink-0" })}
                      {selectedTemplate.title}
                    </h3>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {selectedTemplate.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedTemplate.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-gray-800">
                    {charCount} chars
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {segmentCount} SMS segment{segmentCount > 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Realistic SMS Message Bubble View */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                  <span className="flex items-center gap-1.5 text-blue-900 font-bold">
                    <Eye className="h-4 w-4 text-blue-600" />
                    Live SMS Message Preview
                  </span>
                  <span className="text-[11px] font-normal text-gray-400">
                    Editable before copying
                  </span>
                </div>

                {/* Simulated Phone Message Container */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-200/70 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      <span className="font-bold text-slate-800">From: AAWSA-BILLING</span>
                      <span className="text-slate-400">|</span>
                      <span>To: <strong className="text-slate-700">{phone}</strong></span>
                    </div>
                    <span className="text-slate-400 font-mono">{format(new Date(), "h:mm a")}</span>
                  </div>

                  {/* Message Body Textarea - Spacious and legible */}
                  <Textarea
                    value={customText}
                    onChange={(e) => handleTextChange(e.target.value)}
                    rows={6}
                    className="w-full text-xs sm:text-sm font-mono bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg p-3 text-slate-900 leading-relaxed resize-none shadow-xs"
                    placeholder="Type or customize SMS message..."
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>Standard GSM 7-bit (160 characters per SMS credit)</span>
                    {isEdited && (
                      <span className="text-amber-600 font-semibold flex items-center gap-1">
                        <Pencil className="h-3 w-3" /> Modified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs h-9 px-4"
              >
                Close
              </Button>

              <div className="flex items-center gap-2">
                {isEdited && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-xs h-9 text-gray-500 hover:text-gray-800 gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Revert
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={handleCopy}
                  className={cn(
                    "text-xs h-9 font-semibold gap-1.5 px-5 transition-all shadow-xs cursor-pointer",
                    copied
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  )}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied to Clipboard!" : "Copy SMS to Clipboard"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
