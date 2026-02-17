import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export default function CookiesPage() {
  return (
    <StaticPage
      title="Cookies Policy"
      description="Understand how cookies help us improve your rental experience."
      callToAction={{ label: "Privacy policy", href: "/privacy" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
