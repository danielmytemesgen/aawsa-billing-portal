
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
import { useToast } from "@/hooks/use-toast";
import { createPermission, updatePermission } from "@/lib/data-store";
import { Loader2 } from "lucide-react";
import type { DomainPermission } from "@/lib/data-store";

interface CreateEditPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permission?: DomainPermission;
}

const formSchema = z.object({
  name: z.string().min(3, { message: "Permission name must be at least 3 characters." }),
  category: z.string().min(3, { message: "Category must be at least 3 characters." }),
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
      form.reset(permission);
    } else {
      form.reset({ name: "", category: "" });
    }
  }, [permission, form]);

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Permission" : "Create New Permission"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Edit the permission details below." : "Enter details for the new permission."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Permission Name</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
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
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
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
