
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

import { PERMISSIONS } from "@/lib/constants/auth";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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

    const attemptOfflineLogin = () => {
      const cachedCredsRaw = localStorage.getItem("offline_creds");
      if (cachedCredsRaw) {
        const cachedCreds = JSON.parse(cachedCredsRaw);
        const enteredEmail = values.email.trim().toLowerCase();
        const storedEmail = cachedCreds.email.trim().toLowerCase();

        if (enteredEmail === storedEmail) {
          if (btoa(values.password) === cachedCreds.passwordHash) {
            // Use the user profile stored directly inside the offline_creds
            const user = cachedCreds.user;
            if (user) {
              toast({
                title: "Offline Login Successful",
                description: `Logged in as ${enteredEmail} (Offline Mode)`,
              });
              
              // Restore the user session to localStorage so dashboards can load
              localStorage.setItem("user", JSON.stringify(user));

              const permissions = user.permissions || [];
              const isManagement = permissions.includes(PERMISSIONS.DASHBOARD_VIEW_ALL);
              
              setTimeout(() => {
                if (isManagement) router.push("/admin/dashboard");
                else router.push("/staff/dashboard");
              }, 500);
              
              return true;
            }
          } else {
            toast({
              variant: "destructive",
              title: "Offline Login Failed",
              description: "Incorrect password for offline access.",
            });
            return true;
          }
        } else {
           // Email doesn't match the one stored in offline_creds
           console.log("Offline login: Email mismatch", { entered: enteredEmail, stored: storedEmail });
        }
      } else {
        console.log("Offline login: No 'offline_creds' found in localStorage");
      }
      return false;
    };

    const isOffline = typeof window !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      if (attemptOfflineLogin()) {
        setIsLoading(false);
        return;
      }
      
      toast({
        variant: "destructive",
        title: "Offline Login Failed",
        description: "No cached credentials found for this user on this device. Please connect to the internet for your first login.",
      });
      setIsLoading(false);
      return;
    }

    // Create FormData for the server action
    const formData = new FormData();
    formData.append("email", values.email);
    formData.append("password", values.password);

    try {
      const result = await loginAction(formData);

      if (result.success && result.user) {
        // Cache credentials AND user profile for future offline login
        localStorage.setItem("offline_creds", JSON.stringify({
          email: values.email.trim().toLowerCase(),
          passwordHash: btoa(values.password), // Basic obfuscation for local matching
          user: result.user // Cache the profile so it survives even if "user" is cleared from LS
        }));
        
        toast({
          title: "Login Successful",
          description: "Welcome back! Redirecting...",
        });

        localStorage.setItem("user", JSON.stringify(result.user));

      const role = result.user.role.toLowerCase().trim();
      const permissions = result.user.permissions || [];
      const isManagement = permissions.includes(PERMISSIONS.DASHBOARD_VIEW_ALL);

      if (isManagement) {
        // Automatically sync billing aging debt in the background for management users
        syncAllBillsAgingDebtAction().catch(err => {
          console.error("Background sync failed on login:", err);
        });

        router.push("/admin/dashboard");
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
    } catch (error) {
      console.warn("Login action failed (likely network error). Attempting offline fallback.", error);
      if (!attemptOfflineLogin()) {
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "Unable to reach the server and no offline credentials found. Please check your internet connection.",
        });
      }
    }

    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-md glass-card p-6 border-none">
      <CardHeader className="text-center pt-8 pb-12">
        <CardTitle className="text-3xl font-bold text-white tracking-wide">
          <span className="font-extrabold">AAWSA</span>{' '}
          <span className="font-light opacity-80 text-2xl">Billing Portal</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="glass-label text-base mb-2">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="admin@aawsa.com"
                      {...field}
                      disabled={isLoading}
                      className="glass-input h-14 text-lg rounded-xl px-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </FormControl>
                  <FormMessage className="text-red-300" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="glass-label text-base mb-2">Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="•••••"
                        {...field}
                        disabled={isLoading}
                        className="glass-input h-14 text-lg rounded-xl px-4 pr-12 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/50 hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-6 w-6" />
                      ) : (
                        <Eye className="h-6 w-6" />
                      )}
                    </button>
                  </div>
                  <FormMessage className="text-red-300" />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full sign-in-button gap-3" disabled={isLoading}>
              {isLoading ? "Signing In..." : (
                <>
                  <LogIn className="h-6 w-6" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <div className="glass-separator mx-6"></div>
      <CardFooter className="flex flex-col gap-6 pb-12">
        <div className="text-lg text-center text-white/70 font-light italic">
          Are you a customer?
        </div>
        <button
          onClick={() => router.push("/customer-login")}
          className="customer-link text-xl font-medium tracking-wide underline-offset-4"
        >
          Go to Customer Portal
        </button>
      </CardFooter>
    </Card>
  );
}
