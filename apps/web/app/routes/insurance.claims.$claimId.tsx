import { Link, useParams, useNavigate } from "react-router";
import type { MetaFunction } from "react-router";
import { useState, useEffect } from "react";
import {
  Shield, AlertCircle, Clock, CheckCircle, X, ArrowLeft,
  FileText, Image, Video, ExternalLink, Calendar,
} from "lucide-react";
import { RouteErrorBoundary, UnifiedButton } from "~/components/ui";
import { useAuthStore } from "~/lib/store/auth";
import { insuranceApi, type InsuranceClaim, type ClaimStatus } from "~/lib/api/insurance";
import { formatCurrency } from "~/lib/utils";
import { getActionableErrorMessage, ApiErrorType } from "~/lib/api-error";

export const meta: MetaFunction = () => [
  { title: "Claim Details | GharBatai Rentals" },
  { name: "description", content: "View your insurance claim details and status updates." },
];

const CLAIM_STATUS_CONFIG: Record<ClaimStatus, { label: string; className: string; icon: React.ElementType }> = {
  SUBMITTED: { label: "Submitted", className: "text-blue-700 bg-blue-100", icon: FileText },
  UNDER_REVIEW: { label: "Under Review", className: "text-yellow-700 bg-yellow-100", icon: Clock },
  APPROVED: { label: "Approved", className: "text-green-700 bg-green-100", icon: CheckCircle },
  DENIED: { label: "Denied", className: "text-red-700 bg-red-100", icon: X },
  PAID: { label: "Paid", className: "text-emerald-700 bg-emerald-100", icon: CheckCircle },
};

const STATUS_ORDER: ClaimStatus[] = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PAID"];

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  DAMAGE: "Property Damage",
  THEFT: "Theft",
  LIABILITY: "Liability",
  OTHER: "Other",
};

const EVIDENCE_ICONS: Record<string, React.ElementType> = {
  IMAGE: Image,
  VIDEO: Video,
  DOCUMENT: FileText,
};

