"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface SidebarContextValue {
  state: "expanded" | "collapsed" | "mobile"
  setState: React.Dispatch<React.SetStateAction<"expanded" | "collapsed">>
  toggleSidebar: () => void
  isMobile: boolean
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(undefined)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

interface SidebarProviderProps {
  children: React.ReactNode
  defaultOpen?: boolean
}

export function SidebarProvider({ children, defaultOpen = true }: SidebarProviderProps) {
  const isMobile = useIsMobile()
  const [state, setState] = React.useState<"expanded" | "collapsed">(defaultOpen && !isMobile ? "expanded" : "collapsed")

  React.useEffect(() => {
    if (isMobile) {
      setState("collapsed")
    } else {
      setState(defaultOpen ? "expanded" : "collapsed")
    }
  }, [isMobile, defaultOpen])

  const toggleSidebar = () => {
    setState(prev => prev === "expanded" ? "collapsed" : "expanded")
  }

  const contextValue: SidebarContextValue = {
    state: isMobile ? (state === "expanded" ? "mobile" : "collapsed") : state,
    setState,
    toggleSidebar,
    isMobile,
  }

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  )
}

const sidebarVariants = cva(
  "fixed inset-y-0 left-0 z-40 flex h-full flex-col transition-all duration-300 ease-in-out",
  {
    variants: {
      variant: {
        default: "border-r bg-background",
        sidebar: "border-r border-sidebar-border bg-background text-sidebar-foreground",
      },
      state: {
        expanded: "w-64",
        collapsed: "w-16",
        mobile: "w-64",
      },
      collapsible: {
        true: "",
        false: "",
        icon: ""
      }
    },
    compoundVariants: [
      {
        collapsible: "icon",
        state: "collapsed",
        className: "w-16",
      },
    ],
    defaultVariants: {
      variant: "default",
      state: "expanded",
    },
  }
)

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof sidebarVariants> {
  collapsible?: boolean | 'icon';
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ className, variant, collapsible, children, ...props }, ref) => {
    const { state: sidebarState, isMobile, toggleSidebar } = useSidebar()

    let currentVisualState: "expanded" | "collapsed" | "mobile" = "expanded";
    if (isMobile) {
      currentVisualState = sidebarState === "mobile" ? "mobile" : "collapsed";
    } else {
      currentVisualState = sidebarState as "expanded" | "collapsed";
    }

    return (
      <>
        {isMobile && currentVisualState === "mobile" && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity no-print"
            onClick={toggleSidebar}
          />
        )}
        <aside
          ref={ref}
          className={cn(
            sidebarVariants({ variant, state: currentVisualState, collapsible: collapsible as boolean }),
            "shadow-sm",
            isMobile && currentVisualState === "mobile" && "shadow-2xl",
            isMobile && currentVisualState === "collapsed" && "-translate-x-full",
            className)}
          data-collapsible={collapsible === "icon" ? "icon" : collapsible}
          {...props}
        >
          {children}
        </aside>
      </>
    )
  }
)
Sidebar.displayName = "Sidebar"


const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { state, isMobile } = useSidebar();
    const currentDisplayState = isMobile ? (state === "mobile" ? "expanded" : "collapsed") : state;
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between px-3 py-4 border-b",
          currentDisplayState === "collapsed" && !isMobile && "justify-center px-2",
          className
        )}
        {...props}
      />
    );
  }
);
SidebarHeader.displayName = "SidebarHeader";


const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 overflow-y-auto overflow-x-hidden py-2 scroll-smooth", className)} {...props} />
  )
)
SidebarContent.displayName = "SidebarContent"


const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { state, isMobile } = useSidebar();
    const currentDisplayState = isMobile ? (state === "mobile" ? "expanded" : "collapsed") : state;
    return (
      <div
        ref={ref}
        className={cn(
          "mt-auto border-t p-3",
          currentDisplayState === "collapsed" && !isMobile && "p-2",
          className
        )}
        {...props}
      />
    )
  }
)
SidebarFooter.displayName = "SidebarFooter"


const SidebarTrigger = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
    const { toggleSidebar, state, isMobile } = useSidebar()
    const effectiveState = isMobile ? (state === "mobile" ? "expanded" : "collapsed") : state;

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={ref}
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", className)}
              onClick={toggleSidebar}
              aria-label={effectiveState === "expanded" ? "Collapse sidebar" : "Expand sidebar"}
              {...props}
            >
              {children || (effectiveState === "expanded" ? <ChevronLeft /> : <ChevronRight />)}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={5}>
            {effectiveState === "expanded" ? "Collapse" : "Expand"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
)
SidebarTrigger.displayName = "SidebarTrigger"


