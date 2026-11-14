import { InvoiceGeneratorView } from "@/components/billing/InvoiceGeneratorView";

export default function AdminInvoicesPage() {
  return (
    <InvoiceGeneratorView
      isAdmin={true}
      printRoute="/admin/bulk-meters/print-invoices"
    />
  );
}
