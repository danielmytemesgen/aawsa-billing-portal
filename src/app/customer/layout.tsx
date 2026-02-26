"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Droplets, LogOut, FileText, User, LayoutDashboard, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface CustomerLayoutProps {
    children: React.ReactNode;
}

const PAGE_NAME_MAP: Record<string, string> = {
    '/customer/dashboard': 'Dashboard',
    '/customer/bills': 'Bills',
    '/customer/readings': 'Reading History',
    '/customer/account': 'Account',
};

export default function CustomerLayout({ children }: CustomerLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [customerName, setCustomerName] = useState("");
    const [customerKey, setCustomerKey] = useState("");
    const loggedPagesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Check if customer is logged in
        const customerData = localStorage.getItem("customer");
        if (!customerData) {
            router.push("/customer-login");
            return;
        }

        try {
            const customer = JSON.parse(customerData);
            setCustomerName(customer.name || "Customer");
            setCustomerKey(customer.customerKeyNumber || "");
        } catch (error) {
            router.push("/customer-login");
        }
    }, [router]);

    // Track page views on navigation
    useEffect(() => {
        if (!pathname) return;
        const pageName = PAGE_NAME_MAP[pathname];
        if (!pageName) return;

        // Avoid logging the same page multiple times in this client session
        if (loggedPagesRef.current.has(pageName)) return;

        const customerData = localStorage.getItem("customer");
        if (!customerData) return;

        try {
            const customer = JSON.parse(customerData);
            const sessionId = customer.sessionId;
            if (!sessionId) return;

            loggedPagesRef.current.add(pageName);

            // Fire-and-forget: log the page view
            fetch('/api/customer/log-page-view', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, pageName }),
            }).catch(() => {
                // Remove from tracked if logging failed so it can retry
                loggedPagesRef.current.delete(pageName);
            });
        } catch {
            // ignore parse errors
        }
    }, [pathname]);

    const handleLogout = () => {
        localStorage.removeItem("customer");
        router.push("/customer-login");
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-md sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {/* Mobile Menu Trigger */}
                            <div className="md:hidden">
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                            <Menu className="h-6 w-6" />
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="left">
                                        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                                        <SheetDescription className="sr-only">
                                            Main navigation for accessing dashboard, bills, and account settings.
                                        </SheetDescription>
                                        <div className="flex flex-col gap-6 mt-8">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Image
                                                    src="https://veiethiopia.com/photo/partner/par2.png"
                                                    alt="AAWSA Logo"
                                                    width={50}
                                                    height={30}
                                                    className="object-contain"
                                                />
                                                <h2 className="font-bold text-lg">AAWSA Portal</h2>
                                            </div>
                                            <nav className="flex flex-col gap-2">
                                                <Link href="/customer/dashboard" className="w-full">
                                                    <Button variant="ghost" className="w-full justify-start gap-3">
                                                        <LayoutDashboard className="h-5 w-5" />
                                                        Dashboard
                                                    </Button>
                                                </Link>
                                                <Link href="/customer/bills" className="w-full">
                                                    <Button variant="ghost" className="w-full justify-start gap-3">
                                                        <FileText className="h-5 w-5" />
                                                        Bills
                                                    </Button>
                                                </Link>
                                                <Link href="/customer/account" className="w-full">
                                                    <Button variant="ghost" className="w-full justify-start gap-3">
                                                        <User className="h-5 w-5" />
                                                        Account
                                                    </Button>
                                                </Link>
                                                <Link href="/customer/readings" className="w-full">
                                                    <Button variant="ghost" className="w-full justify-start gap-3">
                                                        <Droplets className="h-5 w-5" />
                                                        Reading History
                                                    </Button>
                                                </Link>
                                            </nav>
                                            <div className="mt-auto border-t pt-4">
                                                <div className="mb-4">
                                                    <p className="font-medium">{customerName}</p>
                                                    <p className="text-xs text-gray-500">Key: {customerKey}</p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={handleLogout}
                                                >
                                                    <LogOut className="h-4 w-4" />
                                                    Logout
                                                </Button>
                                            </div>
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </div>

                            <Image
                                src="https://veiethiopia.com/photo/partner/par2.png"
                                alt="AAWSA Logo"
                                width={60}
                                height={40}
                                className="object-contain hidden md:block" // Hide on small screens if desired, or keep small
                            />
                            <div>
                                <h1 className="text-lg md:text-xl font-bold text-white leading-tight">AAWSA <span className="hidden sm:inline">Customer Portal</span></h1>
                                <p className="text-sm text-blue-100 hidden sm:block">Welcome, {customerName}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-medium text-white">{customerName}</p>
                                <p className="text-xs text-blue-100">Key: {customerKey}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleLogout}
                                className="gap-2 hidden md:flex text-white hover:bg-white/20 border-white/20"
                            >
                                <LogOut className="h-4 w-4" />
                                <span>Logout</span>
                            </Button>
                            {/* Mobile logout icon only if needed, but menu usually handles it */}
                        </div>
                    </div>
                </div>
            </header>

            {/* Desktop Navigation - Hidden on Mobile */}
            <nav className="bg-blue-50 border-b hidden md:block">
                <div className="container mx-auto px-4">
                    <div className="flex gap-1">
                        <Link href="/customer/dashboard">
                            <Button variant="ghost" className="gap-2 rounded-none border-b-2 border-transparent hover:border-blue-600 hover:bg-blue-100/50">
                                <LayoutDashboard className="h-4 w-4 text-blue-700" />
                                <span className="text-blue-900 font-medium">Dashboard</span>
                            </Button>
                        </Link>
                        <Link href="/customer/bills">
                            <Button variant="ghost" className="gap-2 rounded-none border-b-2 border-transparent hover:border-blue-600 hover:bg-blue-100/50">
                                <FileText className="h-4 w-4 text-blue-700" />
                                <span className="text-blue-900 font-medium">Bills</span>
                            </Button>
                        </Link>
                        <Link href="/customer/account">
                            <Button variant="ghost" className="gap-2 rounded-none border-b-2 border-transparent hover:border-blue-600 hover:bg-blue-100/50">
                                <User className="h-4 w-4 text-blue-700" />
                                <span className="text-blue-900 font-medium">Account</span>
                            </Button>
                        </Link>
                        <Link href="/customer/readings">
                            <Button variant="ghost" className="gap-2 rounded-none border-b-2 border-transparent hover:border-blue-600 hover:bg-blue-100/50">
                                <Droplets className="h-4 w-4 text-blue-700" />
                                <span className="text-blue-900 font-medium">Reading History</span>
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8 flex-1">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t py-6">
                <div className="container mx-auto px-4 text-center text-sm text-gray-600">
                    <p>© 2026 Addis Ababa Water and Sewerage Authority. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
