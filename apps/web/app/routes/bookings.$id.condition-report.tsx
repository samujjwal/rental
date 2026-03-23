import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, Form, Link, redirect, useRevalidator } from "react-router";
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  AlertTriangle,
  FileText,
  Pen,
  Info,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { bookingsApi } from "~/lib/api/bookings";
import { getUser } from "~/utils/auth";
import { format } from "date-fns";
import type { Booking, ConditionReport } from "~/types/booking";
import { RouteErrorBoundary, UnifiedButton } from "~/components/ui";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export { RouteErrorBoundary as ErrorBoundary };

export const meta: MetaFunction<typeof clientLoader> = ({ data }) => {
  const title = data?.booking ? `Condition Report — Booking #${data.booking.id.slice(-8).toUpperCase()}` : "Condition Report";
  return [
    { title: `${title} | GharBatai Rentals` },
    { name: "description", content: "View and update the condition report for this booking." },
  ];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUID_PATTERN = /^c[a-z0-9]{20,}$/i;
const isValidId = (v: string | undefined): v is string =>
  Boolean(v && (UUID_PATTERN.test(v) || CUID_PATTERN.test(v)));

export function getConditionReportLoadError(error: unknown): string {
  const responseMessage =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? (error as { response: { data: { message: string } } }).response.data.message
      : null;

  return (
    responseMessage ||
    getActionableErrorMessage(error, "Unable to load the condition reports right now.", {
      [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
      [ApiErrorType.TIMEOUT_ERROR]: "Loading the condition reports timed out. Try again.",
    })
  );
}

export function getConditionReportUpdateError(
  error: unknown,
  fallbackMessage = "Failed to update report"
): string {
  const responseMessage =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? (error as { response: { data: { message: string } } }).response.data.message
      : null;

  if (responseMessage) {
    return responseMessage;
  }

  const directMessage =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? String((error as { message: string }).message).trim()
      : "";

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try updating the report again.";
  }

  const actionableMessage = getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try updating the report again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Updating the report timed out. Try again.",
    [ApiErrorType.NETWORK_ERROR]: "We could not update the report right now. Try again in a moment.",
    [ApiErrorType.CONFLICT]: "This report was updated elsewhere. Refresh and try again.",
  });

  const genericMessages = new Set([
    "conflict",
    "network error",
    "timeout",
    fallbackMessage.toLowerCase(),
  ]);

  if (directMessage && !genericMessages.has(directMessage.toLowerCase())) {
    return directMessage;
  }

  return actionableMessage;
}

// ---------- loader ----------

export async function clientLoader({ params, request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) throw redirect("/auth/login?redirect=/bookings");

  const bookingId = params.id;
  if (!isValidId(bookingId)) throw redirect("/bookings");

  try {
    const [booking, reports] = await Promise.all([
      bookingsApi.getBookingById(bookingId),
      bookingsApi.getConditionReports(bookingId),
    ]);

    const isParticipant =
      booking.ownerId === user.id ||
      booking.renterId === user.id ||
      user.role === "admin";
    if (!isParticipant) throw redirect("/bookings");

    return { booking, reports, userId: user.id };
  } catch (error) {
    if (error instanceof Response) throw error;
    return {
      booking: null,
      reports: [],
      userId: user.id,
      error: getConditionReportLoadError(error),
    };
  }
}

// ---------- action ----------

export async function clientAction({ params, request }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) return redirect("/auth/login");

  const bookingId = params.id;
  if (!isValidId(bookingId)) return { error: "Invalid booking ID" };

  const formData = await request.formData();
  const reportId = String(formData.get("reportId") ?? "");
  if (!isValidId(reportId)) return { error: "Invalid report ID" };

  const notes = formData.get("notes");
  const damages = formData.get("damages");
  const signature = formData.get("signature");
  const photosRaw = formData.get("photos");

  const dto: {
    notes?: string;
    damages?: string;
    signature?: string;
    photos?: string[];
  } = {};
  if (typeof notes === "string") dto.notes = notes;
  if (typeof damages === "string") dto.damages = damages;
  if (typeof signature === "string" && signature.trim()) dto.signature = signature;
  if (typeof photosRaw === "string" && photosRaw.trim()) {
    try {
      const parsed = JSON.parse(photosRaw);
      if (Array.isArray(parsed)) dto.photos = parsed.filter((p: unknown) => typeof p === "string");
    } catch {
      // ignore malformed input
    }
  }

  try {
    await bookingsApi.updateConditionReport(bookingId, reportId, dto);
    return { success: true };
  } catch (err: unknown) {
    return { error: getConditionReportUpdateError(err) };
  }
}

// ---------- helpers ----------

function formatDate(value: string | null | undefined, pattern: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : format(d, pattern);
}