const SidebarInset = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { state, isMobile } = useSidebar();

    const marginLeftClass = isMobile
      ? ""
      : state === "collapsed"
        ? "sm:ml-16"
        : "sm:ml-64";

    return (
      <div
        ref={ref}
        className={cn("flex flex-1 flex-col transition-all duration-300 ease-in-out", marginLeftClass, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SidebarInset.displayName = "SidebarInset";


// Menu Components
const SidebarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { state, isMobile } = useSidebar()
    const currentDisplayState = isMobile ? (state === "mobile" ? "expanded" : "collapsed") : state;

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col mb-1",
          currentDisplayState === "expanded" ? "gap-0.5 px-2 py-1" : "gap-1 px-1 py-1 items-center",
          className
        )}
        {...props}
      />
    )
  }
)
SidebarGroup.displayName = "SidebarGroup"


const SidebarGroupLabel = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const { state, isMobile } = useSidebar()
    const currentDisplayState = isMobile ? (state === "mobile" ? "expanded" : "collapsed") : state;
    if (currentDisplayState === "collapsed" && !isMobile) return null

    return (
      <p
        ref={ref}
        className={cn(
          "px-2 py-1.5 text-sm font-bold text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </p>
    )
  }
)
SidebarGroupLabel.displayName = "SidebarGroupLabel"


const SidebarMenu = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("space-y-0.5", className)} {...props} />
  )
)
SidebarMenu.displayName = "SidebarMenu"


const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn("", className)} {...props} />
  )
)
SidebarMenuItem.displayName = "SidebarMenuItem"


interface SidebarMenuButtonProps extends ButtonProps {
  isActive?: boolean;
  tooltip?: React.ReactNode;
}

const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ className, variant = "ghost", size = "default", isActive, tooltip, children, asChild, ...props }, ref) => {
    const { state, isMobile, toggleSidebar } = useSidebar();
    const currentDisplayState = isMobile ? (state === "mobile" ? "expanded" : "collapsed") : state;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isMobile && state === "mobile") {
        toggleSidebar();
      }
      if (props.onClick) {
        props.onClick(e);
      }
    };

    const buttonElement = (
      <Button
        ref={ref}
        variant="ghost"
        size={currentDisplayState === "collapsed" && !isMobile ? "icon" : size}
        className={cn(
          "w-full justify-start gap-3 rounded-lg text-[15px] font-semibold transition-colors",
          "text-muted-foreground hover:text-foreground hover:bg-accent",
          currentDisplayState === "collapsed" && !isMobile && "h-10 w-10 justify-center p-0",
          isActive && "bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700",
          !isActive && "hover:bg-accent",
          className
        )}
        {...props}
        asChild={asChild}
        onClick={handleClick}
      >
        {children}
      </Button>
    );

    if (currentDisplayState === "collapsed" && !isMobile && tooltip) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{buttonElement}</TooltipTrigger>
            <TooltipContent
              side="right"
              sideOffset={8}
              className="text-xs font-medium"
            >
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return buttonElement;
  }
);
SidebarMenuButton.displayName = "SidebarMenuButton";


const SidebarMenuSub = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { state, isMobile } = useSidebar()
    const currentDisplayState = isMobile ? (state === "mobile" ? "expanded" : "collapsed") : state;
    if (currentDisplayState === "collapsed" && !isMobile) return null

    return (
      <div
        ref={ref}
        className={cn(
          "ml-4 mt-0.5 space-y-0.5 border-l pl-3",
          className
        )}
        {...props}
      />
    )
  }
)
SidebarMenuSub.displayName = "SidebarMenuSub"


const SidebarMenuSubItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn("", className)} {...props} />
  )
)
SidebarMenuSubItem.displayName = "SidebarMenuSubItem"

const SidebarMenuSubButton = React.forwardRef<HTMLButtonElement, ButtonProps & { isActive?: boolean }>(
  ({ className, variant = "ghost", size = "sm", isActive, children, asChild, ...props }, ref) => {
    const { state, isMobile, toggleSidebar } = useSidebar();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isMobile && state === "mobile") {
        toggleSidebar();
      }
      if (props.onClick) {
        props.onClick(e);
      }
    };

    return (
      <Button
        ref={ref}
        variant="ghost"
        size={size}
        className={cn(
          "w-full justify-start gap-2 text-sm font-medium rounded-md transition-colors",
          "text-muted-foreground hover:text-foreground hover:bg-accent",
          isActive && "bg-blue-50 text-blue-600 font-bold hover:bg-blue-100",
          className
        )}
        {...props}
        asChild={asChild}
        onClick={handleClick}
      >
        {children}
      </Button>
    );
  }
)
SidebarMenuSubButton.displayName = "SidebarMenuSubButton"


export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
}