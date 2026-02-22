
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "react-router";
import { useState } from "react";
import {
  AlertTriangle,
  XCircle,
  User,
  Calendar,
  DollarSign,
  ChevronRight,
  Search,
  Loader2,
} from "lucide-react";
import { adminApi, type AdminDispute } from "~/lib/api/admin";
import { disputesApi, type DisputeDetail } from "~/lib/api/disputes";
import { UnifiedButton , RouteErrorBoundary } from "~/components/ui";
import { requireAdmin } from "~/utils/auth";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const response = record.response as Record<string, unknown> | undefined;
    const data = response?.data as Record<string, unknown> | undefined;
    const message = data?.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return "Unknown error";
}

export const meta: MetaFunction = () => {
  return [
    { title: "Dispute Management | Admin" },
    { name: "description", content: "Manage platform disputes and resolutions" },
  ];
};

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeDateLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString();
};
const safeLower = (value: unknown): string =>
  (typeof value === "string" ? value : "").toLowerCase();
const humanize = (value: unknown): string =>
  String(value || "").replace(/_/g, " ").trim() || "unknown";
const shortId = (value: unknown): string => safeLower(value).slice(0, 8) || "unknown";
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  try {
    const disputesRes = await adminApi.getDisputes({ limit: 50 });
    return {
      disputes: disputesRes.disputes ?? [],
      pagination: {
        total: disputesRes.total,
        page: disputesRes.page,
        limit: disputesRes.limit,
      },
      error: null,
    };
  } catch (error: unknown) {
    return {
      disputes: [],
      pagination: null,
      error: getErrorMessage(error) || "Failed to load disputes",
    };
  }
}

export async function clientAction({ request }: ActionFunctionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const disputeId = String(formData.get("disputeId") ?? "").trim();
  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (intent === "set-status") {
    const status = String(formData.get("status") ?? "").trim().toUpperCase();
    const allowedStatuses = new Set([
      "OPEN",
      "UNDER_REVIEW",
      "INVESTIGATING",
      "RESOLVED",
      "CLOSED",
      "DISMISSED",
    ]);
    if (!UUID_PATTERN.test(disputeId)) {
      return { success: false, error: "Dispute ID is required" };
    }
    if (!allowedStatuses.has(status)) {
      return { success: false, error: "Invalid dispute status" };
    }
    try {
      await adminApi.updateDisputeStatus(disputeId, status);
      return { success: true, message: "Dispute updated successfully" };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) || "Failed to update dispute" };
    }
  }

  if (intent === "assign-to-me") {
    if (!UUID_PATTERN.test(disputeId)) {
      return { success: false, error: "Dispute ID is required" };
    }
    try {
      await adminApi.assignDispute(disputeId);
      return { success: true, message: "Dispute assigned for review" };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) || "Failed to assign dispute" };
    }
  }

  if (intent === "add-note") {
    const adminNote = String(formData.get("adminNote") ?? "").trim();
    if (!UUID_PATTERN.test(disputeId)) {
      return { success: false, error: "Dispute ID is required" };
    }
    if (adminNote.length < 3) {
      return { success: false, error: "Admin note must be at least 3 characters" };
    }
    try {
      await adminApi.updateDispute(disputeId, { adminNotes: adminNote });
      return { success: true, message: "Admin note added" };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) || "Failed to add admin note" };
    }
  }

  if (intent === "send-message") {
    const message = String(formData.get("message") ?? "").trim();
    if (!UUID_PATTERN.test(disputeId)) {
      return { success: false, error: "Dispute ID is required" };
    }
    if (message.length < 3) {
      return { success: false, error: "Message must be at least 3 characters" };
    }
    try {
      await disputesApi.respondToDispute(disputeId, message);
      return { success: true, message: "Message sent to dispute thread" };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) || "Failed to send message" };
    }
  }

  if (intent === "resolve-dispute") {
    const resolution = String(formData.get("resolution") ?? "").trim();
    const resolvedAmountRaw = String(formData.get("resolvedAmount") ?? "").trim();
    const resolvedAmount =
      resolvedAmountRaw.length > 0 && !Number.isNaN(Number(resolvedAmountRaw))
        ? Number(resolvedAmountRaw)
        : undefined;
    if (!UUID_PATTERN.test(disputeId)) {
      return { success: false, error: "Dispute ID is required" };
    }
    if (resolution.length < 3) {
      return { success: false, error: "Resolution note must be at least 3 characters" };
    }
    if (resolvedAmount !== undefined && resolvedAmount < 0) {
      return { success: false, error: "Resolved amount cannot be negative" };
    }
    try {
      await adminApi.resolveDispute(disputeId, {
        resolution,
        notes: resolution,
        resolvedAmount,
      });
      return { success: true, message: "Dispute resolved successfully" };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) || "Failed to resolve dispute" };
    }
  }

  return { success: false, error: "Unknown action" };
}

type DisputeStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "INVESTIGATING"
  | "RESOLVED"
  | "CLOSED"
  | "DISMISSED";
type DisputePriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export default function AdminDisputesPage() {
  const { disputes, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<AdminDispute | null>(null);
  const [selectedDisputeDetail, setSelectedDisputeDetail] = useState<DisputeDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  const openDisputeDetails = async (dispute: AdminDispute) => {
    setSelectedDispute(dispute);
    setSelectedDisputeDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const detail = await disputesApi.getDisputeById(dispute.id);
      setSelectedDisputeDetail(detail);
    } catch (detailLoadError: unknown) {
      setDetailError(getErrorMessage(detailLoadError));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDisputeDetails = () => {
    setSelectedDispute(null);
    setSelectedDisputeDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  // Filter disputes
  const query = safeLower(searchQuery);
  const availableTypes = Array.from(
    new Set(disputes.map((dispute: AdminDispute) => dispute.type).filter(Boolean)),
  );
  const filteredDisputes = disputes.filter((dispute: AdminDispute) => {
    const matchesStatus = selectedStatus === "all" || dispute.status === selectedStatus;
    const matchesType = selectedType === "all" || dispute.type === selectedType;
    const matchesSearch = query === "" ||
      safeLower(dispute.id).includes(query) ||
      safeLower(dispute.initiator?.email).includes(query);
    return matchesStatus && matchesType && matchesSearch;
  });

  // Count by status
  const statusCounts = {
    all: disputes.length,
    OPEN: disputes.filter((d: AdminDispute) => d.status === "OPEN").length,
    UNDER_REVIEW: disputes.filter((d: AdminDispute) => d.status === "UNDER_REVIEW").length,
    INVESTIGATING: disputes.filter((d: AdminDispute) => d.status === "INVESTIGATING").length,
    RESOLVED: disputes.filter((d: AdminDispute) => d.status === "RESOLVED").length,
  };

  const getPriorityColor = (priority: DisputePriority) => {
    switch (priority) {
      case "URGENT": return "text-red-700 bg-red-100";
      case "HIGH": return "text-red-600 bg-red-100";
      case "MEDIUM": return "text-yellow-600 bg-yellow-100";
      case "LOW": return "text-green-600 bg-green-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusColor = (status: DisputeStatus) => {
    switch (status) {
      case "OPEN": return "text-red-600 bg-red-100";
      case "UNDER_REVIEW": return "text-blue-600 bg-blue-100";
      case "INVESTIGATING": return "text-blue-600 bg-blue-100";
      case "RESOLVED": return "text-green-600 bg-green-100";
      case "CLOSED": return "text-gray-600 bg-gray-100";
      case "DISMISSED": return "text-gray-600 bg-gray-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "ITEM_DAMAGED": return "🔧";
      case "ITEM_NOT_RECEIVED": return "📦";
      case "ITEM_NOT_AS_DESCRIBED": return "❌";
      case "UNAUTHORIZED_CHARGES": return "💳";
      case "OWNER_UNRESPONSIVE": return "🔇";
      default: return "⚠️";
    }
  };


  if (error && disputes.length === 0) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
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
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-muted-foreground hover:text-foreground">
                ← Admin Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-foreground">Dispute Management</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Success/Error Messages */}
        {actionData?.success && (
          <div
            className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700"
            data-testid="dispute-action-success"
          >
            {actionData.message}
          </div>
        )}
        {actionData?.error && (
          <div
            className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive"
            data-testid="dispute-action-error"
          >
            {actionData.error}
          </div>
        )}

        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: "all", label: "All" },
            { key: "OPEN", label: "Open" },
            { key: "UNDER_REVIEW", label: "Under Review" },
            { key: "INVESTIGATING", label: "Investigating" },
            { key: "RESOLVED", label: "Resolved" },
          ].map((tab) => (
            <button
              key={tab.key}
              data-testid={
                tab.key === "OPEN"
                  ? "filter-open"
                  : tab.key === "UNDER_REVIEW"
                    ? "filter-in-progress"
                    : tab.key === "RESOLVED"
                      ? "filter-resolved"
                      : undefined
              }
              onClick={() => setSelectedStatus(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStatus === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border hover:bg-muted"
              }`}
            >
              {tab.label} ({statusCounts[tab.key as keyof typeof statusCounts]})
            </button>
          ))}
        </div>

        {/* Type Filter */}
        <div className="mb-6">
          <div className="max-w-md">
            <label htmlFor="dispute-type-filter" className="block text-sm font-medium mb-2">
              Filter by type
            </label>
            <select
              id="dispute-type-filter"
              data-testid="type-filter"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background"
            >
              <option value="all">All types</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by dispute ID or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background"
            />
          </div>
        </div>

        {/* Disputes List */}
        <div className="space-y-4" data-testid="disputes-list">
          {filteredDisputes.map((dispute: AdminDispute) => (
            <div
              key={dispute.id}
              data-testid="dispute-card"
              className="bg-card border rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => void openDisputeDetails(dispute)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {dispute.priority ? (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(
                          dispute.priority as DisputePriority
                        )}`}
                      >
                        {dispute.priority}
                      </span>
                    ) : null}
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(dispute.status as DisputeStatus)}`}>
                      {humanize(dispute.status)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      #{shortId(dispute.id)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{getTypeIcon(dispute.type)}</span>
                    <h3 className="font-semibold text-foreground">
                      {humanize(dispute.type)}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {safeText(dispute.initiator?.firstName, "User")} • {safeText(dispute.initiator?.email, "Unknown")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {safeDateLabel(dispute.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {safeNumber(dispute.amount) > 0
                        ? `$${safeNumber(dispute.amount).toFixed(2)}`
                        : "—"}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {safeText(dispute.description) ||
                      safeText(dispute.reason, "No details provided")}
                  </p>

                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <span>
                      Booking: {safeText(dispute.booking?.listing?.title, "Listing")}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          ))}

          {filteredDisputes.length === 0 && (
            <div className="text-center py-12 bg-card border rounded-xl">
              <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No disputes found</p>
            </div>
          )}
        </div>
      </div>

      {/* Dispute Detail Modal */}
      {selectedDispute && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-testid="dispute-details-overlay"
        >
          <div
            className="bg-card border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            data-testid="dispute-details"
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Dispute #{shortId(selectedDispute.id)}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {selectedDispute.priority ? (
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(
                        selectedDispute.priority as DisputePriority
                      )}`}
                    >
                      {selectedDispute.priority}
                    </span>
                  ) : null}
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(
                      selectedDispute.status as DisputeStatus
                    )}`}
                  >
                    {humanize(selectedDispute.status)}
                  </span>
                </div>
              </div>
              <button
                data-testid="close-dispute-details"
                onClick={closeDisputeDetails}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {detailLoading && (
                <div className="p-3 bg-muted/40 rounded-lg text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading dispute details...
                </div>
              )}
              {detailError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {detailError}
                </div>
              )}

              {/* Participants */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Initiator</h4>
                  <p className="font-medium text-foreground">
                    {safeText(selectedDispute.initiator?.firstName, "User")}
                  </p>
                  <p className="text-sm text-muted-foreground">{safeText(selectedDispute.initiator?.email, "Unknown")}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Defendant</h4>
                  <p className="font-medium text-foreground">
                    {safeText(selectedDispute.defendant?.firstName, "User")}
                  </p>
                  <p className="text-sm text-muted-foreground">{safeText(selectedDispute.defendant?.email, "Unknown")}</p>
                </div>
              </div>

              {/* Details */}
              <div data-testid="dispute-details-section">
                <h4 className="text-sm font-medium text-foreground mb-2">Issue Details</h4>
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="font-medium text-foreground">
                    {getTypeIcon(selectedDispute.type)} {humanize(selectedDispute.type)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {safeText(selectedDispute.description) ||
                      safeText(selectedDispute.reason, "No details provided")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Booking: {safeText(selectedDispute.booking?.listing?.title, "Listing")}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Amount Disputed:</span>{" "}
                    <span className="font-semibold text-foreground">
                      {safeNumber(selectedDispute.amount) > 0
                        ? `$${safeNumber(selectedDispute.amount).toFixed(2)}`
                        : "—"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Evidence */}
              <div data-testid="evidence-section">
                <h4 className="text-sm font-medium text-foreground mb-2">Evidence</h4>
                <div className="p-4 bg-muted/50 rounded-lg">
                  {Array.isArray(selectedDisputeDetail?.evidence) &&
                  selectedDisputeDetail.evidence.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {selectedDisputeDetail.evidence.map((item, index) => (
                        <li key={`evidence-${index}`} className="text-muted-foreground">
                          {typeof item === "string" ? item : JSON.stringify(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No evidence attached for this dispute.</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div data-testid="dispute-messages">
                <h4 className="text-sm font-medium text-foreground mb-2">Discussion</h4>
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  {Array.isArray(selectedDisputeDetail?.responses) &&
                  selectedDisputeDetail.responses.length > 0 ? (
                    selectedDisputeDetail.responses.map((response) => (
                      <div key={response.id} className="border rounded-md p-3 bg-background">
                        <p className="text-sm text-foreground">{safeText(response.content, "No content")}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {safeText(response.user?.email, "Unknown user")} • {safeDateLabel(response.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No responses yet.</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="border-t pt-6 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Form method="post">
                    <input type="hidden" name="disputeId" value={selectedDispute.id} />
                    <input type="hidden" name="intent" value="assign-to-me" />
                    <UnifiedButton
                      type="submit"
                      variant="outline"
                      disabled={isSubmitting}
                      data-testid="assign-dispute-button"
                    >
                      Assign to Me
                    </UnifiedButton>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="disputeId" value={selectedDispute.id} />
                    <input type="hidden" name="intent" value="set-status" />
                    <input type="hidden" name="status" value="UNDER_REVIEW" />
                    <UnifiedButton type="submit" variant="outline" disabled={isSubmitting}>
                      Move to Review
                    </UnifiedButton>
                  </Form>
                </div>

                <Form method="post" className="space-y-3">
                  <input type="hidden" name="disputeId" value={selectedDispute.id} />
                  <input type="hidden" name="intent" value="add-note" />
                  <label className="block text-sm font-medium text-foreground">
                    Admin note
                    <textarea
                      name="adminNote"
                      className="mt-2 w-full min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Add internal handling notes for this dispute..."
                      data-testid="admin-note-input"
                    />
                  </label>
                  <UnifiedButton
                    type="submit"
                    variant="outline"
                    disabled={isSubmitting}
                    data-testid="add-note-button"
                  >
                    Add Note
                  </UnifiedButton>
                </Form>

                <Form method="post" className="space-y-3">
                  <input type="hidden" name="disputeId" value={selectedDispute.id} />
                  <input type="hidden" name="intent" value="send-message" />
                  <label className="block text-sm font-medium text-foreground">
                    Send message
                    <textarea
                      name="message"
                      className="mt-2 w-full min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Send a message to the dispute thread..."
                      data-testid="dispute-message-input"
                    />
                  </label>
                  <UnifiedButton
                    type="submit"
                    variant="outline"
                    disabled={isSubmitting}
                    data-testid="send-dispute-message-button"
                  >
                    Send Message
                  </UnifiedButton>
                </Form>

                <Form method="post" className="space-y-3">
                  <input type="hidden" name="disputeId" value={selectedDispute.id} />
                  <input type="hidden" name="intent" value="resolve-dispute" />
                  <label className="block text-sm font-medium text-foreground">
                    Resolution notes
                    <textarea
                      name="resolution"
                      className="mt-2 w-full min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Summarize the dispute resolution decision..."
                      data-testid="resolution-note-input"
                    />
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    Resolved amount (optional)
                    <input
                      name="resolvedAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      placeholder="0.00"
                      data-testid="resolved-amount-input"
                    />
                  </label>
                  <UnifiedButton
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-destructive hover:bg-destructive/90"
                    data-testid="resolve-dispute-button"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Resolve Dispute
                      </>
                    )}
                  </UnifiedButton>
                </Form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

