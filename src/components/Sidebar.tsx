"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { MENU_ITEMS, type MenuItem, type SubmenuItem } from "@/lib/menu";
import { SidebarGroup } from "./SidebarGroup";
import { SidebarLink } from "./SidebarLink";
import { cn } from "@/lib/utils";

export interface SidebarProps {
  /**
   * List of menu items to render. Defaults to standard MENU_ITEMS config.
   */
  items?: MenuItem[];
  /**
   * Accordion mode: opening one group closes the others. Defaults to true.
   */
  singleOpen?: boolean;
  /**
   * Optional custom header element (e.g. logo, brand title).
   */
  header?: React.ReactNode;
  /**
   * Optional custom footer element (e.g. user profile, version info).
   */
  footer?: React.ReactNode;
  /**
   * Optional callback when any navigation item is clicked.
   */
  onNavigate?: (href: string) => void;
  /**
   * Additional container CSS classes.
   */
  className?: string;
}

export function Sidebar({
  items = MENU_ITEMS,
  singleOpen = true,
  header,
  footer,
  onNavigate,
  className,
}: SidebarProps) {
  const pathname = usePathname();

  // Helper to find which group (if any) contains the current active pathname
  const findActiveGroupId = React.useCallback(
    (currentPath: string): string | null => {
      for (const item of items) {
        if (item.children) {
          const match = item.children.some(
            (sub) =>
              currentPath === sub.href ||
              (sub.href !== "/" && currentPath.startsWith(`${sub.href}/`))
          );
          if (match) return item.id;
        }
      }
      return null;
    },
    [items]
  );

  // State for single-open (string | null) and multi-open (Set<string>)
  const [activeSingleGroup, setActiveSingleGroup] = React.useState<string | null>(
    () => findActiveGroupId(pathname)
  );
  const [openMultiGroups, setOpenMultiGroups] = React.useState<Set<string>>(() => {
    const initial = findActiveGroupId(pathname);
    return initial ? new Set([initial]) : new Set();
  });

  // Auto-expand group containing the current route whenever pathname changes
  React.useEffect(() => {
    const matchingGroupId = findActiveGroupId(pathname);
    if (matchingGroupId) {
      if (singleOpen) {
        setActiveSingleGroup(matchingGroupId);
      } else {
        setOpenMultiGroups((prev) => {
          if (prev.has(matchingGroupId)) return prev;
          const next = new Set(prev);
          next.add(matchingGroupId);
          return next;
        });
      }
    }
  }, [pathname, findActiveGroupId, singleOpen]);

  // Handle toggling of a group
  const handleToggleGroup = (groupId: string) => {
    if (singleOpen) {
      setActiveSingleGroup((prev) => (prev === groupId ? null : groupId));
    } else {
      setOpenMultiGroups((prev) => {
        const next = new Set(prev);
        if (next.has(groupId)) {
          next.delete(groupId);
        } else {
          next.add(groupId);
        }
        return next;
      });
    }
  };

  const isGroupOpen = (groupId: string): boolean => {
    return singleOpen
      ? activeSingleGroup === groupId
      : openMultiGroups.has(groupId);
  };

  return (
    <aside
      aria-label="Sidebar Navigation"
      className={cn(
        // Visual structure: White background, subtle right border & shadow, full height, flex column
        "flex flex-col w-64 md:w-72 h-full bg-white border-r border-slate-200/80 shadow-[1px_0_4px_rgba(0,0,0,0.02)] select-none",
        className
      )}
    >
      {/* Optional Header Slot */}
      {header && (
        <div className="shrink-0 px-4 py-4 border-b border-slate-100">
          {header}
        </div>
      )}

      {/* Scrollable Navigation Area */}
      <nav
        className="flex-1 overflow-y-auto py-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300"
        role="navigation"
      >
        {items.map((item) => {
          // Items with children -> Expandable Group
          if (item.children && item.children.length > 0) {
            return (
              <SidebarGroup
                key={item.id}
                item={item}
                isOpen={isGroupOpen(item.id)}
                onToggle={() => handleToggleGroup(item.id)}
                onItemClick={(subItem: SubmenuItem) => onNavigate?.(subItem.href)}
              />
            );
          }

          // Items without children -> Plain Link (no chevron)
          return (
            <SidebarLink
              key={item.id}
              item={item}
              onClick={() => item.href && onNavigate?.(item.href)}
            />
          );
        })}
      </nav>

      {/* Optional Footer Slot */}
      {footer && (
        <div className="shrink-0 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          {footer}
        </div>
      )}
    </aside>
  );
}

export default Sidebar;

