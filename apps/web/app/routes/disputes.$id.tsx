import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { Form, Link, redirect, useActionData, useLoaderData, useRevalidator } from "react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  FileText,
  MessageCircle,
  Send,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { disputesApi, type DisputeDetail } from "~/lib/api/disputes";
import { useAuthStore } from "~/lib/store/auth";
import { Badge, Card, CardContent, UnifiedButton, RouteErrorBoundary } from "~/components/ui";
import { cn } from "~/lib/utils";
import { getUser } from "~/utils/auth";

export const meta: MetaFunction = () => {
  return [{ title: "Dispute Details | GharBatai Rentals" }];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | undefined): value is string =>
  Boolean(value && UUID_PATTERN.test(value));

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: typeof AlertCircle }
> = {
  OPEN: { label: "Open", className: "bg-warning/15 text-warning", icon: AlertCircle },
  UNDER_REVIEW: {
    label: "Under Review",
    className: "bg-muted text-foreground",
    icon: FileText,
  },
  INVESTIGATING: {
    label: "Investigating",
    className: "bg-muted text-foreground",
    icon: FileText,
  },
  RESOLVED: { label: "Resolved", className: "bg-success/15 text-success", icon: CheckCircle },
  CLOSED: { label: "Closed", className: "bg-muted text-muted-foreground", icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  PROPERTY_DAMAGE: "Property Damage",
  MISSING_ITEMS: "Missing Items",
  CONDITION_MISMATCH: "Condition Mismatch",
  REFUND_REQUEST: "Refund Request",
  PAYMENT_ISSUE: "Payment Issue",
  OTHER: "Other",
};
const MAX_DISPUTE_MESSAGE_LENGTH = 2000;
const MAX_CLOSE_REASON_LENGTH = 1000;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeDateLabel = (value: unknown, pattern: string): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown date" : format(date, pattern);
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};
const humanizeKey = (value: unknown): string =>
  String(value || "").replace(/_/g, " ").trim();

