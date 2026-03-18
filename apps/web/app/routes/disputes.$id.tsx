import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
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
import { formatCurrency } from "~/lib/utils";
import { getUser } from "~/utils/auth";
import { useTranslation } from "react-i18next";
import { toast } from "~/lib/toast";
import { isAppEntityId } from "~/utils/entity-id";

export const meta: MetaFunction = () => {
  return [{ title: "Dispute Details | GharBatai Rentals" }];
};

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
  if (!isAppEntityId(disputeId)) {
    return redirect("/disputes");
  }

  try {
    const dispute = await disputesApi.getDisputeById(disputeId);
    const initiatorId = dispute.initiator?.id || dispute.initiatorId;
    const defendantId = dispute.defendant?.id || dispute.defendantId;
    const isParticipant = [initiatorId, defendantId].some((id) => id === user.id);
    const isAdmin = user.role === "admin" || user.role === "SUPER_ADMIN";
    if (!isParticipant && !isAdmin) {
      return redirect("/disputes");
    }
    return { dispute };
  } catch (error) {
    throw redirect("/disputes");
  }
}

export async function clientAction({ request, params }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const disputeId = params.id;
  if (!isAppEntityId(disputeId)) {
    return { error: "Dispute ID is required" };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const allowedIntents = new Set(["respond", "close", "escalate"]);
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
    const isAdmin = user.role === "admin" || user.role === "SUPER_ADMIN";

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

    if (intent === "escalate") {
      if (!isAdmin && user.role !== 'SUPER_ADMIN') {
        return { error: "Only administrators can escalate disputes." };
      }
      if (["CLOSED", "RESOLVED"].includes(status)) {
        return { error: "Closed or resolved disputes cannot be escalated." };
      }
      const reason = String(formData.get("reason") || "")
        .trim()
        .slice(0, MAX_CLOSE_REASON_LENGTH);
      if (!reason) {
        return { error: "Escalation reason is required" };
      }
      await disputesApi.escalateDispute(disputeId, reason);
      return { success: "Dispute escalated" };
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
  const { t } = useTranslation();
  const { dispute } = useLoaderData<{ dispute: DisputeDetail }>();
  const actionData = useActionData<{ success?: string; error?: string }>();
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
  const isAdminUser = user?.role === "admin" || user?.role === "SUPER_ADMIN";
  const canEscalate = isAdminUser && !["CLOSED", "RESOLVED"].includes(statusKey);
  const [escalateReason, setEscalateReason] = useState("");

  useEffect(() => {
    if (actionData?.success) {
      setMessage("");
      toast.success(actionData.success);
    }
    if (actionData?.error) {
      toast.error(actionData.error);
    }
    // React Router automatically revalidates loaders after clientAction
    // so manual revalidation is not needed
  }, [actionData]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page header */}
        <div>
          <Link to="/disputes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="w-4 h-4" />
            {t("disputes.backToDisputes")}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {dispute.title || (dispute.type ? t(`disputes.types.${({PROPERTY_DAMAGE:"propertyDamage",MISSING_ITEMS:"missingItems",CONDITION_MISMATCH:"conditionMismatch",REFUND_REQUEST:"refundRequest",PAYMENT_ISSUE:"paymentIssue",OTHER:"other"} as Record<string,string>)[String(dispute.type)] || "other"}`) : humanizeKey(dispute.type)) || t("disputes.dispute")}
            </h1>
            <Badge className={cn("gap-1", statusConfig.className)}>
              <StatusIcon className="w-3 h-3" />
              {t(`disputes.${({OPEN:"open",UNDER_REVIEW:"underReview",INVESTIGATING:"investigating",RESOLVED:"resolved",CLOSED:"closed"} as Record<string,string>)[statusKey] || "open"}`)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {t("disputes.booking")}{" "}
            <Link
              to={bookingId ? `/bookings/${bookingId}` : "/bookings"}
              className="text-primary hover:underline"
            >
              {bookingId || "N/A"}
            </Link>
          </p>
        </div>

        {/* "What happens next" lifecycle guidance */}
        {['OPEN', 'UNDER_REVIEW', 'INVESTIGATING'].includes(statusKey) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm text-blue-900">
                  {t('disputes.whatHappensNext', 'What happens next?')}
                </p>
                {statusKey === 'OPEN' && (
                  <p className="text-xs text-blue-800">
                    {t('disputes.nextStep.open', 'Our team will begin reviewing your dispute within 1–2 business days. You may add more information by replying to this thread. Typical resolution time: 3–5 business days.')}
                  </p>
                )}
                {statusKey === 'UNDER_REVIEW' && (
                  <p className="text-xs text-blue-800">
                    {t('disputes.nextStep.underReview', "Our team is actively reviewing your dispute and gathering information from both parties. We'll notify you of any updates. Typical resolution time: 2–3 more business days.")}
                  </p>
                )}
                {statusKey === 'INVESTIGATING' && (
                  <p className="text-xs text-blue-800">
                    {t('disputes.nextStep.investigating', 'A specialist is investigating your case. We may reach out for additional evidence. Please check this thread regularly. Typical resolution time: 3–7 business days.')}
                  </p>
                )}
                <p className="text-xs text-blue-700 font-medium pt-1">
                  {isInitiator
                    ? t('disputes.youCanReply', 'You can reply below to add more context or evidence.')
                    : t('disputes.youCanReplyDefendant', 'You can reply below to provide your perspective.')}
                </p>
              </div>
            </div>
          </div>
        )}

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
                {t("disputes.createdOn", { date: safeDateLabel(dispute.createdAt, "MMM d, yyyy") })}
              </span>
              {typeof dispute.amount === "number" ? (
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {t("disputes.disputeAmount", { amount: formatCurrency(safeNumber(dispute.amount)) })}
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
              <h2 className="text-sm font-semibold text-foreground mb-2">{t("disputes.description")}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {disputeDescription}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-muted/40 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("disputes.initiator")}</p>
                <p className="font-medium text-foreground">{safeText(dispute.initiator?.email, "Unknown")}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("disputes.defendant")}</p>
                <p className="font-medium text-foreground">{safeText(dispute.defendant?.email, "Unknown")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{t("disputes.conversation")}</h2>
            {responses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("disputes.noResponses")}</p>
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
                placeholder={t("disputes.addResponsePlaceholder")}
                className="w-full border border-input rounded-lg px-3 py-2 min-h-[120px] bg-background"
                disabled={!canRespond}
              />
              <UnifiedButton
                type="submit"
                variant="primary"
                leftIcon={<Send className="w-4 h-4" />}
                disabled={!canRespond || message.trim().length === 0}
              >
                {t("disputes.sendResponse")}
              </UnifiedButton>
            </Form>
          </CardContent>
        </Card>

        {canClose ? (
          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">{t("disputes.closeDispute")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("disputes.closeDisputeDesc")}
              </p>
              <Form method="post" className="space-y-3">
                <input type="hidden" name="intent" value="close" />
                <textarea
                  name="reason"
                  value={closeReason}
                  onChange={(event) =>
                    setCloseReason(event.target.value.slice(0, MAX_CLOSE_REASON_LENGTH))
                  }
                  placeholder={t("disputes.closeReasonPlaceholder")}
                  className="w-full border border-input rounded-lg px-3 py-2 min-h-[100px] bg-background"
                />
                <UnifiedButton
                  type="submit"
                  variant="destructive"
                  disabled={closeReason.trim().length === 0}
                >
                  {t("disputes.closeDispute")}
                </UnifiedButton>
              </Form>
            </CardContent>
          </Card>
        ) : null}

        {canEscalate ? (
          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">{t("disputes.escalateDispute", "Escalate Dispute")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("disputes.escalateDisputeDesc", "Escalate this dispute to the next review level. Provide a clear reason for escalation.")}
              </p>
              <Form method="post" className="space-y-3">
                <input type="hidden" name="intent" value="escalate" />
                <textarea
                  name="reason"
                  value={escalateReason}
                  onChange={(event) =>
                    setEscalateReason(event.target.value.slice(0, MAX_CLOSE_REASON_LENGTH))
                  }
                  placeholder={t("disputes.escalateReasonPlaceholder", "Explain why this dispute needs to be escalated...")}
                  className="w-full border border-input rounded-lg px-3 py-2 min-h-[100px] bg-background"
                />
                <UnifiedButton
                  type="submit"
                  variant="secondary"
                  disabled={escalateReason.trim().length === 0}
                >
                  {t("disputes.escalateDispute", "Escalate Dispute")}
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
