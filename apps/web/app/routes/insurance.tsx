import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { RouteErrorBoundary, UnifiedButton } from "~/components/ui";
import { Shield, FileCheck, AlertCircle, CheckCircle, Clock, X } from "lucide-react";
import { useAuthStore } from "~/lib/store/auth";
import { insuranceApi, type InsurancePolicy } from "~/lib/api/insurance";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";
import { formatCurrency } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Insurance | GharBatai Rentals" },
    { name: "description", content: "Learn how GharBatai protects renters and owners with flexible coverage options." },
  ];
};

const coverageTypeDefs = [
  { icon: Shield, titleKey: "pages.insurance.propertyProtection", descKey: "pages.insurance.propertyProtectionDesc" },
  { icon: FileCheck, titleKey: "pages.insurance.liabilityCoverage", descKey: "pages.insurance.liabilityCoverageDesc" },
  { icon: AlertCircle, titleKey: "pages.insurance.securityDeposits", descKey: "pages.insurance.securityDepositsDesc" },
];

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  ACTIVE: { label: "Active", className: "text-green-700 bg-green-100", icon: CheckCircle },
  PENDING: { label: "Pending", className: "text-yellow-700 bg-yellow-100", icon: Clock },
  EXPIRED: { label: "Expired", className: "text-gray-600 bg-gray-100", icon: Clock },
  CANCELLED: { label: "Cancelled", className: "text-red-700 bg-red-100", icon: X },
  CLAIMED: { label: "Claimed", className: "text-blue-700 bg-blue-100", icon: Shield },
};

function getInsurancePoliciesError(error: unknown): string {
  return getActionableErrorMessage(error, "Failed to load policies. Please try again.", {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading policies timed out. Try again.",
  });
}

function PolicyStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "text-gray-600 bg-gray-100", icon: Shield };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default function InsurancePage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setPoliciesLoading(true);
    setPoliciesError(null);
    insuranceApi.getMyPolicies({ limit: 10 })
      .then((res) => {
        if (!cancelled) {
          setPolicies(res.data ?? []);
          setPoliciesError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPoliciesError(getInsurancePoliciesError(error));
        }
      })
      .finally(() => { if (!cancelled) setPoliciesLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, reloadKey]);

  const retryPoliciesLoad = () => setReloadKey((previous) => previous + 1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">{t("pages.insurance.title")}</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("pages.insurance.subtitle")}
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {coverageTypeDefs.map((type) => (
            <div key={type.titleKey} className="rounded-xl border bg-card p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <type.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{t(type.titleKey)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(type.descKey)}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold">{t("pages.insurance.forOwners")}</h2>
            <div className="mt-4 rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">{t("pages.insurance.uploadInsuranceDocs")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.insurance.uploadInsuranceDocsDesc")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">{t("pages.insurance.setSecurityDeposits")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.insurance.setSecurityDepositsDesc")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">{t("pages.insurance.damageClaims")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.insurance.damageClaimsDesc")}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">{t("pages.insurance.forRenters")}</h2>
            <div className="mt-4 rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">{t("pages.insurance.securePayments")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.insurance.securePaymentsDesc")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">{t("pages.insurance.disputeResolution")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.insurance.disputeResolutionDesc")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">{t("pages.insurance.refundProtection")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.insurance.refundProtectionDesc")}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 rounded-xl border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">{t("pages.insurance.coverageQuestion")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("pages.insurance.coverageQuestionDesc")}
          </p>
          <div className="mt-4 flex justify-center gap-4">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {t("pages.insurance.contactSupport")}
            </Link>
            <Link
              to="/help"
              className="inline-flex items-center justify-center rounded-lg border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-accent"
            >
              {t("pages.insurance.helpCenter")}
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary">{t("common.backToHome")}</Link>
        </div>

        {/* My Policies — authenticated users only */}
        {isAuthenticated && (
          <div className="mt-16">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">{t("pages.insurance.myPolicies", "My Insurance Policies")}</h2>
            </div>
            {policiesError && !policiesLoading && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-red-700">{policiesError}</p>
                      <p className="mt-1 text-xs text-red-600">
                        {t("pages.insurance.retryPoliciesLoad", "Try again to refresh your latest policy coverage.")}
                      </p>
                    </div>
                  </div>
                  <UnifiedButton variant="outline" onClick={retryPoliciesLoad}>
                    {t("errors.tryAgain", "Try Again")}
                  </UnifiedButton>
                </div>
              </div>
            )}
            {policiesLoading ? (
              <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
                {t("common.loading", "Loading policies…")}
              </div>
            ) : policies.length === 0 && !policiesError ? (
              <div className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
                <Shield className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">{t("pages.insurance.noPolicies", "No insurance policies yet")}</p>
                <p className="text-xs mt-1">{t("pages.insurance.noPoliciesDesc", "Policies are created automatically when you book a listing with insurance requirements.")}</p>
              </div>
            ) : policies.length > 0 ? (
              <div className="rounded-xl border bg-card overflow-hidden">
                {policies.map((policy, idx) => (
                  <div
                    key={policy.id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${idx > 0 ? "border-t border-border" : ""}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{policy.listing?.title ?? t("pages.insurance.unknownListing", "Listing")}</span>
                        <PolicyStatusBadge status={policy.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {policy.type} · #{policy.policyNumber} · {t("pages.insurance.coverage", "Coverage:")} {formatCurrency(policy.coverageAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(policy.startDate).toLocaleDateString()} – {new Date(policy.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(policy.premiumAmount)}</p>
                      <p className="text-xs text-muted-foreground">{t("pages.insurance.premium", "Premium")}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
