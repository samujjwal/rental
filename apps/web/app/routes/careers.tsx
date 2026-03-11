import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { RouteErrorBoundary } from "~/components/ui";
import { Code2, Palette, BarChart3, Headphones } from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "Careers | GharBatai Rentals" },
    { name: "description", content: "Join our team and help build a more connected rental economy." },
  ];
};

const departments = [
  { icon: Code2, nameKey: "pages.careers.deptEngineering", descKey: "pages.careers.deptEngineeringDesc" },
  { icon: Palette, nameKey: "pages.careers.deptDesign", descKey: "pages.careers.deptDesignDesc" },
  { icon: BarChart3, nameKey: "pages.careers.deptProduct", descKey: "pages.careers.deptProductDesc" },
  { icon: Headphones, nameKey: "pages.careers.deptSupport", descKey: "pages.careers.deptSupportDesc" },
];

export default function CareersPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("pages.careers.title")}</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("pages.careers.subtitle")}
          </p>
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-semibold text-center">{t("pages.careers.ourTeams")}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {departments.map((dept) => (
              <div key={dept.nameKey} className="rounded-xl border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <dept.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{t(dept.nameKey)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(dept.descKey)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 rounded-xl border bg-card p-8 text-center">
          <h2 className="text-2xl font-semibold">{t("pages.careers.noOpenings")}</h2>
          <p className="mt-2 text-muted-foreground">
            {t("pages.careers.noOpeningsDesc")}
          </p>
          <div className="mt-6">
            <a
              href="mailto:careers@gharbatai.com"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {t("pages.careers.sendResume")}
            </a>
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
