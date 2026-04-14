
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
import { LayoutGrid, MapPin, Users, Info, Activity } from "lucide-react";

const routeFormSchema = z.object({
    routeKey: z.string().min(1, "Route Key is required"),
    branchId: z.string().optional().nullable(),
    readerId: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    status: z.string().default("Active"),
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
            status: "Active",
        },
    });

    const branchIdWatcher = form.watch("branchId");

    // Clear readerId if it doesn't belong to the new branchIdWatcher
    React.useEffect(() => {
        const currentReaderId = form.getValues("readerId");
        if (currentReaderId && branchIdWatcher) {
            const selectedReader = staffMembers.find(s => s.id === currentReaderId);
            if (selectedReader && selectedReader.branchId !== branchIdWatcher) {
                form.setValue("readerId", "");
            }
        }
    }, [branchIdWatcher, form, staffMembers]);

    React.useEffect(() => {
        if (defaultValues) {
            form.reset({
                routeKey: defaultValues.routeKey || "",
                branchId: defaultValues.branchId || "",
                readerId: defaultValues.readerId || "",
                description: defaultValues.description || "",
                status: defaultValues.status || "Active",
            });
        } else {
            form.reset({
                routeKey: "",
                branchId: "",
                readerId: "",
                description: "",
                status: "Active",
            });
        }
    }, [defaultValues, form, open]);

    const filteredReaders = staffMembers.filter((staff: any) => {
        const isReader = staff.role?.toLowerCase() === 'reader';
        const isSameBranch = branchIdWatcher ? staff.branchId === branchIdWatcher : true;
        return isReader && isSameBranch;
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] border-none shadow-2xl rounded-3xl overflow-hidden p-0">
                <div className="bg-slate-900 p-6 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <LayoutGrid className="h-5 w-5 text-blue-400" />
                            {defaultValues ? "Edit Route Profile" : "Create New Route"}
                        </DialogTitle>
                        <p className="text-slate-400 text-xs font-medium">Configure geographic zones and personnel assignment.</p>
                    </DialogHeader>
                </div>

                <div className="p-6 bg-white">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="routeKey"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[13px] font-bold uppercase tracking-wider text-slate-900">Route ID KEY</FormLabel>
                                            <FormControl>
                                                <div className="relative group">
                                                    <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                                    <Input
                                                        placeholder="e.g. RT-A1"
                                                        {...field}
                                                        className="pl-10 h-11 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-blue-500/10 transition-all font-mono font-bold uppercase"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[13px] font-bold uppercase tracking-wider text-slate-900">Operational Status</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value || "Active"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-11 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-blue-500/10 transition-all font-bold">
                                                        <SelectValue placeholder="Status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-slate-100">
                                                    <SelectItem value="Active" className="focus:bg-emerald-50 focus:text-emerald-700">Active</SelectItem>
                                                    <SelectItem value="Inactive" className="focus:bg-amber-50 focus:text-amber-700">Inactive</SelectItem>
                                                    <SelectItem value="Archived" className="focus:bg-slate-50 focus:text-slate-700">Archived</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="branchId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[13px] font-bold uppercase tracking-wider text-slate-900">Territory / Branch</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value || ""}
                                        >
                                            <FormControl>
                                                <div className="relative group">
                                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                                                    <SelectTrigger className="pl-10 h-11 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-blue-500/10 transition-all font-bold">
                                                        <SelectValue placeholder="Assign a branch" />
                                                    </SelectTrigger>
                                                </div>
                                            </FormControl>
                                            <SelectContent className="rounded-xl border-slate-100">
                                                <SelectItem value="">Universal (Unassigned)</SelectItem>
                                                {branches.map((branch: any) => (
                                                    <SelectItem key={branch.id} value={branch.id}>
                                                        {branch.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="text-[10px]" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="readerId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[13px] font-bold uppercase tracking-wider text-slate-900">Personnel Assignment</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value || ""}
                                            disabled={!branchIdWatcher}
                                        >
                                            <FormControl>
                                                <div className="relative group">
                                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                                                    <SelectTrigger className="pl-10 h-11 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-blue-500/10 transition-all font-bold">
                                                        <SelectValue placeholder={!branchIdWatcher ? "Select a branch first" : "Assign a reader"} />
                                                    </SelectTrigger>
                                                </div>
                                            </FormControl>
                                            <SelectContent className="rounded-xl border-slate-100">
                                                <SelectItem value="">No Assignment</SelectItem>
                                                {filteredReaders.map((staff: any) => (
                                                    <SelectItem key={staff.id} value={staff.id}>
                                                        {staff.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {branchIdWatcher && filteredReaders.length === 0 && (
                                            <p className="text-[10px] font-bold text-amber-500 mt-1.5 flex items-center gap-1">
                                                <Info className="h-3 w-3" /> No authorized readers found in this branch
                                            </p>
                                        )}
                                        <FormMessage className="text-[10px]" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[13px] font-bold uppercase tracking-wider text-slate-900">Geographic Description</FormLabel>
                                        <FormControl>
                                            <div className="relative group">
                                                <Info className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                                <Input 
                                                    placeholder="Zone or locality details..." 
                                                    {...field} 
                                                    value={field.value || ""} 
                                                    className="pl-10 h-11 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage className="text-[10px]" />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter className="pt-4">
                                <Button 
                                    type="submit" 
                                    className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 font-bold transition-all active:scale-[0.98] flex items-center gap-2 group"
                                >
                                    <Activity className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                                    {defaultValues ? "Commit Profile Update" : "Initialize New Route"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
