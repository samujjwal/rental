
import { Link, useLocation } from "react-router";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import {
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "~/components/theme";

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
  defaultCollapsed?: boolean;
  collapsible?: boolean;
}

interface DashboardSidebarProps {
  sections: SidebarSection[];
  className?: string;
}

export function DashboardSidebar({ sections, className }: DashboardSidebarProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Track collapsed state for each section
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    sections.forEach((section, index) => {
      if (section.collapsible && section.defaultCollapsed) {
        initial[index] = true;
      }
    });
    return initial;
  });

  const toggleSection = (index: number) => {
    setCollapsedSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close on escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navContent = (
    <nav className="space-y-6">
      {sections.map((section, sectionIndex) => {
        const isCollapsed = collapsedSections[sectionIndex];
        const hasTitle = !!section.title;
        const isCollapsible = section.collapsible;
        
        return (
          <div key={sectionIndex}>
            {hasTitle && (
              <button
                onClick={() => isCollapsible && toggleSection(sectionIndex)}
                className={cn(
                  "w-full flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wider mb-2",
                  isCollapsible && "cursor-pointer hover:text-foreground transition-colors"
                )}
                disabled={!isCollapsible}
              >
                <span className="text-muted-foreground">{section.title}</span>
                {isCollapsible && (
                  <span className="text-muted-foreground">
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </span>
                )}
              </button>
            )}
            <ul className={cn("space-y-1", isCollapsed && "hidden")}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href || 
                  (item.href !== "/dashboard/renter" && item.href !== "/dashboard/owner" && location.pathname.startsWith(item.href));
                
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span className="flex items-center">
                        <Icon className="w-5 h-5 mr-3" />
                        {item.label}
                      </span>
                      {item.badge !== undefined && (
                        <span
                          className={cn(
                            "px-2 py-0.5 text-xs rounded-full",
                            isActive
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-primary/10 text-primary"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {sectionIndex < sections.length - 1 && (
              <div className="border-b my-4" />
            )}
          </div>
        );
      })}
      {/* Theme Toggle */}
      <div className="border-t pt-4 px-3">
        <ThemeToggle size="sm" />
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside
            className="absolute inset-y-0 left-0 w-72 bg-card border-r shadow-xl animate-in"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between border-b p-4">
              <span className="text-sm font-semibold text-foreground">{t("common.navigation")}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">{navContent}</div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn("hidden w-64 shrink-0 lg:block", className)}>
        <div className="sticky top-24 bg-card border rounded-lg p-4">
          {navContent}
        </div>
      </aside>
    </>
  );
}

// Re-export from the central navigation config for backwards compatibility
export { renterNavSections as renterNavItems, ownerNavSections as ownerNavItems } from "~/config/navigation";
