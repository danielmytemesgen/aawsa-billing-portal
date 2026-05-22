'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { BillManagementContent } from "@/components/billing/BillManagementContent";
import { BillDetailsContent } from "@/components/billing/BillDetailsContent";

export default function AdminBillManagementCatchAll() {
    const params = useParams();
    const idArray = params?.id;
    
    // If idArray exists and has at least one element, show details
    if (Array.isArray(idArray) && idArray.length > 0) {
        return <BillDetailsContent basePath="/admin/bill-management" />;
    }

    // Otherwise show the list
    return <BillManagementContent basePath="/admin/bill-management" />;
}
