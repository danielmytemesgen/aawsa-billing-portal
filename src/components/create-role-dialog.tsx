
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
import { createRole } from "@/lib/data-store";
import { Loader2, ShieldPlus } from "lucide-react";

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = z.object({
  roleName: z.string().min(3, {
    message: "Role name must be at least 3 characters.",
  }),
});

export function CreateRoleDialog({ open, onOpenChange }: CreateRoleDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<{ roleName: string }>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roleName: "",
    },
  });

  const handleSubmit = async (data: { roleName: string }) => {
    setIsSubmitting(true);
    const result = await createRole(data.roleName);
    if (result.success) {
      toast({
        title: "Role Created",
        description: `The role "${data.roleName}" has been successfully created.`,
      });
      onOpenChange(false);
      form.reset();
    } else {
      toast({
        variant: "destructive",
        title: "Failed to create role",
        description: result.message || "An unexpected error occurred.",
      });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-xl shadow-2xl border-slate-200">
        <DialogHeader className="space-y-3">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
            <ShieldPlus className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold">Create New Role</DialogTitle>
          <DialogDescription className="text-slate-500">
            Define a high-level role name. You will be able to granularly assign permissions in the main dashboard after creation.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="roleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name</FormLabel>
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
              <Button type="submit" disabled={isSubmitting} className="shadow-md">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldPlus className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Creating..." : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
