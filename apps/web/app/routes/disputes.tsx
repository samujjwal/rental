import type { MetaFunction } from "react-router";
import { useLoaderData, Link, useSearchParams, redirect } from "react-router";
import {
  AlertTriangle,
  Clock,
  MessageCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Package,
  ChevronRight,
  Banknote,
  HelpCircle,
  FileWarning,
  Star,
  CreditCard,
} from "lucide-react";
import { disputesApi } from "~/lib/api/disputes";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  Badge,
  RouteErrorBoundary,
  Pagination,
} from "~/components/ui";
import { UnifiedButton } from "~/components/ui";
import { cn } from "~/lib/utils";
import { StatCardSkeleton, Skeleton } from "~/components/ui/skeleton";
import { getUser } from "~/utils/auth";
import { useTranslation } from "react-i18next";

export const meta: MetaFunction = () => {
  return [
    { title: "My Disputes | GharBatai Rentals" },
    { name: "description", content: "View and manage your disputes" },
  ];
};

// Extended dispute interface with UI-specific properties
interface DisputeExtended {
  id: string;
  bookingId: string;
  title?: string | null;
  description: string;
  amount?: number | null;
  createdAt: string;
  updatedAt: string;
  type: "PROPERTY_DAMAGE" | "MISSING_ITEMS" | "CONDITION_MISMATCH" | "REFUND_REQUEST" | "PAYMENT_ISSUE" | "OTHER";
  status: "OPEN" | "UNDER_REVIEW" | "INVESTIGATING" | "RESOLVED" | "CLOSED";
  booking: {
    id: string;
    listing: {
      id: string;
      title: string;
    };
    renter?: {
      id: string;
      email?: string;
    };
  };
  initiator: {
    id: string;
    email?: string;
  };
  defendant: {
    id: string;
    email?: string;
  };
  _count?: {
    responses?: number;
  };
}

export async function clientLoader({ request }: { request: Request }) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status");
  const allowedStatuses = new Set(["OPEN", "UNDER_REVIEW", "INVESTIGATING", "RESOLVED", "CLOSED"]);
  const status = rawStatus && allowedStatuses.has(rawStatus) ? rawStatus : undefined;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = 10;

  try {
    const response = await disputesApi.getMyDisputes({ status, page, limit });
    const disputes = (Array.isArray(response.disputes) ? response.disputes : []) as DisputeExtended[];
    const total = typeof response.total === "number" ? response.total : disputes.length;
    const totalPages = Math.ceil(total / limit);
    
    // Calculate stats
    const stats = {
      total,
      open: disputes.filter((d) => d.status === "OPEN").length,
      inProgress: disputes.filter((d) => d.status === "UNDER_REVIEW" || d.status === "INVESTIGATING").length,
      resolved: disputes.filter((d) => d.status === "RESOLVED" || d.status === "CLOSED").length,
    };

    return { disputes, stats, page, totalPages, error: null };
  } catch (error: unknown) {
    return {
      disputes: [],
      stats: { total: 0, open: 0, inProgress: 0, resolved: 0 },
      page: 1,
      totalPages: 1,
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load disputes",
    };
  }
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "secondary" | "destructive" | "success" | "warning" | "default";
    icon: typeof Clock;
  }
> = {
  OPEN: { label: "disputes.open", variant: "warning", icon: AlertTriangle },
  UNDER_REVIEW: { label: "disputes.underReview", variant: "default", icon: Clock },
  INVESTIGATING: { label: "disputes.investigating", variant: "default", icon: Clock },
  RESOLVED: { label: "disputes.resolved", variant: "success", icon: CheckCircle },
  CLOSED: { label: "disputes.closed", variant: "secondary", icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  PROPERTY_DAMAGE: "disputes.propertyDamage",
  MISSING_ITEMS: "disputes.missingItems",
  CONDITION_MISMATCH: "disputes.conditionMismatch",
  REFUND_REQUEST: "disputes.refundRequest",
  PAYMENT_ISSUE: "disputes.paymentIssue",
  OTHER: "disputes.other",
};

const TYPE_ICON_CONFIG: Record<string, { icon: typeof Package; color: string; bg: string }> = {
  PROPERTY_DAMAGE:    { icon: FileWarning, color: "text-destructive",    bg: "bg-destructive/10" },
  MISSING_ITEMS:      { icon: Package,     color: "text-warning",         bg: "bg-warning/10" },
  CONDITION_MISMATCH: { icon: Star,        color: "text-warning",         bg: "bg-warning/10" },
  REFUND_REQUEST:     { icon: Banknote,    color: "text-success",         bg: "bg-success/10" },
  PAYMENT_ISSUE:      { icon: CreditCard,  color: "text-destructive",     bg: "bg-destructive/10" },
  OTHER:              { icon: HelpCircle,  color: "text-muted-foreground",bg: "bg-muted" },
};
const safeDateLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown date" : format(date, "MMM d, yyyy");
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};

