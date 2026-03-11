import {
  LayoutDashboard,
  Calendar,
  Heart,
  MessageCircle,
  Star,
  Settings,
  Plus,
  Package,
  CalendarDays,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  AlertTriangle,
} from "lucide-react";
import type { SidebarSection } from "~/components/layout";

// ============================================================================
// Single source of truth for dashboard navigation items.
// Imported by DashboardSidebar, dashboard.renter, and dashboard.owner routes.
// ============================================================================

export const renterNavSections: SidebarSection[] = [
  {
    items: [
      { href: "/dashboard/renter", label: "Dashboard", icon: LayoutDashboard },
      { href: "/bookings", label: "My Bookings", icon: Calendar },
      { href: "/favorites", label: "Favorites", icon: Heart },
      { href: "/messages", label: "Messages", icon: MessageCircle },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/disputes", label: "Disputes", icon: AlertTriangle },
      { href: "/reviews", label: "Reviews", icon: Star },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    items: [{ href: "/become-owner", label: "Become an Owner", icon: Plus }],
  },
];

export const ownerNavSections: SidebarSection[] = [
  {
    items: [
      { href: "/dashboard/owner", label: "Dashboard", icon: LayoutDashboard },
      { href: "/listings", label: "Listings", icon: Package },
      { href: "/bookings", label: "Bookings", icon: Calendar },
      {
        href: "/dashboard/owner/calendar",
        label: "Calendar",
        icon: CalendarDays,
      },
      { href: "/dashboard/owner/earnings", label: "Earnings", icon: Banknote },
      { href: "/messages", label: "Messages", icon: MessageCircle },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/disputes", label: "Disputes", icon: AlertTriangle },
      { href: "/reviews", label: "Reviews", icon: Star },
      { href: "/organizations", label: "Organizations", icon: Building2 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/dashboard/owner/performance", label: "Performance", icon: BarChart3 },
      { href: "/dashboard/owner/insights", label: "Insights", icon: BarChart3 },
    ],
  },
];

export type PortalNavRole = "renter" | "owner";

export function resolvePortalNavRole(role: unknown): PortalNavRole {
  return role === "owner" || role === "admin" ? "owner" : "renter";
}

export function getPortalNavSections(role: PortalNavRole): SidebarSection[] {
  return role === "owner" ? ownerNavSections : renterNavSections;
}
