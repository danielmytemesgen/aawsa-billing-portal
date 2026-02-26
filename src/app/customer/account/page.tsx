"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, MapPin, Droplets, CheckCircle } from "lucide-react";
import { getCustomerAccountAction } from "@/lib/actions";
import { useCustomerActivityLogger } from "@/lib/customer-activity-logger";

interface CustomerAccount {
    name: string;
    customerKeyNumber: string;
    contractNumber: string;
    meterNumber: string;
    meterSize: number;
    currentReading: number;
    previousReading: number;
    month: string;
    specificArea: string;
    subCity: string;
    woreda: string;
    customerType?: string;
    charge_group?: string;
    sewerageConnection?: string;
    sewerage_connection?: string;
    status: string;
    email?: string;
    phone_number?: string;
}

export default function CustomerAccountPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [account, setAccount] = useState<CustomerAccount | null>(null);

    // Log page view
    useEffect(() => {
        useCustomerActivityLogger('Account');
    }, []);

    useEffect(() => {
        loadAccountData();
    }, []);

    const loadAccountData = async () => {
        try {
            const customerData = localStorage.getItem("customer");
            if (!customerData) return;

            const customer = JSON.parse(customerData);
            const customerType = customer.customerType || "individual";

            if (customerType === "bulk") {
                const { getBulkMeterAccountAction } = await import("@/lib/actions");
                const { data: accountData } = await getBulkMeterAccountAction(customer.customerKeyNumber);
                if (accountData) {
                    setAccount(accountData as any);
                }
            } else {
                const { data: accountData } = await getCustomerAccountAction(customer.customerKeyNumber);
                if (accountData) {
                    setAccount(accountData as any);
                }
            }
        } catch (error) {
            console.error("Failed to load account data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (!account) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Failed to load account information</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Account Details</h1>
                <p className="text-gray-600 mt-1">Your account and meter information</p>
            </div>

            {/* Personal Information */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-blue-600" />
                        <CardTitle>Personal Information</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label className="text-gray-600">Full Name</Label>
                            <p className="font-semibold text-lg mt-1">{account.name}</p>
                        </div>
                        <div>
                            <Label className="text-gray-600">Customer Key Number</Label>
                            <p className="font-semibold text-lg mt-1">{account.customerKeyNumber}</p>
                        </div>
                        <div>
                            <Label className="text-gray-600">Contract Number</Label>
                            <p className="font-semibold text-lg mt-1">{account.contractNumber || "N/A"}</p>
                        </div>
                        <div>
                            <Label className="text-gray-600">Charge Group</Label>
                            <p className="font-semibold text-lg mt-1">{account.customerType || account.charge_group || "N/A"}</p>
                        </div>
                        {account.email && (
                            <div>
                                <Label className="text-gray-600">Email</Label>
                                <p className="font-semibold mt-1">{account.email}</p>
                            </div>
                        )}
                        {account.phone_number && (
                            <div>
                                <Label className="text-gray-600">Phone Number</Label>
                                <p className="font-semibold mt-1">{account.phone_number}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Meter Information */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Droplets className="h-5 w-5 text-blue-600" />
                        <CardTitle>Meter Information</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <Label className="text-gray-600">Meter Number</Label>
                            <p className="font-semibold text-lg mt-1">{account.meterNumber || "N/A"}</p>
                        </div>
                        <div>
                            <Label className="text-gray-600">Meter Size</Label>
                            <p className="font-semibold text-lg mt-1">{account.meterSize} inch</p>
                        </div>
                        <div>
                            <Label className="text-gray-600">Sewerage Connection</Label>
                            <p className="font-semibold text-lg mt-1">{account.sewerageConnection || account.sewerage_connection || "N/A"}</p>
                        </div>
                        <div>
                            <Label className="text-gray-600">Current Reading</Label>
                            <p className="font-semibold text-lg mt-1">{Number(account.currentReading || 0).toFixed(2)} m³</p>
                        </div>
                        <div>
                            <Label className="text-gray-600">Previous Reading</Label>
                            <p className="font-semibold text-lg mt-1">{Number(account.previousReading || 0).toFixed(2)} m³</p>
                        </div>
                        <div>
                            <Label className="text-gray-600">Last Reading Month</Label>
                            <p className="font-semibold text-lg mt-1">{account.month || "N/A"}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Location Information */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        <CardTitle>Location</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <Label className="text-gray-600">Sub-City</Label>
                            <p className="font-semibold text-lg mt-1">{account.subCity || "N/A"}</p>
                        </div>
                        <div>
                            <Label className="text-gray-600">Woreda</Label>
                            <p className="font-semibold text-lg mt-1">{account.woreda || "N/A"}</p>
                        </div>
                        <div>
                            <Label className="text-gray-600">Specific Area</Label>
                            <p className="font-semibold text-lg mt-1">{account.specificArea || "N/A"}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Account Status */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <CardTitle>Account Status</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <Badge variant={account.status === "Active" ? "default" : "secondary"} className="text-lg px-4 py-2">
                            {account.status}
                        </Badge>
                        <p className="text-gray-600">
                            {account.status === "Active"
                                ? "Your account is active and in good standing"
                                : "Please contact AAWSA for account status details"}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
