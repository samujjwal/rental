
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useActionData, useNavigate, Link, redirect } from "react-router";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";
import { PageSkeleton } from "~/components/ui";
import { RouteErrorBoundary } from "~/components/ui/error-state";
import { organizationsApi } from "~/lib/api/organizations";
import type { Organization as ApiOrganization } from "~/lib/api/organizations";
import { getUser } from "~/utils/auth";

export const ErrorBoundary = RouteErrorBoundary;

type Organization = ApiOrganization & {
  settings?: {
    autoApproveMembers: boolean;
    requireInsurance: boolean;
    allowPublicProfile: boolean;
  };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | undefined): value is string =>
  Boolean(value && UUID_PATTERN.test(value));

async function getOrganizationMembershipRole(userId: string, organizationId: string) {
  const members = await organizationsApi.getMembers(organizationId);
  const currentMember = members.members.find((member) => member.userId === userId);
  return currentMember?.role;
}

export async function clientLoader({ params, request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  if (!isUuid(params.id)) {
    return redirect("/organizations");
  }

  try {
    if (user.role !== "admin") {
      const role = await getOrganizationMembershipRole(user.id, params.id);
      if (role !== "OWNER" && role !== "ADMIN") {
        return redirect("/organizations");
      }
    }

    const organization = (await organizationsApi.getOrganization(
      params.id
    )) as Organization;
    return { organization };
  } catch {
    return redirect("/organizations");
  }
}

export async function clientAction({ request, params }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  if (!isUuid(params.id)) {
    return { success: false, error: "Organization not found" };
  }
  const formData = await request.formData();
  const action = String(formData.get("_action") || "");

  if (user.role !== "admin") {
    const role = await getOrganizationMembershipRole(user.id, params.id);
    if (role !== "OWNER" && role !== "ADMIN") {
      return { success: false, error: "You do not have access to this organization" };
    }
    if (action === "deactivate" && role !== "OWNER") {
      return { success: false, error: "Only organization owners can deactivate organizations" };
    }
  }

  if (action === "update") {
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("emailAddress") || "").trim();
    const website = String(formData.get("website") || "").trim();
    const phoneNumber = String(formData.get("phoneNumber") || "").trim();
    const postalCode = String(formData.get("postalCode") || "").trim();
    const description = String(formData.get("description") || "").trim();
    if (!name || name.length < 2) {
      return { success: false, error: "Organization name must be at least 2 characters" };
    }
    if (name.length > 120) {
      return { success: false, error: "Organization name must be 120 characters or fewer" };
    }
    if (description.length > 2000) {
      return { success: false, error: "Description must be 2000 characters or fewer" };
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "Please provide a valid email address" };
    }
    if (website) {
      try {
        const parsed = new URL(website);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return { success: false, error: "Website must use http:// or https://" };
        }
      } catch {
        return { success: false, error: "Please provide a valid website URL" };
      }
    }
    if (phoneNumber && !/^\+?[0-9()\-\s]{7,20}$/.test(phoneNumber)) {
      return { success: false, error: "Please provide a valid phone number" };
    }
    if (postalCode && postalCode.length > 20) {
      return { success: false, error: "Postal code must be 20 characters or fewer" };
    }

    try {
      await organizationsApi.updateOrganization(params.id, {
        name,
        description: description || undefined,
        website: website || undefined,
        addressLine1: String(formData.get("address") || "").trim() || undefined,
        addressLine2: undefined,
        city: String(formData.get("city") || "").trim() || undefined,
        state: String(formData.get("state") || "").trim() || undefined,
        postalCode: postalCode || undefined,
        country: String(formData.get("country") || "").trim() || undefined,
        phoneNumber: phoneNumber || undefined,
        email: email || undefined,
        settings: {
          autoApproveMembers: formData.get("autoApproveMembers") === "on",
          requireInsurance: formData.get("requireInsurance") === "on",
          allowPublicProfile: formData.get("allowPublicProfile") === "on",
        },
      });

      return { success: true, message: "Organization updated successfully" };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error && typeof error === "object" && "message" in error
            ? String((error as { message?: string }).message)
            : "Failed to update organization",
      };
    }
  }

  if (action === "deactivate") {
    const deactivateConfirmation = String(formData.get("deactivateConfirmation") || "")
      .trim()
      .toUpperCase();
    if (deactivateConfirmation !== "DEACTIVATE") {
      return { success: false, error: "Type DEACTIVATE to confirm organization deactivation." };
    }
    try {
      await organizationsApi.deactivateOrganization(params.id);

      return {
        success: true,
        message: "Organization deactivated",
        redirect: "/organizations",
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error && typeof error === "object" && "message" in error
            ? String((error as { message?: string }).message)
            : "Failed to deactivate organization",
      };
    }
  }

  return { success: false, error: "Unknown action" };
}

