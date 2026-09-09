import { BatchInvoicePrintView } from "@/components/billing/BatchInvoicePrintView";

export default function StaffPrintInvoicesPage() {
  return <BatchInvoicePrintView fallbackRoute="/staff/bulk-meters" />;
}
