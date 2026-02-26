
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StaffMember, StaffStatus } from "./staff-types";
import { getBranches, initializeBranches, subscribeToBranches, getRoles, initializeRoles, subscribeToRoles } from "@/lib/data-store";
import type { Branch } from "@/app/admin/branches/branch-types";
import type { DomainRole } from "@/lib/data-store";

const staffStatuses = ['Active', 'Inactive', 'On Leave'] as const;

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal('')),
  branchName: z.string().min(1, { message: "A branch must be selected." }),
  status: z.enum(staffStatuses, { errorMap: () => ({ message: "Please select a valid status."}) }),
  phone: z.string().optional(),
  role: z.string({ required_error: "Role is required." }).min(1, "Role is required."),
});


export type StaffFormValues = z.infer<typeof formSchema>;

interface StaffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: StaffFormValues) => void;
  defaultValues?: StaffMember | null;
}

export function StaffFormDialog({ open, onOpenChange, onSubmit, defaultValues }: StaffFormDialogProps) {
  const [availableBranches, setAvailableBranches] = React.useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = React.useState(true);
  const [availableRoles, setAvailableRoles] = React.useState<DomainRole[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = React.useState(true);

  React.useEffect(() => {
    if (open) {
      setIsLoadingBranches(true);
      initializeBranches().then(() => {
        setAvailableBranches(getBranches());
        setIsLoadingBranches(false);
      });
      const unsubscribeBranches = subscribeToBranches((updatedBranches) => {
        setAvailableBranches(updatedBranches);
      });

      setIsLoadingRoles(true);
      initializeRoles().then(() => {
        setAvailableRoles(getRoles());
        setIsLoadingRoles(false);
      });
      const unsubscribeRoles = subscribeToRoles((updatedRoles) => {
        setAvailableRoles(updatedRoles);
      });

      return () => {
        unsubscribeBranches();
        unsubscribeRoles();
      }
    }
  }, [open]);
  
  const form = useForm<StaffFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      branchName: "",
      status: undefined,
      phone: "",
      role: undefined,
    },
  });
  
  const isEditing = !!defaultValues;

  React.useEffect(() => {
    if (defaultValues) {
      form.reset({
        name: defaultValues.name,
        email: defaultValues.email,
        password: "", // Always clear password field for security
        branchName: defaultValues.branchName,
        status: defaultValues.status,
        phone: defaultValues.phone || "",
        role: defaultValues.role,
      });
    } else {
      form.reset({
        name: "",
        email: "",
        password: "",
        branchName: "",
        status: "Active" as StaffStatus,
        phone: "",
        role: "Staff",
      });
    }
  }, [defaultValues, form, open]);

  const handleSubmit = (data: StaffFormValues) => {
    if (!isEditing && !data.password) {
        form.setError("password", { type: "manual", message: "Password is required for new staff members." });
        return;
    }
    onSubmit(data);
    onOpenChange(false); 
  };
  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
          <DialogDescription>
            {defaultValues ? "Update the details of the staff member." : "Fill in the details to add a new staff member."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Login ID)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="e.g., staff@aawsa.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isEditing ? "New Password (Optional)" : "Password"}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={isEditing ? "Leave blank to keep current" : "••••••••"} {...field} />
                  </FormControl>
                   <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="e.g., +251 91 123 4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="branchName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={isLoadingBranches}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingBranches ? "Loading branches..." : "Select a branch"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Head Office">Head Office</SelectItem>
                      {availableBranches.filter(b => b.name && b.name !== '').map((branch, idx) => (
                        <SelectItem key={branch.id ?? `branch-${idx}`} value={String(branch.name)}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingRoles}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingRoles ? "Loading roles..." : "Select a role"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableRoles.filter(r => r.role_name && r.role_name !== '').map((role, idx) => (
                        <SelectItem key={role.id ?? `role-${idx}`} value={String(role.role_name)}>{role.role_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {staffStatuses.filter(s => s).map(status => (
                        <SelectItem key={status} value={String(status)}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">
                {defaultValues ? "Save Changes" : "Add Staff"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
