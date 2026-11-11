'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSubItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import * as icons from 'lucide-react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import * as React from 'react';

export interface NavItem {
  title: string;
  href: string;
  iconName?: keyof typeof icons;
  disabled?: boolean;
  external?: boolean;
  label?: string;
  items?: NavItem[];
  matcher?: (pathname: string, href: string) => boolean;
}

export interface NavItemGroup {
  title?: string;
  iconName?: keyof typeof icons;
  items: NavItem[];
}

interface SidebarNavProps {
  items: NavItemGroup[];
  className?: string;
  /**
   * Accordion mode: opening one group closes the others. Defaults to true.
   */
  singleOpen?: boolean;
}

function checkItemActive(item: NavItem, currentPath: string): boolean {
  if (item.matcher) return item.matcher(currentPath, item.href);
  if (currentPath === item.href) return true;
  if (item.href !== '/' && currentPath.startsWith(`${item.href}/`)) {
    return currentPath.length === item.href.length || currentPath[item.href.length] === '/';
  }
  if (item.items && item.items.length > 0) {
    return item.items.some((sub) => checkItemActive(sub, currentPath));
  }
  return false;
}

function NavItemLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const IconComponent = item.iconName ? (icons[item.iconName] as unknown as React.ComponentType<LucideProps>) : null;
  const { state: sidebarState, isMobile, setState } = useSidebar();
  const currentDisplayState = isMobile ? (sidebarState === "mobile" ? "expanded" : "collapsed") : sidebarState;

  const isActive = checkItemActive(item, pathname);

  // Close sidebar on mobile after navigation
  const handleClick = () => {
    if (isMobile) setState("collapsed");
  };

  const linkContent = (
    <>
      {IconComponent && (
        <IconComponent
          className={cn(
            "h-5 w-5 shrink-0 transition-colors duration-150",
            isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700"
          )}
        />
      )}
      <span
        className={cn(
          "truncate font-semibold text-[14.5px] tracking-[-0.01em]",
          isActive ? "text-white font-bold" : "text-slate-800 group-hover:text-slate-900",
          currentDisplayState === 'collapsed' && !isMobile && 'sr-only'
        )}
      >
        {item.title}
      </span>
      {item.label && currentDisplayState === 'expanded' && (
        <span
          className={cn(
            "ml-auto text-xs px-2 py-0.5 rounded-full font-medium",
            isActive ? "bg-white/20 text-white" : "bg-slate-100 text-muted-foreground"
          )}
        >
          {item.label}
        </span>
      )}
    </>
  );

  return (
    <SidebarMenuButton
      isActive={isActive}
      disabled={item.disabled}
      className={cn(
        "w-full justify-start min-h-[46px] h-12 px-3.5 rounded-xl transition-all duration-200 ease-in-out group",
        isActive
          ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 hover:text-white"
          : "text-slate-700 hover:bg-slate-100/90 hover:text-slate-900 hover:shadow-xs"
      )}
      tooltip={currentDisplayState === 'collapsed' && !isMobile ? item.title : undefined}
      asChild
    >
      <Link
        href={item.href}
        onClick={handleClick}
        target={item.external ? '_blank' : undefined}
        rel={item.external ? 'noopener noreferrer' : undefined}
      >
        {linkContent}
      </Link>
    </SidebarMenuButton>
  );
}

