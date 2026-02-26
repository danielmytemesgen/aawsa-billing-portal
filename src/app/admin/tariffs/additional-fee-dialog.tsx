
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AdditionalFee } from '@/lib/billing-calculations';

const formSchema = z.object({
    name: z.string().min(1, "Fee name is required"),
    value: z.number().min(0, "Value must be 0 or greater"),
    type: z.enum(['percentage', 'flat']),
});

interface AdditionalFeeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: AdditionalFee) => void;
    initialData?: AdditionalFee;
    isEditing?: boolean;
}

export function AdditionalFeeDialog({
    open,
    onOpenChange,
    onSubmit,
    initialData,
    isEditing = false
}: AdditionalFeeDialogProps) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            value: 0,
            type: 'percentage',
        },
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    name: initialData.name,
                    value: initialData.type === 'percentage' ? initialData.value * 100 : initialData.value,
                    type: initialData.type,
                });
            } else {
                form.reset({
                    name: '',
                    value: 0,
                    type: 'percentage',
                });
            }
        }
    }, [open, initialData, form]);

    const handleFormSubmit = (values: z.infer<typeof formSchema>) => {
        const finalData: AdditionalFee = {
            name: values.name,
            value: values.type === 'percentage' ? values.value / 100 : values.value,
            type: values.type,
        };
        onSubmit(finalData);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Additional Fee' : 'Add Additional Fee'}</DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Update the details for this additional fee.'
                            : 'Define a new fee or charge to be included in the bill calculation.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Fee Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Greening Fee" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="value"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Value</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="any"
                                                {...field}
                                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="percentage">Percentage (%)</SelectItem>
                                                <SelectItem value="flat">Flat Rate (ETB)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="submit">{isEditing ? 'Update Fee' : 'Add Fee'}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
