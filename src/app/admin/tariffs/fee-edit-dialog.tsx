
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
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
    value: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
        message: "Value must be a non-negative number.",
    }),
});

export type FeeFormValues = z.infer<typeof formSchema>;

interface FeeEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: number) => void;
    title: string;
    description: string;
    label: string;
    defaultValue: number;
    isPercentage: boolean;
    canUpdate: boolean;
}

export function FeeEditDialog({
    open,
    onOpenChange,
    onSubmit,
    title,
    description,
    label,
    defaultValue,
    isPercentage,
    canUpdate
}: FeeEditDialogProps) {

    // Format the default value for the input. 
    // If it's a percentage (0.01), we want to show it as 1 in the input.
    const initialDisplayValue = isPercentage ? (defaultValue * 100).toString() : defaultValue.toString();

    const form = useForm<FeeFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            value: initialDisplayValue,
        },
    });

    React.useEffect(() => {
        if (open) {
            form.reset({
                value: initialDisplayValue,
            });
        }
    }, [defaultValue, initialDisplayValue, form, open]);

    const handleSubmit = (data: FeeFormValues) => {
        const numericValue = parseFloat(data.value);
        // If it's a percentage, convert back to decimal (1 -> 0.01)
        const finalValue = isPercentage ? numericValue / 100 : numericValue;
        onSubmit(finalValue);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="value"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{label}</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                {...field}
                                                disabled={!canUpdate}
                                                className={isPercentage ? "pr-8" : ""}
                                            />
                                            {isPercentage && (
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                                            )}
                                        </div>
                                    </FormControl>
                                    <FormDescription>
                                        {isPercentage
                                            ? "Enter the percentage value (e.g., 15 for 15%)."
                                            : "Enter the threshold value in cubic meters (m³)."}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            {canUpdate && (
                                <Button type="submit">Save Changes</Button>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