export function SidebarNav({ items, className, singleOpen = true }: SidebarNavProps) {
  const pathname = usePathname() ?? '/';
  const { state: sidebarState, isMobile, setState } = useSidebar();
  const currentDisplayState = isMobile ? (sidebarState === "mobile" ? "expanded" : "collapsed") : sidebarState;

  // Helper to determine which group index/title contains the active route
  const getActiveGroupKey = React.useCallback(
    (currentPath: string): string | null => {
      for (let i = 0; i < items.length; i++) {
        const group = items[i];
        if (!group.title) continue;
        const hasActive = group.items.some((item) => checkItemActive(item, currentPath));
        if (hasActive) return group.title || String(i);
      }
      return null;
    },
    [items]
  );

  // Track open group for singleOpen accordion mode
  const [activeSingleGroup, setActiveSingleGroup] = React.useState<string | null>(() =>
    getActiveGroupKey(pathname)
  );

  // Track open groups for multiOpen mode
  const [openMultiGroups, setOpenMultiGroups] = React.useState<Set<string>>(() => {
    const active = getActiveGroupKey(pathname);
    return active ? new Set([active]) : new Set();
  });

  // Track open sub-items (item.items)
  const [openSubMenus, setOpenSubMenus] = React.useState<Set<string>>(() => {
    const activeSubs = new Set<string>();
    items.forEach((g) => {
      g.items.forEach((item) => {
        if (item.items?.some((sub) => checkItemActive(sub, pathname))) {
          activeSubs.add(item.href);
        }
      });
    });
    return activeSubs;
  });

  // Auto-expand group that contains current route on route change
  React.useEffect(() => {
    const activeGroupKey = getActiveGroupKey(pathname);
    if (activeGroupKey) {
      if (singleOpen) {
        setActiveSingleGroup(activeGroupKey);
      } else {
        setOpenMultiGroups((prev) => {
          if (prev.has(activeGroupKey)) return prev;
          const next = new Set(prev);
          next.add(activeGroupKey);
          return next;
        });
      }
    }

    // Also auto-expand active sub-menus
    items.forEach((g) => {
      g.items.forEach((item) => {
        if (item.items?.some((sub) => checkItemActive(sub, pathname))) {
          setOpenSubMenus((prev) => new Set(prev).add(item.href));
        }
      });
    });
  }, [pathname, getActiveGroupKey, singleOpen, items]);

  if (!items?.length) {
    return null;
  }

  const handleToggleGroup = (groupKey: string) => {
    if (singleOpen) {
      setActiveSingleGroup((prev) => (prev === groupKey ? null : groupKey));
    } else {
      setOpenMultiGroups((prev) => {
        const next = new Set(prev);
        if (next.has(groupKey)) {
          next.delete(groupKey);
        } else {
          next.add(groupKey);
        }
        return next;
      });
    }
  };

  const isGroupExpanded = (groupKey: string): boolean => {
    return singleOpen
      ? activeSingleGroup === groupKey
      : openMultiGroups.has(groupKey);
  };

  const handleToggleSubMenu = (itemHref: string) => {
    setOpenSubMenus((prev) => {
      const next = new Set(prev);
      if (next.has(itemHref)) {
        next.delete(itemHref);
      } else {
        next.add(itemHref);
      }
      return next;
    });
  };

  return (
    <nav className={cn('flex flex-col gap-2.5 px-2.5 py-2 select-none', className)} role="navigation">
      {items.map((group, index) => {
        const groupKey = group.title || `group-${index}`;
        const hasTitle = Boolean(group.title);
        const isExpanded = isGroupExpanded(groupKey);
        const hasActiveItem = group.items.some((item) => checkItemActive(item, pathname));

        // Group Icon: either explicitly provided on group or derived from first child item
        const groupIconName = group.iconName || (group.items.length === 1 ? group.items[0]?.iconName : undefined);
        const GroupIcon = groupIconName ? (icons[groupIconName] as unknown as React.ComponentType<LucideProps>) : null;

        // Group WITHOUT a title (e.g. standalone top-level Dashboard link)
        if (!hasTitle) {
          return (
            <SidebarGroup key={groupKey} className="p-0 mb-1">
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <NavItemLink item={item} pathname={pathname} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        }

        // Group WITH a title -> Large, Spaced, High-Fidelity Collapsible Accordion Group
        return (
          <SidebarGroup key={groupKey} className="p-0">
            {/* Clickable Header for Collapsible Group */}
            <div className="w-full">
              {currentDisplayState !== 'collapsed' ? (
                <button
                  type="button"
                  onClick={() => handleToggleGroup(groupKey)}
                  aria-expanded={isExpanded}
                  aria-controls={`group-menu-${groupKey}`}
                  className={cn(
                    // Increased Size & Padding: 48px touch target height, 14px horizontal px, rounded-xl
                    "w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px] h-12 rounded-xl text-[13px] sm:text-[13.5px] font-bold uppercase tracking-[0.03em] cursor-pointer group transition-all duration-200 ease-in-out border",
                    // Focus ring
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
                    // Active / Expanded / Inactive Hover states with smooth interaction
                    isExpanded
                      ? "text-slate-900 bg-slate-100/90 border-slate-200/80 shadow-xs"
                      : hasActiveItem
                        ? "text-blue-700 bg-blue-50/70 border-blue-200/70 hover:bg-blue-100/80 hover:border-blue-300 hover:shadow-xs"
                        : "text-slate-700 bg-white hover:bg-slate-100/90 hover:text-slate-900 border-transparent hover:border-slate-200/70 hover:shadow-xs"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {GroupIcon && (
                      <GroupIcon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-colors duration-200",
                          isExpanded
                            ? "text-blue-600"
                            : hasActiveItem
                              ? "text-blue-600"
                              : "text-slate-500 group-hover:text-blue-600"
                        )}
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate">{group.title}</span>
                  </div>
                  <span
                    className={cn(
                      "flex items-center justify-center h-6 w-6 rounded-lg ml-auto pl-0.5 transition-all duration-200",
                      isExpanded
                        ? "bg-slate-200/80 text-slate-800"
                        : "text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-100/60 group-hover:translate-x-0.5"
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 transition-transform duration-200" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4 transition-transform duration-200" aria-hidden="true" />
                    )}
                  </span>
                </button>
              ) : (
                /* Minimal divider when sidebar is in icon-only collapsed mode */
                <div className="h-px bg-slate-200/60 my-1.5 mx-2" />
              )}
            </div>

            {/* Smooth Animated Collapsible Content */}
            <div
              id={`group-menu-${groupKey}`}
              role="region"
              aria-label={group.title}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200 ease-in-out",
                isExpanded || (currentDisplayState === 'collapsed' && !isMobile)
                  ? "grid-rows-[1fr] opacity-100 mt-1.5"
                  : "grid-rows-[0fr] opacity-0 pointer-events-none"
              )}
            >
              <div className="overflow-hidden">
                <div className="space-y-1.5 pt-0.5 pb-1">
                  <SidebarMenu className="space-y-1.5">
                    {group.items.map((item) => {
                      const hasSubItems = item.items && item.items.length > 0;
                      const isSubOpen = openSubMenus.has(item.href);

                      return (
                        <React.Fragment key={item.href}>
                          <SidebarMenuItem className="relative">
                            <NavItemLink item={item} pathname={pathname} />

                            {/* Sub-item Chevron toggle if item has nested children */}
                            {hasSubItems && currentDisplayState !== 'collapsed' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleToggleSubMenu(item.href);
                                }}
                                aria-expanded={isSubOpen}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                                title={isSubOpen ? "Collapse sub-menu" : "Expand sub-menu"}
                              >
                                {isSubOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </SidebarMenuItem>

                          {/* Collapsible Sub-menu for item.items */}
                          {hasSubItems && (
                            <div
                              className={cn(
                                "grid transition-[grid-template-rows,opacity] duration-200 ease-in-out",
                                isSubOpen
                                  ? "grid-rows-[1fr] opacity-100 mt-1"
                                  : "grid-rows-[0fr] opacity-0 pointer-events-none"
                              )}
                            >
                              <div className="overflow-hidden">
                                <SidebarMenuSub className="mx-2 my-1 py-2 rounded-xl bg-slate-50 border-l-[3px] border-primary/70 space-y-1">
                                  {item.items!.map((subItem) => {
                                    const SubIconComponent = subItem.iconName
                                      ? (icons[subItem.iconName as keyof typeof icons] as unknown as React.ComponentType<LucideProps>)
                                      : null;
                                    const isSubItemActive = checkItemActive(subItem, pathname);

                                    return (
                                      <SidebarMenuSubItem key={subItem.href}>
                                        <SidebarMenuSubButton
                                          isActive={isSubItemActive}
                                          className={cn(
                                            "min-h-[40px] pl-4 text-xs rounded-lg transition-all",
                                            isSubItemActive &&
                                            "bg-sidebar-accent text-sidebar-accent-foreground font-semibold hover:bg-sidebar-accent/90"
                                          )}
                                          asChild
                                        >
                                          <Link
                                            href={subItem.href}
                                            onClick={() => isMobile && setState("collapsed")}
                                          >
                                            {SubIconComponent && (
                                              <SubIconComponent
                                                className={cn(
                                                  "h-4 w-4 mr-2 flex-shrink-0",
                                                  isSubItemActive && "text-white"
                                                )}
                                              />
                                            )}
                                            <span
                                              className={cn(
                                                "truncate font-medium text-[13px]",
                                                isSubItemActive ? "text-white font-semibold" : "text-slate-800"
                                              )}
                                            >
                                              {subItem.title}
                                            </span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </SidebarMenuSub>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </SidebarMenu>
                </div>
              </div>
            </div>
          </SidebarGroup>
        );
      })}
    </nav>
  );
}
