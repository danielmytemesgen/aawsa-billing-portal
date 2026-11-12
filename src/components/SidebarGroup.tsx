"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MenuItem, SubmenuItem } from "@/lib/menu";
import { cn } from "@/lib/utils";

interface SidebarGroupProps {
  item: MenuItem;
  isOpen: boolean;
  onToggle: () => void;
  onItemClick?: (subItem: SubmenuItem) => void;
  className?: string;
}

export function SidebarGroup({
  item,
  isOpen,
  onToggle,
  onItemClick,
  className,
}: SidebarGroupProps) {
  const pathname = usePathname();
  const Icon = item.icon;
  const children = item.children || [];

  // Check if any child item matches current pathname
  const hasActiveChild = React.useMemo(() => {
    return children.some((sub) => {
      if (!sub.href) return false;
      return pathname === sub.href || pathname.startsWith(`${sub.href}/`);
    });
  }, [children, pathname]);

  const controlId = `submenu-${item.id}`;
  const headerId = `group-header-${item.id}`;

  return (
    <div className={cn("select-none", className)}>
      {/* Top-Level Group Header Row */}
      <button
        id={headerId}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={controlId}
        className={cn(
          // Layout & dimensions: 48px height, 16px px, rounded corners
          "group flex w-[calc(100%-16px)] h-12 items-center px-4 mx-2 rounded-xl text-left transition-all duration-150 ease-in-out",
          // Focus state for accessibility
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B76D6]/50",
          // Hover & active parent states
          isOpen
            ? "bg-slate-100/70 text-slate-900"
            : hasActiveChild
            ? "bg-slate-50 text-slate-900"
            : "text-slate-800 hover:bg-slate-100/80 hover:text-slate-900"
        )}
      >
        {/* Top-level Icon: 20px, outline style, slate color */}
        <Icon
          className={cn(
            "w-5 h-5 shrink-0 transition-colors duration-150",
            isOpen || hasActiveChild
              ? "text-[#6B76D6]"
              : "text-slate-500 group-hover:text-slate-700"
          )}
          strokeWidth={1.75}
          aria-hidden="true"
        />

        {/* Top-level Label: font-semibold, ~15-16px, dark slate */}
        <span
          className={cn(
            "ml-3.5 text-[15px] font-semibold tracking-[-0.01em] truncate flex-1",
            isOpen || hasActiveChild ? "text-slate-900" : "text-slate-800"
          )}
        >
          {item.label}
        </span>

        {/* Group Badge (if provided) */}
        {item.badge && (
          <span className="mr-2 text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
            {item.badge}
          </span>
        )}

        {/* Chevron aligned to far right in gray */}
        <span className="ml-auto text-slate-400 group-hover:text-slate-600 transition-colors">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-200" aria-hidden="true" />
          )}
        </span>
      </button>

      {/* Collapsible Submenu Panel with smooth CSS Grid Animation */}
      <div
        id={controlId}
        role="region"
        aria-labelledby={headerId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-in-out",
          isOpen
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0 pointer-events-none"
        )}
      >
        <div className="overflow-hidden">
          {/* Submenu Panel: #F1F4FA background, rounded-2xl, thick 3.5px #6B76D6 left border, 8px margin-x */}
          <div className="mx-2 mt-1 mb-1.5 py-2 rounded-2xl bg-[#F1F4FA] border-l-[3.5px] border-[#6B76D6] shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-0.5">
            {children.map((sub, idx) => {
              const isChildActive =
                pathname === sub.href || (sub.href !== "/" && pathname.startsWith(`${sub.href}/`));

              return (
                <Link
                  key={sub.id || sub.href || idx}
                  href={sub.href}
                  onClick={() => onItemClick?.(sub)}
                  className={cn(
                    // Alignment: pl-14 (~56px) aligns text past parent icon, py-2.5 (10px)
                    "block w-full pl-14 pr-4 py-2.5 text-sm transition-all duration-150 ease-in-out whitespace-normal leading-snug rounded-lg",
                    // Focus styles
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B76D6]/40",
                    // Active vs Inactive states
                    isChildActive
                      ? "text-[#6B76D6] font-medium bg-[#E2E8F4]/80 shadow-[inset_0_1px_1px_rgba(0,0,0,0.02)]"
                      : "text-slate-800 font-normal hover:bg-[#E2E8F4]/60 hover:text-slate-900"
                  )}
                  aria-current={isChildActive ? "page" : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{sub.label}</span>
                    {sub.badge && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/70 text-slate-600 shrink-0">
                        {sub.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

