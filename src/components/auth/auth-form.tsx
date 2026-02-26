
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { LogIn, Eye, EyeOff } from "lucide-react";
import { loginAction } from "@/lib/auth-actions";
import { syncAllBillsAgingDebtAction } from "@/lib/actions";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const ADMIN_ROLES = ['admin', 'head office management', 'staff management'];

export function AuthForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);

    // Create FormData for the server action
    const formData = new FormData();
    formData.append("email", values.email);
    formData.append("password", values.password);

    const result = await loginAction(formData);

    if (result.success && result.user) {
      toast({
        title: "Login Successful",
        description: "Welcome back! Redirecting...",
      });

      // Still storing minimal user info in localStorage for UI convenience (e.g., name display)
      // but NOT for security checks anymore.
      localStorage.setItem("user", JSON.stringify(result.user));

      const role = result.user.role.toLowerCase();

      if (['admin', 'head office management', 'staff management'].includes(role)) {
        // Automatically sync billing aging debt in the background for management users
        syncAllBillsAgingDebtAction().catch(err => {
          console.error("Background sync failed on login:", err);
        });

        if (role === 'admin') router.push("/admin/dashboard");
        else if (role === 'head office management') router.push("/admin/head-office-dashboard");
        else if (role === 'staff management') router.push("/admin/staff-management-dashboard");
      } else {
        router.push("/staff/dashboard");
      }

    } else {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: result.message || "Invalid email or password.",
      });
    }

    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-sm shadow-2xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">AAWSA Billing Portal</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="e.g., kality@aawsa.com"
                      {...field}
                      disabled={isLoading}
                    />
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
                  <FormLabel>Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing In..." : <> <LogIn className="mr-2 h-4 w-4" /> Sign In </>}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t pt-6 bg-muted/20">
        <div className="text-sm text-center text-muted-foreground">Are you a customer?</div>
        <Button variant="outline" className="w-full" onClick={() => router.push("/customer-login")}>
          Go to Customer Portal
        </Button>
      </CardFooter>
    </Card>
  );
}
