import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export default function HowItWorksPage() {
  return (
    <StaticPage
      title="How It Works"
      description="Discover, book, and enjoy rentals with secure payments and trusted reviews."
      callToAction={{ label: "Start searching", href: "/search" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
