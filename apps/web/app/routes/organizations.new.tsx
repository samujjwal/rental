/* eslint-disable react-refresh/only-export-components */

import type { MetaFunction, ActionFunctionArgs } from "react-router";
import { useNavigate, useActionData, Form, useNavigation, redirect } from "react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Users,
  Shield,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { organizationsApi } from "~/lib/api/organizations";
import type { BusinessType, CreateOrganizationDto } from "~/lib/api/organizations";
import { UnifiedButton } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Create Organization | GharBatai Rentals" },
    { name: "description", content: "Set up your business rental organization" },
  ];
};

export async function clientAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  
  const data: CreateOrganizationDto = {
    name: formData.get("name") as string,
    description: formData.get("description") as string || undefined,
    businessType: formData.get("businessType") as BusinessType,
    taxId: formData.get("taxId") as string || undefined,
    email: formData.get("email") as string,
    phoneNumber: formData.get("phoneNumber") as string || undefined,
    addressLine1: formData.get("addressLine1") as string || undefined,
    addressLine2: formData.get("addressLine2") as string || undefined,
    city: formData.get("city") as string || undefined,
    state: formData.get("state") as string || undefined,
    postalCode: formData.get("postalCode") as string || undefined,
    country: formData.get("country") as string || undefined,
  };

  // Validation
  if (!data.name || data.name.trim().length < 2) {
    return { error: "Organization name must be at least 2 characters" };
  }
  if (!data.email || !data.email.includes("@")) {
    return { error: "Please enter a valid email address" };
  }
  if (!data.businessType) {
    return { error: "Please select a business type" };
  }

  try {
    const organization = await organizationsApi.createOrganization(data);
    return redirect(`/organizations/${organization.id}`);
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: unknown }).response === "object" &&
      (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
        ? String((error as { response: { data: { message: unknown } } }).response.data.message)
        : error instanceof Error
          ? error.message
          : "Failed to create organization";
    return { error: message };
  }
}

const BUSINESS_TYPES: { value: BusinessType; label: string; description: string }[] = [
  {
    value: "INDIVIDUAL",
    label: "Individual / Sole Proprietor",
    description: "Operating as yourself without a formal business structure",
  },
  {
    value: "LLC",
    label: "Limited Liability Company (LLC)",
    description: "A business structure that protects personal assets",
  },
  {
    value: "CORPORATION",
    label: "Corporation",
    description: "A legal entity separate from its owners",
  },
  {
    value: "PARTNERSHIP",
    label: "Partnership",
    description: "Two or more people sharing ownership",
  },
];

export default function NewOrganizationPage() {
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [step, setStep] = useState(1);

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {step > 1 ? <CheckCircle className="w-5 h-5" /> : "1"}
            </div>
            <div className="w-24 h-1 bg-muted mx-2">
              <div
                className={`h-full bg-primary transition-all ${step > 1 ? "w-full" : "w-0"}`}
              />
            </div>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {step > 2 ? <CheckCircle className="w-5 h-5" /> : "2"}
            </div>
            <div className="w-24 h-1 bg-muted mx-2">
              <div
                className={`h-full bg-primary transition-all ${step > 2 ? "w-full" : "w-0"}`}
              />
            </div>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              3
            </div>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Create Your Organization</h1>
          <p className="text-muted-foreground mt-2">
            Set up your business account to manage multiple listings and team members
          </p>
        </div>

        {actionData?.error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="bg-card border rounded-lg p-6 space-y-6">
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Business Type
              </h2>
              <p className="text-sm text-muted-foreground">
                Select the type of business entity for your organization
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {BUSINESS_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`cursor-pointer border rounded-lg p-4 transition-all ${
                      selectedType === type.value
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="businessType"
                      value={type.value}
                      checked={selectedType === type.value}
                      onChange={() => setSelectedType(type.value)}
                      className="sr-only"
                    />
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                          selectedType === type.value
                            ? "border-primary"
                            : "border-muted-foreground"
                        }`}
                      >
                        {selectedType === type.value && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{type.label}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {type.description}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!selectedType}
                >
                  Continue
                </UnifiedButton>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Organization Details
              </h2>
              <input type="hidden" name="businessType" value={selectedType || ""} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="Acme Rentals Inc."
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="Tell us about your rental business..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Business Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="contact@acmerentals.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Tax ID / EIN
                  </label>
                  <input
                    type="text"
                    name="taxId"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="XX-XXXXXXX"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <UnifiedButton type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </UnifiedButton>
                <UnifiedButton type="button" onClick={() => setStep(3)}>
                  Continue
                </UnifiedButton>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Business Address
              </h2>
              <input type="hidden" name="businessType" value={selectedType || ""} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    name="addressLine1"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="123 Business St"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    name="addressLine2"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="Suite 100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="San Francisco"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    State / Province
                  </label>
                  <input
                    type="text"
                    name="state"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="CA"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="94105"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    defaultValue="United States"
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <UnifiedButton type="button" variant="outline" onClick={() => setStep(2)}>
                  Back
                </UnifiedButton>
                <UnifiedButton type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Organization"
                  )}
                </UnifiedButton>
              </div>
            </>
          )}
        </Form>

        {/* Benefits Section */}
        <div className="mt-8 bg-muted/50 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-4">
            Organization Benefits
          </h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Manage multiple listings under one business profile</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Invite team members with role-based access</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Consolidated financial reporting and payouts</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Professional business verification badge</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
