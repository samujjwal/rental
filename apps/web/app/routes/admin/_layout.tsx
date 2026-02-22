import type { LoaderFunctionArgs } from "react-router";
import { Outlet } from "react-router";
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

export default function AdminLayout() {
  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-md focus:no-underline"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
        <AdminNavigation />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-6 w-full sm:w-[calc(100%-280px)] outline-none"
        >
          <Outlet />
        </main>
      </div>
    </>
  );
}