function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const cfg = CLAIM_STATUS_CONFIG[status] ?? { label: status, className: "text-gray-600 bg-gray-100", icon: Shield };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-full font-medium ${cfg.className}`}>
      <Icon className="w-4 h-4" />
      {cfg.label}
    </span>
  );
}

/** Visual step-by-step status tracker (only for non-denied claims). */
function ClaimProgressTracker({ status }: { status: ClaimStatus }) {
  if (status === "DENIED") return null;
  const currentIdx = STATUS_ORDER.indexOf(status);
  return (
    <div className="flex items-center gap-0">
      {STATUS_ORDER.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div
              className={`flex flex-col items-center ${active ? "text-primary" : done ? "text-emerald-600" : "text-muted-foreground/40"}`}
            >
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                  done
                    ? active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-emerald-600 bg-emerald-600 text-white"
                    : "border-muted-foreground/30 bg-background"
                }`}
              >
                {done && !active ? <CheckCircle className="w-4 h-4" /> : idx + 1}
              </div>
              <span className="text-[10px] mt-1 text-center w-16 leading-tight">
                {CLAIM_STATUS_CONFIG[step].label}
              </span>
            </div>
            {idx < STATUS_ORDER.length - 1 && (
              <div
                className={`flex-1 h-0.5 mt-[-18px] mx-1 ${idx < currentIdx ? "bg-emerald-500" : "bg-muted-foreground/20"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function InsuranceClaimDetailPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [claim, setClaim] = useState<InsuranceClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/auth/login?redirect=/insurance/claims/${claimId}`);
      return;
    }
    if (!claimId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    insuranceApi
      .getClaim(claimId)
      .then((c) => { if (!cancelled) setClaim(c); })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            getActionableErrorMessage(
              err,
              "Failed to load claim. It may not exist or you may not have permission to view it.",
              {
                [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
                [ApiErrorType.TIMEOUT_ERROR]: "Loading the claim timed out. Try again.",
              }
            )
          );
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, claimId, navigate, reloadKey]);

  const retryLoad = () => setReloadKey((prev) => prev + 1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-2xl px-4 py-10">
        {/* Back link */}
        <Link
          to="/insurance/claims"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Claims
        </Link>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 w-1/2 bg-muted rounded" />
            <div className="h-5 w-1/3 bg-muted rounded" />
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
              <div className="h-4 w-2/3 bg-muted rounded" />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="font-medium text-red-700">{error}</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <UnifiedButton variant="outline" onClick={retryLoad}>
                Retry
              </UnifiedButton>
              <Link to="/insurance/claims">
                <UnifiedButton variant="ghost">
                  Return to claims list
                </UnifiedButton>
              </Link>
            </div>
          </div>
        )}

        {/* Claim detail */}
        {!loading && !error && claim && (
          <div className="space-y-6">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">
                  {INCIDENT_TYPE_LABELS[claim.incidentType] ?? claim.incidentType} Claim
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Filed {new Date(claim.submittedAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
              <ClaimStatusBadge status={claim.status} />
            </div>

            {/* Progress tracker */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
                Claim Progress
              </h2>
              {claim.status === "DENIED" ? (
                <div className="flex items-center gap-2 text-red-700">
                  <X className="w-5 h-5" />
                  <p className="text-sm font-medium">This claim was denied.</p>
                </div>
              ) : (
                <ClaimProgressTracker status={claim.status} />
              )}
            </div>

            {/* Financial summary */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
                Claim Amount
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Claimed</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(claim.claimAmount)}</p>
                </div>
                {claim.approvedAmount != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Approved</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(claim.approvedAmount)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Incident details */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
                Incident Details
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Incident date:</span>
                  <span className="font-medium">
                    {new Date(claim.incidentDate).toLocaleDateString("en-IN", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </span>
                </div>
                {claim.resolvedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">Resolved:</span>
                    <span className="font-medium">
                      {new Date(claim.resolvedAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm text-foreground leading-relaxed">{claim.description}</p>
                </div>
              </div>
            </div>

            {/* Evidence */}
            {claim.evidence.length > 0 && (
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
                  Evidence ({claim.evidence.length})
                </h2>
                <ul className="space-y-2">
                  {claim.evidence.map((item) => {
                    const Icon = EVIDENCE_ICONS[item.type] ?? FileText;
                    return (
                      <li key={item.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.description ?? item.type.toLowerCase()}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.type}</p>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 flex-shrink-0"
                          aria-label="View evidence"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Status timeline */}
            {claim.timeline.length > 0 && (
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
                  Activity Timeline
                </h2>
                <ol className="relative border-l border-border ml-3 space-y-4">
                  {[...claim.timeline].reverse().map((entry, idx) => {
                    const cfg = CLAIM_STATUS_CONFIG[entry.status];
                    const Icon = cfg?.icon ?? Shield;
                    return (
                      <li key={idx} className="ml-4">
                        <div
                          className={`absolute -left-2 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${
                            cfg ? cfg.className.replace("text-", "bg-").split(" ")[0] : "bg-muted"
                          }`}
                        >
                          <Icon className="w-2.5 h-2.5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {cfg?.label ?? entry.status}
                          </p>
                          {entry.note && (
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(entry.date).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                            {entry.updatedBy && ` · ${entry.updatedBy}`}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Policy link if available */}
            {claim.policy && (
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Associated Policy
                </h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{claim.policy.listing?.title ?? "Insurance Policy"}</p>
                    <p className="text-xs text-muted-foreground">
                      #{claim.policy.policyNumber} · {claim.policy.type} · Coverage: {formatCurrency(claim.policy.coverageAmount)}
                    </p>
                  </div>
                  <Link
                    to="/insurance"
                    className="text-sm text-primary hover:underline underline-offset-2 flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
