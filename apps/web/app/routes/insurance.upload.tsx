import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, redirect } from "react-router";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { uploadApi } from "~/lib/api/upload";
import { getUser } from "~/utils/auth";
import { listingsApi } from "~/lib/api/listings";
import { insuranceApi } from "~/lib/api/insurance";
import { RouteErrorBoundary } from "~/components/ui";

interface InsuranceRequirement {
  required: boolean;
  reason?: string;
  type?: string;
  minimumCoverage?: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | null): value is string =>
  Boolean(value && UUID_PATTERN.test(value));
const MAX_POLICY_FIELD_LENGTH = 120;
const MAX_PROVIDER_FIELD_LENGTH = 120;
const MAX_TYPE_FIELD_LENGTH = 80;
const MAX_COVERAGE_AMOUNT = 10_000_000;

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return redirect("/dashboard");
  }

  const url = new URL(request.url);
  const listingId = url.searchParams.get("listingId");

  if (!isUuid(listingId)) {
    return redirect("/listings");
  }
  try {
    const listing = await listingsApi.getListingById(listingId);
    if (user.role !== "admin" && listing.ownerId !== user.id) {
      return redirect("/listings");
    }

    const requirement = await insuranceApi.getListingRequirement(listingId);
    return { listingId, requirement };
  } catch (error) {
    console.error("[insurance.upload] loader failed:", error);
    return redirect("/listings");
  }
}

