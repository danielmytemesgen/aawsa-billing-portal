"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { DomainFaultCode, addFaultCode, updateExistingFaultCode } from "@/lib/data-store";
import { Loader2, Hash, Tag, FileText, AlertCircle, Pencil } from "lucide-react";

const formSchema = z.object({
    code: z.string().min(1, "Code is required"),
    description: z.string().optional(),
    category: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FaultCodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    faultCode: DomainFaultCode | null; // If null, creating new; otherwise editing
}

export function FaultCodeDialog({ open, onOpenChange, faultCode }: FaultCodeDialogProps) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            code: "",
            description: "",
            category: "",
        },
    });

    React.useEffect(() => {
        if (faultCode) {
            form.reset({
                code: faultCode.code,
                description: faultCode.description || "",
                category: faultCode.category || "",
            });
        } else {
            form.reset({
                code: "",
                description: "",
                category: "",
            });
        }
    }, [faultCode, form, open]);

    const onSubmit = async (values: FormValues) => {
        try {
            setIsSaving(true);

            let result;
            if (faultCode) {
                // Update
                result = await updateExistingFaultCode(faultCode.id, {
                    ...values,
                    description: values.description || null,
                    category: values.category || null,
                });
            } else {
                // Create
                result = await addFaultCode({
                    ...values,
                    description: values.description || null,
                    category: values.category || null,
                });
            }

            if (result.success) {
                toast({
                    title: faultCode ? "Fault Code Updated" : "Fault Code Created",
                    description: `Successfully ${faultCode ? "updated" : "added"} fault code ${values.code}.`,
                });
                onOpenChange(false);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: result.message || "Something went wrong.",
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "An unexpected error occurred.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] rounded-xl shadow-2xl border-slate-200">
                <DialogHeader className="space-y-4">
                    <div className={`h-12 w-12 ${faultCode ? 'bg-indigo-100 text-indigo-600' : 'bg-primary/10 text-primary'} rounded-full flex items-center justify-center mb-2`}>
                        {faultCode ? <Pencil className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold">{faultCode ? "Modify Fault Code" : "Register Fault Code"}</DialogTitle>
                        <DialogDescription className="text-slate-500 mt-1">
                            {faultCode ? "Update the identifier and behavior for this system fault." : "Define a new error code to be used during meter reading operations."}
                        </DialogDescription>
                    </div>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid gap-5 py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="code" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Hash className="h-3.5 w-3.5 text-slate-400" />
                                Code Identifier
                            </Label>
                            <Input
                                id="code"
                                placeholder="e.g. F01"
                                {...form.register("code")}
                                disabled={isSaving}
                                className="h-10 border-slate-200 focus-visible:ring-primary/20 font-mono"
                            />
                            {form.formState.errors.code && (
                                <p className="text-sm text-red-500 font-medium">{form.formState.errors.code.message}</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="category" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Tag className="h-3.5 w-3.5 text-slate-400" />
                                Category (Optional)
                            </Label>
                            <Input
                                id="category"
                                placeholder="e.g. Leakage, Blockage"
                                {...form.register("category")}
                                disabled={isSaving}
                                className="h-10 border-slate-200 focus-visible:ring-primary/20"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-slate-400" />
                                Public Description
                            </Label>
                            <Textarea
                                id="description"
                                placeholder="Provide a clear description of this fault condition..."
                                {...form.register("description")}
                                disabled={isSaving}
                                className="min-h-[100px] border-slate-200 focus-visible:ring-primary/20 resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-5">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving} className="border-slate-200">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving} className="shadow-md">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (faultCode ? <Pencil className="mr-2 h-4 w-4" /> : <AlertCircle className="mr-2 h-4 w-4" />)}
                            {faultCode ? "Save Changes" : "Register Code"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
