import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export default function PressPage() {
  return (
    <StaticPage
      title="Press"
      description="News, media resources, and announcements about GharBatai."
      callToAction={{ label: "Contact press", href: "/contact" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
