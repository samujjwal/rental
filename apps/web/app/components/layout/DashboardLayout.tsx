import { Link, Outlet, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { Bell, LogOut, User, Search } from "lucide-react";
import { getUser } from "~/utils/auth";

/**
 * Shared layout for all authenticated dashboard pages.
 * Provides a top navigation bar and wraps child routes in a consistent shell.
 * The sidebar is rendered by individual dashboard pages (renter/owner) since
 * they have different nav sections.
 */
export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    const url = new URL(request.url);
    return redirect(`/auth/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }
  return { user };
}

export default function DashboardLayout() {
  const { user } = useLoaderData<typeof clientLoader>();
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top nav bar */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link
              to="/dashboard"
              className="text-xl font-bold text-primary hover:text-primary/90 transition-colors"
            >
              GharBatai
            </Link>

            {/* Quick search */}
            <Link
              to="/search"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border rounded-lg hover:bg-muted transition-colors"
            >
              <Search className="w-4 h-4" />
              <span>Search rentals…</span>
            </Link>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              <Link
                to="/notifications"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
              </Link>

              <div className="flex items-center gap-2 text-sm">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {user.profilePhotoUrl ? (
                    <img
                      src={user.profilePhotoUrl}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4 text-primary" />
                  )}
                </div>
                <span className="hidden md:inline text-foreground font-medium">
                  {displayName}
                </span>
              </div>

              <Link
                to="/auth/logout"
                className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Child route content (individual dashboards provide their own sidebar) */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function HydrateFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
}
