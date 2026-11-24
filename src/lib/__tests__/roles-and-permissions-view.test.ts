import { describe, it, expect } from "vitest";
import {
  CANONICAL_CATEGORY_MAP,
  CANONICAL_CATEGORIES,
  getCanonicalCategory,
  getCategoryColor,
  MUTUALLY_EXCLUSIVE_REPORT_PAIRS,
  MASTER_BUNDLE_MAP,
  formatPermissionName,
  getPermissionDescription,
  getPermissionScope,
  PERMISSION_METADATA_REGISTRY,
} from "@/lib/roles-permissions-utils";
import { PERMISSIONS } from "@/lib/constants/auth";

describe("Roles & Permissions: Canonical Normalization & Logic", () => {
  it("normalizes fragmented categories to canonical definitions", () => {
    expect(getCanonicalCategory("Billing")).toBe("Bill Management & Payments");
    expect(getCanonicalCategory("Bill Management")).toBe("Bill Management & Payments");
    expect(getCanonicalCategory("Operations")).toBe("Field Operations & Data Entry");
    expect(getCanonicalCategory("Field Operations")).toBe("Field Operations & Data Entry");
    expect(getCanonicalCategory("Reporting")).toBe("Reports & Analytics");
    expect(getCanonicalCategory("Branch Report")).toBe("Reports & Analytics");
    expect(getCanonicalCategory("Finance")).toBe("Finance & GL Audit");
    expect(getCanonicalCategory("Staff")).toBe("Staff & Access Management");
    expect(getCanonicalCategory("Branches")).toBe("Branch Management");
    expect(getCanonicalCategory("Customer Support")).toBe("Customer Support & Help Desk");
    expect(getCanonicalCategory("Notifications")).toBe("Notifications & SMS");
    expect(getCanonicalCategory(undefined, "dashboard_view_all")).toBe("Dashboard & Overview");
    expect(getCanonicalCategory(undefined, "customers_create")).toBe("Customers & Accounts");
    expect(getCanonicalCategory(undefined, "routes_view_all")).toBe("Routes & Field Readers");
  });

  it("provides distinct category color styles for all canonical categories", () => {
    CANONICAL_CATEGORIES.forEach(cat => {
      const color = getCategoryColor(cat);
      expect(color).toContain("border-");
      expect(color).toContain("text-");
      expect(color).toContain("bg-");
    });
  });

  it("contains all 16 mutually exclusive report pairs", () => {
    expect(MUTUALLY_EXCLUSIVE_REPORT_PAIRS.length).toBe(16);
    MUTUALLY_EXCLUSIVE_REPORT_PAIRS.forEach(([globalScope, branchScope]) => {
      expect(globalScope).toContain("report:");
      expect(branchScope).toContain("report:");
      expect(branchScope).toContain("branch");
    });
  });

  it("contains all critical master bundles and sub-actions", () => {
    expect(MASTER_BUNDLE_MAP["bill:manage_all"]).toBeDefined();
    expect(MASTER_BUNDLE_MAP["bill:manage_all"]).toContain("bill:view_drafts");
    expect(MASTER_BUNDLE_MAP["bill:manage_all"]).toContain("bill:view_approved");
    expect(MASTER_BUNDLE_MAP["bill:manage_all"]).toContain("invoice:view");

    expect(MASTER_BUNDLE_MAP["meter_readings_view_all"]).toBeDefined();
    expect(MASTER_BUNDLE_MAP["meter_readings_view_all"]).toContain("meter_readings_view_individual");
    expect(MASTER_BUNDLE_MAP["meter_readings_view_all"]).toContain("meter_readings_view_bulk");

    expect(MASTER_BUNDLE_MAP["routes_manage"]).toBeDefined();
    expect(MASTER_BUNDLE_MAP["routes_manage"]).toContain("routes_view");
    expect(MASTER_BUNDLE_MAP["routes_manage"]).toContain("routes_create");
  });

  it("formats permission names with user-friendly human titles", () => {
    expect(formatPermissionName("report:gl_audit_view")).toBe("GL Financial & Audit: Base Hub View");
    expect(formatPermissionName("report:gl_audit_view_all")).toBe("GL Audit: All-Branch Monthly Inspection Tab");
    expect(formatPermissionName("report:gl_finance_monthly")).toBe("GL Finance Monthly Report (City-Wide)");
    expect(formatPermissionName("customers_create")).toBe("Create Customer Account");
    expect(formatPermissionName("bill:manage_all")).toBe("Master: Full Bill Management (City-Wide)");
    expect(formatPermissionName("sms_send")).toBe("Send Customer SMS Notifications");
  });

  it("returns helpful, descriptive explanations for permissions", () => {
    const descBill = getPermissionDescription("bill:manage_all");
    expect(descBill).toContain("Comprehensive authority");

    const descSms = getPermissionDescription("sms_send");
    expect(descSms).toContain("SMS");

    const descMeters = getPermissionDescription("meter_readings_view_all");
    expect(descMeters).toContain("city-wide access");
  });

  it("correctly identifies operational scopes (all, branch, master, action)", () => {
    expect(getPermissionScope("dashboard_view_all")).toBe("all");
    expect(getPermissionScope("dashboard_view_branch")).toBe("branch");
    expect(getPermissionScope("bill:manage_all")).toBe("master");
    expect(getPermissionScope("customers_create")).toBe("action");
    expect(getPermissionScope("routes_manage")).toBe("master");
    expect(getPermissionScope("routes_view_branch")).toBe("branch");
  });

  it("defines a consistent list of canonical categories for dialog selection", () => {
    expect(CANONICAL_CATEGORIES.length).toBe(15);
    expect(CANONICAL_CATEGORIES).toContain("Bill Management & Payments");
    expect(CANONICAL_CATEGORIES).toContain("Reports & Analytics");
    expect(CANONICAL_CATEGORIES).toContain("Finance & GL Audit");
    expect(CANONICAL_CATEGORIES).toContain("Dashboard & Overview");
    expect(CANONICAL_CATEGORIES).toContain("Customer Support & Help Desk");
  });

  it("guarantees 100% metadata coverage for all constants in PERMISSIONS", () => {
    const allPermConstants = Object.values(PERMISSIONS);
    expect(allPermConstants.length).toBe(169);

    for (const perm of allPermConstants) {
      const meta = PERMISSION_METADATA_REGISTRY[perm];
      expect(meta, `Permission "${perm}" must exist in PERMISSION_METADATA_REGISTRY`).toBeDefined();
      expect(meta.label.length).toBeGreaterThan(3);
      expect(meta.description.length).toBeGreaterThan(10);
      expect(CANONICAL_CATEGORIES).toContain(meta.category);
      expect(["all", "branch", "master", "action"]).toContain(meta.scope);
    }
  });

  it("ensures no permission is orphaned or unresolvable", () => {
    const allPermConstants = Object.values(PERMISSIONS);
    for (const perm of allPermConstants) {
      const canonical = getCanonicalCategory(undefined, perm);
      expect(CANONICAL_CATEGORIES).toContain(canonical);
      const color = getCategoryColor(canonical);
      expect(color).not.toBe("bg-gray-100 text-gray-700 border-gray-200");
    }
  });
});
