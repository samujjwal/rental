import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useNavigate, redirect } from "react-router";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/lib/utils";
import { uploadApi } from "~/lib/api/upload";
import { getUser } from "~/utils/auth";
import { listingsApi } from "~/lib/api/listings";
import { insuranceApi } from "~/lib/api/insurance";
import { RouteErrorBoundary } from "~/components/ui";
import { useTranslation } from "react-i18next";
import { isAppEntityId } from "~/utils/entity-id";

interface InsuranceRequirement {
  required: boolean;
  reason?: string;
  type?: string;
  minimumCoverage?: number;
}

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

  if (!isAppEntityId(listingId)) {
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
    return redirect("/listings");
  }
}

export const meta: MetaFunction = () => {
  return [
    { title: "Upload Insurance | GharBatai Rentals" },
    { name: "description", content: "Upload insurance policy documents for your rental listings" },
  ];
};

export default function InsuranceUpload() {
  const { listingId, requirement } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
        `Coverage amount must be at least ${formatCurrency(requirement.minimumCoverage)}.`
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

      navigate("/listings");
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
            {t("pages.insurance.uploadTitle")}
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
                    ? t("pages.insurance.insuranceRequired")
                    : t("pages.insurance.insuranceOptional")}
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
                      <strong>{t("pages.insurance.requiredType")}</strong> {requirement.type}
                    </p>
                    <p>
                      <strong>{t("pages.insurance.minimumCoverageLabel")}</strong>{" "}
                      {requirement.minimumCoverage
                        ? formatCurrency(requirement.minimumCoverage)
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
                {t("pages.insurance.policyNumber")}
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
                {t("pages.insurance.insuranceProvider")}
              </label>
              <input
                type="text"
                id="provider"
                name="provider"
                required
                maxLength={MAX_PROVIDER_FIELD_LENGTH}
                className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-ring"
                placeholder="Nepal Insurance, Sagarmatha Insurance, etc."
              />
            </div>

            {/* Type */}
            <div>
              <label
                htmlFor="type"
                className="block text-sm font-medium text-foreground"
              >
                {t("pages.insurance.insuranceType")}
              </label>
              <select
                id="type"
                name="type"
                required
                defaultValue={requirement.type || ""}
                className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-ring"
              >
                <option value="">{t("pages.insurance.selectType")}</option>
                <option value="LIABILITY">{t("pages.insurance.liability")}</option>
                <option value="COMPREHENSIVE">{t("pages.insurance.comprehensive")}</option>
                <option value="COLLISION">{t("pages.insurance.collision")}</option>
                <option value="DAMAGE">{t("pages.insurance.damageProtectionType")}</option>
              </select>
            </div>

            {/* Coverage Amount */}
            <div>
              <label
                htmlFor="coverageAmount"
                className="block text-sm font-medium text-foreground"
              >
                {t("pages.insurance.coverageAmountLabel")}
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
                  {t("pages.insurance.minimumRequired", { amount: formatCurrency(requirement.minimumCoverage) })}
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
                  {t("pages.insurance.effectiveDate")}
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
                  {t("pages.insurance.expirationDate")}
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
                {t("pages.insurance.insuranceDocument")}
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
                {t("pages.insurance.uploadDocMax")}
              </p>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between pt-6">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-input rounded-md shadow-sm hover:bg-muted"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-6 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:bg-muted disabled:text-muted-foreground"
              >
                {uploading ? t("pages.insurance.uploading") : t("pages.insurance.submitForVerification")}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-border">
            <h3 className="text-sm font-medium text-foreground mb-2">
              {t("pages.insurance.whatHappensNext")}
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>{t("pages.insurance.reviewStep1")}</li>
              <li>{t("pages.insurance.reviewStep2")}</li>
              <li>{t("pages.insurance.reviewStep3")}</li>
              <li>
                {t("pages.insurance.reviewStep4")}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
export { RouteErrorBoundary as ErrorBoundary };
