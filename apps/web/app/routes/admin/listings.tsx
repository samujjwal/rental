import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useNavigation, useActionData, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Home,
  User,
  Calendar,
  DollarSign,
  Loader2,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";
import { adminApi, type AdminListing } from "~/lib/api/admin";
import { Dialog, DialogFooter, UnifiedButton, RouteErrorBoundary } from "~/components/ui";
import { requireAdmin } from "~/utils/auth";
import { formatCurrency, formatDate } from "~/lib/utils";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export function getAdminListingsError(error: unknown, fallbackMessage: string): string {
  const responseMessage =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? (error as { response: { data: { message: string } } }).response.data.message
      : null;

  return (
    responseMessage ||
    getActionableErrorMessage(error, fallbackMessage, {
      [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
      [ApiErrorType.TIMEOUT_ERROR]: "Listing moderation request timed out. Try again.",
    })
  );
}

export const meta: MetaFunction = () => [
  { title: "Listing Approvals | Admin" },
  { name: "description", content: "Review and approve property listings" },
];

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  try {
    const res = await adminApi.getPendingListings();
    return { listings: res.listings ?? [], total: res.total ?? 0, error: null };
  } catch (error) {
    return {
      listings: [],
      total: 0,
      error: getAdminListingsError(error, "Failed to load listings"),
    };
  }
}

