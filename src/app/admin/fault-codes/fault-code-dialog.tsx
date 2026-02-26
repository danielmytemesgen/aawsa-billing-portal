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
import { Loader2 } from "lucide-react";

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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{faultCode ? "Edit Fault Code" : "Add Fault Code"}</DialogTitle>
                    <DialogDescription>
                        {faultCode ? "Update the details of the fault code." : "Create a new fault code for meter readings."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="code">Code</Label>
                            <Input
                                id="code"
                                placeholder="e.g. F01"
                                {...form.register("code")}
                                disabled={isSaving}
                            />
                            {form.formState.errors.code && (
                                <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="category">Category (Optional)</Label>
                            <Input
                                id="category"
                                placeholder="e.g. Leakage"
                                {...form.register("category")}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Describe the fault..."
                                {...form.register("description")}
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {faultCode ? "Save Changes" : "Create Code"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