export default function InsuranceUpload() {
  const { listingId, requirement } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const documentFile = formData.get("document") as File | null;
    if (!documentFile) {
      setError("Please attach your insurance document.");
      setUploading(false);
      return;
    }
    if (documentFile.size > 10 * 1024 * 1024) {
      setError("Document must be 10MB or smaller.");
      setUploading(false);
      return;
    }
    const allowedFileTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    if (!allowedFileTypes.has(documentFile.type)) {
      setError("Only PDF, JPG, PNG, or WEBP documents are allowed.");
      setUploading(false);
      return;
    }

    let documentUrl = "";
    try {
      const uploadResult = await uploadApi.uploadDocument(documentFile);
      documentUrl = uploadResult.url;
    } catch {
      setError("Unable to upload document. Please try again.");
      setUploading(false);
      return;
    }

    const coverageAmount = Number(formData.get("coverageAmount"));
    const policyNumber = String(formData.get("policyNumber") || "")
      .trim()
      .slice(0, MAX_POLICY_FIELD_LENGTH);
    const provider = String(formData.get("provider") || "")
      .trim()
      .slice(0, MAX_PROVIDER_FIELD_LENGTH);
    const type = String(formData.get("type") || "")
      .trim()
      .slice(0, MAX_TYPE_FIELD_LENGTH);
    const effectiveDate = String(formData.get("effectiveDate") || "");
    const expirationDate = String(formData.get("expirationDate") || "");
    if (!policyNumber || !provider || !type) {
      setError("Policy number, provider, and insurance type are required.");
      setUploading(false);
      return;
    }
    if (!Number.isFinite(coverageAmount) || coverageAmount <= 0) {
      setError("Coverage amount must be a valid positive number.");
      setUploading(false);
      return;
    }
    if (coverageAmount > MAX_COVERAGE_AMOUNT) {
      setError("Coverage amount exceeds the allowed limit.");
      setUploading(false);
      return;
    }
    if (
      requirement.required &&
      typeof requirement.minimumCoverage === "number" &&
      coverageAmount < requirement.minimumCoverage
    ) {
      setError(
        `Coverage amount must be at least $${requirement.minimumCoverage.toLocaleString()}.`
      );
      setUploading(false);
      return;
    }
    if (!effectiveDate || !expirationDate) {
      setError("Please provide effective and expiration dates.");
      setUploading(false);
      return;
    }
    const effectiveAt = new Date(effectiveDate);
    const expirationAt = new Date(expirationDate);
    if (
      Number.isNaN(effectiveAt.getTime()) ||
      Number.isNaN(expirationAt.getTime())
    ) {
      setError("Please provide valid insurance dates.");
      setUploading(false);
      return;
    }
    if (expirationAt <= effectiveAt) {
      setError("Expiration date must be after effective date.");
      setUploading(false);
      return;
    }

    const data = {
      listingId,
      policyNumber,
      provider,
      type,
      coverageAmount,
      effectiveDate,
      expirationDate,
      documentUrl,
    };

    try {
      await insuranceApi.uploadPolicy(data);

      // Success - redirect to listings
      navigate("/listings?status=pending_insurance");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-card shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">
            Upload Insurance Policy
          </h1>

          {/* Requirement Notice */}
          <div
            className={cn(
              "mb-8 p-4 rounded-lg",
              requirement.required
                ? "bg-warning/10 border border-warning/20"
                : "bg-primary/10 border border-primary/20"
            )}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {requirement.required ? (
                  <svg
                    className="h-6 w-6 text-warning"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-6 w-6 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <h3
                  className={cn(
                    "text-sm font-medium",
                    requirement.required
                      ? "text-warning-foreground"
                      : "text-primary-foreground"
                  )}
                >
                  {requirement.required
                    ? "Insurance Required"
                    : "Insurance Optional"}
                </h3>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    requirement.required
                      ? "text-warning-foreground/80"
                      : "text-primary-foreground/80"
                  )}
                >
                  {requirement.reason}
                </p>
                {requirement.required && (
                  <div className="mt-2 text-sm text-warning-foreground/80">
                    <p>
                      <strong>Required Type:</strong> {requirement.type}
                    </p>
                    <p>
                      <strong>Minimum Coverage:</strong> $
                      {requirement.minimumCoverage
                        ? requirement.minimumCoverage.toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Policy Number */}
            <div>
              <label
                htmlFor="policyNumber"
                className="block text-sm font-medium text-foreground"
              >
                Policy Number *
              </label>
              <input
                type="text"
                id="policyNumber"
                name="policyNumber"
                required
                maxLength={MAX_POLICY_FIELD_LENGTH}
                className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-ring"
                placeholder="POL-123456"
              />
            </div>

            {/* Provider */}
            <div>
              <label
                htmlFor="provider"
                className="block text-sm font-medium text-foreground"
              >
                Insurance Provider *
              </label>
              <input
                type="text"
                id="provider"
                name="provider"
                required
                maxLength={MAX_PROVIDER_FIELD_LENGTH}
                className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-ring"
                placeholder="State Farm, Geico, etc."
              />
            </div>

            {/* Type */}
            <div>
              <label
                htmlFor="type"
                className="block text-sm font-medium text-foreground"
              >
                Insurance Type *
              </label>
              <select
                id="type"
                name="type"
                required
                defaultValue={requirement.type || ""}
                className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-ring"
              >
                <option value="">Select type...</option>
                <option value="LIABILITY">Liability</option>
                <option value="COMPREHENSIVE">Comprehensive</option>
                <option value="COLLISION">Collision</option>
                <option value="DAMAGE">Damage Protection</option>
              </select>
            </div>

            {/* Coverage Amount */}
            <div>
              <label
                htmlFor="coverageAmount"
                className="block text-sm font-medium text-foreground"
              >
                Coverage Amount * (in dollars)
              </label>
              <input
                type="number"
                id="coverageAmount"
                name="coverageAmount"
                required
                min={requirement.minimumCoverage || 0}
                max={MAX_COVERAGE_AMOUNT}
                className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-ring"
                placeholder={requirement.minimumCoverage?.toString() || "50000"}
              />
              {requirement.minimumCoverage && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Minimum required: $
                  {requirement.minimumCoverage.toLocaleString()}
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="effectiveDate"
                  className="block text-sm font-medium text-foreground"
                >
                  Effective Date *
                </label>
                <input
                  type="date"
                  id="effectiveDate"
                  name="effectiveDate"
                  required
                  className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-ring"
                />
              </div>

              <div>
                <label
                  htmlFor="expirationDate"
                  className="block text-sm font-medium text-foreground"
                >
                  Expiration Date *
                </label>
                <input
                  type="date"
                  id="expirationDate"
                  name="expirationDate"
                  required
                  className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-ring"
                />
              </div>
            </div>

            {/* Document Upload */}
            <div>
              <label
                htmlFor="documentUrl"
                className="block text-sm font-medium text-foreground"
              >
                Insurance Document * (PDF)
              </label>
              <div className="mt-1 flex items-center">
                <input
                  type="file"
                  id="document"
                  name="document"
                  accept=".pdf,image/*"
                  required
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload your insurance policy document (Max 10MB)
              </p>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between pt-6">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-input rounded-md shadow-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-6 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:bg-muted disabled:text-muted-foreground"
              >
                {uploading ? "Uploading..." : "Submit for Verification"}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-border">
            <h3 className="text-sm font-medium text-foreground mb-2">
              What happens next?
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Your insurance policy will be reviewed by our team</li>
              <li>Verification typically takes 24-48 hours</li>
              <li>You'll receive an email notification once verified</li>
              <li>
                Your listing will become active after insurance verification
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
export { RouteErrorBoundary as ErrorBoundary };

