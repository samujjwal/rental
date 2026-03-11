import type { LoaderFunctionArgs } from "react-router";
import { Outlet, Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, Home } from "lucide-react";
import AdminNavigation from "~/components/admin/AdminNavigation";
import AdminErrorBoundary from "~/components/admin/AdminErrorBoundary";
import { requireAdmin } from "~/utils/auth";

export function ErrorBoundary() {
  return <AdminErrorBoundary />;
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return null;
}

/** Converts a URL slug to a human-readable label */
function slugToLabel(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Breadcrumb auto-generated from the current URL path */
function AdminBreadcrumb() {
  const location = useLocation();
  // Build crumbs from path segments: /admin/system/logs → ["admin", "system", "logs"]
  const segments = location.pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = i === 0 ? "Admin" : slugToLabel(seg);
    return { href, label };
  });

  // Only show breadcrumb when we're deeper than /admin
  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <Link to="/admin" className="flex items-center gap-1 hover:text-foreground transition-colors">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link to={crumb.href} className="hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const { t } = useTranslation();
  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-md focus:no-underline"
      >
        {t("admin.skipToMainContent")}
      </a>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
        <AdminNavigation />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-6 w-full sm:w-[calc(100%-280px)] outline-none"
        >
          <AdminBreadcrumb />
          <Outlet />
        </main>
      </div>
    </>
  );
}

