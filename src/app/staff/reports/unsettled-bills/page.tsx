
"use client";

// This component simply re-exports the main Unsettled Bills Report Page component.
// This allows staff with the correct permission to view the report page
// under the /staff/reports/unsettled-bills route, ensuring it uses the StaffLayout.
import UnsettledBillsReportPage from '@/app/admin/reports/unsettled-bills/page';

export default UnsettledBillsReportPage;
