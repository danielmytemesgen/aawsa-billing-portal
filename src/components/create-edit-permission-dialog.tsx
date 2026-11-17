"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { useToast } from "@/hooks/use-toast";
import { createPermission, updatePermission, getPermissions } from "@/lib/data-store";
import { Loader2, ShieldPlus, Pencil } from "lucide-react";
import type { DomainPermission } from "@/lib/data-store";
import { getCanonicalCategory, CANONICAL_CATEGORIES } from "@/lib/roles-permissions-utils";

export { CANONICAL_CATEGORIES };

interface CreateEditPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permission?: DomainPermission;
}

const formSchema = z.object({
  name: z.string().min(3, { message: "Permission name must be at least 3 characters." }),
  category: z.string().min(2, { message: "Category selection is required." }),
});

export function CreateEditPermissionDialog({ open, onOpenChange, permission }: CreateEditPermissionDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEditMode = !!permission;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "",
    },
  });

  React.useEffect(() => {
    if (permission) {
      form.reset({
        name: permission.name,
        category: getCanonicalCategory(permission.category, permission.name),
      });
    } else {
      form.reset({ name: "", category: "Dashboard & Overview" });
    }
  }, [permission, form, open]);

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);

    // Validate duplicate permission name
    const existingPerms = getPermissions();
    const isDuplicate = existingPerms.some(p => {
      if (isEditMode && p.id === permission?.id) return false;
      return p.name.trim().toLowerCase() === data.name.trim().toLowerCase();
    });

    if (isDuplicate) {
      form.setError("name", {
        type: "manual",
        message: "A permission token with this name already exists.",
      });
      setIsSubmitting(false);
      return;
    }

    const result = isEditMode
      ? await updatePermission(permission.id, data)
      : await createPermission(data);

    if (result.success) {
      toast({
        title: isEditMode ? "Permission Updated" : "Permission Created",
        description: `The permission "${data.name}" has been successfully ${isEditMode ? 'updated' : 'created'}.`,
      });
      onOpenChange(false);
    } else {
      toast({
        variant: "destructive",
        title: `Failed to ${isEditMode ? 'update' : 'create'} permission`,
        description: result.message || "An unexpected error occurred.",
      });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-xl shadow-2xl border-slate-200">
        <DialogHeader className="space-y-3">
          <div className={`h-12 w-12 ${isEditMode ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'} rounded-full flex items-center justify-center mb-2`}>
            {isEditMode ? <Pencil className="h-6 w-6" /> : <ShieldPlus className="h-6 w-6" />}
          </div>
          <DialogTitle className="text-xl font-bold">{isEditMode ? "Modify Permission Token" : "Generate System Token"}</DialogTitle>
          <DialogDescription className="text-slate-500">
            {isEditMode 
              ? "Update the handle and category for this underlying system token." 
              : "Register a new permission string that can be used for role-based access control."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Permission Name / Handle</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g. report:billing_summary"
                      className="font-mono text-sm"
                      disabled={isSubmitting}
                    />
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
                  <FormLabel>Canonical Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Select a category..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[250px]">
                      {CANONICAL_CATEGORIES.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? (isEditMode ? "Saving..." : "Creating...") : (isEditMode ? "Save Changes" : "Create Permission")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
