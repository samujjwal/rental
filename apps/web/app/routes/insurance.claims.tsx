import { Link, useNavigate } from "react-router";
import type { MetaFunction } from "react-router";
import { useState, useEffect } from "react";
import { Shield, AlertCircle, Clock, CheckCircle, X, ChevronRight, FileText, Plus } from "lucide-react";
import { RouteErrorBoundary } from "~/components/ui";
import { useAuthStore } from "~/lib/store/auth";
import { insuranceApi, type InsuranceClaim, type ClaimStatus } from "~/lib/api/insurance";
import { formatCurrency } from "~/lib/utils";

export const meta: MetaFunction = () => [
  { title: "My Claims | GharBatai Rentals" },
  { name: "description", content: "View and manage your insurance claims." },
];

const CLAIM_STATUS_CONFIG: Record<ClaimStatus, { label: string; className: string; icon: React.ElementType }> = {
  SUBMITTED: { label: "Submitted", className: "text-blue-700 bg-blue-100", icon: FileText },
  UNDER_REVIEW: { label: "Under Review", className: "text-yellow-700 bg-yellow-100", icon: Clock },
  APPROVED: { label: "Approved", className: "text-green-700 bg-green-100", icon: CheckCircle },
  DENIED: { label: "Denied", className: "text-red-700 bg-red-100", icon: X },
  PAID: { label: "Paid", className: "text-emerald-700 bg-emerald-100", icon: CheckCircle },
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  DAMAGE: "Property Damage",
  THEFT: "Theft",
  LIABILITY: "Liability",
  OTHER: "Other",
};

function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const cfg = CLAIM_STATUS_CONFIG[status] ?? { label: status, className: "text-gray-600 bg-gray-100", icon: Shield };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

type FilterStatus = ClaimStatus | "ALL";

export default function InsuranceClaimsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth/login?redirect=/insurance/claims");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    insuranceApi
      .getMyClaims({ limit: 50 })
      .then((res) => { if (!cancelled) setClaims(res.data ?? []); })
      .catch(() => { if (!cancelled) setError("Failed to load claims. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, navigate]);

  const filteredClaims = filterStatus === "ALL"
    ? claims
    : claims.filter((c) => c.status === filterStatus);

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "SUBMITTED", label: "Submitted" },
    { value: "UNDER_REVIEW", label: "Under Review" },
    { value: "APPROVED", label: "Approved" },
    { value: "DENIED", label: "Denied" },
    { value: "PAID", label: "Paid" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Insurance Claims</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track submitted claims and their resolution status.
            </p>
          </div>
          <Link
            to="/insurance"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Shield className="w-4 h-4" />
            My Policies
          </Link>
        </div>

        {/* Status filter tabs */}
        {!loading && !error && claims.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {filterOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterStatus(value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  filterStatus === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-accent"
                }`}
              >
                {label}
                {value !== "ALL" && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({claims.filter((c) => c.status === value).length})
                  </span>
                )}
                {value === "ALL" && (
                  <span className="ml-1.5 text-xs opacity-70">({claims.length})</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-5 animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-1/3 bg-muted rounded" />
                    <div className="h-3 w-1/2 bg-muted rounded" />
                    <div className="h-3 w-1/4 bg-muted rounded" />
                  </div>
                  <div className="h-5 w-20 bg-muted rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              className="mt-3 text-sm text-red-600 underline underline-offset-2 hover:text-red-800"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && claims.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No insurance claims yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Claims can be filed through your active insurance policies when an incident occurs.
            </p>
            <Link
              to="/insurance"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Shield className="w-4 h-4" />
              View My Policies
            </Link>
          </div>
        )}

        {/* Filtered empty state */}
        {!loading && !error && claims.length > 0 && filteredClaims.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
            <p className="text-sm">No claims with status "{filterOptions.find(o => o.value === filterStatus)?.label}".</p>
            <button
              className="mt-2 text-sm text-primary hover:underline"
              onClick={() => setFilterStatus("ALL")}
            >
              Show all claims
            </button>
          </div>
        )}

        {/* Claims list */}
        {!loading && !error && filteredClaims.length > 0 && (
          <div className="space-y-3">
            {filteredClaims.map((claim) => (
              <Link
                key={claim.id}
                to={`/insurance/claims/${claim.id}`}
                className="block rounded-xl border bg-card p-5 hover:bg-accent/40 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        {INCIDENT_TYPE_LABELS[claim.incidentType] ?? claim.incidentType}
                      </span>
                      <ClaimStatusBadge status={claim.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {claim.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Incident: {new Date(claim.incidentDate).toLocaleDateString()}
                      </span>
                      <span>
                        Filed: {new Date(claim.submittedAt).toLocaleDateString()}
                      </span>
                      {claim.resolvedAt && (
                        <span>
                          Resolved: {new Date(claim.resolvedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-base font-bold text-foreground">
                      {formatCurrency(claim.claimAmount)}
                    </p>
                    {claim.approvedAmount != null && (
                      <p className="text-xs text-emerald-600 font-medium">
                        Approved: {formatCurrency(claim.approvedAmount)}
                      </p>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-10 text-center text-sm text-muted-foreground">
          <Link to="/insurance" className="hover:text-primary">
            ← Back to Insurance
          </Link>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
