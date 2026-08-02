'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import StaffBulkMetersPage from '../page-content';
import BulkMeterDetailsClient from '@/app/(dashboard)/admin/bulk-meters/[[...id]]/BulkMeterDetailsClient';

export default function StaffBulkMetersCatchAll() {
    const params = useParams();
    const idArray = params?.id;
    
    if (Array.isArray(idArray) && idArray.length > 0) {
        return <BulkMeterDetailsClient />;
    }

    return <StaffBulkMetersPage />;
}
