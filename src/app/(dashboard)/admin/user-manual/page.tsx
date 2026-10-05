"use client";

import * as React from "react";
import {
  BookOpen, ChevronRight, Search, Users, Zap, BarChart3, Settings, Trash2,
  Shield, FileText, CreditCard, Gauge, Activity, Database, BookMarked,
  ClipboardList, MapPin, Map, Building, UserCog, UserCheck, ShieldCheck, Bell,
  LibraryBig, AlertOctagon, LifeBuoy, BarChart2, CheckCircle2, Send, FileClock,
  RefreshCcw, Megaphone, BookText, FileDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ContentBlock = {
  heading: string;
  body?: string;
  steps?: string[];
  table?: { headers: string[]; rows: string[][] };
};

type Section = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge: string;
  group: string;
  color: string;
  content: ContentBlock[];
};

// ─── Sidebar Groups ───────────────────────────────────────────────────────────

const GROUPS = [
  "Dashboard",
  "Field Operations",
  "Management",
  "Customer & Metering",
  "Data & Reports",
  "System",
];

// ─── All Sections ─────────────────────────────────────────────────────────────

const sections: Section[] = [
  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  {
    id: "dashboard",
    icon: BarChart2,
    title: "Dashboard",
    badge: "Admin / Staff",
    group: "Dashboard",
    color: "bg-indigo-500",
    content: [
      {
        heading: "Admin Dashboard — System-Wide View",
        steps: [
          "Log in as Admin and click Dashboard in the left sidebar.",
          "Review summary cards: Total Bills, Paid / Unpaid / Overdue, Total Revenue, Collection Efficiency.",
          "Use the Branch Filter (top right) to narrow data to a specific branch.",
          "Click any summary card to drill into the filtered bill list.",
        ],
      },
      {
        heading: "Head Office Dashboard",
        steps: [
          "Click Dashboard in the sidebar (head-office role).",
          "View a comparative table of all branches side by side.",
          "Compare collection efficiency and outstanding balances per branch.",
          "Use for monthly performance reviews across all branches.",
        ],
      },
      {
        heading: "Staff Dashboard — Branch View",
        steps: [
          "Log in as Staff and click Dashboard in the sidebar.",
          "View bills pending your action: Draft, Pending Approval.",
          "Review your branch collection summary and overdue meters.",
        ],
      },
    ],
  },

  // ── FIELD OPERATIONS ───────────────────────────────────────────────────────
  {
    id: "my-routes",
    icon: MapPin,
    title: "My Routes",
    badge: "Meter Reader",
    group: "Field Operations",
    color: "bg-teal-500",
    content: [
      {
        heading: "View Your Assigned Routes",
        steps: [
          "Click My Routes in the sidebar (visible to meter readers only).",
          "Your assigned routes are listed with total meters and completion status.",
          "Click a route to see all meters on that route.",
          "Click a meter row to enter a reading directly.",
        ],
      },
      {
        heading: "Enter a Reading from My Routes",
        steps: [
          "Open a route and click the meter you want to read.",
          "Enter the Current Reading value.",
          "The system computes consumption = Current minus Previous automatically.",
          "Click Submit Reading.",
        ],
      },
    ],
  },
  {
    id: "meter-readings",
    icon: ClipboardList,
    title: "Meter Readings",
    badge: "Admin / Staff / Reader",
    group: "Field Operations",
    color: "bg-teal-600",
    content: [
      {
        heading: "View Meter Readings",
        steps: [
          "Click Meter Readings in the sidebar.",
          "Toggle between Bulk Meter Readings and Individual Customer Readings tabs.",
          "Filter by Branch, Date Range, or Customer Key.",
        ],
      },
      {
        heading: "Enter a Single Manual Reading",
        steps: [
          "Click Meter Readings > Add Reading (or the + Add Reading button).",
          "Select Customer Type: Bulk or Individual.",
          "Search and select the Customer Key / Name.",
          "Enter the Reading Date and Current Reading value.",
          "The system computes consumption automatically.",
          "Click Submit Reading.",
        ],
      },
      {
        heading: "Upload Readings via CSV",
        steps: [
          "Go to Meter Readings > Upload CSV.",
          "Click Download Template to get the correct CSV format.",
          "Fill the template: columns CUSTOMER_KEY, READING_DATE, METER_READING.",
          "Click Choose File and select your filled CSV.",
          "Click Upload & Preview to see validation results.",
          "Fix any errors highlighted in red, then re-upload.",
          "Click Confirm Upload to save all valid readings.",
        ],
      },
      {
        heading: "Edit / Recalculate a Reading",
        body: "Requires meter_readings_edit_recalculate permission.",
        steps: [
          "Find the reading in the list.",
          "Click the Edit (pencil) icon on the row.",
          "Update the reading value.",
          "Click Save & Recalculate — consumption is updated automatically.",
        ],
      },
    ],
  },
  {
    id: "reader-monitoring",
    icon: Activity,
    title: "Reader Monitoring",
    badge: "Admin / Staff",
    group: "Field Operations",
    color: "bg-cyan-600",
    content: [
      {
        heading: "Monitor Reader Progress",
        steps: [
          "Click Reader Monitoring in the sidebar.",
          "View a table of assigned routes per reader showing total meters, meters read, % completion, and last reading date.",
          "Filter by Branch or Date Range.",
          "Use this to identify readers who are behind schedule.",
        ],
      },
    ],
  },
  {
    id: "meter-change",
    icon: RefreshCcw,
    title: "Meter Change",
    badge: "Admin / Staff",
    group: "Field Operations",
    color: "bg-amber-600",
    content: [
      {
        heading: "Log a Meter Change (Field Replacement)",
        steps: [
          "Click Meter Change in the sidebar.",
          "Click New Meter Change.",
          "Select the Bulk Meter being changed.",
          "Fill in: Old Meter Key, New Meter Key, Old Meter Final Reading, New Meter Opening Reading (usually 0), Change Date, Reason.",
          "Click Save Meter Change.",
          "The meter's readings are updated automatically.",
        ],
      },
      {
        heading: "View Meter Change History",
        steps: [
          "Click Meter Change in the sidebar.",
          "Filter by meter, date, or branch.",
          "Each entry shows old and new meter details, readings, and who logged the change.",
        ],
      },
    ],
  },

  // ── MANAGEMENT ─────────────────────────────────────────────────────────────
  {
    id: "branches",
    icon: Building,
    title: "Branch Management",
    badge: "Admin",
    group: "Management",
    color: "bg-slate-500",
    content: [
      {
        heading: "View Branches",
        steps: [
          "Click Branch Management in the sidebar.",
          "All branches are listed with name, code, and status.",
        ],
      },
      {
        heading: "Create a New Branch",
        steps: [
          "Click + New Branch.",
          "Enter the full Name (e.g. Megenagna Branch) and 2-letter Code (e.g. MG).",
          "Click Save.",
        ],
      },
      {
        heading: "Edit / Delete a Branch",
        steps: [
          "Click a branch row to open it.",
          "Click Edit, update the fields, click Save.",
          "To delete: click Delete then confirm. Only possible if no active meters or staff are assigned.",
        ],
      },
    ],
  },
  {
    id: "staff-management",
    icon: UserCog,
    title: "Staff Management",
    badge: "Admin",
    group: "Management",
    color: "bg-violet-500",
    content: [
      {
        heading: "View Staff List",
        steps: [
          "Click Staff Management in the sidebar.",
          "View all staff with their role, branch, and active status.",
          "Filter by branch or search by name.",
        ],
      },
      {
        heading: "Create a New Staff Member",
        steps: [
          "Click + Add Staff.",
          "Fill in: Name, Email (login username), Temporary Password, Branch, Role.",
          "Click Create Staff.",
          "Inform the staff member to change their password on first login.",
        ],
      },
      {
        heading: "Edit Staff",
        steps: [
          "Click the staff member's row.",
          "Click Edit.",
          "Update name, email, branch, or role.",
          "Click Save.",
        ],
      },
      {
        heading: "Deactivate / Delete Staff",
        steps: [
          "To deactivate: Edit the staff record, change Status to Inactive, click Save. The user cannot log in.",
          "To permanently remove: click Delete then confirm. This is irreversible.",
        ],
      },
    ],
  },
  {
    id: "approvals",
    icon: UserCheck,
    title: "Approvals",
    badge: "Admin / Supervisor",
    group: "Management",
    color: "bg-blue-500",
    content: [
      {
        heading: "View Pending Approvals",
        steps: [
          "Click Approvals in the sidebar.",
          "The list shows all bills, customers, or meters currently in Pending status for your branch.",
          "Click a row to review the details.",
        ],
      },
      {
        heading: "Approve a Bill",
        steps: [
          "Open the pending bill.",
          "Review all charges and readings.",
          "Click Approve. The bill moves to Approved status.",
        ],
      },
      {
        heading: "Send Back for Rework",
        steps: [
          "Open the pending bill.",
          "Click Send Back for Rework.",
          "Enter the reason (required).",
          "The bill returns to Draft with a rework note visible to the submitter.",
        ],
      },
      {
        heading: "Bulk Approve",
        steps: [
          "On the Approvals page, use checkboxes to select multiple items.",
          "Click Approve Selected.",
          "All selected items move to Approved status.",
        ],
      },
    ],
  },
  {
    id: "roles",
    icon: ShieldCheck,
    title: "Roles & Permissions",
    badge: "Admin",
    group: "Management",
    color: "bg-purple-600",
    content: [
      {
        heading: "View Roles",
        steps: [
          "Click Roles & Permissions in the sidebar.",
          "All system roles are listed.",
          "Click a role to see the permissions assigned to it.",
        ],
      },
      {
        heading: "Create a New Role",
        steps: [
          "Click + New Role.",
          "Enter a Role Name.",
          "Check the permissions to grant this role (billing, readings, reports, etc.).",
          "Click Save Role.",
        ],
      },
      {
        heading: "Assign Role to a Staff Member",
        steps: [
          "Go to Staff Management.",
          "Edit the staff member.",
          "Select the Role from the dropdown.",
          "Click Save.",
        ],
      },
    ],
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Notifications",
    badge: "Admin / Staff",
    group: "Management",
    color: "bg-yellow-500",
    content: [
      {
        heading: "View Notifications",
        steps: [
          "Click the Bell icon in the top navigation bar, or click Notifications in the sidebar.",
          "Notifications include: bills submitted for approval, billing job completions, overdue bills, system alerts.",
          "Click a notification to go directly to the related record.",
        ],
      },
      {
        heading: "Create a Notification (Admin)",
        steps: [
          "Go to Notifications > New Notification.",
          "Select recipients: All Staff, specific Branch, or specific Role.",
          "Enter the message title and body.",
          "Click Send.",
        ],
      },
    ],
  },
  {
    id: "tariffs",
    icon: LibraryBig,
    title: "Tariff Management",
    badge: "Admin",
    group: "Management",
    color: "bg-orange-500",
    content: [
      {
        heading: "View Tariffs",
        steps: [
          "Click Tariff Management in the sidebar.",
          "Tariffs define pricing per charge group: Domestic, Non-domestic, Borehole, Public Fountain.",
          "View current rates: base rate tiers, maintenance fee, sanitation fee, meter rent, VAT %.",
        ],
      },
      {
        heading: "Update Tariff Rates",
        steps: [
          "Click the tariff to edit.",
          "Update rate fields as required.",
          "Click Save.",
        ],
        body: "WARNING: Changing a tariff affects all future billing cycles for that customer type. Existing posted bills are not retroactively changed.",
      },
      {
        heading: "Penalty Settings",
        body: "Configure in the tariff record:\n• Penalty Month Threshold — months of non-payment before penalty starts\n• Bank Lending Rate — base rate used for penalty calculation\n• Penalty Tiered Rates — additional rate per aging tier (30 / 60 / 90+ days)",
      },
    ],
  },
  {
    id: "route-management",
    icon: Map,
    title: "Route Management",
    badge: "Admin / Staff",
    group: "Management",
    color: "bg-green-600",
    content: [
      {
        heading: "Create a Route",
        steps: [
          "Click Route Management in the sidebar.",
          "Click + New Route.",
          "Enter Route Name, Branch, and a description.",
          "Assign bulk meters to the route from the meter picker.",
          "Click Save.",
        ],
      },
      {
        heading: "Assign a Meter Reader to a Route",
        steps: [
          "Open a route.",
          "In the Assigned Readers section, click Add Staff.",
          "Search and select the staff member.",
          "Click Assign.",
          "The reader can now see this route under My Routes.",
        ],
      },
      {
        heading: "Edit / Delete a Route",
        steps: [
          "Click the route row.",
          "Click Edit to update name, branch, or assignments.",
          "Click Delete to remove the route (meters are unaffected).",
        ],
      },
    ],
  },
  {
    id: "knowledge-base",
    icon: BookText,
    title: "Knowledge Base",
    badge: "Admin / Staff",
    group: "Management",
    color: "bg-sky-500",
    content: [
      {
        heading: "Browse the Knowledge Base",
        steps: [
          "Click Knowledge Base in the sidebar.",
          "Browse articles by category or search by keyword.",
          "Click an article to read it in full.",
        ],
      },
      {
        heading: "Manage Articles (Admin)",
        steps: [
          "Click + New Article.",
          "Enter title, content (rich text editor), and category.",
          "Click Publish to make it visible to all staff.",
          "Click Edit on an existing article to update it.",
          "Click Delete to remove an article.",
        ],
      },
    ],
  },
  {
    id: "bill-management",
    icon: FileText,
    title: "Bill Management",
    badge: "Admin / Staff",
    group: "Management",
    color: "bg-rose-500",
    content: [
      {
        heading: "View All Bills",
        steps: [
          "Click Bill Management in the sidebar.",
          "The table lists bills with: Customer Key, Branch, Period, Workflow Status, Payment Status, Amount.",
          "Filter by: Branch, Status (Draft / Pending / Approved / Posted / Paid / Unpaid), Period, or Search.",
          "Click any bill row to open Bill Details.",
        ],
      },
      {
        heading: "Run Billing Cycle — Single Meter",
        steps: [
          "Open the Bulk Meter Details page for the specific meter.",
          "Click Run Billing Cycle.",
          "Select Billing Period (Month/Year) and Carry Balance option.",
          "Review the computed charges in the preview.",
          "Click Confirm and Generate Bill.",
          "The bill is created with status Draft and payment status Unpaid.",
        ],
      },
      {
        heading: "Batch Billing — All Meters in a Branch",
        steps: [
          "In Bill Management, click the Bulk Billing tab.",
          "Select Branch, Billing Period, and Carry Balance option.",
          "Click Start Batch Billing.",
          "A background job is queued — progress is shown in the job status panel.",
          "When complete, all meters in the branch have a new Draft bill.",
        ],
      },
      {
        heading: "Bill Workflow (Draft to Posted)",
        body: "Draft → Submit for Approval → Pending → Approve → Approved → Post → Posted\n\nRework: A Pending bill can be sent back to Draft with a rework note.\nCorrection: A Posted bill can be Reversed and a correction bill created.",
      },
      {
        heading: "Submit a Bill for Approval",
        steps: [
          "Open the bill in Draft status.",
          "Click Submit for Approval.",
          "The bill moves to Pending Approval. Approvers are notified automatically.",
        ],
      },
      {
        heading: "Approve a Bill",
        steps: [
          "Open the bill in Pending status (or go to Approvals page).",
          "Review charges and readings.",
          "Click Approve to move to Approved status.",
          "Or click Send Back for Rework to return to Draft with a note.",
        ],
      },
      {
        heading: "Post a Bill",
        steps: [
          "Open the Approved bill.",
          "Click Post Bill.",
          "The bill is now Posted — locked from core editing.",
          "It is visible in customer-facing views and ready for payment.",
        ],
      },
      {
        heading: "Print / Export Bill as PDF",
        steps: [
          "Open any bill.",
          "Click Print Bill (printer icon) — opens a print-ready browser view.",
          "Click Export PDF — downloads the PDF file.",
          "The printout shows: itemized charges, reading info, payment status stamp (Paid / Unpaid), billing period.",
        ],
      },
      {
        heading: "Create a Bill Correction",
        steps: [
          "Open the Posted bill to correct.",
          "Click Create Correction.",
          "The original bill is marked Reversed.",
          "A new CORR- prefixed bill is created in Draft.",
          "Edit and re-submit the correction through the normal approval workflow.",
        ],
      },
      {
        heading: "Bulk Delete / Reset Bills for a Period",
        body: "Use this when you need to re-run billing for an entire period. Paid bills are always protected.",
        steps: [
          "Click the Bulk Delete / Reset Bills button (top right in Bill Management).",
          "Select Billing Period and Branch in the dialog.",
          "Click Preview Impact to see total scope, protected paid bills, and balance to reverse.",
          "Check Preserve paid & settled bills (recommended — on by default).",
          "Type DELETE in the confirmation box.",
          "Click Delete Bills to archive to Recycle Bin, or Delete & Rebill Now to immediately re-run billing.",
        ],
      },
      {
        heading: "Record a Payment",
        steps: [
          "Open the bill in Bill Details.",
          "Click Record Payment.",
          "Fill in: Amount Paid, Payment Method, Transaction Reference, Payment Date.",
          "Click Save Payment.",
          "If full amount is covered, the bill is automatically marked Paid.",
        ],
      },
    ],
  },
  {
    id: "fault-codes",
    icon: AlertOctagon,
    title: "Fault Codes",
    badge: "Admin / Staff",
    group: "Management",
    color: "bg-red-500",
    content: [
      {
        heading: "View Fault Codes",
        steps: [
          "Click Fault Codes in the sidebar.",
          "Fault codes are predefined categories for billing or reading exceptions.",
          "View all codes with their description and category.",
        ],
      },
      {
        heading: "Create / Edit Fault Codes",
        steps: [
          "Click + New Fault Code.",
          "Enter Code, Description, and Category.",
          "Click Save.",
          "To edit: click the fault code row, update fields, click Save.",
        ],
      },
    ],
  },
  {
    id: "support",
    icon: LifeBuoy,
    title: "Customer Support",
    badge: "Admin / Staff",
    group: "Management",
    color: "bg-pink-500",
    content: [
      {
        heading: "Create a Support Ticket",
        steps: [
          "Click Customer Support in the sidebar.",
          "Click + New Ticket.",
          "Fill in: Subject, Description of the issue, Priority (Low / Medium / High).",
          "Click Submit.",
        ],
      },
      {
        heading: "View and Respond to Tickets",
        steps: [
          "Click Customer Support in the sidebar.",
          "View tickets assigned to you or your branch.",
          "Click a ticket to open it.",
          "Add a Reply / Update in the comment box.",
          "Click Resolve when the issue is fixed.",
        ],
      },
      {
        heading: "Assign a Ticket to a Staff Member",
        steps: [
          "Open the ticket.",
          "Click Assign then select a staff member from the list.",
          "The assigned staff member is notified automatically.",
        ],
      },
    ],
  },

  // ── CUSTOMER & METERING ────────────────────────────────────────────────────
  {
    id: "bulk-meters",
    icon: Gauge,
    title: "Bulk Meters",
    badge: "Admin / Staff",
    group: "Customer & Metering",
    color: "bg-amber-500",
    content: [
      {
        heading: "View Bulk Meters List",
        steps: [
          "Click Bulk Meters in the sidebar.",
          "The table shows: name, customer key, branch, status, current reading.",
          "Search by name or customer key. Filter by Branch or Status.",
          "Click any row to open the Bulk Meter Details page.",
        ],
      },
      {
        heading: "Create a New Bulk Meter",
        steps: [
          "Click Bulk Meters > New Bulk Meter (or the + Add button).",
          "Fill in required fields: Name, Contract Number, Meter Key, Branch, Charge Group, Sewerage Connection, Meter Size, Initial Readings.",
          "Optionally fill: Route, Sub-City, Woreda, GPS coordinates.",
          "Click Save. The meter is created with status Active.",
        ],
      },
      {
        heading: "Edit a Bulk Meter",
        steps: [
          "Open the bulk meter from the list.",
          "Click the Edit (pencil) button.",
          "Update the fields.",
          "Click Save.",
        ],
      },
      {
        heading: "Delete a Bulk Meter",
        steps: [
          "Open the bulk meter.",
          "Click Delete (trash icon) and confirm in the dialog.",
          "The meter is soft-deleted and moved to the Recycle Bin.",
          "All associated individual sub-meter customers are also soft-deleted.",
        ],
      },
      {
        heading: "Credit / Deposit Balance",
        steps: [
          "Open the Bulk Meter Details page.",
          "Scroll to the Credit / Deposit section.",
          "View current credit balance and ledger history.",
          "Click Add Credit to record an overpayment or deposit.",
          "Click Void on a credit entry to reverse an unused credit.",
        ],
      },
    ],
  },
  {
    id: "individual-customers",
    icon: Users,
    title: "Individual Customers",
    badge: "Admin / Staff",
    group: "Customer & Metering",
    color: "bg-blue-600",
    content: [
      {
        heading: "View Individual Customers",
        steps: [
          "Click Individual Customers in the sidebar.",
          "Filter by Branch or search by name / customer key.",
          "Click a row to view the customer details page.",
        ],
      },
      {
        heading: "Create an Individual Customer (Sub-meter)",
        steps: [
          "Click Individual Customers > New Customer.",
          "Fill in: Name, Contract Number, Customer Key, Assigned Bulk Meter (parent), Branch, Route, Initial Readings.",
          "Click Save.",
        ],
      },
      {
        heading: "Assign Customer to a Bulk Meter",
        steps: [
          "Open the Bulk Meter Details page.",
          "Scroll to Assigned Individual Customers.",
          "Click Add Customer.",
          "Search and select the customer.",
          "Click Assign.",
        ],
      },
      {
        heading: "Edit / Delete an Individual Customer",
        steps: [
          "Open the customer, click Edit, modify fields, click Save.",
          "To delete: click Delete and confirm. The customer is moved to the Recycle Bin.",
        ],
      },
    ],
  },

  // ── DATA & REPORTS ─────────────────────────────────────────────────────────
  {
    id: "data-entry",
    icon: FileDown,
    title: "Data Entry",
    badge: "Admin / Staff",
    group: "Data & Reports",
    color: "bg-teal-700",
    content: [
      {
        heading: "Bulk Meter CSV Import",
        steps: [
          "Click Data Entry in the sidebar.",
          "Select the Bulk Meters tab.",
          "Click Download Template to get the CSV format.",
          "Fill the template with meter data.",
          "Click Upload File and select your CSV.",
          "Review the validation summary — errors are highlighted.",
          "Click Import to save all valid rows.",
        ],
      },
      {
        heading: "Individual Customer CSV Import",
        steps: [
          "Same process as Bulk Meter import, but select the Individual Customers tab.",
          "The template requires an ASSIGNED_BULK_METER_KEY column.",
          "Customers with an invalid bulk meter key will be flagged as errors.",
        ],
      },
    ],
  },
  {
    id: "reports",
    icon: BarChart3,
    title: "Reports",
    badge: "Admin / Staff",
    group: "Data & Reports",
    color: "bg-cyan-500",
    content: [
      {
        heading: "Generate and Export a Report",
        steps: [
          "Click Reports in the sidebar.",
          "Click a report name to select it.",
          "Apply optional filters: Branch, Date Range, Charge Group.",
          "Click Preview to see the data on screen.",
          "Click Export XLSX to download as an Excel file.",
        ],
      },
      {
        heading: "Available Reports",
        table: {
          headers: ["Report", "Description", "Who"],
          rows: [
            ["Billing Summary", "All bills for a period with totals", "Admin, Staff"],
            ["List of Paid Bills", "Only paid bills", "Admin, Staff"],
            ["List of Sent Bills", "Bills that have been posted/sent", "Admin, Staff"],
            ["List of Unsettled Bills", "Unpaid and overdue bills", "Admin, Staff"],
            ["GL Monthly Summary by GL Code", "Finance GL report by Branch, Charge Group, GL Code", "Admin Finance"],
            ["GL Finance Monthly", "Monthly GL finance export", "Admin Finance"],
            ["Water Usage", "Consumption by meter and period", "Admin, Staff"],
            ["Meter Reading Accuracy", "Flagged irregular readings", "Admin, Staff"],
            ["Customer Data Export", "Full customer list", "Admin"],
            ["Bulk Meter Data Export", "Full bulk meter list", "Admin"],
            ["Monthly Bill Export", "All bills for a month", "Admin, Staff"],
          ],
        },
      },
      {
        heading: "GL Code Reference",
        table: {
          headers: ["GL Code", "Meaning"],
          rows: [
            ["WDGL", "Water — Domestic"],
            ["WNDGL", "Water — Non-domestic"],
            ["WBORGL", "Water — Borehole"],
            ["WPFNTGL", "Water — Public Fountain"],
            ["SEWERGL", "Sewerage Charge"],
            ["SNTGL", "Sanitation Fee"],
            ["MTRRNTGL", "Meter Rent"],
            ["MNTGL", "Maintenance Fee"],
            ["FIREGL", "Additional Fees / Penalty"],
          ],
        },
      },
    ],
  },
  {
    id: "paid-bills",
    icon: CheckCircle2,
    title: "List of Paid Bills",
    badge: "Admin / Staff",
    group: "Data & Reports",
    color: "bg-green-500",
    content: [
      {
        heading: "View and Export Paid Bills",
        steps: [
          "Click List Of Paid Bills in the sidebar.",
          "Filter by Branch, Date Range, or Charge Group.",
          "Click Preview to see the data.",
          "Click Export XLSX to download the list.",
        ],
      },
    ],
  },
  {
    id: "sent-bills",
    icon: Send,
    title: "List of Sent Bills",
    badge: "Admin / Staff",
    group: "Data & Reports",
    color: "bg-blue-400",
    content: [
      {
        heading: "View and Export Sent Bills",
        steps: [
          "Click List Of Sent Bills in the sidebar.",
          "Shows all bills that have been Posted (sent to customers).",
          "Filter by Branch or Date Range.",
          "Click Export XLSX to download.",
        ],
      },
    ],
  },
  {
    id: "unsettled-bills",
    icon: FileClock,
    title: "List of Unsettled Bills",
    badge: "Admin / Staff",
    group: "Data & Reports",
    color: "bg-orange-600",
    content: [
      {
        heading: "View Unsettled (Unpaid / Overdue) Bills",
        steps: [
          "Click List of Unsettled Bills in the sidebar.",
          "This shows all bills with payment_status = Unpaid that are past their due date.",
          "Filter by Branch or Date Range.",
          "Use this list for follow-up and collection actions.",
          "Click Export XLSX to download for offline use.",
        ],
      },
    ],
  },

  // ── SYSTEM ─────────────────────────────────────────────────────────────────
  {
    id: "settings",
    icon: Settings,
    title: "Settings",
    badge: "Admin",
    group: "System",
    color: "bg-slate-600",
    content: [
      {
        heading: "System Settings",
        steps: [
          "Click Settings in the sidebar.",
          "Configure: System Name, Logo, Currency, Due Date Rule (days after billing before due), Email notifications on/off.",
          "Click Save Settings.",
        ],
      },
      {
        heading: "Billing Settings",
        steps: [
          "In Settings, navigate to the Billing tab.",
          "Configure: default carry balance behavior, penalty thresholds, billing cycle defaults.",
          "Click Save.",
        ],
      },
    ],
  },
  {
    id: "promotions",
    icon: Megaphone,
    title: "Promotions",
    badge: "Admin",
    group: "System",
    color: "bg-pink-400",
    content: [
      {
        heading: "Manage Promotions",
        steps: [
          "Click Promotions in the sidebar.",
          "View active and past promotions.",
          "Click + New Promotion to create one.",
          "Enter: Title, Description, Discount Type, Value, Eligible Charge Groups, Date Range.",
          "Click Save to activate the promotion.",
        ],
      },
    ],
  },
  {
    id: "security-logs",
    icon: Shield,
    title: "Security Logs",
    badge: "Admin",
    group: "System",
    color: "bg-red-600",
    content: [
      {
        heading: "View Security Logs",
        steps: [
          "Click Security Logs in the sidebar.",
          "All sensitive system actions are recorded here: logins, data changes, deletions, bulk operations.",
          "Filter by: Event Type, Staff Member, Date Range.",
          "Each entry shows: event type, who performed it, when, and details.",
          "Use this for audit trails and investigating unauthorized changes.",
        ],
      },
    ],
  },
  {
    id: "recycle-bin",
    icon: Trash2,
    title: "Recycle Bin",
    badge: "Admin",
    group: "System",
    color: "bg-orange-500",
    content: [
      {
        heading: "View Deleted Items",
        steps: [
          "Click Recycle Bin in the sidebar.",
          "Filter by Entity Type (Bills, Bulk Meters, Individual Customers), Branch, or Date Deleted.",
          "Each row shows who deleted the item and when.",
        ],
      },
      {
        heading: "Restore a Single Item",
        steps: [
          "Find the item in the Recycle Bin list.",
          "Click the Restore button on that row.",
          "The item is restored to its original state.",
          "For bills, customer outstanding balances are recalculated automatically.",
        ],
      },
      {
        heading: "Batch Restore",
        steps: [
          "Apply filters to show the items you want to restore.",
          "Use checkboxes to select multiple items.",
          "Click Restore Selected in the action bar.",
          "Confirm in the dialog.",
        ],
      },
      {
        heading: "Permanently Delete",
        body: "WARNING: This action is irreversible. The record is removed from the database permanently.",
        steps: [
          "Select one or more items using checkboxes.",
          "Click Delete Permanently.",
          "Type DELETE in the confirmation box.",
          "Click Confirm.",
        ],
      },
    ],
  },
  {
    id: "backup",
    icon: Database,
    title: "Database Backup",
    badge: "Admin",
    group: "System",
    color: "bg-indigo-700",
    content: [
      {
        heading: "Create a Backup",
        steps: [
          "Click Database Backup in the sidebar.",
          "Click Create Backup to generate a system backup.",
          "Download the backup file for safe offline storage.",
          "View backup history with timestamps and file sizes.",
        ],
      },
    ],
  },
  {
    id: "maintenance",
    icon: Activity,
    title: "System Maintenance",
    badge: "Admin",
    group: "System",
    color: "bg-yellow-700",
    content: [
      {
        heading: "System Maintenance Tasks",
        steps: [
          "Click System Maintenance in the sidebar.",
          "View system health statistics: database size, active jobs, error counts.",
          "Use maintenance tools: clear stale jobs, rebuild indexes, re-sync aging for all customers.",
          "Schedule or run maintenance tasks as needed.",
        ],
      },
    ],
  },
  {
    id: "errors",
    icon: AlertOctagon,
    title: "Common Errors & Fixes",
    badge: "All Users",
    group: "System",
    color: "bg-red-500",
    content: [
      {
        heading: "Error Reference Table",
        table: {
          headers: ["Error Message", "Cause", "Solution"],
          rows: [
            ["A billing job is currently in progress", "Billing job is running", "Wait for completion or reset the job from System Maintenance"],
            ["Bill not found", "Bill deleted or invalid ID", "Check the Recycle Bin"],
            ["Cannot edit core billing data", "Bill is Posted or Approved", "Only payment fields are editable on Posted bills"],
            ["Deletion Failed", "SQL or system error", "Contact administrator and check Security Logs"],
            ["Forbidden: Missing permission", "Role lacks this permission", "Contact your administrator to update role"],
            ["Billing period overlaps", "Bill exists for that period", "Use Bulk Delete to reset the period first"],
            ["column bm id does not exist", "SQL join error on bulk_meters", "This is a system bug — contact administrator"],
          ],
        },
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserManualPage() {
  const [search, setSearch] = React.useState("");
  const [activeGroup, setActiveGroup] = React.useState<string | null>(null);

  const filtered = sections.filter((s) => {
    const groupOk = !activeGroup || s.group === activeGroup;
    if (!search.trim()) return groupOk;
    const q = search.toLowerCase();
    const textMatch =
      s.title.toLowerCase().includes(q) ||
      s.group.toLowerCase().includes(q) ||
      s.content.some((raw) => {
        const c = raw as ContentBlock;
        return (
          c.heading?.toLowerCase().includes(q) ||
          c.body?.toLowerCase().includes(q) ||
          c.steps?.some((step: string) => step.toLowerCase().includes(q))
        );
      });
    return groupOk && textMatch;
  });

  const groupedFiltered = GROUPS.map((g) => ({
    group: g,
    items: filtered.filter((s) => s.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">User Manual</h1>
              <p className="text-sm text-muted-foreground">
                AAWSA Bulk Billing Portal — Complete guide for all features and roles
              </p>
            </div>
          </div>

          {/* Search + Group Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search manual..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setActiveGroup(null)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  !activeGroup
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                All
              </button>
              {GROUPS.map((g) => (
                <button
                  key={g}
                  onClick={() => setActiveGroup(activeGroup === g ? null : g)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    activeGroup === g
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">
        {groupedFiltered.length === 0 && (
          <div className="py-20 text-center text-muted-foreground">
            No sections match your search.
          </div>
        )}

        {groupedFiltered.map(({ group, items }) => (
          <div key={group}>
            {/* Group heading */}
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-bold text-foreground">{group}</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {items.length} {items.length === 1 ? "page" : "pages"}
              </span>
              <div className="flex-1 h-px bg-border ml-1" />
            </div>

            <div className="space-y-4">
              {items.map((section) => {
                const Icon = section.icon;
                return (
                  <div
                    key={section.id}
                    id={`section-${section.id}`}
                    className="scroll-mt-6 rounded-xl border bg-card shadow-sm overflow-hidden"
                  >
                    {/* Section header */}
                    <div className="flex items-center gap-3 border-b px-5 py-3.5">
                      <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-white shrink-0", section.color)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="font-semibold text-sm flex-1">{section.title}</h3>
                      <Badge variant="secondary" className="text-xs shrink-0">{section.badge}</Badge>
                    </div>

                    {/* Section body */}
                    <div className="divide-y">
                      {section.content.map((rawBlock, bi) => {
                        const block = rawBlock as ContentBlock;
                        return (
                          <div key={bi} className="px-5 py-4">
                            <h4 className="font-medium text-sm mb-2.5 text-foreground">{block.heading}</h4>

                            {/* Steps */}
                            {block.steps && (
                              <ol className="space-y-1.5 mb-2">
                                {block.steps.map((step: string, si: number) => (
                                  <li key={si} className="flex gap-2.5 text-sm">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                                      {si + 1}
                                    </span>
                                    <span className="text-muted-foreground leading-5">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            )}

                            {/* Body text */}
                            {block.body && (
                              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                                {block.body}
                              </p>
                            )}

                            {/* Table */}
                            {block.table && (
                              <div className="overflow-x-auto mt-1 -mx-1">
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      {block.table.headers.map((h: string) => (
                                        <th key={h} className="px-3 py-2 text-left font-medium text-foreground border border-border">
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {block.table.rows.map((row: string[], ri: number) => (
                                      <tr key={ri} className={ri % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                        {row.map((cell: string, ci: number) => (
                                          <td key={ci} className="px-3 py-2 text-muted-foreground border border-border">
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Billing Workflow Quick Reference */}
        {!search && !activeGroup && (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 border-b px-5 py-3.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
              <h3 className="font-semibold text-sm">Billing Workflow — Quick Reference</h3>
            </div>
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {[
                  { label: "Enter Readings", color: "bg-teal-100 text-teal-800 border-teal-200" },
                  { label: "→", color: "text-muted-foreground font-bold" },
                  { label: "Run Billing Cycle", color: "bg-amber-100 text-amber-800 border-amber-200" },
                  { label: "→", color: "text-muted-foreground font-bold" },
                  { label: "Draft Created", color: "bg-slate-100 text-slate-700 border-slate-200" },
                  { label: "→", color: "text-muted-foreground font-bold" },
                  { label: "Submit for Approval", color: "bg-blue-100 text-blue-800 border-blue-200" },
                  { label: "→", color: "text-muted-foreground font-bold" },
                  { label: "Approve", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
                  { label: "→", color: "text-muted-foreground font-bold" },
                  { label: "Post Bill", color: "bg-purple-100 text-purple-800 border-purple-200" },
                  { label: "→", color: "text-muted-foreground font-bold" },
                  { label: "Record Payment", color: "bg-green-100 text-green-800 border-green-200" },
                  { label: "→", color: "text-muted-foreground font-bold" },
                  { label: "PAID ✓", color: "bg-green-500 text-white border-green-500" },
                ].map((item, i) =>
                  item.label.startsWith("→") ? (
                    <span key={i} className={item.color}>{item.label}</span>
                  ) : (
                    <span key={i} className={cn("px-2.5 py-1 rounded-md border text-xs font-medium", item.color)}>
                      {item.label}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