export async function clientAction({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const listingId = formData.get("listingId") as string;

  try {
    if (intent === "approve") {
      await adminApi.approveListing(listingId);
      return { success: true, message: "Listing approved successfully", error: null };
    }
    if (intent === "reject") {
      const reason = (formData.get("reason") as string) || undefined;
      await adminApi.rejectListing(listingId, reason);
      return { success: true, message: "Listing rejected", error: null };
    }
    return { success: false, message: null, error: "Unknown action" };
  } catch (error) {
    return {
      success: false,
      message: null,
      error: getAdminListingsError(error, "Failed to update listing"),
    };
  }
}

function humanizeStatus(value: string | undefined): string {
  return String(value || "pending")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getReviewChecklist(listing: AdminListing) {
  return [
    {
      label: "Photos",
      value: `${listing.photos?.length ?? 0} uploaded`,
    },
    {
      label: "Description",
      value: listing.description?.trim() ? "Present" : "Missing",
    },
    {
      label: "Location",
      value: listing.city ? "Present" : "Missing",
    },
    {
      label: "Category",
      value: listing.category?.name || "Missing",
    },
  ];
}

function ListingCard({
  listing,
  onReject,
}: {
  listing: AdminListing;
  onReject: (listing: AdminListing) => void;
}) {
  const navigation = useNavigation();
  const isApproving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "approve" &&
    navigation.formData?.get("listingId") === listing.id;
  const reviewChecklist = getReviewChecklist(listing);
  const verificationLabel = humanizeStatus(listing.verificationStatus);
  const moderationLabel = humanizeStatus(listing.moderationStatus);
  const submittedDate = formatDate(new Date(listing.createdAt));
  const updatedDate = listing.updatedAt
    ? formatDate(new Date(listing.updatedAt))
    : submittedDate;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Photos */}
      {listing.photos && listing.photos.length > 0 ? (
        <img
          src={listing.photos[0]}
          alt={listing.title}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
          <Home className="h-10 w-10 text-gray-400" />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-gray-900 line-clamp-1">{listing.title}</h3>
          {listing.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{listing.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="truncate">
              {listing.owner.firstName} {listing.owner.lastName ?? ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span>{formatCurrency(listing.basePrice, listing.currency)}/night</span>
          </div>
          {listing.category && (
            <div className="flex items-center gap-1">
              <Home className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span className="truncate">{listing.category.name}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span>{submittedDate}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            Verification: {verificationLabel}
          </span>
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            Moderation: {moderationLabel}
          </span>
        </div>

        {listing.city && (
          <p className="text-xs text-gray-500">
            {listing.city}
            {listing.country ? `, ${listing.country}` : ""}
          </p>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Review Snapshot
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
            {reviewChecklist.map((item) => (
              <div key={item.label}>
                <p className="text-slate-500">{item.label}</p>
                <p className="font-medium">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600 space-y-1">
            <p>
              Owner email: <span className="font-medium text-slate-800">{listing.owner.email}</span>
            </p>
            <p>
              Last updated: <span className="font-medium text-slate-800">{updatedDate}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Form method="post" className="flex-1">
            <input type="hidden" name="intent" value="approve" />
            <input type="hidden" name="listingId" value={listing.id} />
            <UnifiedButton
              type="submit"
              variant="primary"
              size="sm"
              className="w-full"
              loading={isApproving}
              disabled={isApproving}
            >
              {!isApproving ? (
                <CheckCircle className="h-4 w-4" />
              ) : null}
              Approve
            </UnifiedButton>
          </Form>

          <UnifiedButton
            variant="destructive"
            size="sm"
            className="flex-1"
            onClick={() => onReject(listing)}
            disabled={navigation.state === "submitting"}
          >
            <XCircle className="h-4 w-4" />
            Reject
          </UnifiedButton>
        </div>
      </div>
    </div>
  );
}

function RejectModal({
  listing,
  onClose,
  error,
}: {
  listing: AdminListing;
  onClose: () => void;
  error?: string | null;
}) {
  const navigation = useNavigation();
  const isSubmitting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "reject" &&
    navigation.formData?.get("listingId") === listing.id;

  return (
    <Dialog
      open
      onClose={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      title="Reject Listing"
      description={`You are rejecting: ${listing.title}`}
      size="md"
    >
      <Form method="post">
        <input type="hidden" name="intent" value="reject" />
        <input type="hidden" name="listingId" value={listing.id} />

        {error ? (
          <div
            id="reject-listing-error"
            className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-2 mb-4">
          <label
            htmlFor="reject-listing-reason"
            className="block text-sm font-medium text-gray-700"
          >
            Reason (optional - shown to owner)
          </label>
          <textarea
            id="reject-listing-reason"
            name="reason"
            rows={3}
            disabled={isSubmitting}
            aria-describedby={error ? "reject-listing-error" : undefined}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. Photos are unclear, description incomplete..."
          />
        </div>

        <DialogFooter>
          <UnifiedButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </UnifiedButton>
          <UnifiedButton
            type="submit"
            variant="destructive"
            size="sm"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Confirm Reject
          </UnifiedButton>
        </DialogFooter>
      </Form>
    </Dialog>
  );
}

export default function AdminListingsPage() {
  const { listings, total, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const { t } = useTranslation();
  const [rejectTarget, setRejectTarget] = useState<AdminListing | null>(null);
  const revalidator = useRevalidator();

  useEffect(() => {
    if (actionData?.success) {
      setRejectTarget(null);
    }
  }, [actionData?.success]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-600" />
            Listing Approvals
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} listing{total !== 1 ? "s" : ""} pending review
          </p>
        </div>
      </div>

      {/* Action feedback */}
      {actionData?.success && actionData.message && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4 flex items-center gap-2 text-green-800">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{actionData.message}</span>
        </div>
      )}
      {actionData?.error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 flex items-center gap-2 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{actionData.error}</span>
        </div>
      )}

      {/* Load error */}
      {error && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-yellow-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="text-sm">Failed to load listings: {error}</span>
            </div>
            <UnifiedButton variant="outline" size="sm" onClick={() => revalidator.revalidate()}>
              Retry
            </UnifiedButton>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!error && listings.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-lg font-medium">All caught up!</p>
          <p className="text-sm">No listings are pending approval right now.</p>
        </div>
      )}

      {/* Cards grid */}
      {listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onReject={setRejectTarget}
            />
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          listing={rejectTarget}
          onClose={() => setRejectTarget(null)}
          error={actionData?.error}
        />
      )}
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