export async function clientLoader({ params, request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const disputeId = params.id;
  if (!isUuid(disputeId)) {
    return redirect("/disputes");
  }

  try {
    const dispute = await disputesApi.getDisputeById(disputeId);
    const initiatorId = dispute.initiator?.id || dispute.initiatorId;
    const defendantId = dispute.defendant?.id || dispute.defendantId;
    const isParticipant = [initiatorId, defendantId].some((id) => id === user.id);
    if (!isParticipant && user.role !== "admin") {
      return redirect("/disputes");
    }
    return { dispute };
  } catch (error) {
    console.error("Failed to load dispute:", error);
    throw redirect("/disputes");
  }
}

export async function clientAction({ request, params }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const disputeId = params.id;
  if (!isUuid(disputeId)) {
    return { error: "Dispute ID is required" };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const allowedIntents = new Set(["respond", "close"]);
  if (!allowedIntents.has(intent)) {
    return { error: "Invalid action" };
  }

  try {
    const dispute = await disputesApi.getDisputeById(disputeId);
    const status = safeText(dispute.status, "OPEN").toUpperCase();
    const initiatorId = dispute.initiator?.id || dispute.initiatorId;
    const defendantId = dispute.defendant?.id || dispute.defendantId;
    const isInitiator = initiatorId === user.id;
    const isParticipant = [initiatorId, defendantId].some((id) => id === user.id);
    const isAdmin = user.role === "admin";

    if (!isParticipant && !isAdmin) {
      return { error: "You are not authorized to update this dispute." };
    }

    if (intent === "respond") {
      if (["CLOSED", "RESOLVED"].includes(status)) {
        return { error: "Closed disputes cannot receive new responses." };
      }
      const message = String(formData.get("message") || "")
        .trim()
        .slice(0, MAX_DISPUTE_MESSAGE_LENGTH);
      if (!message) {
        return { error: "Response message is required" };
      }
      await disputesApi.respondToDispute(disputeId, message);
      return { success: "Response sent" };
    }

    if (intent === "close") {
      if (!isInitiator && !isAdmin) {
        return { error: "Only the dispute initiator can close this dispute." };
      }
      if (["CLOSED", "RESOLVED"].includes(status)) {
        return { error: "This dispute is already closed." };
      }
      const reason = String(formData.get("reason") || "")
        .trim()
        .slice(0, MAX_CLOSE_REASON_LENGTH);
      if (!reason) {
        return { error: "Close reason is required" };
      }
      await disputesApi.closeDispute(disputeId, reason);
      return { success: "Dispute closed" };
    }

    return { error: "Invalid action" };
  } catch (error: unknown) {
    return {
      error:
        (error &&
          typeof error === "object" &&
          "response" in error &&
          (error as { response?: { data?: { message?: string } } }).response
            ?.data?.message) ||
        "Action failed",
    };
  }
}

export default function DisputeDetailPage() {
  const { dispute } = useLoaderData<{ dispute: DisputeDetail }>();
  const actionData = useActionData<{ success?: string; error?: string }>();
  const revalidator = useRevalidator();
  const { user } = useAuthStore();
  const [message, setMessage] = useState("");
  const [closeReason, setCloseReason] = useState("");

  const statusKey = safeText(dispute.status, "OPEN").toUpperCase();
  const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.OPEN;
  const StatusIcon = statusConfig.icon;
  const bookingId = safeText(dispute.bookingId);
  const bookingListingTitle = safeText(dispute.booking?.listing?.title);
  const disputeDescription = safeText(dispute.description, "No description provided.");

  const responses = useMemo(() => dispute.responses || [], [dispute.responses]);
  const canRespond = !["CLOSED", "RESOLVED"].includes(statusKey);
  const actorId = dispute.initiator?.id || dispute.initiatorId;
  const isInitiator = Boolean(actorId && actorId === user?.id);
  const canClose = (isInitiator || user?.role === "admin") && !["CLOSED", "RESOLVED"].includes(statusKey);

  useEffect(() => {
    if (actionData?.success) {
      revalidator.revalidate();
      setMessage("");
    }
  }, [actionData, revalidator]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/disputes" className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 inline-block mr-1" />
            Back to disputes
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {dispute.title || TYPE_LABELS[String(dispute.type)] || humanizeKey(dispute.type) || "Dispute"}
            </h1>
            <Badge className={cn("gap-1", statusConfig.className)}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Booking{" "}
            <Link
              to={bookingId ? `/bookings/${bookingId}` : "/bookings"}
              className="text-primary hover:underline"
            >
              {bookingId || "N/A"}
            </Link>
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {actionData?.error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            {actionData.error}
          </div>
        )}
        {actionData?.success && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-success">
            {actionData.success}
          </div>
        )}

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Created {safeDateLabel(dispute.createdAt, "MMM d, yyyy")}
              </span>
              {typeof dispute.amount === "number" ? (
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Amount ${safeNumber(dispute.amount).toFixed(2)}
                </span>
              ) : null}
              {bookingListingTitle ? (
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  {bookingListingTitle}
                </span>
              ) : null}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">Description</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {disputeDescription}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-muted/40 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Initiator</p>
                <p className="font-medium text-foreground">{safeText(dispute.initiator?.email, "Unknown")}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Defendant</p>
                <p className="font-medium text-foreground">{safeText(dispute.defendant?.email, "Unknown")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Conversation</h2>
            {responses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No responses yet. Start the conversation below.</p>
            ) : (
              <div className="space-y-4">
                {responses.map((response) => (
                  <div key={response.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{response.user?.email || "System"}</span>
                      <span>{safeDateLabel(response.createdAt, "MMM d, yyyy h:mm a")}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-line">{response.content}</p>
                  </div>
                ))}
              </div>
            )}

            <Form method="post" className="space-y-3">
              <input type="hidden" name="intent" value="respond" />
              <textarea
                name="message"
                value={message}
                onChange={(event) =>
                  setMessage(event.target.value.slice(0, MAX_DISPUTE_MESSAGE_LENGTH))
                }
                placeholder="Add a response..."
                className="w-full border border-input rounded-lg px-3 py-2 min-h-[120px] bg-background"
                disabled={!canRespond}
              />
              <UnifiedButton
                type="submit"
                variant="primary"
                leftIcon={<Send className="w-4 h-4" />}
                disabled={!canRespond || message.trim().length === 0}
              >
                Send Response
              </UnifiedButton>
            </Form>
          </CardContent>
        </Card>

        {canClose ? (
          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Close Dispute</h2>
              <p className="text-sm text-muted-foreground">
                Closing the dispute will lock the thread and mark it as closed.
              </p>
              <Form method="post" className="space-y-3">
                <input type="hidden" name="intent" value="close" />
                <textarea
                  name="reason"
                  value={closeReason}
                  onChange={(event) =>
                    setCloseReason(event.target.value.slice(0, MAX_CLOSE_REASON_LENGTH))
                  }
                  placeholder="Reason for closing the dispute"
                  className="w-full border border-input rounded-lg px-3 py-2 min-h-[100px] bg-background"
                />
                <UnifiedButton
                  type="submit"
                  variant="destructive"
                  disabled={closeReason.trim().length === 0}
                >
                  Close Dispute
                </UnifiedButton>
              </Form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
