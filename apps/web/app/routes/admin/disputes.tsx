/* eslint-disable react-refresh/only-export-components */
import type { MetaFunction } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "react-router";
import { useState } from "react";
import {
  AlertTriangle,
  Clock,
  XCircle,
  FileText,
  Image,
  User,
  Calendar,
  DollarSign,
  ChevronRight,
  Search,
  Loader2,
} from "lucide-react";
import { adminApi } from "~/lib/api/admin";
import { UnifiedButton } from "~/components/ui";

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

export async function clientLoader() {
  try {
    const disputesRes = (await adminApi.getDisputes({ limit: 50 })) as {
      data?: Dispute[];
      pagination?: unknown;
    };
    return {
      disputes: disputesRes.data ?? [],
      pagination: disputesRes.pagination ?? null,
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

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const disputeId = formData.get("disputeId") as string;

  if (intent === "resolve") {
    const resolution = formData.get("resolution") as string;
    const notes = formData.get("notes") as string;
    try {
      await adminApi.resolveDispute(disputeId, { resolution, notes });
      return { success: true, message: "Dispute resolved successfully" };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) || "Failed to resolve dispute" };
    }
  }

  if (intent === "assign") {
    try {
      await adminApi.assignDispute(disputeId);
      return { success: true, message: "Dispute assigned to you" };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) || "Failed to assign dispute" };
    }
  }

  return { success: false, error: "Unknown action" };
}

type DisputeStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type DisputePriority = "HIGH" | "MEDIUM" | "LOW";

interface Dispute {
  id: string;
  type: string;
  status: DisputeStatus;
  priority: DisputePriority;
  bookingId: string;
  amount: number;
  description: string;
  evidence: { type: string; url: string }[];
  renter: { id: string; firstName: string; lastName: string; email: string };
  owner: { id: string; firstName: string; lastName: string; email: string };
  assignedTo?: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
  slaDeadline?: string;
}