function ReportTypeBadge({ type }: { type: string | null }) {
  const isCheckIn = type === "CHECK_IN";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ${
        isCheckIn
          ? "bg-blue-100 text-blue-800"
          : "bg-purple-100 text-purple-800"
      }`}
    >
      {isCheckIn ? "Check-In" : "Check-Out"}
    </span>
  );
}

function ReportCard({
  report,
  canEdit,
  bookingId,
  actionData,
  isSubmitting,
}: {
  report: ConditionReport;
  canEdit: boolean;
  bookingId: string;
  actionData: { success?: boolean; error?: string } | null;
  isSubmitting: boolean;
}) {
  const creatorName = `${report.creator.firstName} ${report.creator.lastName}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ReportTypeBadge type={report.reportType} />
          <span className="text-sm text-gray-500">
            by {creatorName} · {formatDate(report.createdAt, "MMM d, yyyy")}
          </span>
        </div>
        {report.signature && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
            <CheckCircle className="w-3 h-3" />
            Signed
          </span>
        )}
      </div>

      {/* Photos */}
      {report.photos.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Photos ({report.photos.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {report.photos.map((url, i) => (
              <a
                key={`${url}-${i}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity"
              >
                <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {report.photos.length === 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <ImageIcon className="w-4 h-4" />
            <span>No photos attached yet</span>
          </div>
        </div>
      )}

      {/* Notes & Damages */}
      <div className="px-6 py-4 space-y-4 border-b border-gray-100">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {report.notes ?? <span className="text-gray-400 italic">No notes added.</span>}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Damages
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {report.damages ?? (
              <span className="text-gray-400 italic">No damages reported.</span>
            )}
          </p>
        </div>
      </div>

      {/* Edit Form */}
      {canEdit && (
        <div className="px-6 py-5 bg-gray-50">
          <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Pen className="w-4 h-4 text-indigo-500" />
            Update Report
          </p>

          {actionData?.error && (
            <div className="mb-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {actionData.error}
            </div>
          )}
          {actionData?.success && (
            <div className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Report saved successfully.
            </div>
          )}

          <Form method="post" className="space-y-4">
            <input type="hidden" name="reportId" value={report.id} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`notes-${report.id}`}>
                Notes
              </label>
              <textarea
                id={`notes-${report.id}`}
                name="notes"
                rows={3}
                defaultValue={report.notes ?? ""}
                maxLength={5000}
                placeholder="Describe the condition of the property…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`damages-${report.id}`}>
                Damages
              </label>
              <textarea
                id={`damages-${report.id}`}
                name="damages"
                rows={3}
                defaultValue={report.damages ?? ""}
                maxLength={5000}
                placeholder="Describe any damages found (leave blank if none)…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5" htmlFor={`photos-${report.id}`}>
                <Camera className="w-4 h-4 text-gray-500" />
                Photo URLs (JSON array, e.g. ["https://…"])
              </label>
              <input
                id={`photos-${report.id}`}
                name="photos"
                type="text"
                defaultValue={report.photos.length > 0 ? JSON.stringify(report.photos) : ""}
                placeholder='["https://cdn.example.com/photo1.jpg"]'
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
              />
              <p className="mt-1 text-xs text-gray-400">
                Upload photos via the file upload API, then paste the returned URLs here.
              </p>
            </div>

            <div className="flex justify-end">
              <UnifiedButton
                type="submit"
                disabled={isSubmitting}
                loading={isSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Save Report
                  </>
                )}
              </UnifiedButton>
            </div>
          </Form>
        </div>
      )}
    </div>
  );
}

// ---------- page ----------

export default function ConditionReportPage() {
  const { booking, reports, userId, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>() as
    | { success?: boolean; error?: string }
    | null;
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const isSubmitting = navigation.state === "submitting";

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Condition reports unavailable</h1>
            <p className="mt-3 text-sm text-gray-500">{error || "Unable to load the condition reports right now."}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <UnifiedButton type="button" onClick={() => revalidator.revalidate()}>
                Try Again
              </UnifiedButton>
              <Link
                to="/bookings"
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to Bookings
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isRenter = booking.renterId === userId;
  const isOwner = booking.ownerId === userId;

  const checkInReport = reports.find((r) => r.reportType === "CHECK_IN") ?? null;
  const checkOutReport = reports.find((r) => r.reportType === "CHECK_OUT") ?? null;

  // Renter can edit the check-in report; owner can edit the check-out report (return inspection).
  function canEdit(report: ConditionReport) {
    if (report.reportType === "CHECK_IN") return isRenter || report.createdBy === userId;
    if (report.reportType === "CHECK_OUT") return isOwner;
    return report.createdBy === userId;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back */}
        <Link
          to={`/bookings/${booking.id}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Booking
        </Link>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Condition Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Booking #{booking.id.slice(-8).toUpperCase()}
            {booking.listing?.title ? ` · ${booking.listing.title}` : ""}
          </p>
        </div>

        {/* Info banner */}
        <div className="mb-6 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
          <div>
            <strong>How condition reports work:</strong> A check-in report is created automatically
            when the rental starts. The renter documents the initial condition. When the rental ends,
            the owner completes the check-out report during return inspection.
            {isOwner && !checkOutReport && (
              <span className="block mt-1 font-medium">
                The check-out report will appear here once the renter requests a return.
              </span>
            )}
          </div>
        </div>

        {/* No reports state */}
        {reports.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              No condition reports yet. Reports are generated automatically when the rental begins.
            </p>
          </div>
        )}

        {/* Check-In Report */}
        {checkInReport && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Check-In Report
            </h2>
            <ReportCard
              report={checkInReport}
              canEdit={canEdit(checkInReport)}
              bookingId={booking.id}
              actionData={actionData}
              isSubmitting={isSubmitting}
            />
          </div>
        )}

        {/* Check-Out Report */}
        {checkOutReport && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Check-Out / Return Inspection Report
            </h2>
            <ReportCard
              report={checkOutReport}
              canEdit={canEdit(checkOutReport)}
              bookingId={booking.id}
              actionData={actionData}
              isSubmitting={isSubmitting}
            />
          </div>
        )}

        {/* Other reports (edge-case) */}
        {reports
          .filter((r) => r.reportType !== "CHECK_IN" && r.reportType !== "CHECK_OUT")
          .map((report) => (
            <div key={report.id} className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {report.reportType ?? "Report"}
              </h2>
              <ReportCard
                report={report}
                canEdit={canEdit(report)}
                bookingId={booking.id}
                actionData={actionData}
                isSubmitting={isSubmitting}
              />
            </div>
          ))}
      </div>
    </div>
  );
}
