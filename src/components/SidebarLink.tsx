"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuItem } from "@/lib/menu";
import { cn } from "@/lib/utils";

interface SidebarLinkProps {
  item: MenuItem;
  className?: string;
  onClick?: () => void;
}

export function SidebarLink({ item, className, onClick }: SidebarLinkProps) {
  const pathname = usePathname();
  const Icon = item.icon;
  const href = item.href || "#";
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        // Dimensions & layout
        "group flex h-12 items-center px-4 mx-2 rounded-xl transition-all duration-150 ease-in-out select-none",
        // Focus state
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B76D6]/50",
        // Active / Inactive states
        isActive
          ? "bg-[#F1F4FA] text-[#6B76D6]"
          : "text-slate-800 hover:bg-slate-100/80 hover:text-slate-900",
        className
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        className={cn(
          "w-5 h-5 shrink-0 transition-colors duration-150",
          isActive
            ? "text-[#6B76D6]"
            : "text-slate-500 group-hover:text-slate-700"
        )}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span
        className={cn(
          "ml-3.5 text-[15px] font-semibold tracking-[-0.01em] truncate flex-1",
          isActive ? "text-[#6B76D6]" : "text-slate-800"
        )}
      >
        {item.label}
      </span>
      {item.badge && (
        <span
          className={cn(
            "ml-auto text-xs px-2 py-0.5 rounded-full font-medium",
            isActive
              ? "bg-[#6B76D6]/10 text-[#6B76D6]"
              : "bg-slate-100 text-slate-600"
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

