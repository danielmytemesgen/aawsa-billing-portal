'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import { getBulkMeterByIdAction, calculateBillAction, createBillAction, closeBillingCycleAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { getBillingPeriodStartDate, getBillingPeriodEndDate } from '@/lib/billing-config';

const billSchema = z.object({
    CUSTOMERKEY: z.string().min(1, "Bulk Customer Key is required"),
    month_year: z.string().min(1, "Month is required"), // YYYY-MM
    PREVREAD: z.number().min(0),
    CURRREAD: z.number().min(0, "Current reading must be non-negative"),
});

type BillFormValues = z.infer<typeof billSchema>;

export default function CreateBillPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [customer, setCustomer] = useState<any>(null);
    const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [calculationResult, setCalculationResult] = useState<any>(null);

    const form = useForm<BillFormValues>({
        resolver: zodResolver(billSchema),
        defaultValues: {
            CUSTOMERKEY: '',
            month_year: new Date().toISOString().slice(0, 7), // YYYY-MM
            PREVREAD: 0,
            CURRREAD: 0,
        }
    });

    const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = form;
    const CUSTOMERKEY = watch('CUSTOMERKEY');

    const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'not-found' | 'error'>('idle');

    const handleFetchCustomer = useCallback(async (id: string) => {
        if (!id) return;
        setIsLoadingCustomer(true);
        setSearchStatus('searching');
        setCustomer(null);
        setCalculationResult(null);

        console.log("Fetching bulk meter:", id);

        try {
            const res = await getBulkMeterByIdAction(id);
            if (res.data) {
                console.log("Bulk meter found:", res.data);
                setCustomer(res.data);
                setSearchStatus('found');
                setValue('PREVREAD', Number(res.data.currentReading));
                setValue('CURRREAD', Number(res.data.currentReading));
            } else {
                console.log("Bulk meter not found for ID:", id);
                setSearchStatus('not-found');
            }
        } catch (error) {
            console.error("Error fetching bulk meter:", error);
            setSearchStatus('error');
            toast({ title: "Error", description: "Failed to fetch bulk meter", variant: "destructive" });
        } finally {
            setIsLoadingCustomer(false);
        }
    }, [setValue, toast]);

    // Auto-fetch when CUSTOMERKEY changes (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (CUSTOMERKEY && CUSTOMERKEY.length >= 3) {
                handleFetchCustomer(CUSTOMERKEY);
            } else {
                setSearchStatus('idle');
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [CUSTOMERKEY, handleFetchCustomer]);

    // Auto-calculate when readings change
    const currentReading = watch('CURRREAD');
    const monthYear = watch('month_year');

    useEffect(() => {
        const timer = setTimeout(() => {
            if (customer && currentReading >= getValues().PREVREAD) {
                handleCalculate();
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [currentReading, monthYear, customer]); // eslint-disable-next-line react-hooks/exhaustive-deps

    const handleCalculate = async () => {
        if (!customer) return; // Silent return for auto-calc

        const values = getValues();
        if (values.CURRREAD < values.PREVREAD) {
            setCalculationResult(null);
            return;
        }

        setIsCalculating(true);
        try {
            const rawUsage = values.CURRREAD - values.PREVREAD;
            // Apply Rule: Minimum 3m3 for billing
            let effectiveUsage = rawUsage;
            if (rawUsage < 3) {
                effectiveUsage = 3;
            }

            const res = await calculateBillAction(
                effectiveUsage,
                customer.charge_group || "Non-domestic",
                customer.sewerage_connection || "No",
                customer.meterSize,
                values.month_year
            );

            if (res.data) {
                setCalculationResult({
                    ...res.data,
                    bulkUsage: rawUsage,
                    effectiveUsage: effectiveUsage
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsCalculating(false);
        }
    };

    const onSubmit = async (data: BillFormValues, actionType: 'paid' | 'carry') => {
        if (!calculationResult) {
            await handleCalculate();
            if (!calculationResult) return;
        }

        setIsSubmitting(true);
        try {
            // Construct BillInsert object
            const billData = {
                CUSTOMERKEY: data.CUSTOMERKEY,
                individual_customer_id: null,
                month_year: data.month_year,
                PREVREAD: data.PREVREAD,
                CURRREAD: data.CURRREAD,
                CONS: calculationResult.bulkUsage,
                difference_usage: calculationResult.effectiveUsage,
                TOTALBILLAMOUNT: calculationResult.totalBill,
                base_water_charge: calculationResult.baseWaterCharge,
                sewerage_charge: calculationResult.sewerageCharge,
                meter_rent: calculationResult.meterRent,
                maintenance_fee: calculationResult.maintenanceFee,
                sanitation_fee: calculationResult.sanitationFee,
                bill_number: `BILL-${Date.now()}`,
                bill_period_start_date: getBillingPeriodStartDate(data.month_year),
                bill_period_end_date: getBillingPeriodEndDate(data.month_year),
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                payment_status: actionType === 'paid' ? 'Paid' : 'Unpaid',
                status: 'Draft'
            };

            const meterUpdateData = {
                customerKeyNumber: data.CUSTOMERKEY,
                previousReading: data.CURRREAD,
                currentReading: data.CURRREAD,
                outStandingbill: actionType === 'carry' ? (Number(calculationResult.totalBill || 0) + Number(customer?.outStandingbill || 0)) : 0,
                paymentStatus: actionType === 'paid' ? 'Paid' : 'Unpaid',
            };

            const res = await closeBillingCycleAction({
                bill: billData as any,
                meterUpdate: meterUpdateData
            });

            if (res.data) {
                toast({ title: "Bill Created & Cycle Updated", description: actionType === 'paid' ? "Bill marked as paid." : "Balance carried forward." });
                router.push(`/staff/bill-management/${res.data.bill.id}`);
            } else {
                toast({ title: "Creation Failed", description: res.error?.message || "Unknown error", variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to create bill", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">Create New Bill (Bulk Meter)</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Bill Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Bulk Meter Lookup */}
                        <div className="space-y-2">
                            <Label>Bulk Meter ID</Label>
                            <div className="flex gap-2">
                                <Input
                                    {...register('CUSTOMERKEY')}
                                    placeholder="Enter Bulk Meter Key"
                                />
                                <Button size="icon" variant="secondary" onClick={() => handleFetchCustomer(CUSTOMERKEY)} disabled={isLoadingCustomer}>
                                    {isLoadingCustomer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                            {/* Status Feedback */}
                            {searchStatus === 'searching' && <p className="text-xs text-blue-500">Searching...</p>}
                            {searchStatus === 'not-found' && <p className="text-xs text-red-500">Bulk meter not found</p>}
                            {searchStatus === 'found' && <p className="text-xs text-green-600">Bulk meter loaded</p>}

                            {errors.CUSTOMERKEY && <p className="text-xs text-red-500">{errors.CUSTOMERKEY.message}</p>}
                        </div>

                        {customer && (
                            <div className="p-3 bg-blue-50 text-blue-800 rounded text-sm space-y-1">
                                <p className="font-semibold">{customer.name}</p>
                                <p>Address: {customer.specificArea}, {customer.woreda}</p>
                                <p>Meter: {customer.meterNumber} ({customer.meterSize}mm)</p>
                                <p>Type: {customer.charge_group}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Billing Month</Label>
                            <Input type="month" {...register('month_year')} />
                            {errors.month_year && <p className="text-xs text-red-500">{errors.month_year.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Prev Reading</Label>
                                <Input type="number" {...register('PREVREAD', { valueAsNumber: true })} readOnly className="bg-gray-100" />
                            </div>
                            <div className="space-y-2">
                                <Label>Curr Reading</Label>
                                <Input type="number" {...register('CURRREAD', { valueAsNumber: true })} />
                                {errors.CURRREAD && <p className="text-xs text-red-500">{errors.CURRREAD.message}</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Difference Billing Calculation</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {calculationResult ? (
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between py-1 border-b border-dashed pt-0">
                                    <span className="font-medium text-gray-600">Bulk Usage:</span>
                                    <span className="font-bold text-gray-600">{calculationResult.bulkUsage?.toFixed(2)} m³</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-dashed">
                                    <span className="font-medium text-green-600">Difference Usage:</span>
                                    <span className="font-bold text-green-600">{calculationResult.effectiveUsage?.toFixed(2)} m³</span>
                                </div>
                                {calculationResult.waterTierBreakdown && calculationResult.waterTierBreakdown.length > 0 && (
                                    <div className="py-2 border-b border-gray-100">
                                        <p className="text-xs font-semibold text-gray-500 mb-1">Consumption Details</p>
                                        {calculationResult.waterTierBreakdown.map((tier: any, index: number) => (
                                            <div key={index} className="flex justify-between text-xs text-gray-600 pl-2">
                                                <span>Level {index} ({tier.start.toFixed(0)}-{tier.end === Infinity ? '∞' : tier.end.toFixed(0)}):</span>
                                                <span>{tier.usage.toFixed(2)} m³ * {tier.rate} = {tier.charge.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex justify-between py-1 border-t border-dashed mt-1">
                                    <span>Base Water Charge:</span>
                                    <span>ETB {calculationResult.baseWaterCharge?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span>Maintenance Fee:</span>
                                    <span>ETB {calculationResult.maintenanceFee?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span>Sanitation Fee:</span>
                                    <span>ETB {calculationResult.sanitationFee?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span>Sewerage Fee:</span>
                                    <span>ETB {calculationResult.sewerageCharge?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span>Meter Rent:</span>
                                    <span>ETB {calculationResult.meterRent?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b">
                                    <span>VAT (15%):</span>
                                    <span>ETB {calculationResult.vatAmount?.toFixed(2)}</span>
                                </div>

                                <div className="flex justify-between text-base font-bold pt-2">
                                    <span>Total Difference Bill:</span>
                                    <span>ETB {calculationResult.totalBill?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-1 text-gray-500">
                                    <span>Outstanding Bill:</span>
                                    <span>ETB {Number(customer?.outStandingbill || 0).toFixed(2)}</span>
                                </div>

                                <div className="flex justify-between text-lg font-bold pt-2 text-blue-600 border-t mt-2">
                                    <span>Total Amount Payable:</span>
                                    <span>ETB {(Number(calculationResult.totalBill || 0) + Number(customer?.outStandingbill || 0)).toFixed(2)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                                Enter details and calculate to view summary.
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex-col gap-3">
                        <div className="w-full">
                            <p className="text-sm font-semibold mb-2">End of Month Actions</p>
                            <Button
                                onClick={handleSubmit((data) => onSubmit(data, 'paid'))}
                                disabled={!calculationResult || isSubmitting}
                                className="w-full bg-blue-600 hover:bg-blue-700 mb-2"
                            >
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Mark Paid & Start New Cycle
                            </Button>
                            <Button
                                onClick={handleSubmit((data) => onSubmit(data, 'carry'))}
                                disabled={!calculationResult || isSubmitting}
                                variant="destructive"
                                className="w-full"
                            >
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Carry Balance & Start New Cycle
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
