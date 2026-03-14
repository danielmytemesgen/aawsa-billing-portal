
import React from 'react';
import { CheckCircle, Circle, ArrowRight, XCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming utils exists

type BillStatus = 'Draft' | 'Pending' | 'Approved' | 'Posted' | 'Rework' | 'Rejected';

interface BillWorkflowMapProps {
    currentStatus: string;
    history?: { from_status: string; to_status: string; created_at: string }[];
}

const steps: { status: BillStatus; label: string; icon: any }[] = [
    { status: 'Draft', label: 'Draft', icon: Circle },
    { status: 'Pending', label: 'Pending Approval', icon: Clock },
    { status: 'Approved', label: 'Approved', icon: CheckCircle },
    { status: 'Posted', label: 'Posted', icon: CheckCircle },
];

export function BillWorkflowMap({ currentStatus, history }: BillWorkflowMapProps) {
    // Determine current step index
    let currentStepIndex = steps.findIndex((s) => s.status === currentStatus);

    // Handle special states like Rework/Rejected which might map to earlier steps or be distinct
    if (currentStatus === 'Rework') {
        currentStepIndex = 0; // Back to Draft effectively, but maybe show alert
    }

    return (
        <div className="w-full py-6">
            <div className="flex items-center justify-between w-full relative">
                {/* Progress Line */}
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10" />

                {steps.map((step, index) => {
                    const isCompleted = index < currentStepIndex || (index === currentStepIndex && currentStatus === 'Posted');
                    const isCurrent = step.status === currentStatus;
                    const isRework = currentStatus === 'Rework' && index === 1; // Show error on Pending step? Or just reset.

                    return (
                        <div key={step.status} className="flex flex-col items-center bg-white px-2">
                            <div
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                                    isCompleted ? "bg-green-500 border-green-500 text-white" :
                                        isCurrent ? "bg-blue-500 border-blue-500 text-white" :
                                            "bg-white border-gray-300 text-gray-400"
                                )}
                            >
                                <step.icon size={20} />
                            </div>
                            <span className={cn(
                                "mt-2 text-sm font-medium",
                                isCurrent ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-500"
                            )}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {currentStatus === 'Rework' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
                    <AlertCircle size={18} />
                    <span className="text-sm">This bill was returned for rework. Please check remarks and resubmit.</span>
                </div>
            )}
        </div>
    );
}
