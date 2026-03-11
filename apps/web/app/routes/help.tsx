import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { RouteErrorBoundary } from "~/components/ui";
import { Search, MessageCircle, Shield, CreditCard, Package, AlertTriangle } from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "Help Center | GharBatai Rentals" },
    { name: "description", content: "Find answers, guides, and troubleshooting resources." },
  ];
};

const categoryDefs = [
  { icon: Package, titleKey: "pages.help.catListingsTitle", descKey: "pages.help.catListingsDesc", link: "/owner-guide" },
  { icon: CreditCard, titleKey: "pages.help.catPaymentsTitle", descKey: "pages.help.catPaymentsDesc", link: "/payments" },
  { icon: Shield, titleKey: "pages.help.catSafetyTitle", descKey: "pages.help.catSafetyDesc", link: "/safety" },
  { icon: AlertTriangle, titleKey: "pages.help.catDisputesTitle", descKey: "pages.help.catDisputesDesc", link: "/disputes" },
  { icon: MessageCircle, titleKey: "pages.help.catMessagingTitle", descKey: "pages.help.catMessagingDesc", link: "/messages" },
  { icon: Search, titleKey: "pages.help.catSearchTitle", descKey: "pages.help.catSearchDesc", link: "/search" },
];

const faqKeys = [
  { qKey: "pages.help.faq1Q", aKey: "pages.help.faq1A" },
  { qKey: "pages.help.faq2Q", aKey: "pages.help.faq2A" },
  { qKey: "pages.help.faq3Q", aKey: "pages.help.faq3A" },
  { qKey: "pages.help.faq4Q", aKey: "pages.help.faq4A" },
  { qKey: "pages.help.faq5Q", aKey: "pages.help.faq5A" },
  { qKey: "pages.help.faq6Q", aKey: "pages.help.faq6A" },
];

export default function HelpPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">{t("pages.help.title")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("pages.help.subtitle")}
          </p>
        </div>

        {/* Topic categories */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoryDefs.map((cat) => (
            <Link
              key={cat.titleKey}
              to={cat.link}
              className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <cat.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold group-hover:text-primary">{t(cat.titleKey)}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t(cat.descKey)}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* FAQs */}
        <div className="mt-16">
          <h2 className="text-2xl font-semibold">{t("pages.help.faq")}</h2>
          <div className="mt-6 divide-y rounded-xl border bg-card">
            {faqKeys.map((faq) => (
              <details key={faq.qKey} className="group px-6 py-4">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                  {t(faq.qKey)}
                  <span className="ml-2 text-muted-foreground transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{t(faq.aKey)}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="mt-12 rounded-xl border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">{t("pages.help.stillNeedHelp")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("pages.help.supportTeamMessage")}
          </p>
          <div className="mt-4">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {t("pages.help.contactSupport")}
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary">{t("common.backToHome")}</Link>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
