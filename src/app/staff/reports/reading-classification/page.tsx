"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Download,
    FileSpreadsheet,
    Search,
    Filter,
    ChevronDown,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    AlertTriangle,
    RefreshCw
} from "lucide-react";
import {
    getIndividualCustomerReadings,
    getBulkMeterReadings,
    initializeIndividualCustomerReadings,
    initializeBulkMeterReadings,
    getBranches,
    getCustomers,
    getBulkMeters,
    initializeBranches,
    initializeCustomers,
    initializeBulkMeters,
    getStaffMembers,
    initializeStaffMembers
} from "@/lib/data-store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getAllFaultCodes } from "@/lib/fault-codes";

type ReadingCategory = 'Increase' | 'Decrease' | 'Zero' | 'Fault';

interface ReadingRecord {
    id: string;
    date: string;
    month: string;
    customerKey: string;
    customerName: string;
    previousReading: number;
    currentReading: number;
    usage: number;
    category: ReadingCategory;
    faultCode?: string;
    readerName: string;
    branchName: string;
    route: string;
    meterType: 'Individual' | 'Bulk';
}

export default function ReadingClassificationPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(true);
    const [readings, setReadings] = React.useState<ReadingRecord[]>([]);
    const [filteredReadings, setFilteredReadings] = React.useState<ReadingRecord[]>([]);

    // Filters
    const [searchTerm, setSearchTerm] = React.useState("");
    const [selectedCategory, setSelectedCategory] = React.useState<ReadingCategory | 'all'>('all');
    const [selectedFaultCode, setSelectedFaultCode] = React.useState<string>('all');
    const [selectedMonth, setSelectedMonth] = React.useState<string>('all');
    const [selectedBranch, setSelectedBranch] = React.useState<string>('all');
    const [selectedRoute, setSelectedRoute] = React.useState<string>('all');

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                initializeIndividualCustomerReadings(true),
                initializeBulkMeterReadings(true),
                initializeBranches(true),
                initializeCustomers(true),
                initializeBulkMeters(true),
                initializeStaffMembers(true)
            ]);

            const indReadings = getIndividualCustomerReadings();
            const bulkReadings = getBulkMeterReadings();
            const customers = getCustomers();
            const bms = getBulkMeters();
            const staff = getStaffMembers();
            const branches = getBranches();

            const processed: ReadingRecord[] = [];

            // Process Individual Readings
            indReadings.forEach(r => {
                const customer = customers.find(c => c.customerKeyNumber === r.individualCustomerId);
                const reader = staff.find(s => s.id === r.readerStaffId || s.email === r.readerStaffId);
                const branch = branches.find(b => b.id === customer?.branchId);

                const prev = Number(r.previousReading) || 0;
                const curr = Number(r.readingValue) || 0;
                const usage = curr - prev;

                let category: ReadingCategory = 'Increase';
                if (r.faultCode || (r as any).FAULT_CODE) {
                    category = 'Fault';
                } else if (usage === 0) {
                    category = 'Zero';
                } else if (usage < 0) {
                    category = 'Decrease';
                }

                processed.push({
                    id: r.id,
                    date: r.readingDate,
                    month: r.monthYear,
                    customerKey: r.individualCustomerId,
                    customerName: customer?.name || r.custName || 'Unknown',
                    previousReading: prev,
                    currentReading: curr,
                    usage: usage,
                    category: category,
                    faultCode: r.faultCode || (r as any).FAULT_CODE,
                    readerName: reader?.name || r.readerStaffId || 'System',
                    branchName: branch?.name || 'N/A',
                    route: r.roundKey || (customer as any)?.bookNumber || 'N/A',
                    meterType: 'Individual'
                });
            });

            // Process Bulk Readings
            bulkReadings.forEach(r => {
                const meter = bms.find(bm => bm.customerKeyNumber === r.CUSTOMERKEY);
                const reader = staff.find(s => s.id === r.readerStaffId || s.email === r.readerStaffId);
                const branch = branches.find(b => b.id === meter?.branchId);

                const prev = Number(r.previousReading) || 0;
                const curr = Number(r.readingValue) || 0;
                const usage = curr - prev;

                let category: ReadingCategory = 'Increase';
                if (r.faultCode || (r as any).FAULT_CODE) {
                    category = 'Fault';
                } else if (usage === 0) {
                    category = 'Zero';
                } else if (usage < 0) {
                    category = 'Decrease';
                }

                processed.push({
                    id: r.id,
                    date: r.readingDate,
                    month: r.monthYear,
                    customerKey: r.CUSTOMERKEY,
                    customerName: meter?.name || 'Unknown Bulk Meter',
                    previousReading: prev,
                    currentReading: curr,
                    usage: usage,
                    category: category,
                    faultCode: r.faultCode || (r as any).FAULT_CODE,
                    readerName: reader?.name || r.readerStaffId || 'System',
                    branchName: branch?.name || 'N/A',
                    route: r.roundKey || (meter as any)?.routeKey || 'N/A',
                    meterType: 'Bulk'
                });
            });

            // Sort by date descending
            processed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setReadings(processed);
            setFilteredReadings(processed);
        } catch (error) {
            console.error("Failed to fetch reading data:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load reading records."
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    React.useEffect(() => {
        let result = readings;

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(r =>
                r.customerKey.toLowerCase().includes(lowerSearch) ||
                r.customerName.toLowerCase().includes(lowerSearch) ||
                r.readerName.toLowerCase().includes(lowerSearch)
            );
        }

        if (selectedCategory !== 'all') {
            result = result.filter(r => r.category === selectedCategory);
        }

        if (selectedMonth !== 'all') {
            result = result.filter(r => r.month === selectedMonth);
        }

        if (selectedBranch !== 'all') {
            result = result.filter(r => r.branchName === selectedBranch);
        }

        if (selectedRoute !== 'all') {
            result = result.filter(r => r.route === selectedRoute);
        }

        if (selectedFaultCode !== 'all') {
            result = result.filter(r => r.faultCode === selectedFaultCode);
        }

        setFilteredReadings(result);
    }, [searchTerm, selectedCategory, selectedMonth, selectedBranch, selectedRoute, selectedFaultCode, readings]);

    const handleExport = () => {
        if (filteredReadings.length === 0) {
            toast({
                title: "No Data",
                description: "There is no data to export."
            });
            return;
        }

        const exportData = filteredReadings.map(r => ({
            'Date': r.date ? format(new Date(r.date), 'dd/MM/yyyy') : '',
            'Month': r.month,
            'Customer Key': r.customerKey,
            'Customer Name': r.customerName,
            'Previous Reading': r.previousReading,
            'Current Reading': r.currentReading,
            'Usage': r.usage,
            'Category': r.category,
            'Fault Code': r.faultCode || '',
            'Reader': r.readerName,
            'Branch': r.branchName,
            'Route': r.route,
            'Meter Type': r.meterType
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Readings");
        XLSX.writeFile(wb, `Reading_Analytics_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

        toast({
            title: "Export Success",
            description: "Reading analytics report has been downloaded."
        });
    };

    const months = Array.from(new Set(readings.map(r => r.month))).sort().reverse();
    const branches = Array.from(new Set(readings.map(r => r.branchName))).sort();
    const routes = Array.from(new Set(readings.map(r => r.route))).sort();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reading Analytics Report</h1>
                    <p className="text-muted-foreground mt-1">Analyze and export reading classifications across branches.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                        <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all">
                        <Download className="h-4 w-4 mr-2" />
                        Export to Excel
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
                <CardHeader className="pb-3 border-b">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1 max-w-sm relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search key, name or reader..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Filters:</span>
                            </div>

                            <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
                                <SelectTrigger className="w-[140px] h-9">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="Increase">Increase</SelectItem>
                                    <SelectItem value="Decrease">Decrease</SelectItem>
                                    <SelectItem value="Zero">Zero</SelectItem>
                                    <SelectItem value="Fault">Fault/OVF</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={selectedFaultCode} onValueChange={setSelectedFaultCode}>
                                <SelectTrigger className="w-[140px] h-9">
                                    <SelectValue placeholder="Fault Code" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Faults</SelectItem>
                                    {getAllFaultCodes().map(fc => (
                                        <SelectItem key={fc.code} value={fc.code}>
                                            <span className="font-bold mr-2">{fc.code}</span> - {fc.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="w-[140px] h-9">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Months</SelectItem>
                                    {months.map(m => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                <SelectTrigger className="w-[160px] h-9">
                                    <SelectValue placeholder="Branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Branches</SelectItem>
                                    {branches.map(b => (
                                        <SelectItem key={b} value={b}>{b}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedRoute} onValueChange={setSelectedRoute}>
                                <SelectTrigger className="w-[140px] h-9">
                                    <SelectValue placeholder="Route" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Routes</SelectItem>
                                    {routes.map(rt => (
                                        <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="font-bold">Customer</TableHead>
                                    <TableHead className="font-bold">Date / Month</TableHead>
                                    <TableHead className="text-right font-bold">Prev Reading</TableHead>
                                    <TableHead className="text-right font-bold">Curr Reading</TableHead>
                                    <TableHead className="text-right font-bold">Usage</TableHead>
                                    <TableHead className="font-bold px-6">Classification</TableHead>
                                    <TableHead className="font-bold text-center">Route</TableHead>
                                    <TableHead className="font-bold">Reader / Branch</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={7} className="h-12">
                                                <div className="h-4 w-full bg-gray-100 animate-pulse rounded" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredReadings.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-40 text-center text-muted-foreground font-medium">
                                            No reading records found matching your filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredReadings.map((r) => (
                                        <TableRow key={`${r.meterType}-${r.id}`} className="group hover:bg-gray-50/80 transition-colors">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{r.customerName}</span>
                                                    <span className="text-xs font-medium text-muted-foreground">{r.customerKey}</span>
                                                    <Badge variant="outline" className="text-[10px] w-fit mt-1 h-3.5 px-1 font-bold">
                                                        {r.meterType}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{r.date ? format(new Date(r.date), 'dd MMM yyyy') : 'N/A'}</span>
                                                    <span className="text-xs text-muted-foreground">{r.month}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-gray-600">{r.previousReading.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-medium text-gray-900">{r.currentReading.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
                                                <div className={cn(
                                                    "font-bold text-sm",
                                                    r.usage > 0 ? "text-emerald-600" : r.usage < 0 ? "text-red-600" : "text-gray-400"
                                                )}>
                                                    {r.usage > 0 ? '+' : ''}{r.usage.toLocaleString()}
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-6">
                                                <div className="flex items-center gap-2">
                                                    {r.category === 'Increase' && (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100">
                                                            <ArrowUpRight className="h-3 w-3" />
                                                            Increase
                                                        </div>
                                                    )}
                                                    {r.category === 'Decrease' && (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-100">
                                                            <ArrowDownRight className="h-3 w-3" />
                                                            Decrease
                                                        </div>
                                                    )}
                                                    {r.category === 'Zero' && (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-500 text-[11px] font-bold border border-gray-200">
                                                            <Minus className="h-3 w-3" />
                                                            Zero
                                                        </div>
                                                    )}
                                                    {r.category === 'Fault' && (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-bold border border-red-100">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            Fault ({r.faultCode || 'OVF'})
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-bold text-gray-500">
                                                {r.route}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-700">{r.readerName}</span>
                                                    <span className="text-xs text-muted-foreground">{r.branchName}</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
