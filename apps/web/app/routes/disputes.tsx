import type { MetaFunction } from "react-router";
import { useLoaderData, Link, useSearchParams, Form, useActionData, useNavigation } from "react-router";
import { useState } from "react";
import {
  AlertTriangle,
  Clock,
  MessageCircle,
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  DollarSign,
  Package,
  ChevronRight,
} from "lucide-react";
import { disputesApi } from "~/lib/api/disputes";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "~/components/ui";
import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";

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
  description: string;
  amount?: number;
  evidence?: any[];
  createdAt: string;
  updatedAt: string;
  type: "DAMAGE" | "LATE_RETURN" | "CANCELLATION" | "QUALITY" | "PAYMENT" | "OTHER";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  title: string;
  booking: {
    id: string;
    listing: {
      id: string;
      title: string;
      image: string;
    };
    startDate: string;
    endDate: string;
    totalAmount: number;
  };
  initiator: {
    id: string;
    firstName: string;
    lastName: string | null;
  };
  respondent: {
    id: string;
    firstName: string;
    lastName: string | null;
  };
  messages: number;
  resolution?: {
    type: string;
    amount?: number;
  };
}

export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;

  try {
    const disputes = await disputesApi.getMyDisputes({ status }) as DisputeExtended[];
    
    // Calculate stats
    const stats = {
      total: disputes.length,
      open: disputes.filter((d) => d.status === "OPEN").length,
      inProgress: disputes.filter((d) => d.status === "IN_PROGRESS").length,
      resolved: disputes.filter((d) => d.status === "RESOLVED" || d.status === "CLOSED").length,
    };

    return { disputes, stats, error: null };
  } catch (error: any) {
    return {
      disputes: [],
      stats: { total: 0, open: 0, inProgress: 0, resolved: 0 },
      error: error?.message || "Failed to load disputes",
    };
  }
}

const STATUS_CONFIG: Record<string, { label: string; variant: string; icon: typeof Clock }> = {
  OPEN: { label: "Open", variant: "warning", icon: AlertTriangle },
  IN_PROGRESS: { label: "In Progress", variant: "default", icon: Clock },
  RESOLVED: { label: "Resolved", variant: "success", icon: CheckCircle },
  CLOSED: { label: "Closed", variant: "secondary", icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  DAMAGE: "Item Damage",
  LATE_RETURN: "Late Return",
  CANCELLATION: "Cancellation",
  QUALITY: "Quality Issue",
  PAYMENT: "Payment Issue",
  OTHER: "Other",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
};

function DisputeCard({ dispute }: { dispute: DisputeExtended }) {
  const statusConfig = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.OPEN;
  const StatusIcon = statusConfig.icon;

  return (
    <Link to={`/disputes/${dispute.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-6">
          <div className="flex gap-4">
            {/* Listing Image */}
            <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
              {dispute.booking.listing.image ? (
                <img
                  src={dispute.booking.listing.image}
                  alt={dispute.booking.listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-semibold text-foreground line-clamp-1">
                    {dispute.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {dispute.booking.listing.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={statusConfig.variant as any}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusConfig.label}
                  </Badge>
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium", PRIORITY_COLORS[dispute.priority])}>
                    {dispute.priority}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(dispute.createdAt), "MMM d, yyyy")}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  {dispute.messages} messages
                </span>
                <span className="px-2 py-0.5 bg-muted rounded text-xs">
                  {TYPE_LABELS[dispute.type] || dispute.type}
                </span>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {dispute.description}
              </p>

              {dispute.resolution && (
                <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                  <span className="font-medium">Resolution:</span> {dispute.resolution.type}
                  {dispute.resolution.amount && ` - $${dispute.resolution.amount.toFixed(2)}`}
                </div>
              )}
            </div>

            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 self-center" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DisputesPage() {
  const { disputes, stats, error } = useLoaderData<typeof clientLoader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get("status");

  const handleStatusFilter = (status: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
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
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">My Disputes</h1>
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-warning">{stats.open}</p>
              <p className="text-sm text-muted-foreground">Open</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.inProgress}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
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
            All
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
              {config.label}
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
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Disputes</h3>
                <p className="text-muted-foreground mb-4">
                  {currentStatus
                    ? `No ${STATUS_CONFIG[currentStatus]?.label.toLowerCase() || ""} disputes found.`
                    : "You don't have any disputes. Great job maintaining good rental relationships!"}
                </p>
                <Link to="/bookings">
                  <Button variant="outlined">View Bookings</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Help Section */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Need to Open a Dispute?</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  If you're having issues with a rental, you can open a dispute from your booking page.
                  Our support team will help mediate and find a fair resolution.
                </p>
                <Link to="/bookings" className="text-sm text-primary font-medium hover:text-primary/80">
                  View My Bookings →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
