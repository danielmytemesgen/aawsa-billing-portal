"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileEdit, Loader2, AlertCircle, Check } from "lucide-react";

const PRESET_TAGS = [
  "Meter Key Mismatch",
  "GPS / Location Error",
  "Missing Document",
  "Wrong Tariff Category",
  "Duplicate Record",
  "Customer Info Incomplete",
];

interface AmendmentReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  isBulk?: boolean;
  recordCount?: number;
  isLoading?: boolean;
  onConfirm: (reason: string, tags: string[]) => Promise<void>;
}

export function AmendmentReasonDialog({
  open,
  onOpenChange,
  entityName,
  isBulk = false,
  recordCount = 1,
  isLoading = false,
  onConfirm,
}: AmendmentReasonDialogProps) {
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [customNote, setCustomNote] = React.useState("");

  // Reset state when opened
  React.useEffect(() => {
    if (open) {
      setSelectedTags([]);
      setCustomNote("");
    }
  }, [open]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSend = async () => {
    const combinedParts: string[] = [];
    if (selectedTags.length > 0) {
      combinedParts.push(`Issues: ${selectedTags.join(", ")}`);
    }
    if (customNote.trim()) {
      combinedParts.push(customNote.trim());
    }
    const finalReason = combinedParts.join(". ") || "Amendment requested by supervisor.";

    await onConfirm(finalReason, selectedTags);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <DialogContent className="w-full max-w-lg sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-7 overflow-hidden">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
              <FileEdit className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {isBulk ? `Request Amendment for ${recordCount} Records` : `Request Amendment`}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isBulk
                  ? `Send all ${recordCount} pending records back with feedback for correction.`
                  : `Specify why "${entityName}" needs corrections.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick Issue Tags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Quick Issue Tags (Click to select)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Badge
                    key={tag}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer text-xs py-1 px-2.5 transition-all rounded-lg select-none ${
                      isSelected
                        ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                        : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                    onClick={() => toggleTag(tag)}
                  >
                    {isSelected && <Check className="w-3 h-3 mr-1 inline-block" />}
                    {tag}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Custom Instruction Box */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Instructions for Submitter (Optional)
            </label>
            <Textarea
              placeholder="E.g. Please re-check GPS pin with field reader and upload the contract agreement page..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="resize-none h-24 text-sm rounded-xl border-slate-200 dark:border-slate-800 focus-visible:ring-amber-500"
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="rounded-xl sm:mr-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={isLoading}
            className="rounded-xl border border-amber-400 bg-amber-600 hover:bg-amber-700 text-white shadow-sm shrink-0 gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileEdit className="w-4 h-4" />
            )}
            Send Amendment Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

