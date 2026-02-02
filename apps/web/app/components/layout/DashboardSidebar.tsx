/* eslint-disable react-refresh/only-export-components */

import { Link, useLocation } from "react-router";
import { cn } from "~/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Heart,
  MessageCircle,
  Star,
  Settings,
  Plus,
  Package,
  DollarSign,
  TrendingUp,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

interface DashboardSidebarProps {
  sections: SidebarSection[];
  className?: string;
}

export function DashboardSidebar({ sections, className }: DashboardSidebarProps) {
  const location = useLocation();

  return (
    <aside className={cn("w-64 shrink-0", className)}>
      <div className="sticky top-24 bg-card border rounded-lg p-4">
        <nav className="space-y-6">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {section.title && (
                <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {section.title}
                </h3>
              )}
              <ul className="space-y-1">
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
          ))}
        </nav>
      </div>
    </aside>
  );
}

// Predefined navigation configs for different dashboard types
export const renterNavItems: SidebarSection[] = [
  {
    items: [
      { href: "/dashboard/renter", label: "Dashboard", icon: LayoutDashboard },
      { href: "/bookings", label: "My Bookings", icon: Calendar },
      { href: "/favorites", label: "Favorites", icon: Heart },
      { href: "/messages", label: "Messages", icon: MessageCircle },
      { href: "/reviews", label: "Reviews", icon: Star },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    items: [
      { href: "/become-owner", label: "Become an Owner", icon: Plus },
    ],
  },
];

export const ownerNavItems: SidebarSection[] = [
  {
    items: [
      { href: "/dashboard/owner", label: "Dashboard", icon: LayoutDashboard },
      { href: "/listings", label: "Listings", icon: Package },
      { href: "/bookings", label: "Bookings", icon: Calendar },
      { href: "/dashboard/owner/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/dashboard/owner/earnings", label: "Earnings", icon: DollarSign },
      { href: "/messages", label: "Messages", icon: MessageCircle },
      { href: "/reviews", label: "Reviews", icon: Star },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/dashboard/owner/performance", label: "Performance", icon: TrendingUp },
      { href: "/dashboard/owner/insights", label: "Insights", icon: BarChart3 },
    ],
  },
];

