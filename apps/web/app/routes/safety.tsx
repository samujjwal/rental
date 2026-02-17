import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export default function SafetyPage() {
  return (
    <StaticPage
      title="Safety"
      description="Safety guidelines and best practices for renters and owners."
      callToAction={{ label: "Get support", href: "/help" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
