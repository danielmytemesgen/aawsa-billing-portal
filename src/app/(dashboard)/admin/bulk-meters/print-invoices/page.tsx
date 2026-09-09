import { BatchInvoicePrintView } from "@/components/billing/BatchInvoicePrintView";

export default function AdminPrintInvoicesPage() {
  return <BatchInvoicePrintView fallbackRoute="/admin/bulk-meters" />;
}
