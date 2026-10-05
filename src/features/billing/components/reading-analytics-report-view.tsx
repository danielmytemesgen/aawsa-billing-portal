"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Download,
    FileSpreadsheet,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    AlertTriangle,
    RefreshCw,
    Eye,
    Camera,
    CheckCircle2,
    X,
    ExternalLink,
    Layers,
    MapPin,
    Calendar,
    Users
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
    initializeStaffMembers,
    subscribeToFaultCodes
} from "@/lib/data-store";
import { getPhotosByReadingIdAction } from "@/lib/actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getAllFaultCodes, getFaultCodeLabel } from "@/lib/fault-codes";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { ReadingDetailsDialog, type ReadingData } from "@/features/billing/components/reading-details-dialog";
import { classifyReadingCategory, type ReadingCategory } from '@/lib/reading-classification';

export interface ReadingRecord {
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
    readerPhone?: string;
    branchName: string;
    branchId?: string;
    route: string;
    meterType: 'Individual' | 'Bulk';
    hasPhoto?: boolean;
}

const ClassificationBadge = ({ category, faultCode }: { category: ReadingCategory, faultCode?: string }) => {
    switch (category) {
        case 'Increase':
            return (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                    <span>Increase</span>
                </div>
            );
        case 'Decrease':
            return (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200">
                    <ArrowDownRight className="h-3 w-3 shrink-0" />
                    <span>Decrease</span>
                </div>
            );
        case 'Zero':
            return (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold border border-slate-200">
                    <Minus className="h-3 w-3 shrink-0" />
                    <span>Zero</span>
                </div>
            );
        case 'Fault':
            return (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>Fault ({faultCode || 'ERR'})</span>
                </div>
            );
        default:
            return null;
    }
};

interface ReadingAnalyticsReportViewProps {
    isAdmin?: boolean;
    staffBranchId?: string | null;
    isEmbedded?: boolean;
    onOpenFullscreen?: () => void;
    fullscreenUrl?: string;
}

