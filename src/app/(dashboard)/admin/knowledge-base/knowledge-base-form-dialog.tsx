
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription as FormDescriptionComponent,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Trash2, ExternalLink, Loader2, Paperclip, X } from "lucide-react";
import type { KnowledgeBaseArticle } from "./knowledge-base-types";

const formSchema = z.object({
  title: z.string().min(5, { message: "Title must be at least 5 characters." }),
  content: z.string().min(20, { message: "Content must be at least 20 characters." }),
  category: z.string().optional(),
  pdfFile: z.instanceof(File).optional(), // Field for PDF upload
});

export type KnowledgeBaseFormValues = z.infer<typeof formSchema> & {
  pdfFile?: File;
  pdf_url?: string | null;
  removePdf?: boolean;
};

interface KnowledgeBaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: KnowledgeBaseFormValues) => Promise<void> | void;
  defaultValues?: KnowledgeBaseArticle | null;
}

export function KnowledgeBaseFormDialog({ open, onOpenChange, onSubmit, defaultValues }: KnowledgeBaseFormDialogProps) {
  const form = useForm<KnowledgeBaseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
    },
  });

  const [existingPdfUrl, setExistingPdfUrl] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (defaultValues) {
      form.reset({
        title: defaultValues.title,
        content: defaultValues.content,
        category: defaultValues.category || "",
        pdfFile: undefined,
      });
      setExistingPdfUrl(defaultValues.pdf_url || null);
    } else {
      form.reset({
        title: "",
        content: "",
        category: "",
        pdfFile: undefined,
      });
      setExistingPdfUrl(null);
    }
    setIsSubmitting(false);
  }, [defaultValues, form, open]);

  const handleSubmit = async (data: KnowledgeBaseFormValues) => {
    // Client-side validation for file size
    if (data.pdfFile && data.pdfFile.size > 5 * 1024 * 1024) { // 5MB limit
      form.setError("pdfFile", {
        type: "manual",
        message: "PDF file must be less than 5MB.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...data,
        pdf_url: existingPdfUrl
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Submission failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearPdf = () => {
    form.setValue("pdfFile", undefined);
    setExistingPdfUrl(null);
    form.clearErrors("pdfFile");
    form.setValue("removePdf" as any, true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Edit Article" : "Add New Article"}</DialogTitle>
          <DialogDescription>
            {defaultValues ? "Update the information for this article." : "Add a new article to the knowledge base for the chatbot."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., How to Reset Your Password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Provide a detailed answer or explanation..." {...field} rows={8} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Billing, Account Management" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pdfFile"
              render={({ field: { value, onChange, ...fieldProps } }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="flex items-center gap-1.5 font-semibold text-sm">
                      <Paperclip className="h-4 w-4 text-primary" />
                      PDF Attachment <span className="text-muted-foreground font-normal text-xs">(Optional, max 5MB)</span>
                    </FormLabel>
                    {(value || existingPdfUrl) && (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        {value ? 'New file selected' : 'Document attached'}
                      </span>
                    )}
                  </div>
                  <FormControl>
                    <div className="space-y-3">
                      {/* Hidden File Input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files && event.target.files[0];
                          if (file) {
                            if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
                              form.setError("pdfFile", { type: "manual", message: "Only PDF files are allowed." });
                              return;
                            }
                            onChange(file);
                            form.setValue("removePdf" as any, false);
                            form.clearErrors("pdfFile");
                          }
                        }}
                      />

                      {/* Case 1: Newly selected file */}
                      {value ? (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5 transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2.5 rounded-md bg-red-500/10 text-red-500 shrink-0">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold truncate text-foreground">{value.name}</p>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                  PDF
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(value.size)} &bull; Ready to upload on save
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Replace
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={clearPdf}
                            >
                              <X className="h-3.5 w-3.5 mr-1" /> Clear
                            </Button>
                          </div>
                        </div>
                      ) : existingPdfUrl ? (
                        /* Case 2: Existing attached file */
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40 transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2.5 rounded-md bg-red-500/10 text-red-500 shrink-0">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold truncate text-foreground">
                                  {existingPdfUrl.split('/').pop()}
                                </p>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                                  Attached
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">Attached document available for download</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              asChild
                              className="h-8 text-xs gap-1.5"
                            >
                              <a href={existingPdfUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" /> View / Download
                              </a>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Replace
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={clearPdf}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Case 3: Empty - Dropzone */
                        <div
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
                                form.setError("pdfFile", { type: "manual", message: "Only PDF files are allowed." });
                                return;
                              }
                              onChange(file);
                              form.setValue("removePdf" as any, false);
                              form.clearErrors("pdfFile");
                            }
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                            isDragging
                              ? "border-primary bg-primary/10 scale-[0.99]"
                              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40"
                          }`}
                        >
                          <div className="p-3 rounded-full bg-primary/10 text-primary">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">Click to attach PDF or drag & drop</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Supports standard PDF files up to 5MB (SOPs, guides, manuals)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : defaultValues ? (
                  "Save Changes"
                ) : (
                  "Add Article"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
