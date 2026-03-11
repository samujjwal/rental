/**
 * Universal authenticated-app layout.
 * Wraps every non-home, non-auth, non-marketing route with a consistent
 * sticky top navigation bar. Auth state comes from the client store — no
 * server redirect here; individual protected routes still check auth in
 * their own clientLoader.
 *
 * All nav logic (unread counts, avatar dropdown, etc.) lives in AppNav so
 * home.tsx can reuse the same component without duplicating it.
 */
import { Outlet } from "react-router";
import { RouteErrorBoundary } from "~/components/ui";
import { AppNav } from "~/components/layout/AppNav";

export const ErrorBoundary = RouteErrorBoundary;

export default function AppLayout() {
  return (
    <div className="bg-background">
      <AppNav />
      <Outlet />
    </div>
  );
}
