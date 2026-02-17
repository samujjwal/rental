import type { MetaFunction } from "react-router";
import { redirect } from "react-router";
import { getUser } from "~/utils/auth";
import { RouteErrorBoundary } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Earnings | GharBatai Rentals" },
    { name: "description", content: "Track your rental income and earnings." },
  ];
};

export async function clientLoader({ request }: { request: Request }) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login?redirect=/earnings");
  }
  if (user.role === "owner" || user.role === "admin") {
    return redirect("/dashboard/owner/earnings");
  }
  // Renters don't have earnings — redirect to their dashboard
  return redirect("/dashboard/renter");
}

export default function EarningsPage() {
  // This page always redirects; fallback in case loader doesn't fire
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Redirecting...</h1>
        <p className="text-muted-foreground">Taking you to your earnings dashboard.</p>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary />;
}
