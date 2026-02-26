
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
import type { KnowledgeBaseArticle } from "./knowledge-base-types";

const formSchema = z.object({
  title: z.string().min(5, { message: "Title must be at least 5 characters." }),
  content: z.string().min(20, { message: "Content must be at least 20 characters." }),
  category: z.string().optional(),
  pdfFile: z.instanceof(File).optional(), // New field for PDF upload
});

export type KnowledgeBaseFormValues = z.infer<typeof formSchema> & {
  pdfFile?: File; // Include File type for direct access
  pdf_url?: string | null;
};

interface KnowledgeBaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: KnowledgeBaseFormValues) => void;
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

  React.useEffect(() => {
    if (defaultValues) {
      form.reset({
        title: defaultValues.title,
        content: defaultValues.content,
        category: defaultValues.category || "",
        pdfFile: undefined, // Clear any previously selected file when editing
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
  }, [defaultValues, form, open]);

  const handleSubmit = (data: KnowledgeBaseFormValues) => {
    // Client-side validation for file size
    if (data.pdfFile && data.pdfFile.size > 5 * 1024 * 1024) { // 5MB limit
      form.setError("pdfFile", {
        type: "manual",
        message: "PDF file must be less than 5MB.",
      });
      return;
    }
    onSubmit({
      ...data,
      pdf_url: existingPdfUrl
    });
    onOpenChange(false);
  };

  const clearPdf = () => {
    form.setValue("pdfFile", undefined);
    setExistingPdfUrl(null);
    form.clearErrors("pdfFile");
  }

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
                  <FormLabel>PDF Attachment (Optional, max 5MB)</FormLabel>
                  <FormControl>
                    <div>
                      <Input
                        {...fieldProps}
                        type="file"
                        accept=".pdf"
                        onChange={(event) => {
                          onChange(event.target.files && event.target.files[0]);
                        }}
                      />
                      {existingPdfUrl && !value && (
                        <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between">
                          <span>Currently attached: <a href={existingPdfUrl} target="_blank" rel="noopener noreferrer" className="underline">{existingPdfUrl.split('/').pop()}</a></span>
                          <Button variant="ghost" size="sm" onClick={clearPdf}>
                            Remove
                          </Button>
                        </div>
                      )}
                      {value && (
                        <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between">
                          <span>Selected: {value.name}</span>
                          <Button variant="ghost" size="sm" onClick={clearPdf}>
                            Clear Selection
                          </Button>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">
                {defaultValues ? "Save Changes" : "Add Article"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
