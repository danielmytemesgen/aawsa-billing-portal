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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Ticket,
  Send,
  Loader2,
  Wrench,
  AlertTriangle,
  Droplets,
  HelpCircle,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createCallCenterTicketAction } from "@/lib/actions";

interface QuickTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any | null;
  onTicketCreated?: (ticket: any) => void;
}

const TICKET_PRESETS = [
  {
    label: "Meter Testing Request",
    category: "Meter Fault / Stopped Meter",
    priority: "High",
    subject: "Customer requested physical meter calibration & accuracy test",
    description: "Caller disputes water consumption surge. Requests AAWSA technical team to inspect meter onsite and verify calibration.",
  },
  {
    label: "Underground Leak Inspection",
    category: "Underground Leak / Pipe Burst",
    priority: "Urgent",
    subject: "Urgent leak inspection request near customer connection",
    description: "Unusual continuous water flow observed with high unmetered or billed loss. Site inspection required.",
  },
  {
    label: "Billing Apportionment Dispute",
    category: "High Consumption / Billing Dispute",
    priority: "Medium",
    subject: "Bulk difference bill apportionment dispute",
    description: "Caller requests audit of sub-meter readings and bulk difference apportionment ratio for the current period.",
  },
];

export function QuickTicketModal({
  open,
  onOpenChange,
  customer,
  onTicketCreated,
}: QuickTicketModalProps) {
  const { toast } = useToast();
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryName, setCategoryName] = React.useState("High Consumption / Billing Dispute");
  const [priority, setPriority] = React.useState("High");
  const [contactPhone, setContactPhone] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [sendSmsNotification, setSendSmsNotification] = React.useState(true);

  React.useEffect(() => {
    if (customer) {
      setContactPhone(customer.phone !== "N/A" ? customer.phone : "");
      setSubject(`Inquiry / Complaint - ${customer.name || customer.customerKey}`);
      setDescription("");
    }
  }, [customer]);

  const applyPreset = (preset: typeof TICKET_PRESETS[0]) => {
    setCategoryName(preset.category);
    setPriority(preset.priority);
    setSubject(preset.subject);
    setDescription(preset.description);
  };

  const validateEthiopianPhone = (phone: string): boolean => {
    if (!phone) return true; // optional field
    const cleaned = phone.replace(/\s+/g, "");
    return /^(\+2519\d{8}|09\d{8}|2519\d{8})$/.test(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast({ variant: "destructive", title: "Subject Required", description: "Please enter a ticket subject." });
      return;
    }
    if (!description.trim()) {
      toast({ variant: "destructive", title: "Description Required", description: "Please enter details for this ticket." });
      return;
    }
    if (contactPhone && !validateEthiopianPhone(contactPhone)) {
      toast({ variant: "destructive", title: "Invalid Phone Number", description: "Enter a valid Ethiopian phone: +2519XXXXXXXX or 09XXXXXXXX." });
      return;
    }

    setIsSubmitting(true);
    try {
      const ticket = await createCallCenterTicketAction({
        customerKey: customer?.customerKey || "N/A",
        customerType: customer?.type === "Bulk Meter" ? "bulk" : "individual",
        customerName: customer?.name || "Customer",
        customerPhone: contactPhone,
        subject: subject.trim(),
        description: description.trim(),
        categoryName,
        priority,
        branchName: customer?.branchName || "Head Office",
        branchId: customer?.branchId || undefined,
      });

      const tktNum = ticket?.ticket_number || "";
      const custKey = customer?.customerKey || "N/A";

      // If copy SMS enabled, copy preformatted ticket notification to clipboard
      if (sendSmsNotification) {
        const ticketSms = `AAWSA Support: Your service ticket #${tktNum} for account ${custKey} has been logged and assigned to field operations. Call 991 for status updates.`;
        navigator.clipboard.writeText(ticketSms);
        toast({
          title: "Ticket Created & SMS Copied!",
          description: `Ticket #${tktNum} opened. Confirmation SMS copied to clipboard.`,
        });
      } else {
        toast({
          title: "Ticket Created Successfully",
          description: `Support Ticket #${tktNum} has been opened and routed to field ops.`,
        });
      }

      if (onTicketCreated) {
        onTicketCreated(ticket);
      }

      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Ticket Creation Failed", description: err?.message || "Failed to create ticket." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50/50">
          <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Ticket className="h-5 w-5 text-blue-600" />
            Create Field Ticket / Investigation Request
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500 mt-0.5">
            Escalate caller inquiry directly to AAWSA branch engineers or meter inspection crews.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 space-y-4 flex-1">
          {/* Caller Summary Banner */}
          <div className="bg-gray-50 border rounded-lg p-3 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <span className="text-gray-400 block text-[10px] uppercase font-semibold">Customer</span>
              <span className="font-semibold text-gray-800 truncate block">{customer?.name}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px] uppercase font-semibold">Account Key</span>
              <span className="font-mono text-gray-800">{customer?.customerKey}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px] uppercase font-semibold">Meter Serial</span>
              <span className="font-mono text-gray-800">{customer?.meterNumber || "N/A"}</span>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <Label className="text-xs font-semibold text-gray-700 block mb-1.5">Quick Presets</Label>
            <div className="flex flex-wrap gap-1.5">
              {TICKET_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(p)}
                  className="h-7 text-xs bg-white text-gray-700 border-gray-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Category</Label>
              <Select value={categoryName} onValueChange={setCategoryName}>
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High Consumption / Billing Dispute">High Consumption / Billing Dispute</SelectItem>
                  <SelectItem value="Meter Fault / Stopped Meter">Meter Fault / Stopped Meter</SelectItem>
                  <SelectItem value="Underground Leak / Pipe Burst">Underground Leak / Pipe Burst</SelectItem>
                  <SelectItem value="Low Water Pressure / Supply Outage">Low Water Pressure / Supply Outage</SelectItem>
                  <SelectItem value="Water Quality Complaint">Water Quality Complaint</SelectItem>
                  <SelectItem value="General Inquiry / Other">General Inquiry / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Urgent">Urgent (Field Emergency)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Contact Phone for Field Crew</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+2519..."
                className="h-8 text-xs font-mono bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Assigned Branch</Label>
              <Input
                value={customer?.branchName || "Head Office"}
                disabled
                className="h-8 text-xs bg-gray-100 text-gray-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-gray-700">Subject *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of caller's issue..."
              className="h-8 text-xs bg-white"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-gray-700">Investigation Details & Instructions *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specific details, landmarks, customer availability, or reading discrepancy notes..."
              rows={3}
              className="text-xs bg-white resize-none"
              required
            />
          </div>

          {/* SMS Confirmation Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="send-sms-confirm"
              checked={sendSmsNotification}
              onChange={(e) => setSendSmsNotification(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <label htmlFor="send-sms-confirm" className="text-xs text-gray-700 cursor-pointer">
              Auto-copy ticket confirmation SMS to clipboard upon creation
            </label>
          </div>

          {/* SMS Notification Live Preview (View Before Copy) */}
          {sendSmsNotification && (
            <div className="p-2.5 bg-blue-50/60 border border-blue-200/80 rounded-md space-y-1 text-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-blue-900">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3 text-blue-600" />
                  SMS Preview (Auto-copied to clipboard on creation)
                </span>
                <span className="text-[10px] text-blue-600 font-mono">To: {contactPhone || customer?.phone || "Caller"}</span>
              </div>
              <p className="font-mono text-slate-800 bg-white p-2 rounded border border-blue-100 text-[11px] leading-relaxed">
                {`AAWSA Support: Your service ticket for account ${customer?.customerKey || "N/A"} (${subject ? subject.trim() : "New Request"}) has been logged and assigned to field operations. Call 991 for status.`}
              </p>
            </div>
          )}

          <div className="pt-2 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              size="sm"
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ticket className="h-3.5 w-3.5" />}
              {isSubmitting ? "Creating Ticket..." : "Create & Dispatch Ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
