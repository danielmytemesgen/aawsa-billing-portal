'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import BulkMetersPage from '../page-content'; // I will move the original page.tsx content here
import BulkMeterDetailsClient from './BulkMeterDetailsClient';

export default function AdminBulkMetersCatchAll() {
    const params = useParams();
    const idArray = params?.id;
    
    if (Array.isArray(idArray) && idArray.length > 0) {
        return <BulkMeterDetailsClient />;
    }

    return <BulkMetersPage />;
}
