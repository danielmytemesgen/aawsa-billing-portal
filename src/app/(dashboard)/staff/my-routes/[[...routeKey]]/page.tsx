'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import MyRoutesPage from '../page-content';
import RouteDetailsClient from './RouteDetailsClient';

export default function StaffMyRoutesCatchAll() {
    const params = useParams();
    const routeKeyArray = params?.routeKey;
    
    if (Array.isArray(routeKeyArray) && routeKeyArray.length > 0) {
        return <RouteDetailsClient />;
    }

    return <MyRoutesPage />;
}
