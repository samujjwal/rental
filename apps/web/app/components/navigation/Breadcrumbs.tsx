import { Link, useLocation } from "react-router";
import { useMemo } from "react";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "~/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
  homeHref?: string;
  showHome?: boolean;
}

// Route mapping for automatic breadcrumb generation
const ROUTE_MAPPINGS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/renter": "Renter Dashboard",
  "/dashboard/owner": "Owner Dashboard",
  "/dashboard/owner/calendar": "Calendar",
  "/dashboard/owner/earnings": "Earnings",
  "/dashboard/owner/insights": "Insights",
  "/dashboard/owner/performance": "Performance",
  "/bookings": "Bookings",
  "/listings": "Listings",
  "/listings/new": "New Listing",
  "/favorites": "Favorites",
  "/messages": "Messages",
  "/notifications": "Notifications",
  "/reviews": "Reviews",
  "/disputes": "Disputes",
  "/settings": "Settings",
  "/settings/profile": "Profile",
  "/settings/notifications": "Notifications",
  "/settings/security": "Security",
  "/settings/billing": "Billing",
  "/earnings": "Earnings",
  "/payments": "Payments",
  "/insurance": "Insurance",
  "/organizations": "Organizations",
  "/become-owner": "Become an Owner",
  "/search": "Search",
  "/checkout": "Checkout",
  "/admin": "Admin",
  "/admin/analytics": "Analytics",
  "/admin/listings": "Listings",
  "/admin/disputes": "Disputes",
  "/admin/fraud": "Fraud",
  "/admin/system": "System",
  "/help": "Help",
  "/contact": "Contact",
};

function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const paths = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = "";

  for (const segment of paths) {
    currentPath += `/${segment}`;
    
    // Check for exact match first
    let label = ROUTE_MAPPINGS[currentPath];
    
    // If no exact match, check for patterns
    if (!label) {
      // Handle dynamic routes
      if (segment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // UUID pattern - could be listing, booking, etc.
        label = "Details";
      } else if (segment.length > 20) {
        // Likely an ID or slug
        label = "Details";
      } else {
        // Fallback: capitalize and format
        label = segment
          .replace(/-/g, " ")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
      }
    }

    breadcrumbs.push({
      label,
      href: currentPath,
    });
  }

  return breadcrumbs;
}

export function Breadcrumbs({
  items,
  className,
  homeHref = "/",
  showHome = true,
}: BreadcrumbsProps) {
  const location = useLocation();
  
  const breadcrumbs = useMemo(() => {
    if (items) return items;
    return generateBreadcrumbsFromPath(location.pathname);
  }, [items, location.pathname]);

  if (breadcrumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumbs"
      className={cn("flex items-center text-sm text-muted-foreground", className)}
    >
      <ol className="flex items-center flex-wrap gap-1">
        {showHome && (
          <li className="flex items-center">
            <Link
              to={homeHref}
              className="flex items-center hover:text-foreground transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="sr-only">Home</span>
            </Link>
          </li>
        )}
        
        {showHome && breadcrumbs.length > 0 && (
          <li className="flex items-center">
            <ChevronRight className="w-4 h-4 mx-1" />
          </li>
        )}

        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          
          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 mx-1 flex-shrink-0" />
              )}
              
              {isLast || !crumb.href ? (
                <span
                  className={cn(
                    "font-medium",
                    isLast ? "text-foreground" : "text-muted-foreground"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.icon && <crumb.icon className="w-4 h-4 inline mr-1" />}
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.href}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.icon && <crumb.icon className="w-4 h-4 inline mr-1" />}
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Hook for using breadcrumbs with custom overrides
export function useBreadcrumbs(
  overrides?: Partial<Record<string, string>>,
  exclusions?: string[]
): BreadcrumbItem[] {
  const location = useLocation();
  
  return useMemo(() => {
    const crumbs = generateBreadcrumbsFromPath(location.pathname);
    
    return crumbs
      .filter((crumb) => !exclusions?.includes(crumb.href || ""))
      .map((crumb) => ({
        ...crumb,
        label: overrides?.[crumb.href || ""] || crumb.label,
      }));
  }, [location.pathname, overrides, exclusions]);
}

export default Breadcrumbs;
