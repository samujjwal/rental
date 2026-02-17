import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export default function OwnerGuidePage() {
  return (
    <StaticPage
      title="Owner Guide"
      description="Best practices for listing, pricing, and managing your rentals."
      callToAction={{ label: "List an item", href: "/listings/new" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
