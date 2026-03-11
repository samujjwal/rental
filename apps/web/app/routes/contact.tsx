import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { StaticPage } from "~/components/StaticPage";
import { RouteErrorBoundary } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Contact Us | GharBatai Rentals" },
    { name: "description", content: "Reach out to GharBatai for support, partnerships, or inquiries" },
  ];
};

export default function ContactPage() {
  const { t } = useTranslation();

  return (
    <StaticPage
      title={t("pages.contact.title")}
      description={t("pages.contact.description")}
      callToAction={{ label: t("pages.contact.browseListings"), href: "/search" }}
    />
  );
}
export { RouteErrorBoundary as ErrorBoundary };