export default function OrganizationSettings() {
  const { organization } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigate = useNavigate();
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateConfirmation, setDeactivateConfirmation] = useState("");

  useEffect(() => {
    if (actionData?.redirect) {
      navigate(actionData.redirect);
    }
  }, [actionData, navigate]);

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              to="/organizations"
              className="text-primary hover:text-primary/80"
            >
              ← Back to Organizations
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Organization Settings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {organization.name}
          </p>
        </div>

        {/* Success/Error Messages */}
        {actionData?.success && (
          <div className="mb-6 bg-success/10 border border-success/20 text-success px-4 py-3 rounded">
            {actionData.message}
          </div>
        )}
        {actionData?.error && (
          <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-6">
          <input type="hidden" name="_action" value="update" />

          {/* Basic Information */}
          <div className="bg-card shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">
              Basic Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={organization.name}
                  required
                  maxLength={120}
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Slug (URL identifier)
                </label>
                <input
                  type="text"
                  value={organization.slug}
                  disabled
                  className="w-full border border-input rounded-md px-3 py-2 bg-muted text-muted-foreground"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Slug cannot be changed after creation
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Business Type
                </label>
                <input
                  type="text"
                  value={organization.businessType || ""}
                  disabled
                  className="w-full border border-input rounded-md px-3 py-2 bg-muted text-muted-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={4}
                  maxLength={2000}
                  defaultValue={organization.description ?? ""}
                  placeholder="Tell us about your organization..."
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-card shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">
              Contact Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  defaultValue={organization.website || ""}
                  maxLength={2048}
                  placeholder="https://example.com"
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="emailAddress"
                  defaultValue={organization.email || ""}
                  maxLength={254}
                  placeholder="contact@example.com"
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  defaultValue={organization.phone || ""}
                  maxLength={20}
                  placeholder="+1 (555) 123-4567"
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Address
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    name="address"
                    defaultValue={organization.address ?? ""}
                    maxLength={120}
                    placeholder="123 Main St"
                    className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                  />
                  <input
                    type="text"
                    name="city"
                    defaultValue={organization.city ?? ""}
                    maxLength={80}
                    placeholder="City"
                    className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                  />
                  <input
                    type="text"
                    name="state"
                    defaultValue={organization.state ?? ""}
                    maxLength={80}
                    placeholder="State"
                    className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                  />
                  <input
                    type="text"
                    name="postalCode"
                    defaultValue={organization.zipCode ?? ""}
                    maxLength={20}
                    placeholder="Postal Code"
                    className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                  />
                  <input
                    type="text"
                    name="country"
                    defaultValue={organization.country ?? ""}
                    maxLength={80}
                    placeholder="Country"
                    className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary md:col-span-2"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Organization Settings */}
          <div className="bg-card shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">
              Organization Settings
            </h2>

            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="autoApproveMembers"
                    name="autoApproveMembers"
                    type="checkbox"
                    defaultChecked={organization.settings?.autoApproveMembers}
                    className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                  />
                </div>
                <div className="ml-3">
                  <label
                    htmlFor="autoApproveMembers"
                    className="font-medium text-foreground"
                  >
                    Auto-approve new members
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Automatically approve member join requests without manual
                    review
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="requireInsurance"
                    name="requireInsurance"
                    type="checkbox"
                    defaultChecked={organization.settings?.requireInsurance}
                    className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                  />
                </div>
                <div className="ml-3">
                  <label
                    htmlFor="requireInsurance"
                    className="font-medium text-foreground"
                  >
                    Require insurance for all listings
                  </label>
                  <p className="text-sm text-muted-foreground">
                    All listings from this organization must have valid
                    insurance
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="allowPublicProfile"
                    name="allowPublicProfile"
                    type="checkbox"
                    defaultChecked={organization.settings?.allowPublicProfile}
                    className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                  />
                </div>
                <div className="ml-3">
                  <label
                    htmlFor="allowPublicProfile"
                    className="font-medium text-foreground"
                  >
                    Public profile
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Allow your organization profile to be visible to all users
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          <div className="bg-card shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">
              Verification Status
            </h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Status</p>
                <p className="mt-1 text-lg font-medium">
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full",
                      organization.verificationStatus === "VERIFIED"
                        ? "bg-success/10 text-success"
                        : organization.verificationStatus === "PENDING"
                          ? "bg-warning/10 text-warning"
                          : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {organization.verificationStatus}
                  </span>
                </p>
              </div>
              {organization.verificationStatus === "PENDING" && (
                <p className="text-sm text-muted-foreground">
                  Your verification request is being reviewed
                </p>
              )}
              {organization.verificationStatus === "REJECTED" && (
                <Link
                  to="/contact"
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90"
                >
                  Contact Support
                </Link>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
            >
              Save Changes
            </button>
          </div>
        </Form>

        {/* Danger Zone */}
        <div className="mt-8 bg-card shadow rounded-lg p-6 border-2 border-destructive/20">
          <h2 className="text-lg font-medium text-destructive mb-4">
            Danger Zone
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Deactivate Organization
              </p>
              <p className="text-sm text-muted-foreground">
                Deactivating will hide all listings and prevent new bookings
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeactivateConfirmation("");
                setShowDeactivateModal(true);
              }}
              className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-md hover:bg-destructive/90"
            >
              Deactivate
            </button>
          </div>
        </div>
      </div>

      {/* Deactivate Confirmation Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-foreground mb-4">
              Deactivate Organization?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to deactivate this organization? All
              listings will be hidden and you won't be able to create new
              bookings. You can reactivate it later.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                Type DEACTIVATE to confirm
              </label>
              <input
                type="text"
                name="deactivateConfirmation"
                value={deactivateConfirmation}
                onChange={(event) => setDeactivateConfirmation(event.target.value)}
                maxLength={20}
                className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                autoComplete="off"
              />
            </div>
            <Form method="post" className="flex justify-end space-x-3">
              <input type="hidden" name="_action" value="deactivate" />
              <input
                type="hidden"
                name="deactivateConfirmation"
                value={deactivateConfirmation}
              />
              <button
                type="button"
                onClick={() => {
                  setDeactivateConfirmation("");
                  setShowDeactivateModal(false);
                }}
                className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-input rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={deactivateConfirmation.trim().toUpperCase() !== "DEACTIVATE"}
                className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90"
              >
                Deactivate
              </button>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
