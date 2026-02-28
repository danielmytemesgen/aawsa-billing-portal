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
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
    effectiveDate: z.string().refine((dateString) => {
        if (!dateString) return false;
        // We split by hyphens and construct a local date to avoid timezone offset issues
        const [year, month, day] = dateString.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selectedDate <= today;
    }, {
        message: "Effective date cannot be in the future.",
    }),
});

export type NewVersionFormValues = z.infer<typeof formSchema>;

interface NewVersionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: NewVersionFormValues) => void;
}

export function NewVersionDialog({ open, onOpenChange, onSubmit }: NewVersionDialogProps) {
    const form = useForm<NewVersionFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            effectiveDate: new Date().toISOString().split('T')[0],
        },
    });

    React.useEffect(() => {
        if (open) {
            form.reset({
                effectiveDate: new Date().toISOString().split('T')[0],
            });
        }
    }, [open, form]);

    const handleSubmit = (data: NewVersionFormValues) => {
        onSubmit(data);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Create New Tariff Version</DialogTitle>
                    <DialogDescription>
                        Select the effective date for the new tariff version. The date cannot be in the future.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="effectiveDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Effective Date</FormLabel>
                                    <FormControl>
                                        <Input type="date" max={new Date().toISOString().split('T')[0]} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit">Create Version</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
