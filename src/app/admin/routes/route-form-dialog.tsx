
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useBranches, useStaffMembers } from "@/lib/data-store";
import { type Route } from "../bulk-meters/bulk-meter-types";

const routeFormSchema = z.object({
    routeKey: z.string().min(1, "Route Key is required"),
    branchId: z.string().optional().nullable(),
    readerId: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
});

export type RouteFormValues = z.infer<typeof routeFormSchema>;

interface RouteFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: RouteFormValues) => void;
    defaultValues?: Route | null;
}

export function RouteFormDialog({
    open,
    onOpenChange,
    onSubmit,
    defaultValues,
}: RouteFormDialogProps) {
    const branches = useBranches();
    const staffMembers = useStaffMembers();

    const form = useForm<RouteFormValues>({
        resolver: zodResolver(routeFormSchema),
        defaultValues: {
            routeKey: "",
            branchId: "",
            readerId: "",
            description: "",
        },
    });

    React.useEffect(() => {
        if (defaultValues) {
            form.reset({
                routeKey: defaultValues.routeKey || "",
                branchId: defaultValues.branchId || "",
                readerId: defaultValues.readerId || "",
                description: defaultValues.description || "",
            });
        } else {
            form.reset({
                routeKey: "",
                branchId: "",
                readerId: "",
                description: "",
            });
        }
    }, [defaultValues, form, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{defaultValues ? "Edit Route" : "Add New Route"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="routeKey"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Route Key</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g. RT-001"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="branchId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Branch</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value || undefined}
                                        value={field.value || ""}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a branch" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="">None</SelectItem>
                                            {branches.map((branch: any) => (
                                                <SelectItem key={branch.id} value={branch.id}>
                                                    {branch.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="readerId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reader (Staff Member)</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value || undefined}
                                        value={field.value || ""}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Assign a reader" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="">Unassigned</SelectItem>
                                            {staffMembers
                                                .filter((staff: any) => staff.role?.toLowerCase() === 'reader')
                                                .map((staff: any) => (
                                                    <SelectItem key={staff.id} value={staff.id}>
                                                        {staff.name} ({staff.branchName})
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Optional description of the route" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" className="w-full">
                                {defaultValues ? "Update Route" : "Create Route"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
