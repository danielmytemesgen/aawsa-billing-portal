import { describe, it, expect } from "vitest";
import { MENU_ITEMS } from "@/lib/menu";

describe("Sidebar Navigation Menu Configuration", () => {
  it("should contain all specified top-level groups and plain links", () => {
    const labels = MENU_ITEMS.map((item) => item.label);

    expect(labels).toContain("Invoice");
    expect(labels).toContain("Workflows");
    expect(labels).toContain("Water Shifts");
    expect(labels).toContain("Maps");
    expect(labels).toContain("Phone Management");
    expect(labels).toContain("Call Center");
    expect(labels).toContain("SMS");
    expect(labels).toContain("Reports");
    expect(labels).toContain("Bill Analytics");
    expect(labels).toContain("NRW");
  });

  it("should configure Phone Management as a plain link without children", () => {
    const phoneItem = MENU_ITEMS.find((item) => item.label === "Phone Management");
    expect(phoneItem).toBeDefined();
    expect(phoneItem?.href).toBe("/phone-management");
    expect(phoneItem?.children).toBeUndefined();
  });

  it("should configure NRW with all 7 required child items", () => {
    const nrw = MENU_ITEMS.find((item) => item.label === "NRW");
    expect(nrw).toBeDefined();
    expect(nrw?.children).toBeDefined();
    expect(nrw?.children).toHaveLength(7);

    const childLabels = nrw?.children?.map((c) => c.label);
    expect(childLabels).toEqual([
      "NRW Intelligence Dashboard",
      "NRW GIS Map",
      "Zero Reading GIS Map",
      "Basis2 Disconnection Report",
      "Source-DMA Mapping",
      "Production GIS Map",
      "Bill Data",
    ]);
  });

  it("should provide valid href paths for all submenu items", () => {
    for (const item of MENU_ITEMS) {
      if (item.children) {
        for (const sub of item.children) {
          expect(sub.href).toBeDefined();
          expect(sub.href.startsWith("/")).toBe(true);
          expect(sub.label.trim().length).toBeGreaterThan(0);
        }
      } else {
        expect(item.href).toBeDefined();
        expect(item.href?.startsWith("/")).toBe(true);
      }
    }
  });

  it("should separate Approvals, Roles & Permissions, and Customer Support into their own groups", async () => {
    const { buildSidebarNavItems } = await import(
      "@/lib/nav-builder"
    );

    const mockAdminUser = {
      id: "admin-1",
      email: "admin@aawsa.gov.et",
      name: "Admin User",
      role: "admin",
      permissions: ["*"],
    } as any;

    const navItems = buildSidebarNavItems(mockAdminUser);
    const groupTitles = navItems.map((g) => g.title).filter(Boolean);

    // Verify Management group exists but does NOT contain Approvals, Roles & Permissions, Customer Support
    const managementGroup = navItems.find((g) => g.title === "Management");
    expect(managementGroup).toBeDefined();

    const managementItemTitles = managementGroup?.items.map((i) => i.title);
    expect(managementItemTitles).not.toContain("Approvals");
    expect(managementItemTitles).not.toContain("Roles & Permissions");
    expect(managementItemTitles).not.toContain("Customer Support");

    // Verify each has its own dedicated top-level group
    expect(groupTitles).toContain("Approvals");
    expect(groupTitles).toContain("Roles & Permissions");
    expect(groupTitles).toContain("Customer Support");

    const approvalsGroup = navItems.find((g) => g.title === "Approvals");
    expect(approvalsGroup?.items).toHaveLength(1);
    expect(approvalsGroup?.items[0].title).toBe("Approvals");
    expect(approvalsGroup?.items[0].href).toBe("/admin/approvals");

    const rolesGroup = navItems.find((g) => g.title === "Roles & Permissions");
    expect(rolesGroup?.items).toHaveLength(1);
    expect(rolesGroup?.items[0].title).toBe("Roles & Permissions");
    expect(rolesGroup?.items[0].href).toBe("/admin/roles-and-permissions");

    const supportGroup = navItems.find((g) => g.title === "Customer Support");
    expect(supportGroup?.items).toHaveLength(1);
    expect(supportGroup?.items[0].title).toBe("Customer Support");
    expect(supportGroup?.items[0].href).toBe("/admin/support");
  });

  it("should promote Bill Management, Notifications, Tariff Management, Knowledge Base, Fault Codes to own sections and Route Management to Field Operations", async () => {
    const { buildSidebarNavItems } = await import("@/lib/nav-builder");

    const mockAdminUser = {
      id: "admin-1",
      email: "admin@aawsa.gov.et",
      name: "Admin User",
      role: "admin",
      permissions: ["*"],
    } as any;

    const navItems = buildSidebarNavItems(mockAdminUser);
    const groupTitles = navItems.map((g) => g.title).filter(Boolean);

    // Verify Management group only contains Branch Management & Staff Management
    const managementGroup = navItems.find((g) => g.title === "Management");
    expect(managementGroup).toBeDefined();

    const managementItemTitles = managementGroup?.items.map((i) => i.title);
    expect(managementItemTitles).toEqual(["Branch Management", "Staff Management"]);

    // Verify Route Management is in Field Operations
    const fieldOpsGroup = navItems.find((g) => g.title === "Field Operations");
    expect(fieldOpsGroup).toBeDefined();
    const fieldOpsTitles = fieldOpsGroup?.items.map((i) => i.title);
    expect(fieldOpsTitles).toContain("Route Management");

    // Verify all 5 promoted sections exist as top-level sections
    expect(groupTitles).toContain("Bill Management");
    expect(groupTitles).toContain("Notifications");
    expect(groupTitles).toContain("Tariff Management");
    expect(groupTitles).toContain("Knowledge Base");
    expect(groupTitles).toContain("Fault Codes");

    const billGroup = navItems.find((g) => g.title === "Bill Management");
    expect(billGroup?.items).toHaveLength(1);
    expect(billGroup?.items[0].href).toBe("/admin/bill-management");

    const notifGroup = navItems.find((g) => g.title === "Notifications");
    expect(notifGroup?.items).toHaveLength(1);
    expect(notifGroup?.items[0].href).toBe("/admin/notifications");

    const tariffGroup = navItems.find((g) => g.title === "Tariff Management");
    expect(tariffGroup?.items).toHaveLength(1);
    expect(tariffGroup?.items[0].href).toBe("/admin/tariffs");

    const kbGroup = navItems.find((g) => g.title === "Knowledge Base");
    expect(kbGroup?.items).toHaveLength(1);
    expect(kbGroup?.items[0].href).toBe("/admin/knowledge-base");

    const faultGroup = navItems.find((g) => g.title === "Fault Codes");
    expect(faultGroup?.items).toHaveLength(1);
    expect(faultGroup?.items[0].href).toBe("/admin/fault-codes");

    // Verify User Manual is promoted to its own section and not in System
    const systemGroup = navItems.find((g) => g.title === "System");
    expect(systemGroup).toBeDefined();
    const systemItemTitles = systemGroup?.items.map((i) => i.title);
    expect(systemItemTitles).not.toContain("User Manual");

    expect(groupTitles).toContain("User Manual");
    const manualGroup = navItems.find((g) => g.title === "User Manual");
    expect(manualGroup?.items).toHaveLength(1);
    expect(manualGroup?.items[0].href).toBe("/admin/user-manual");
    expect(manualGroup?.items[0].iconName).toBe("BookOpen");
    expect(manualGroup?.iconName).toBe("BookOpen");
  });

  it("should assign an icon to every titled navigation group in the sidebar", async () => {
    const { buildSidebarNavItems } = await import("@/lib/nav-builder");
    const mockAdminUser = {
      id: "admin-1",
      email: "admin@aawsa.gov.et",
      name: "Admin User",
      role: "admin",
      permissions: ["*"],
    } as any;

    const navItems = buildSidebarNavItems(mockAdminUser);
    const titledGroups = navItems.filter((g) => Boolean(g.title));

    for (const group of titledGroups) {
      expect(group.iconName).toBeDefined();
      expect(typeof group.iconName).toBe("string");
    }

    // Check specific iconic representations
    expect(navItems.find((g) => g.title === "Field Operations")?.iconName).toBe("Compass");
    expect(navItems.find((g) => g.title === "Management")?.iconName).toBe("Briefcase");
    expect(navItems.find((g) => g.title === "Bill Management")?.iconName).toBe("FileText");
    expect(navItems.find((g) => g.title === "Notifications")?.iconName).toBe("Bell");
    expect(navItems.find((g) => g.title === "Tariff Management")?.iconName).toBe("LibraryBig");
    expect(navItems.find((g) => g.title === "Knowledge Base")?.iconName).toBe("BookText");
    expect(navItems.find((g) => g.title === "Fault Codes")?.iconName).toBe("AlertOctagon");
    expect(navItems.find((g) => g.title === "Approvals")?.iconName).toBe("UserCheck");
    expect(navItems.find((g) => g.title === "Roles & Permissions")?.iconName).toBe("ShieldCheck");
    expect(navItems.find((g) => g.title === "Customer Support")?.iconName).toBe("LifeBuoy");
    expect(navItems.find((g) => g.title === "Customer & Metering")?.iconName).toBe("Gauge");
    expect(navItems.find((g) => g.title === "Data Entry")?.iconName).toBe("FileEdit");
    expect(navItems.find((g) => g.title === "Reports")?.iconName).toBe("BarChart2");
    expect(navItems.find((g) => g.title === "System")?.iconName).toBe("Settings");
    expect(navItems.find((g) => g.title === "User Manual")?.iconName).toBe("BookOpen");
  });
});

