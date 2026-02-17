import { Link, Outlet } from "react-router";

/**
 * Shared layout for authentication routes (login, signup, forgot-password, reset-password).
 * Provides a centered card layout with branding.
 */
export function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-muted">
      {/* Minimal header with logo */}
      <header className="py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <Link
            to="/"
            className="text-2xl font-bold text-primary hover:text-primary/90 transition-colors"
          >
            GharBatai
          </Link>
        </div>
      </header>

      {/* Centered content area */}
      <main className="flex-1 flex items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      {/* Minimal footer */}
      <footer className="py-6 px-4 text-center text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} GharBatai.{" "}
          <Link to="/terms" className="hover:text-foreground underline">
            Terms
          </Link>{" "}
          &middot;{" "}
          <Link to="/privacy" className="hover:text-foreground underline">
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}
