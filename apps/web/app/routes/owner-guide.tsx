import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Owner Guide | GharBatai Rentals" },
    { name: "description", content: "Best practices for listing and managing your rentals on GharBatai" },
  ];
};

export default function OwnerGuidePage() {
  const { t } = useTranslation();

  return (
    <StaticPage
      title={t("pages.ownerGuide.title")}
      description={t("pages.ownerGuide.description")}
      callToAction={{ label: t("pages.ownerGuide.listAnItem"), href: "/listings/new" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
