"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Droplets, Calendar, BarChart3, Info } from "lucide-react";
import { getCustomerReadingsAction, getBulkMeterReadingsAction } from "@/lib/actions";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCustomerActivityLogger } from "@/lib/customer-activity-logger";

interface Reading {
    id: string | number;
    // Individual customer fields
    reading_date?: string;
    reading_value?: number;
    month_year?: string;
    is_estimate?: boolean;
    // Bulk meter fields
    READING_DATE?: string;
    METER_READING?: number;
    ESTIMATED_READING_IND?: string;
    // Common fields
    notes?: string;
}

export default function ReadingHistoryPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [readings, setReadings] = useState<Reading[]>([]);
    const [customerType, setCustomerType] = useState<string>("individual");

    // Log page view
    useEffect(() => {
        useCustomerActivityLogger('Readings');
    }, []);

    useEffect(() => {
        loadReadings();
    }, []);

    const loadReadings = async () => {
        try {
            const customerData = localStorage.getItem("customer");
            if (!customerData) return;

            const customer = JSON.parse(customerData);
            const customerKeyNumber = customer.customerKeyNumber;
            const type = customer.customerType || "individual";
            setCustomerType(type);

            if (type === "bulk") {
                const { data } = await getBulkMeterReadingsAction(customerKeyNumber);
                if (data) setReadings(data as any);
            } else {
                const { data } = await getCustomerReadingsAction(customerKeyNumber);
                if (data) setReadings(data as any);
            }
        } catch (error) {
            console.error("Failed to load readings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Reading History</h1>
                <p className="text-gray-600 mt-1">Track your meter readings over time</p>
            </div>

            {/* Consumption Trend Chart */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        <CardTitle>Meter Reading Trend</CardTitle>
                    </div>
                    <CardDescription>Visual representation of your meter readings (m³)</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    {readings.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            No reading history available to chart
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[...readings].map(r => ({
                                    ...r,
                                    displayValue: r.METER_READING || 0,
                                    displayMonth: r.month_year || (
                                        r.READING_DATE
                                            ? format(new Date(r.READING_DATE), "MMM yyyy")
                                            : "N/A"
                                    )
                                })).reverse()}
                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="displayMonth" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: number) => [`${value} m³`, 'Reading']}
                                    labelStyle={{ color: '#333' }}
                                />
                                <Bar dataKey="displayValue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* Readings Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Droplets className="h-5 w-5 text-blue-600" />
                        <CardTitle>Detailed Readings</CardTitle>
                    </div>
                    <CardDescription>Full history of your meter readings</CardDescription>
                </CardHeader>
                <CardContent>
                    {readings.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Info className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                            <p className="text-lg font-medium">No readings found</p>
                            <p>We haven't recorded any meter readings for your account yet.</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader className="bg-gray-50">
                                    <TableRow>
                                        <TableHead>Month/Year</TableHead>
                                        <TableHead>Reading Date</TableHead>
                                        <TableHead>Reading Value (m³)</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {readings.map((reading) => {
                                        // Generate month/year from date if not available
                                        const monthYear = reading.month_year || (
                                            (reading.READING_DATE || reading.reading_date)
                                                ? format(new Date(reading.READING_DATE || reading.reading_date!), "MMM yyyy")
                                                : "N/A"
                                        );

                                        return (
                                            <TableRow key={reading.id} className="hover:bg-gray-50">
                                                <TableCell className="font-medium">{monthYear}</TableCell>
                                                <TableCell>{format(new Date(reading.READING_DATE!), "MMM dd, yyyy")}</TableCell>
                                                <TableCell>{Number(reading.METER_READING ?? 0).toFixed(2)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={(reading.ESTIMATED_READING_IND === 'Y' || reading.is_estimate) ? "outline" : "default"}>
                                                        {(reading.ESTIMATED_READING_IND === 'Y' || reading.is_estimate) ? "Estimated" : "Actual"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-gray-600 max-w-[200px] truncate">
                                                    {reading.notes || "-"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
