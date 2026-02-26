"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Droplets, AlertCircle, Key, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import { getCustomerAccountAction } from "@/lib/actions";

export default function CustomerLoginPage() {
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

            // Helper function to get IP and location (simplified - using a public API)
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
                // Create session
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
                // Create session
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
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[100px] opacity-50 animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[100px] opacity-50 animate-pulse" style={{ animationDelay: '2s' }}></div>

            <div className="w-full max-w-lg z-10">
                <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="inline-flex p-3 rounded-2xl bg-white shadow-xl mb-6 transform transition-transform hover:scale-105 duration-300">
                        <Image
                            src="https://veiethiopia.com/photo/partner/par2.png"
                            alt="AAWSA Logo"
                            width={100}
                            height={66}
                            className="object-contain"
                            priority
                        />
                    </div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                        AAWSA <span className="text-blue-600">Portal</span>
                    </h1>
                    <p className="text-slate-500 font-medium">Empowering Customers with Digital Access</p>
                </div>

                <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-md rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 delay-200">
                    <CardHeader className="pb-0 pt-8 px-8">
                        <CardTitle className="text-2xl font-bold text-slate-800">Welcome Back</CardTitle>
                        <CardDescription className="text-slate-500">Enter your credentials to access your water account</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-3">
                                <Label htmlFor="customerKeyNumber" className="text-slate-700 font-semibold flex items-center gap-2 ml-1">
                                    <Key className="h-4 w-4 text-blue-500" />
                                    Customer Key Number
                                </Label>
                                <div className="relative group">
                                    <Input
                                        id="customerKeyNumber"
                                        type="text"
                                        placeholder="e.g. 4444444"
                                        value={customerKeyNumber}
                                        onChange={(e) => setCustomerKeyNumber(e.target.value)}
                                        required
                                        disabled={isLoading}
                                        className="h-14 px-5 bg-slate-50 border-slate-200 rounded-2xl text-lg transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 group-hover:bg-white"
                                        autoFocus
                                    />
                                    {!isLoading && customerKeyNumber.length > 0 && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 animate-in fade-in slide-in-from-right-2">
                                            <ArrowRight className="h-5 w-5" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <Alert variant="destructive" className="rounded-2xl bg-red-50 border-red-100 text-red-800 animate-in shake duration-500">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="font-medium">{error}</AlertDescription>
                                </Alert>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-blue-500/20 transition-all duration-300 hover:shadow-blue-500/40 transform active:scale-[0.98] flex items-center justify-center gap-2"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-3">
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Signing in...</span>
                                    </div>
                                ) : (
                                    <>
                                        <span>Access Portal</span>
                                        <ShieldCheck className="h-5 w-5" />
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="mt-10 pt-8 border-t border-slate-100">
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex items-center gap-2 text-slate-400 group cursor-help transition-colors hover:text-blue-500">
                                    <HelpCircle className="h-4 w-4" />
                                    <span className="text-sm font-medium">Need help finding your key?</span>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl w-full text-center">
                                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                        Your customer key number can be found at the top of your
                                        <span className="text-blue-600 font-bold mx-1">monthly water bill</span>
                                        or by contacting AAWSA support.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-center mt-8 text-slate-400 text-sm font-medium">
                    © 2026 Addis Ababa Water & Sewerage Authority
                </p>
            </div>
        </div>
    );
}
