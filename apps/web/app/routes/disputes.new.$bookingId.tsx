import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "react-router";
import {
  Form,
  useLoaderData,
  useActionData,
  useNavigate,
  useNavigation,
  useSubmit,
  Link,
} from "react-router";
import { useState } from "react";
import {
  ArrowLeft,
  AlertCircle,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/lib/utils";
import { disputesApi, type CreateDisputeRequest } from "~/lib/api/disputes";
import { bookingsApi } from "~/lib/api/bookings";
import { uploadApi } from "~/lib/api/upload";
import { useAuthStore } from "~/lib/store/auth";
import { redirect } from "react-router";
import { getUser } from "~/utils/auth";
import { RouteErrorBoundary } from "~/components/ui";
import { useTranslation } from "react-i18next";
import { isAppEntityId } from "~/utils/entity-id";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const meta: MetaFunction = () => {
  return [
    { title: "File a Dispute | GharBatai Rentals" },
    { name: "description", content: "File a dispute for your booking" },
  ];
};

const MAX_EVIDENCE_FILES = 8;
const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DISPUTE_TITLE_LENGTH = 120;
const MAX_DISPUTE_DESCRIPTION_LENGTH = 3000;
const MAX_REQUESTED_AMOUNT = 1_000_000;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function getCreateDisputeError(
  error: unknown,
  fallbackMessage = "Failed to create dispute. Please try again."
): string {
  const responseMessage =
    error &&
    typeof error === "object" &&
    "response" in error &&
    (error as { response?: { data?: { message?: string } } }).response?.data?.message;

  if (typeof responseMessage === "string" && responseMessage.length > 0) {
    return responseMessage;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try creating the dispute again.";
  }

  return getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.CONFLICT]: "A dispute for this booking is already in progress. Refresh and review the booking timeline.",
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try creating the dispute again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Creating the dispute timed out. Try again.",
  });
}

export function getDisputeEvidenceUploadError(
  error: unknown,
  fallbackMessage = "Unable to upload dispute evidence right now. Try again."
): string {
  const responseMessage =
    error &&
    typeof error === "object" &&
    "response" in error &&
    (error as { response?: { data?: { message?: string } } }).response?.data?.message;

  if (typeof responseMessage === "string" && responseMessage.length > 0) {
    return responseMessage;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try uploading dispute evidence again.";
  }

  return getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try uploading dispute evidence again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Uploading dispute evidence timed out. Try again.",
    [ApiErrorType.NETWORK_ERROR]: "We could not upload dispute evidence right now. Try again in a moment.",
  });
}

const getStoredClientAuth = (): {
  user: { id: string; role: "owner" | "renter" | "admin" } | null;
  accessToken: string | null;
} => {
  if (typeof window === "undefined") {
    return { user: null, accessToken: null };
  }

  try {
    // F-39 fix: Use useAuthStore.getState() as the single source of truth.
    const { user: rawUser, accessToken } = useAuthStore.getState();

    const role = (() => {
      const normalized = String(rawUser?.role || "").toUpperCase();
      if (normalized === "OWNER" || normalized === "HOST") return "owner" as const;
      if (normalized === "ADMIN" || normalized === "SUPER_ADMIN") return "admin" as const;
      return "renter" as const;
    })();

    return {
      accessToken: accessToken ?? null,
      user: rawUser?.id ? { id: rawUser.id, role } : null,
    };
  } catch {
    return { user: null, accessToken: null };
  }
};

export async function clientLoader({ params, request }: LoaderFunctionArgs) {
  const storedAuth = getStoredClientAuth();
  const user = storedAuth.user ?? (await getUser(request));
  if (!user && !storedAuth.accessToken) {
    return redirect("/auth/login");
  }

  const bookingId = params.bookingId;
  if (!isAppEntityId(bookingId)) return redirect("/bookings");

  try {
    const booking = await bookingsApi.getBookingById(bookingId);
    const activeUser = user ?? storedAuth.user;
    const isParticipant =
      !!activeUser &&
      (booking.ownerId === activeUser.id ||
        booking.renterId === activeUser.id ||
        activeUser.role === "admin");
    if (!isParticipant) {
      return redirect("/bookings");
    }
    return { booking };
  } catch {
    return redirect("/bookings");
  }
}

