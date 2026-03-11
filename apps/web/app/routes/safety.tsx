import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Safety Guidelines | GharBatai Rentals" },
    { name: "description", content: "Safety best practices for renters and owners on GharBatai" },
  ];
};

export default function SafetyPage() {
  const { t } = useTranslation();

  return (
    <StaticPage
      title={t("pages.safety.title")}
      description={t("pages.safety.description")}
      callToAction={{ label: t("pages.safety.getSupport"), href: "/help" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
