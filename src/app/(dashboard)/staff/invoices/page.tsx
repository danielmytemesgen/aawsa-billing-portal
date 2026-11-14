import { InvoiceGeneratorView } from "@/components/billing/InvoiceGeneratorView";

export default function StaffInvoicesPage() {
  return (
    <InvoiceGeneratorView
      isAdmin={false}
      printRoute="/staff/bulk-meters/print-invoices"
    />
  );
}