clientLoader.hydrate = true;

export async function clientAction({ request, params }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const bookingId = params.bookingId;
  if (!isAppEntityId(bookingId)) return { error: "Booking ID is required" };

  const formData = await request.formData();
  const type = formData.get("type") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const requestedAmount = formData.get("requestedAmount") as string;
  const evidenceFiles = formData.getAll("evidence").filter((file) => {
    return file instanceof File && file.size > 0;
  }) as File[];
  if (evidenceFiles.length > MAX_EVIDENCE_FILES) {
    return { error: `You can upload up to ${MAX_EVIDENCE_FILES} evidence files.` };
  }
  if (evidenceFiles.some((file) => file.size > MAX_EVIDENCE_FILE_SIZE)) {
    return { error: "Each evidence file must be 10MB or smaller." };
  }

  if (!type || !title?.trim() || !description?.trim()) {
    return { error: "Type, title, and description are required" };
  }
  if (!DISPUTE_TYPES.some((item) => item.value === type)) {
    return { error: "Invalid dispute type" };
  }
  const normalizedTitle = title.trim().slice(0, MAX_DISPUTE_TITLE_LENGTH);
  const normalizedDescription = description
    .trim()
    .slice(0, MAX_DISPUTE_DESCRIPTION_LENGTH);
  if (!normalizedTitle || !normalizedDescription) {
    return { error: "Type, title, and description are required" };
  }
  const amount = requestedAmount ? Number(requestedAmount) : undefined;
  if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
    return { error: "Requested amount must be a valid positive number" };
  }
  if (amount !== undefined && amount > MAX_REQUESTED_AMOUNT) {
    return { error: "Requested amount is too large" };
  }

  try {
    const booking = await bookingsApi.getBookingById(bookingId);
    const isParticipant =
      booking.ownerId === user.id || booking.renterId === user.id || user.role === "admin";
    if (!isParticipant) {
      return { error: "You are not authorized to create a dispute for this booking." };
    }
    if (
      amount !== undefined &&
      amount > safeNumber(booking.totalPrice ?? booking.totalAmount)
    ) {
      return { error: "Requested amount cannot exceed booking total." };
    }

    let evidenceUrls: string[] | undefined;
    if (evidenceFiles.length > 0) {
      let uploads;
      try {
        uploads = await Promise.all(
          evidenceFiles.map((file) => {
            if (file.type.startsWith("image/")) {
              return uploadApi.uploadImage(file);
            }
            if (file.type === "application/pdf") {
              return uploadApi.uploadDocument(file);
            }
            return Promise.reject(new Error("Unsupported evidence file type"));
          })
        );
      } catch (error: unknown) {
        return { error: getDisputeEvidenceUploadError(error) };
      }
      evidenceUrls = uploads.map((file) => file.url);
    }

    await disputesApi.createDispute({
      bookingId,
      type: type as CreateDisputeRequest["type"],
      title: normalizedTitle,
      description: normalizedDescription,
      amount,
      evidence: evidenceUrls,
    });

    return redirect(`/bookings/${bookingId}?disputeCreated=true`);
  } catch (error: unknown) {
    return { error: getCreateDisputeError(error) };
  }
}

const DISPUTE_TYPES = [
  {
    value: "PROPERTY_DAMAGE",
    label: "Property Damage",
    description: "Item was damaged before or during rental",
  },
  {
    value: "MISSING_ITEMS",
    label: "Missing Items",
    description: "Parts or accessories are missing",
  },
  {
    value: "CONDITION_MISMATCH",
    label: "Condition Mismatch",
    description: "Item condition does not match listing",
  },
  {
    value: "REFUND_REQUEST",
    label: "Refund Request",
    description: "Request a refund for the booking",
  },
  {
    value: "PAYMENT_ISSUE",
    label: "Payment Issue",
    description: "Payment or payout issue",
  },
  { value: "OTHER", label: "Other", description: "Other dispute reason" },
];

