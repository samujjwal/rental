import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export default function ContactPage() {
  return (
    <StaticPage
      title="Contact Us"
      description="Reach out to our team for support, partnerships, or general inquiries."
      callToAction={{ label: "Browse listings", href: "/search" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
