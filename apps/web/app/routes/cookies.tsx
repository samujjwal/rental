import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Cookie Policy | GharBatai Rentals" },
    { name: "description", content: "How GharBatai uses cookies to improve your rental experience" },
  ];
};

export default function CookiesPage() {
  const { t } = useTranslation();

  return (
    <StaticPage
      title={t("pages.cookies.title")}
      description={t("pages.cookies.description")}
      callToAction={{ label: t("pages.cookies.privacyPolicy"), href: "/privacy" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