const getDisputeGuidance = (bookingStatus: unknown) => {
  const status = String(bookingStatus || "").toUpperCase();

  if (status === "AWAITING_RETURN_INSPECTION") {
    return {
      title: "Return inspection disputes",
      description:
        "Use this form for refund, payout, or return disagreements that need operator review. If the returned item is damaged, the owner can also use Report Damage from the booking page to open an inspection-based claim.",
      accent: "amber" as const,
    };
  }

  if (["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(status)) {
    return {
      title: "Payment disputes",
      description:
        "Choose Payment Issue or Refund Request if the checkout amount, charge, or refund outcome looks wrong. Include screenshots or receipts so the operator can reconcile the payment faster.",
      accent: "blue" as const,
    };
  }

  if (["CONFIRMED", "IN_PROGRESS", "COMPLETED", "SETTLED"].includes(status)) {
    return {
      title: "Condition and refund disputes",
      description:
        "Use disputes for item condition, missing parts, payment, or refund issues that could not be resolved in chat. Be specific about what happened, when it happened, and what resolution you expect.",
      accent: "amber" as const,
    };
  }

  return {
    title: "Document the issue clearly",
    description:
      "Pick the closest dispute type, describe the issue in a timeline, and attach evidence that helps the operator understand the expected resolution without extra back-and-forth.",
    accent: "blue" as const,
  };
};

export default function DisputeNewRoute() {
  const { t } = useTranslation();
  const { booking } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === 'submitting';
  const [selectedType, setSelectedType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [evidence, setEvidence] = useState<File[]>([]);
  const disputeGuidance = getDisputeGuidance(booking.status);
  const guidanceColorClasses =
    disputeGuidance.accent === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-blue-200 bg-blue-50 text-blue-900";

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const allowedFileTypes = new Set([
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);
      const selectedFiles = Array.from(e.target.files).filter(
        (file) =>
          file.size > 0 &&
          file.size <= MAX_EVIDENCE_FILE_SIZE &&
          (file.type.startsWith("image/") || allowedFileTypes.has(file.type))
      );
      const nextFiles = [...evidence, ...selectedFiles].slice(0, MAX_EVIDENCE_FILES);
      setEvidence(nextFiles);
    }
  };

  const removeFile = (index: number) => {
    setEvidence(evidence.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/bookings/${booking.id}`)}
            className="flex items-center text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t("disputes.backToBooking")}
          </button>
          <h1 className="text-3xl font-bold text-foreground">{t("disputes.fileDispute")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("disputes.fileDisputeDesc")}
          </p>
        </div>

        {/* Booking Summary */}
        <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {t("disputes.bookingDetails")}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("common.listing")}</p>
              <p className="text-sm font-medium text-foreground">
                {booking.listing?.title || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("disputes.bookingId")}</p>
              <p className="text-sm font-medium text-foreground">
                {booking.id}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("disputes.totalAmount")}</p>
              <p className="text-sm font-medium text-foreground">
                {formatCurrency(safeNumber(booking.totalPrice ?? booking.totalAmount))}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("disputes.status")}</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {booking.status}
              </span>
            </div>
          </div>
        </div>

        <div className={cn("rounded-lg border p-4 mb-6", guidanceColorClasses)}>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{disputeGuidance.title}</p>
              <p className="text-sm mt-1 opacity-90">{disputeGuidance.description}</p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {actionData?.error && (
          <div className="mb-6 bg-destructive/10 border-l-4 border-destructive p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="ml-3">
                <p className="text-sm text-destructive">{actionData.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Dispute Form */}
        <Form
          method="post"
          encType="multipart/form-data"
          className="bg-card rounded-lg shadow-sm p-6"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            // Remove the stale native file input entries and add accumulated evidence files
            formData.delete("evidence");
            for (const file of evidence) {
              formData.append("evidence", file);
            }
            submit(formData, { method: "post", encType: "multipart/form-data" });
          }}
        >
          <div className="space-y-6">
            {/* Dispute Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                {t("disputes.whatIsIssue")}
              </label>
              <div className="space-y-3">
                {DISPUTE_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={cn(
                      "flex items-start p-4 border rounded-lg cursor-pointer transition-all",
                      selectedType === type.value
                        ? "border-primary bg-primary/5"
                        : "border-input hover:border-border"
                    )}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={type.value}
                      checked={selectedType === type.value}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="mt-1 h-4 w-4 text-primary focus:ring-ring"
                      required
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-foreground">
                        {t(`disputes.types.${({PROPERTY_DAMAGE:"propertyDamage",MISSING_ITEMS:"missingItems",CONDITION_MISMATCH:"conditionMismatch",REFUND_REQUEST:"refundRequest",PAYMENT_ISSUE:"paymentIssue",OTHER:"other"} as Record<string,string>)[type.value] || "other"}`)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t(`disputes.types.${({PROPERTY_DAMAGE:"propertyDamageDesc",MISSING_ITEMS:"missingItemsDesc",CONDITION_MISMATCH:"conditionMismatchDesc",REFUND_REQUEST:"refundRequestDesc",PAYMENT_ISSUE:"paymentIssueDesc",OTHER:"otherDesc"} as Record<string,string>)[type.value] || "otherDesc"}`)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("disputes.disputeTitle")}
              </label>
              <input
                type="text"
                name="title"
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value.slice(0, MAX_DISPUTE_TITLE_LENGTH))
                }
                placeholder={t("disputes.titlePlaceholder")}
                className="w-full border border-input rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-foreground mb-2"
              >
                {t("disputes.describeIssue")}
              </label>
              <textarea
                id="description"
                name="description"
                rows={6}
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value.slice(0, MAX_DISPUTE_DESCRIPTION_LENGTH)
                  )
                }
                placeholder={t("disputes.descriptionPlaceholder")}
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-primary"
                required
              />
              <p className="mt-2 text-sm text-muted-foreground">
                {t("disputes.detailsHint")}
              </p>
            </div>

            {/* Requested Amount */}
            <div>
              <label
                htmlFor="requestedAmount"
                className="block text-sm font-medium text-foreground mb-2"
              >
                {t("disputes.refundAmountRequested")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-muted-foreground sm:text-sm">{t("common.currencySymbol")}</span>
                </div>
                <input
                  type="number"
                  id="requestedAmount"
                  name="requestedAmount"
                  step="0.01"
                  min="0"
                  max={safeNumber(booking.totalPrice ?? booking.totalAmount)}
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-primary"
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("disputes.maximum", { amount: formatCurrency(safeNumber(booking.totalPrice ?? booking.totalAmount)) })}
              </p>
            </div>

            {/* Evidence Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("disputes.supportingEvidence")}
              </label>
              <div className="border-2 border-dashed border-input rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="evidence"
                  name="evidence"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="evidence"
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-input rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-muted"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  {t("disputes.uploadFiles")}
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("disputes.evidenceHint")}
                </p>
              </div>

              {/* Uploaded Files */}
              {evidence.length > 0 && (
                <div className="mt-4 space-y-2">
                  {evidence.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center">
                        {file.type.startsWith("image/") ? (
                          <ImageIcon className="w-5 h-5 text-muted-foreground mr-3" />
                        ) : (
                          <FileText className="w-5 h-5 text-muted-foreground mr-3" />
                        )}
                        <span className="text-sm text-foreground">
                          {file.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Important Note */}
            <div className="bg-warning/10 border-l-4 border-warning p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-warning" />
                <div className="ml-3">
                  <p className="text-sm text-warning-foreground">
                    <strong>{t("disputes.importantNote")}</strong> {t("disputes.importantNoteText")}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate(`/bookings/${booking.id}`)}
                className="flex-1 px-6 py-3 border border-input rounded-lg font-medium text-foreground hover:bg-muted transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedType || !description}
                className="flex-1 px-6 py-3 bg-destructive text-destructive-foreground rounded-lg font-medium hover:bg-destructive/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? t("common.submitting") : t("disputes.submitDispute")}
              </button>
            </div>
          </div>
        </Form>

        {/* Help Section */}
        <div className="mt-6 bg-primary/5 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-primary mb-2">
            {t("disputes.needHelp")}
          </h3>
          <p className="text-sm text-primary/80 mb-4">
            {t("disputes.needHelpText")}
          </p>
          <Link
            to={`/messages?booking=${booking.id}`}
            className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80"
          >
            {t("disputes.goToMessages")}
          </Link>
        </div>
      </div>
    </div>
  );
}
export { RouteErrorBoundary as ErrorBoundary };
