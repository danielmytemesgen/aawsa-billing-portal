"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Key, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import { getCustomerAccountAction } from "@/lib/actions";

export function CustomerAuthForm() {
    const router = useRouter();
    const [customerKeyNumber, setCustomerKeyNumber] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const { data: individualData } = await getCustomerAccountAction(customerKeyNumber);

            // Helper function to get device name
            const getDeviceName = () => {
                const ua = navigator.userAgent;
                if (/mobile/i.test(ua)) return 'Mobile Device';
                if (/tablet/i.test(ua)) return 'Tablet';
                return 'Desktop';
            };

            // Helper function to get IP and location
            const getIpAndLocation = async () => {
                try {
                    const response = await fetch('https://ipapi.co/json/');
                    const data = await response.json();
                    return {
                        ip: data.ip || 'unknown',
                        location: `${data.city || ''}, ${data.country_name || ''}`.trim() || 'unknown'
                    };
                } catch {
                    return { ip: 'unknown', location: 'unknown' };
                }
            };

            const { ip, location } = await getIpAndLocation();
            const deviceName = getDeviceName();

            if (individualData && individualData.status === "Active") {
                const { createCustomerSessionAction } = await import("@/lib/actions");
                const { data: session } = await createCustomerSessionAction({
                    customer_key_number: individualData.customerKeyNumber,
                    customer_type: "individual",
                    ip_address: ip,
                    device_name: deviceName,
                    location: location
                });

                localStorage.setItem("customer", JSON.stringify({
                    customerKeyNumber: individualData.customerKeyNumber,
                    name: individualData.name,
                    email: (individualData as any).email || null,
                    phoneNumber: (individualData as any).phone_number || null,
                    customerType: "individual",
                    sessionId: session?.id
                }));
                router.push("/customer/dashboard");
                return;
            }

            const { getBulkMeterAccountAction } = await import("@/lib/actions");
            const { data: bulkData } = await getBulkMeterAccountAction(customerKeyNumber);

            if (bulkData && bulkData.status === "Active") {
                const { createCustomerSessionAction } = await import("@/lib/actions");
                const { data: session } = await createCustomerSessionAction({
                    customer_key_number: bulkData.customerKeyNumber,
                    customer_type: "bulk",
                    ip_address: ip,
                    device_name: deviceName,
                    location: location
                });

                localStorage.setItem("customer", JSON.stringify({
                    customerKeyNumber: bulkData.customerKeyNumber,
                    name: bulkData.name,
                    email: null,
                    phoneNumber: null,
                    customerType: "bulk",
                    sessionId: session?.id
                }));
                router.push("/customer/dashboard");
                return;
            }

            if (individualData && individualData.status !== "Active") {
                setError("Your account is not active. Please contact AAWSA customer service.");
            } else if (bulkData && bulkData.status !== "Active") {
                setError("Your account is not active. Please contact AAWSA customer service.");
            } else {
                setError("Customer not found. Please check your customer key number.");
            }
            setIsLoading(false);
        } catch (err) {
            setError("An unexpected error occurred. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-lg glass-card p-6 border-none">
            <CardHeader className="text-center pt-8 pb-12">
                <div className="flex justify-center mb-6">
                    <div className="bg-white p-2 rounded-xl shadow-lg inline-flex items-center justify-center">
                        <Image
                            src="https://veiethiopia.com/photo/partner/par2.png"
                            alt="AAWSA Logo"
                            width={80}
                            height={50}
                            className="object-contain"
                            priority
                        />
                    </div>
                </div>
                <CardTitle className="text-3xl font-bold text-white tracking-wide">
                    <span className="font-extrabold">CUSTOMER</span>{' '}
                    <span className="font-light opacity-80 text-2xl">Portal Access</span>
                </CardTitle>
                <CardDescription className="text-white/60 text-lg">Enter your customer key number to access your account</CardDescription>
            </CardHeader>
            <CardContent className="px-6">
                <form onSubmit={handleLogin} className="space-y-8">
                    <div className="space-y-3">
                        <label htmlFor="customerKeyNumber" className="glass-label text-base mb-2 flex items-center gap-2">
                            <Key className="h-4 w-4 text-blue-300" />
                            Customer Key Number
                        </label>
                        <div className="relative group">
                            <Input
                                id="customerKeyNumber"
                                type="text"
                                placeholder="e.g. 4444444"
                                value={customerKeyNumber}
                                onChange={(e) => setCustomerKeyNumber(e.target.value)}
                                required
                                disabled={isLoading}
                                className="glass-input h-14 text-lg rounded-xl px-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                                autoFocus
                            />
                            {!isLoading && customerKeyNumber.length > 0 && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400">
                                    <ArrowRight className="h-5 w-5" />
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive" className="rounded-xl bg-red-500/10 border-red-500/20 text-red-200">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="font-medium">{error}</AlertDescription>
                        </Alert>
                    )}

                    <Button
                        type="submit"
                        className="w-full sign-in-button gap-3 h-14"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-3">
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Accessing...</span>
                            </div>
                        ) : (
                            <>
                                <ShieldCheck className="h-6 w-6" />
                                Access Portal
                            </>
                        )}
                    </Button>
                </form>
            </CardContent>
            <div className="glass-separator mx-6 my-8"></div>
            <CardFooter className="flex flex-col gap-6 pb-12">
                <div className="bg-white/5 p-4 rounded-2xl w-full text-center">
                    <div className="flex items-center justify-center gap-2 text-blue-300 mb-2">
                        <HelpCircle className="h-4 w-4" />
                        <span className="text-sm font-semibold">Help</span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                        Your customer key number can be found at the top of your
                        <span className="text-blue-400 font-bold mx-1">monthly water bill</span>
                        or by contacting support.
                    </p>
                </div>
            </CardFooter>
        </Card>
    );
}
