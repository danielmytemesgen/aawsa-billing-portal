import type { LucideIcon } from "lucide-react";
import {
  FileText,
  LayoutGrid,
  Globe,
  Map,
  Phone,
  Headphones,
  Mail,
  SquarePen,
  TrendingUp,
} from "lucide-react";

export interface SubmenuItem {
  id?: string;
  label: string;
  href: string;
  badge?: string | number;
}

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: SubmenuItem[];
  badge?: string | number;
}

/**
 * Standard navigation menu configuration for the collapsible sidebar.
 * Plain links (e.g. Phone Management) have `href` without `children`.
 * Expandable groups have `children` without top-level `href`.
 */
export const MENU_ITEMS: MenuItem[] = [
  {
    id: "invoice",
    label: "Invoice",
    icon: FileText,
    children: [
      { label: "All Invoices", href: "/invoices" },
      { label: "Create Invoice", href: "/invoices/create" },
      { label: "Batch Generation", href: "/invoices/batch" },
      { label: "Invoice Archives", href: "/invoices/archive" },
    ],
  },
  {
    id: "workflows",
    label: "Workflows",
    icon: LayoutGrid,
    children: [
      { label: "Active Workflows", href: "/workflows/active" },
      { label: "Task Queue", href: "/workflows/tasks" },
      { label: "Approvals", href: "/workflows/approvals" },
      { label: "Workflow History", href: "/workflows/history" },
    ],
  },
  {
    id: "water-shifts",
    label: "Water Shifts",
    icon: Globe,
    children: [
      { label: "Shift Schedule", href: "/water-shifts/schedule" },
      { label: "Distribution Zones", href: "/water-shifts/zones" },
      { label: "Valve Monitoring", href: "/water-shifts/valves" },
      { label: "Pressure Telemetry", href: "/water-shifts/pressure" },
    ],
  },
  {
    id: "maps",
    label: "Maps",
    icon: Map,
    children: [
      { label: "Network Overview", href: "/maps/network" },
      { label: "DMA Boundaries", href: "/maps/dma" },
      { label: "Infrastructure Map", href: "/maps/infrastructure" },
      { label: "Reader GPS Tracker", href: "/maps/tracking" },
    ],
  },
  {
    id: "phone-management",
    label: "Phone Management",
    icon: Phone,
    href: "/phone-management",
  },
  {
    id: "call-center",
    label: "Call Center",
    icon: Headphones,
    children: [
      { label: "Inbound Queue", href: "/call-center/inbound" },
      { label: "Agent Monitor", href: "/call-center/agents" },
      { label: "Customer Tickets", href: "/call-center/tickets" },
      { label: "Call History", href: "/call-center/history" },
    ],
  },
  {
    id: "sms",
    label: "SMS",
    icon: Mail,
    children: [
      { label: "Campaign Outbox", href: "/sms/outbox" },
      { label: "Broadcast Notification", href: "/sms/broadcast" },
      { label: "Message Templates", href: "/sms/templates" },
      { label: "Delivery Reports", href: "/sms/reports" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: SquarePen,
    children: [
      { label: "Billing Summary", href: "/reports/billing-summary" },
      { label: "GL Audit Trail", href: "/reports/gl-audit" },
      { label: "Paid Bills Report", href: "/reports/paid-bills" },
      { label: "Sent Bills Report", href: "/reports/sent-bills" },
      { label: "Export Hub", href: "/reports/export-hub" },
    ],
  },
  {
    id: "bill-analytics",
    label: "Bill Analytics",
    icon: TrendingUp,
    children: [
      { label: "Revenue Trends", href: "/analytics/revenue" },
      { label: "Collection Efficiency", href: "/analytics/collection" },
      { label: "Overdue Aging", href: "/analytics/overdue" },
      { label: "Disconnection Risk", href: "/analytics/disconnection-risk" },
    ],
  },
  {
    id: "nrw",
    label: "NRW",
    icon: Globe,
    children: [
      { label: "NRW Intelligence Dashboard", href: "/nrw/dashboard" },
      { label: "NRW GIS Map", href: "/nrw/gis-map" },
      { label: "Zero Reading GIS Map", href: "/nrw/zero-reading-map" },
      { label: "Basis2 Disconnection Report", href: "/nrw/basis2-disconnection" },
      { label: "Source-DMA Mapping", href: "/nrw/source-dma" },
      { label: "Production GIS Map", href: "/nrw/production-map" },
      { label: "Bill Data", href: "/nrw/bill-data" },
    ],
  },
];