function DisputeCard({ dispute }: { dispute: DisputeExtended }) {
  const { t } = useTranslation();
  const statusConfig = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.OPEN;
  const StatusIcon = statusConfig.icon;
  const disputeId = safeText(dispute.id);
  const disputeTitle = safeText(dispute.title) || (TYPE_LABELS[dispute.type] ? t(TYPE_LABELS[dispute.type]) : t("disputes.dispute"));
  const listingTitle = safeText(dispute.booking?.listing?.title, t("common.listing"));
  const disputeDescription = safeText(dispute.description, t("disputes.noDescription"));
  const typeIconConfig = TYPE_ICON_CONFIG[dispute.type] ?? TYPE_ICON_CONFIG.OTHER;
  const TypeIcon = typeIconConfig.icon;

  return (
    <Link to={disputeId ? `/disputes/${disputeId}` : "/disputes"}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-6">
          <div className="flex gap-4">
            {/* Type icon with colored background */}
            <div className={cn("w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center", typeIconConfig.bg)}>
              <TypeIcon className={cn("w-7 h-7", typeIconConfig.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-semibold text-foreground line-clamp-1">
                    {disputeTitle}
                  </h3>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {listingTitle}
              </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={statusConfig.variant}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {t(statusConfig.label)}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {safeDateLabel(dispute.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  {t("disputes.messagesCount", { count: dispute._count?.responses ?? 0 })}
                </span>
                {dispute.amount != null && dispute.amount > 0 && (
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Banknote className="w-4 h-4 text-muted-foreground" />
                    {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(dispute.amount)}
                  </span>
                )}
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {disputeDescription}
              </p>

            </div>

            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 self-center" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DisputesPage() {
  const { t } = useTranslation();
  const { disputes, stats, page, totalPages, error } = useLoaderData<typeof clientLoader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get("status");

  const handleStatusFilter = (status: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    params.delete("page"); // reset page when filtering
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("disputes.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("disputes.fileFromBooking", "To file a new dispute, open a booking and click \"File a Dispute\".")}</p>
          </div>
          <Link to="/bookings">
            <UnifiedButton variant="outline" leftIcon={<AlertTriangle className="w-4 h-4" />}>
              {t("disputes.fileNewDispute", "File a Dispute")}
            </UnifiedButton>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">{t("common.total")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-warning">{stats.open}</p>
              <p className="text-sm text-muted-foreground">{t("disputes.open")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.inProgress}</p>
              <p className="text-sm text-muted-foreground">{t("disputes.inProgress")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{stats.resolved}</p>
              <p className="text-sm text-muted-foreground">{t("disputes.resolved")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleStatusFilter(null)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              !currentStatus
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {t("common.all")}
          </button>
          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
            <button
              key={status}
              onClick={() => handleStatusFilter(status)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                currentStatus === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t(config.label)}
            </button>
          ))}
        </div>

        {/* Disputes List */}
        <div className="space-y-4">
          {disputes.length > 0 ? (
            disputes.map((dispute: DisputeExtended) => (
              <DisputeCard key={dispute.id} dispute={dispute} />
            ))
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">{t("disputes.empty")}</h3>
                <p className="text-muted-foreground mb-4">
                  {currentStatus
                    ? t("disputes.noStatusDisputes", { status: t(STATUS_CONFIG[currentStatus]?.label || "") })
                    : t("disputes.emptyDefaultDesc")}
                </p>
                <Link to="/bookings">
                  <UnifiedButton variant="outline">{t("disputes.viewBookings")}</UnifiedButton>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          className="mt-6"
        />

        {/* Help Section */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t("disputes.needToOpen")}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t("disputes.needToOpenDesc")}
                </p>
                <Link to="/bookings" className="text-sm text-primary font-medium hover:text-primary/80">
                  {t("disputes.viewMyBookings")}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

