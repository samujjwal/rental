import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Press | GharBatai Rentals" },
    { name: "description", content: "News and media resources about GharBatai" },
  ];
};

export default function PressPage() {
  const { t } = useTranslation();

  return (
    <StaticPage
      title={t("pages.press.title")}
      description={t("pages.press.description")}
      callToAction={{ label: t("pages.press.contactPress"), href: "/contact" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
