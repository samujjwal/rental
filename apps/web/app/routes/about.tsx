import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { RouteErrorBoundary } from "~/components/ui";
import { Shield, Users, Heart, Globe } from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "About Us | GharBatai Rentals" },
    { name: "description", content: "Learn about GharBatai and our mission to make renting easy and trustworthy." },
  ];
};

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("pages.about.title")}</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("pages.about.subtitle")}
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{t("pages.about.communityFirst")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("pages.about.communityFirstDesc")}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{t("pages.about.verifiedSecure")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("pages.about.verifiedSecureDesc")}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{t("pages.about.sustainability")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("pages.about.sustainabilityDesc")}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{t("pages.about.forEveryone")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("pages.about.forEveryoneDesc")}
            </p>
          </div>
        </div>

        <div className="mt-16 rounded-xl border bg-card p-8 text-center">
          <h2 className="text-2xl font-semibold">{t("pages.about.readyToGetStarted")}</h2>
          <p className="mt-2 text-muted-foreground">
            {t("pages.about.joinCommunity")}
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              to="/search"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {t("pages.about.browseListings")}
            </Link>
            <Link
              to="/become-owner"
              className="inline-flex items-center justify-center rounded-lg border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-accent"
            >
              {t("pages.about.becomeOwner")}
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
