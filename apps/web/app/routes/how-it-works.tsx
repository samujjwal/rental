import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "How It Works | GharBatai Rentals" },
    { name: "description", content: "Discover, book, and enjoy rentals with GharBatai" },
  ];
};

export default function HowItWorksPage() {
  const { t } = useTranslation();

  return (
    <StaticPage
      title={t("pages.howItWorks.title")}
      description={t("pages.howItWorks.description")}
      callToAction={{ label: t("pages.howItWorks.startSearching"), href: "/search" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
