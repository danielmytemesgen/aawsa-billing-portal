
"use client"

// This component simply re-exports the main TariffManagementPage component.
// This allows staff with the correct permission to view the tariff page
// under the /staff/tariffs route, ensuring it uses the StaffLayout.
import TariffManagementPage from '@/app/admin/tariffs/page';

export default TariffManagementPage;