export function ReadingAnalyticsReportView({
    isAdmin = true,
    staffBranchId = null,
    isEmbedded = false,
    onOpenFullscreen,
    fullscreenUrl = "/admin/reports/reading-classification"
}: ReadingAnalyticsReportViewProps) {
    const { hasPermission } = usePermissions();
    const { toast } = useToast();

    // Filters
    const [searchTerm, setSearchTerm] = React.useState("");
    const [selectedCategory, setSelectedCategory] = React.useState<ReadingCategory | 'all'>('all');
    const [selectedFaultCode, setSelectedFaultCode] = React.useState<string>('all');
    const [selectedMonth, setSelectedMonth] = React.useState<string>('all');
    const [selectedBranch, setSelectedBranch] = React.useState<string>('all');
    const [selectedRoute, setSelectedRoute] = React.useState<string>('all');
    const [selectedCustomerType, setSelectedCustomerType] = React.useState<'all' | 'Individual' | 'Bulk'>('all');
    const [photoFilter, setPhotoFilter] = React.useState<'all' | 'with-photo' | 'no-photo'>('all');

    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);

    const [isLoading, setIsLoading] = React.useState(true);
    const [readings, setReadings] = React.useState<ReadingRecord[]>([]);
    const [filteredReadings, setFilteredReadings] = React.useState<ReadingRecord[]>([]);
    const [selectedReading, setSelectedReading] = React.useState<ReadingData | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);
    const [isDownloadingPhoto, setIsDownloadingPhoto] = React.useState<string | null>(null);
    const [faultCodesList, setFaultCodesList] = React.useState(getAllFaultCodes());

    React.useEffect(() => {
        setIsMounted(true);
        const unsubscribe = subscribeToFaultCodes(() => {
            setFaultCodesList(getAllFaultCodes());
        });
        return () => unsubscribe();
    }, []);

    const handleViewDetails = (r: ReadingRecord) => {
        const mappedData: ReadingData = {
            id: r.id,
            meterIdentifier: r.customerName,
            meterId: r.customerKey,
            meterType: r.meterType,
            previousReading: r.previousReading,
            currentReading: r.currentReading,
            usage: r.usage,
            readingDate: r.date,
            monthYear: r.month,
            faultCode: r.faultCode,
            readerName: r.readerName,
            readerPhone: r.readerPhone,
            branchName: r.branchName,
            hasPhoto: r.hasPhoto
        };
        setSelectedReading(mappedData);
        setIsDetailsOpen(true);
    };

    const processReading = (
        r: any,
        type: 'Individual' | 'Bulk',
        customers: any[],
        staff: any[],
        branches: any[],
        bulkMeters: any[]
    ): ReadingRecord => {
        const customerKey = type === 'Individual' 
            ? (r.individualCustomerId || r.CUST_KEY || r.customerKeyNumber) 
            : (r.CUSTOMERKEY || r.CUST_KEY || r.customerKeyNumber || r.bulkMeterId);
        
        const customer = type === 'Individual' 
            ? customers.find(c => c.customerKeyNumber === customerKey || c.id === customerKey)
            : bulkMeters.find(bm => bm.customerKeyNumber === customerKey || bm.id === customerKey);
            
        const reader = staff.find(s => s.id === r.readerStaffId || s.email === r.readerStaffId);
        const branch = branches.find(b => b.id === (customer?.branchId || (r as any).branchId));

        const prev = Number(r.previousReading ?? (r as any).PREV_READING) || 0;
        const curr = Number(r.readingValue ?? (r as any).READING_VALUE ?? (r as any).METER_READING) || 0;
        const usage = curr - prev;
        const fault = r.faultCode || (r as any).FAULT_CODE || (r as any).fault_code;
        const category = classifyReadingCategory(prev, curr, fault);

        return {
            id: String(r.id || `${customerKey}-${r.readingDate}`),
            date: r.readingDate || (r as any).READING_DATE || (r as any).createdAt,
            month: r.monthYear || (r as any).MONTH_YEAR || (r.readingDate ? String(r.readingDate).substring(0, 7) : ''),
            customerKey: customerKey || 'N/A',
            customerName: type === 'Individual' 
                ? (customer?.name || (r as any).custName || (r as any).customerName || 'Individual Customer') 
                : (customer?.name || (r as any).customerName || 'Bulk Meter'),
            previousReading: prev,
            currentReading: curr,
            usage: usage,
            category: category,
            faultCode: fault,
            readerName: reader?.name || (r as any).readerName || r.readerStaffId || 'System',
            readerPhone: reader?.phone || (r as any).readerPhone,
            branchName: branch?.name || (r as any).branchName || 'N/A',
            branchId: customer?.branchId || (r as any).branchId,
            route: type === 'Individual' 
                ? (r.roundKey || (customer as any)?.bookNumber || (customer as any)?.routeKey || 'N/A') 
                : (r.roundKey || (customer as any)?.routeKey || 'N/A'),
            meterType: type,
            hasPhoto: Boolean(r.hasPhoto || (r as any).meter_photo || (r as any).photo_url)
        };
    };

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

            const indProcessed = indReadings.map(r => processReading(r, 'Individual', customers, staff, branches, []));
            const bulkProcessed = bulkReadings.map(r => processReading(r, 'Bulk', [], staff, branches, bms));

            let processed = [...indProcessed, ...bulkProcessed];

            // Branch isolation for staff without global permissions
            if (!isAdmin && staffBranchId) {
                const hasGlobalView = hasPermission('reports_generate_all') || hasPermission('meter_readings_view_all');
                if (!hasGlobalView) {
                    processed = processed.filter(r => r.branchId === staffBranchId);
                }
            }

            // Sort by date descending
            processed.sort((a, b) => {
                const timeA = a.date ? new Date(a.date).getTime() : 0;
                const timeB = b.date ? new Date(b.date).getTime() : 0;
                return timeB - timeA;
            });

            setReadings(processed);
            setFilteredReadings(processed);
        } catch (error) {
            console.error("Failed to fetch reading data for report:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load reading records."
            });
        } finally {
            setIsLoading(false);
        }
    }, [isAdmin, staffBranchId, hasPermission, toast]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Auto-refresh when system signals new data
    React.useEffect(() => {
        const handleDataRefreshed = () => { fetchData(); };
        window.addEventListener('data-refreshed', handleDataRefreshed);
        return () => window.removeEventListener('data-refreshed', handleDataRefreshed);
    }, [fetchData]);

    // Apply filtering
    React.useEffect(() => {
        let result = readings;

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(r =>
                r.customerKey.toLowerCase().includes(lowerSearch) ||
                r.customerName.toLowerCase().includes(lowerSearch) ||
                r.readerName.toLowerCase().includes(lowerSearch) ||
                r.route.toLowerCase().includes(lowerSearch)
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

        if (selectedCustomerType !== 'all') {
            result = result.filter(r => r.meterType === selectedCustomerType);
        }

        if (selectedFaultCode !== 'all') {
            result = result.filter(r => r.faultCode === selectedFaultCode);
        }

        if (photoFilter === 'with-photo') {
            result = result.filter(r => r.hasPhoto);
        } else if (photoFilter === 'no-photo') {
            result = result.filter(r => !r.hasPhoto);
        }

        setFilteredReadings(result);
    }, [readings, searchTerm, selectedCategory, selectedMonth, selectedBranch, selectedRoute, selectedCustomerType, selectedFaultCode, photoFilter]);

    React.useEffect(() => {
        setPage(0);
    }, [searchTerm, selectedCategory, selectedFaultCode, selectedMonth, selectedBranch, selectedRoute, selectedCustomerType, photoFilter]);

    const paginatedReadings = React.useMemo(
        () => filteredReadings.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
        [filteredReadings, page, rowsPerPage]
    );

    // KPI Summary Calculations
    const kpiSummary = React.useMemo(() => {
        const total = readings.length;
        const increaseCount = readings.filter(r => r.category === 'Increase').length;
        const decreaseCount = readings.filter(r => r.category === 'Decrease').length;
        const zeroCount = readings.filter(r => r.category === 'Zero').length;
        const faultCount = readings.filter(r => r.category === 'Fault').length;
        const photoCount = readings.filter(r => r.hasPhoto).length;

        const individualCount = readings.filter(r => r.meterType === 'Individual').length;
        const bulkCount = readings.filter(r => r.meterType === 'Bulk').length;

        return {
            total,
            increaseCount,
            increasePct: total > 0 ? ((increaseCount / total) * 100).toFixed(1) : '0',
            decreaseCount,
            decreasePct: total > 0 ? ((decreaseCount / total) * 100).toFixed(1) : '0',
            zeroCount,
            zeroPct: total > 0 ? ((zeroCount / total) * 100).toFixed(1) : '0',
            faultCount,
            faultPct: total > 0 ? ((faultCount / total) * 100).toFixed(1) : '0',
            photoCount,
            photoPct: total > 0 ? ((photoCount / total) * 100).toFixed(1) : '0',
            individualCount,
            bulkCount
        };
    }, [readings]);

    const activeFilterCount = [
        searchTerm !== "",
        selectedCategory !== 'all',
        selectedFaultCode !== 'all',
        selectedMonth !== 'all',
        selectedBranch !== 'all',
        selectedRoute !== 'all',
        selectedCustomerType !== 'all',
        photoFilter !== 'all'
    ].filter(Boolean).length;

    const resetFilters = () => {
        setSearchTerm("");
        setSelectedCategory('all');
        setSelectedFaultCode('all');
        setSelectedMonth('all');
        setSelectedBranch('all');
        setSelectedRoute('all');
        setSelectedCustomerType('all');
        setPhotoFilter('all');
    };

    const handleExport = () => {
        if (filteredReadings.length === 0) {
            toast({
                title: "No Data",
                description: "There is no data matching the current filters to export."
            });
            return;
        }

        const exportData = filteredReadings.map(r => ({
            'Date': r.date ? format(new Date(r.date), 'dd/MM/yyyy') : '',
            'Month': r.month,
            'Customer Key': r.customerKey,
            'Customer Name': r.customerName,
            'Meter Type': r.meterType,
            'Previous Reading': r.previousReading,
            'Current Reading': r.currentReading,
            'Usage (m³)': r.usage,
            'Category': r.category,
            'Fault Code': r.faultCode ? `${r.faultCode} - ${getFaultCodeLabel(r.faultCode)}` : '',
            'Reader': r.readerName,
            'Reader Phone': r.readerPhone || 'N/A',
            'Branch': r.branchName,
            'Route': r.route,
            'Photo Proof': r.hasPhoto ? 'Yes' : 'No'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Readings Analytics");
        XLSX.writeFile(wb, `Reading_Analytics_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

        toast({
            title: "Export Successful",
            description: `Exported ${filteredReadings.length} reading record(s) to Excel.`
        });
    };

    const handleDownloadPhoto = async (r: ReadingRecord) => {
        setIsDownloadingPhoto(r.id);
        try {
            const { data, error } = await getPhotosByReadingIdAction(r.id);
            
            if (error || !data || data.length === 0) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "No photo found for this reading."
                });
                return;
            }

            const photo = data[0];
            const base64Data = photo.photo_data;
            
            let contentType = "image/webp";
            let actualData = base64Data;
            if (base64Data.startsWith("data:")) {
                const parts = base64Data.split(",");
                contentType = parts[0].split(":")[1].split(";")[0];
                actualData = parts[1];
            }

            const byteCharacters = atob(actualData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: contentType });
            
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            const fileName = `${r.customerName.replace(/[^a-z0-9]/gi, '_')}_${r.customerKey}_${format(new Date(r.date || new Date()), 'yyyyMMdd')}.webp`;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast({
                title: "Photo Downloaded",
                description: `Photo for ${r.customerName} has been saved.`
            });
        } catch (err) {
            console.error("Download error:", err);
            toast({
                variant: "destructive",
                title: "Download Failed",
                description: "An error occurred while downloading the photo."
            });
        } finally {
            setIsDownloadingPhoto(null);
        }
    };

    const months = Array.from(new Set(readings.map(r => r.month))).filter(Boolean).sort().reverse();
    const branches = Array.from(new Set(readings.map(r => r.branchName))).filter(b => b && b !== 'N/A').sort();
    const routes = Array.from(new Set(readings.map(r => r.route))).filter(r => r && r !== 'N/A').sort();

    return (
        <>
            {isMounted && (
                <React.Suspense fallback={null}>
                    <ReadingDetailsDialog 
                        open={isDetailsOpen} 
                        onOpenChange={setIsDetailsOpen} 
                        reading={selectedReading} 
                    />
                </React.Suspense>
            )}

            <div className="space-y-6">
                {/* Header Row (Only shown if standalone or if fullscreen action exists) */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 flex items-center gap-2.5">
                                <FileSpreadsheet className="h-7 w-7 text-purple-600" />
                                Reading Analytics Report
                            </h2>
                            {isEmbedded && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-bold">
                                    Live Tab View
                                </Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                            Audit reading classifications, verify consumption variances, and inspect field proof across cycles.
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <Button 
                            variant="outline" 
                            onClick={fetchData} 
                            disabled={isLoading} 
                            className="h-10 rounded-xl bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs"
                        >
                            <RefreshCw className={cn("h-4 w-4 mr-1.5", isLoading && "animate-spin text-purple-600")} />
                            Refresh
                        </Button>
                        <Button 
                            onClick={handleExport} 
                            disabled={isLoading || filteredReadings.length === 0}
                            className="h-10 rounded-xl bg-purple-700 hover:bg-purple-800 text-white shadow-md shadow-purple-200 transition-all px-4"
                        >
                            <Download className="h-4 w-4 mr-1.5" />
                            Export to Excel ({filteredReadings.length})
                        </Button>
                        {isEmbedded && fullscreenUrl && (
                            <a href={fullscreenUrl} target="_blank" rel="noreferrer">
                                <Button variant="outline" className="h-10 rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs">
                                    <ExternalLink className="h-4 w-4 mr-1.5" />
                                    Fullscreen Page
                                </Button>
                            </a>
                        )}
                    </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Total Classified */}
                    <div 
                        onClick={() => { setSelectedCategory('all'); setPhotoFilter('all'); }}
                        className={cn(
                            "cursor-pointer rounded-2xl p-4 border transition-all duration-200 hover:shadow-md",
                            selectedCategory === 'all' && photoFilter === 'all'
                                ? "bg-purple-50/70 border-purple-300 ring-2 ring-purple-400/30"
                                : "bg-white border-slate-200/80 hover:bg-slate-50/60"
                        )}
                    >
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span>Total Readings</span>
                            <Layers className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="text-2xl font-black text-slate-900 mt-2">
                            {kpiSummary.total.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
                            Ind: {kpiSummary.individualCount} | Bulk: {kpiSummary.bulkCount}
                        </div>
                    </div>

                    {/* Increased Consumption */}
                    <div 
                        onClick={() => setSelectedCategory(selectedCategory === 'Increase' ? 'all' : 'Increase')}
                        className={cn(
                            "cursor-pointer rounded-2xl p-4 border transition-all duration-200 hover:shadow-md",
                            selectedCategory === 'Increase'
                                ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/30"
                                : "bg-white border-slate-200/80 hover:bg-slate-50/60"
                        )}
                    >
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-700 uppercase tracking-wider">
                            <span>Increased</span>
                            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="text-2xl font-black text-emerald-800 mt-2">
                            {kpiSummary.increaseCount.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-bold text-emerald-600 mt-1">
                            {kpiSummary.increasePct}% of total
                        </div>
                    </div>

                    {/* Decreased Consumption */}
                    <div 
                        onClick={() => setSelectedCategory(selectedCategory === 'Decrease' ? 'all' : 'Decrease')}
                        className={cn(
                            "cursor-pointer rounded-2xl p-4 border transition-all duration-200 hover:shadow-md",
                            selectedCategory === 'Decrease'
                                ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/30"
                                : "bg-white border-slate-200/80 hover:bg-slate-50/60"
                        )}
                    >
                        <div className="flex items-center justify-between text-xs font-bold text-amber-700 uppercase tracking-wider">
                            <span>Decreased</span>
                            <ArrowDownRight className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="text-2xl font-black text-amber-800 mt-2">
                            {kpiSummary.decreaseCount.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-bold text-amber-600 mt-1">
                            {kpiSummary.decreasePct}% of total
                        </div>
                    </div>

                    {/* Zero Consumption */}
                    <div 
                        onClick={() => setSelectedCategory(selectedCategory === 'Zero' ? 'all' : 'Zero')}
                        className={cn(
                            "cursor-pointer rounded-2xl p-4 border transition-all duration-200 hover:shadow-md",
                            selectedCategory === 'Zero'
                                ? "bg-slate-100 border-slate-300 ring-2 ring-slate-400/30"
                                : "bg-white border-slate-200/80 hover:bg-slate-50/60"
                        )}
                    >
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <span>Zero Usage</span>
                            <Minus className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className="text-2xl font-black text-slate-800 mt-2">
                            {kpiSummary.zeroCount.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-bold text-slate-500 mt-1">
                            {kpiSummary.zeroPct}% stuck/idle
                        </div>
                    </div>

                    {/* Faults / OVF */}
                    <div 
                        onClick={() => setSelectedCategory(selectedCategory === 'Fault' ? 'all' : 'Fault')}
                        className={cn(
                            "cursor-pointer rounded-2xl p-4 border transition-all duration-200 hover:shadow-md",
                            selectedCategory === 'Fault'
                                ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400/30"
                                : "bg-white border-slate-200/80 hover:bg-slate-50/60"
                        )}
                    >
                        <div className="flex items-center justify-between text-xs font-bold text-rose-700 uppercase tracking-wider">
                            <span>Fault / OVF</span>
                            <AlertTriangle className="h-4 w-4 text-rose-600" />
                        </div>
                        <div className="text-2xl font-black text-rose-800 mt-2">
                            {kpiSummary.faultCount.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-bold text-rose-600 mt-1">
                            {kpiSummary.faultPct}% anomaly rate
                        </div>
                    </div>

                    {/* Photo Proof */}
                    <div 
                        onClick={() => setPhotoFilter(photoFilter === 'with-photo' ? 'all' : 'with-photo')}
                        className={cn(
                            "cursor-pointer rounded-2xl p-4 border transition-all duration-200 hover:shadow-md",
                            photoFilter === 'with-photo'
                                ? "bg-blue-50 border-blue-300 ring-2 ring-blue-400/30"
                                : "bg-white border-slate-200/80 hover:bg-slate-50/60"
                        )}
                    >
                        <div className="flex items-center justify-between text-xs font-bold text-blue-700 uppercase tracking-wider">
                            <span>Photo Verified</span>
                            <Camera className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="text-2xl font-black text-blue-800 mt-2">
                            {kpiSummary.photoCount.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-bold text-blue-600 mt-1">
                            {kpiSummary.photoPct}% photo coverage
                        </div>
                    </div>
                </div>

                {/* Filter & Search Bar */}
                <Card className="shadow-md border-slate-200/70 overflow-hidden rounded-2xl">
                    <CardHeader className="bg-slate-50/60 border-b border-slate-200/80 py-4 px-5">
                        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
                            {/* Search */}
                            <div className="flex-1 w-full max-w-lg relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search key, customer name, route, or reader..."
                                    className="pl-10 h-10 bg-white rounded-xl border-slate-200 shadow-xs focus:ring-purple-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button 
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Filters */}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                                {/* Category */}
                                <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
                                    <SelectTrigger className="w-[140px] h-10 bg-white rounded-xl border-slate-200 text-xs font-semibold shadow-xs">
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="all">All Categories</SelectItem>
                                        <SelectItem value="Increase">Increase</SelectItem>
                                        <SelectItem value="Decrease">Decrease</SelectItem>
                                        <SelectItem value="Zero">Zero</SelectItem>
                                        <SelectItem value="Fault">Fault/OVF</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Fault Code */}
                                <Select value={selectedFaultCode} onValueChange={setSelectedFaultCode}>
                                    <SelectTrigger className="w-[140px] h-10 bg-white rounded-xl border-slate-200 text-xs font-semibold shadow-xs">
                                        <SelectValue placeholder="Fault Code" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl max-h-60">
                                        <SelectItem value="all">All Faults</SelectItem>
                                        {faultCodesList.map(fc => (
                                            <SelectItem key={fc.code} value={fc.code}>
                                                <span className="font-bold mr-1.5 text-rose-600">{fc.code}</span> - {fc.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Month */}
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger className="w-[130px] h-10 bg-white rounded-xl border-slate-200 text-xs font-semibold shadow-xs">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl max-h-60">
                                        <SelectItem value="all">All Months</SelectItem>
                                        {months.map(m => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Branch */}
                                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                    <SelectTrigger className="w-[145px] h-10 bg-white rounded-xl border-slate-200 text-xs font-semibold shadow-xs">
                                        <SelectValue placeholder="Branch" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl max-h-60">
                                        <SelectItem value="all">All Branches</SelectItem>
                                        {branches.map(b => (
                                            <SelectItem key={b} value={b}>{b}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Route */}
                                {routes.length > 0 && (
                                    <Select value={selectedRoute} onValueChange={setSelectedRoute}>
                                        <SelectTrigger className="w-[130px] h-10 bg-white rounded-xl border-slate-200 text-xs font-semibold shadow-xs">
                                            <SelectValue placeholder="Route" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl max-h-60">
                                            <SelectItem value="all">All Routes</SelectItem>
                                            {routes.map(r => (
                                                <SelectItem key={r} value={r}>{r}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {/* Customer Type */}
                                <Select value={selectedCustomerType} onValueChange={(v) => setSelectedCustomerType(v as any)}>
                                    <SelectTrigger className="w-[140px] h-10 bg-white rounded-xl border-slate-200 text-xs font-semibold shadow-xs">
                                        <SelectValue placeholder="Customer Type" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="Individual">Individual</SelectItem>
                                        <SelectItem value="Bulk">Bulk</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Reset button */}
                                {activeFilterCount > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetFilters}
                                        className="h-10 px-3 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
                                    >
                                        <X className="h-3.5 w-3.5 mr-1" />
                                        Clear ({activeFilterCount})
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    {/* Table View */}
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/80">
                                    <TableRow className="border-b border-slate-200">
                                        <TableHead className="font-black text-slate-700 text-xs py-3.5">CUSTOMER</TableHead>
                                        <TableHead className="font-black text-slate-700 text-xs">DATE / MONTH</TableHead>
                                        <TableHead className="text-right font-black text-slate-700 text-xs">PREV READING</TableHead>
                                        <TableHead className="text-right font-black text-slate-700 text-xs">CURR READING</TableHead>
                                        <TableHead className="text-right font-black text-slate-700 text-xs">USAGE (m³)</TableHead>
                                        <TableHead className="font-black text-slate-700 text-xs px-4">CLASSIFICATION</TableHead>
                                        <TableHead className="font-black text-slate-700 text-xs text-center">ROUTE</TableHead>
                                        <TableHead className="font-black text-slate-700 text-xs">READER / BRANCH</TableHead>
                                        <TableHead className="font-black text-slate-700 text-xs">READER PHONE</TableHead>
                                        <TableHead className="font-black text-slate-700 text-xs text-center">PHOTO</TableHead>
                                        <TableHead className="font-black text-slate-700 text-xs text-right pr-6">ACTIONS</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: 6 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={11} className="h-14">
                                                    <div className="h-4 w-full bg-slate-100 animate-pulse rounded-lg" />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredReadings.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={11} className="h-44 text-center">
                                                <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                                                    <Search className="h-8 w-8 text-slate-300" />
                                                    <p className="font-semibold text-base text-slate-600">No reading records match your filters.</p>
                                                    <p className="text-xs text-slate-400">Try broadening your search term or clearing active filters.</p>
                                                    {activeFilterCount > 0 && (
                                                        <Button variant="outline" size="sm" onClick={resetFilters} className="mt-2 text-xs">
                                                            Clear All Filters
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedReadings.map((r) => (
                                            <TableRow 
                                                key={`${r.meterType}-${r.id}`} 
                                                className="group hover:bg-slate-50/80 transition-colors border-b border-slate-100"
                                            >
                                                <TableCell className="py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors text-sm">
                                                            {r.customerName}
                                                        </span>
                                                        <span className="text-xs font-mono text-slate-500 font-medium">
                                                            {r.customerKey}
                                                        </span>
                                                        <Badge 
                                                            variant="outline" 
                                                            className={cn(
                                                                "text-[10px] w-fit mt-1 h-4 px-1.5 font-bold",
                                                                r.meterType === 'Bulk' 
                                                                    ? "bg-amber-50 text-amber-700 border-amber-200" 
                                                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                                            )}
                                                        >
                                                            {r.meterType}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-slate-800">
                                                            {r.date ? format(new Date(r.date), 'dd MMM yyyy') : 'N/A'}
                                                        </span>
                                                        <span className="text-xs text-slate-400 font-medium">{r.month}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-slate-600 text-sm">
                                                    {r.previousReading.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-black text-slate-900 text-sm">
                                                    {r.currentReading.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className={cn(
                                                        "font-black text-sm",
                                                        r.usage > 0 ? "text-emerald-600" : r.usage < 0 ? "text-rose-600" : "text-slate-400"
                                                    )}>
                                                        {r.usage > 0 ? '+' : ''}{r.usage.toLocaleString()}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4">
                                                    <ClassificationBadge category={r.category} faultCode={r.faultCode} />
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-xs text-slate-600 font-mono">
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                                                        {r.route}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-800">{r.readerName}</span>
                                                        <span className="text-xs text-slate-500 font-medium">{r.branchName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {r.readerPhone && r.readerPhone !== 'N/A' ? (
                                                        <a 
                                                            href={`tel:${r.readerPhone}`} 
                                                            className="text-xs font-semibold text-blue-600 hover:underline"
                                                        >
                                                            {r.readerPhone}
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 font-medium">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {r.hasPhoto ? (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                                                                onClick={() => handleViewDetails(r)}
                                                                title="View photo proof"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                                                                onClick={() => handleDownloadPhoto(r)}
                                                                disabled={isDownloadingPhoto === r.id}
                                                                title="Download proof photo"
                                                            >
                                                                {isDownloadingPhoto === r.id ? (
                                                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <Download className="h-3.5 w-3.5" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">None</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 hover:bg-purple-50 hover:text-purple-700 rounded-full transition-all text-slate-500"
                                                        onClick={() => handleViewDetails(r)}
                                                        title="View full details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {filteredReadings.length > 0 && (
                            <div className="p-3 border-t border-slate-200/80 bg-slate-50/50">
                                <TablePagination
                                    count={filteredReadings.length}
                                    page={page}
                                    rowsPerPage={rowsPerPage}
                                    onPageChange={setPage}
                                    onRowsPerPageChange={(value) => {
                                        setRowsPerPage(value);
                                        setPage(0);
                                    }}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