export default function AdminDisputesPage() {
  const { disputes, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  const isSubmitting = navigation.state === "submitting";

  // Filter disputes
  const filteredDisputes = disputes.filter((dispute: Dispute) => {
    const matchesStatus = selectedStatus === "all" || dispute.status === selectedStatus;
    const matchesSearch = searchQuery === "" ||
      dispute.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispute.renter?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispute.owner?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Count by status
  const statusCounts = {
    all: disputes.length,
    OPEN: disputes.filter((d: Dispute) => d.status === "OPEN").length,
    IN_PROGRESS: disputes.filter((d: Dispute) => d.status === "IN_PROGRESS").length,
    RESOLVED: disputes.filter((d: Dispute) => d.status === "RESOLVED").length,
  };

  const getPriorityColor = (priority: DisputePriority) => {
    switch (priority) {
      case "HIGH": return "text-red-600 bg-red-100";
      case "MEDIUM": return "text-yellow-600 bg-yellow-100";
      case "LOW": return "text-green-600 bg-green-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusColor = (status: DisputeStatus) => {
    switch (status) {
      case "OPEN": return "text-red-600 bg-red-100";
      case "IN_PROGRESS": return "text-blue-600 bg-blue-100";
      case "RESOLVED": return "text-green-600 bg-green-100";
      case "CLOSED": return "text-gray-600 bg-gray-100";
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

  const getDaysUntilSLA = (slaDeadline?: string) => {
    if (!slaDeadline) return null;
    const deadline = new Date(slaDeadline);
    const now = new Date();
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays;
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
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {actionData.message}
          </div>
        )}
        {actionData?.error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {actionData.error}
          </div>
        )}

        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: "all", label: "All" },
            { key: "OPEN", label: "Open" },
            { key: "IN_PROGRESS", label: "In Progress" },
            { key: "RESOLVED", label: "Resolved" },
          ].map((tab) => (
            <button
              key={tab.key}
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
        <div className="space-y-4">
          {filteredDisputes.map((dispute: Dispute) => {
            const daysUntilSLA = getDaysUntilSLA(dispute.slaDeadline);

            return (
              <div
                key={dispute.id}
                className="bg-card border rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => setSelectedDispute(dispute)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(dispute.priority)}`}>
                        {dispute.priority}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(dispute.status)}`}>
                        {dispute.status.replace("_", " ")}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        #{dispute.id.slice(0, 8)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getTypeIcon(dispute.type)}</span>
                      <h3 className="font-semibold text-foreground">
                        {dispute.type.replace(/_/g, " ")}
                      </h3>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {dispute.renter?.firstName} {dispute.renter?.lastName} vs {dispute.owner?.firstName} {dispute.owner?.lastName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${dispute.amount?.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {dispute.description}
                    </p>

                    <div className="flex items-center gap-4 mt-3">
                      {dispute.evidence?.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Image className="w-4 h-4" />
                          {dispute.evidence.length} evidence files
                        </span>
                      )}
                      {dispute.assignedTo && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="w-4 h-4" />
                          Assigned to: {dispute.assignedTo.firstName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {daysUntilSLA !== null && dispute.status !== "RESOLVED" && (
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        daysUntilSLA <= 1 ? "bg-red-100 text-red-700" :
                        daysUntilSLA <= 3 ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        <Clock className="w-3 h-3 inline mr-1" />
                        {daysUntilSLA} days left
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            );
          })}

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Dispute #{selectedDispute.id.slice(0, 8)}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(selectedDispute.priority)}`}>
                    {selectedDispute.priority}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(selectedDispute.status)}`}>
                    {selectedDispute.status.replace("_", " ")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Parties */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Renter</h4>
                  <p className="font-medium text-foreground">
                    {selectedDispute.renter?.firstName} {selectedDispute.renter?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedDispute.renter?.email}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Owner</h4>
                  <p className="font-medium text-foreground">
                    {selectedDispute.owner?.firstName} {selectedDispute.owner?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedDispute.owner?.email}</p>
                </div>
              </div>

              {/* Details */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Issue Details</h4>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-foreground mb-2">
                    {getTypeIcon(selectedDispute.type)} {selectedDispute.type.replace(/_/g, " ")}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedDispute.description}</p>
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Amount Disputed:</span>{" "}
                    <span className="font-semibold text-foreground">${selectedDispute.amount?.toFixed(2)}</span>
                  </p>
                </div>
              </div>

              {/* Evidence */}
              {selectedDispute.evidence?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Evidence</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedDispute.evidence.map((item, index) => (
                      <a
                        key={index}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-muted/50 rounded-lg flex items-center gap-2 hover:bg-muted transition-colors"
                      >
                        {item.type === "IMAGE" ? (
                          <Image className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm truncate">Evidence {index + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedDispute.status !== "RESOLVED" && (
                <div className="border-t pt-6">
                  <h4 className="text-sm font-medium text-foreground mb-4">Resolution</h4>
                  <Form method="post">
                    <input type="hidden" name="disputeId" value={selectedDispute.id} />
                    <input type="hidden" name="intent" value="resolve" />
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Decision
                      </label>
                      <select
                        name="resolution"
                        className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                        required
                      >
                        <option value="">Select resolution...</option>
                        <option value="FULL_REFUND_RENTER">Full refund to renter (${selectedDispute.amount?.toFixed(2)})</option>
                        <option value="PARTIAL_REFUND_RENTER">Partial refund to renter</option>
                        <option value="RELEASE_TO_OWNER">Release deposit to owner</option>
                        <option value="SPLIT_50_50">Split 50/50</option>
                        <option value="DISMISS">Dismiss (no action)</option>
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Resolution Notes
                      </label>
                      <textarea
                        name="notes"
                        rows={3}
                        className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                        placeholder="Explain the reasoning for this decision..."
                        required
                      />
                    </div>

                    <div className="flex gap-3">
                      {!selectedDispute.assignedTo && (
                        <Form method="post">
                          <input type="hidden" name="disputeId" value={selectedDispute.id} />
                          <input type="hidden" name="intent" value="assign" />
                          <UnifiedButton type="submit" variant="outline" disabled={isSubmitting}>
                            Assign to Me
                          </UnifiedButton>
                        </Form>
                      )}
                      <UnifiedButton type="submit" disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Execute Resolution
                          </>
                        )}
                      </UnifiedButton>
                    </div>
                  </Form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
