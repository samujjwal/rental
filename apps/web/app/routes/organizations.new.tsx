
import type { MetaFunction, ActionFunctionArgs } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useNavigate, useActionData, Form, useNavigation, useSubmit, redirect } from "react-router";
import { useRef, useState } from "react";
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
import { UnifiedButton , RouteErrorBoundary } from "~/components/ui";
import { getUser } from "~/utils/auth";
import { APP_PHONE_PLACEHOLDER } from "~/config/locale";
import { useTranslation } from "react-i18next";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const meta: MetaFunction = () => {
  return [
    { title: "Create Organization | GharBatai Rentals" },
    { name: "description", content: "Set up your business rental organization" },
  ];
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  return null;
}

export function getCreateOrganizationError(
  error: unknown,
  fallback = "Failed to create organization"
): string {
  const responseMessage =
    error &&
    typeof error === "object" &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;

  if (responseMessage) {
    return String(responseMessage);
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try creating the organization again.";
  }

  return getActionableErrorMessage(error, fallback, {
    [ApiErrorType.CONFLICT]: "An organization with these details already exists. Review the form and try again.",
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try creating the organization again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Creating the organization is taking too long. Try again.",
  });
}

export async function clientAction({ request }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent !== "create-organization") {
    return { error: "Invalid request." };
  }
  const rawBusinessType = String(formData.get("businessType") ?? "")
    .trim()
    .toUpperCase();
  const allowedBusinessTypes: BusinessType[] = [
    "INDIVIDUAL",
    "LLC",
    "CORPORATION",
    "PARTNERSHIP",
  ];
  const businessType = allowedBusinessTypes.includes(rawBusinessType as BusinessType)
    ? (rawBusinessType as BusinessType)
    : null;
  
  if (!businessType) {
    return { error: "Please select a valid business type" };
  }

  const data: CreateOrganizationDto = {
    name: String(formData.get("name") ?? "").trim().slice(0, 120),
    description:
      String(formData.get("description") ?? "").trim().slice(0, 2000) || undefined,
    businessType,
    taxId: String(formData.get("taxId") ?? "").trim().slice(0, 50) || undefined,
    email: String(formData.get("email") ?? "").trim().slice(0, 254),
    phoneNumber:
      String(formData.get("phoneNumber") ?? "").trim().slice(0, 20) || undefined,
    addressLine1:
      String(formData.get("addressLine1") ?? "").trim().slice(0, 120) || undefined,
    addressLine2:
      String(formData.get("addressLine2") ?? "").trim().slice(0, 120) || undefined,
    city: String(formData.get("city") ?? "").trim().slice(0, 80) || undefined,
    state: String(formData.get("state") ?? "").trim().slice(0, 80) || undefined,
    postalCode:
      String(formData.get("postalCode") ?? "").trim().slice(0, 20) || undefined,
    country: String(formData.get("country") ?? "").trim().slice(0, 80) || undefined,
  };

  // Validation
  if (!data.name || data.name.trim().length < 2) {
    return { error: "Organization name must be at least 2 characters" };
  }
  if (data.name.length > 120) {
    return { error: "Organization name must be 120 characters or fewer" };
  }
  if (data.description && data.description.length > 2000) {
    return { error: "Description must be 2000 characters or fewer" };
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { error: "Please enter a valid email address" };
  }
  if (data.phoneNumber && !/^\+?[0-9()\-\s]{7,20}$/.test(data.phoneNumber)) {
    return { error: "Please enter a valid phone number" };
  }
  if (data.postalCode && data.postalCode.length > 20) {
    return { error: "Postal code must be 20 characters or fewer" };
  }
  try {
    const organization = await organizationsApi.createOrganization(data);
    return redirect(`/organizations/${organization.id}/settings`);
  } catch (error: unknown) {
    return { error: getCreateOrganizationError(error) };
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
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [step, setStep] = useState(1);
  const [formValues, setFormValues] = useState({
    name: "",
    description: "",
    email: "",
    phoneNumber: "",
    taxId: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Nepal",
  });
  const { t } = useTranslation();

  const isSubmitting = navigation.state === "submitting";

  const collectFormValues = (form: HTMLFormElement | null) => {
    if (!form) {
      return formValues;
    }

    const formData = new FormData(form);

    return {
      ...formValues,
      name: String(formData.get("name") ?? formValues.name),
      description: String(formData.get("description") ?? formValues.description),
      email: String(formData.get("email") ?? formValues.email),
      phoneNumber: String(formData.get("phoneNumber") ?? formValues.phoneNumber),
      taxId: String(formData.get("taxId") ?? formValues.taxId),
      addressLine1: String(formData.get("addressLine1") ?? formValues.addressLine1),
      addressLine2: String(formData.get("addressLine2") ?? formValues.addressLine2),
      city: String(formData.get("city") ?? formValues.city),
      state: String(formData.get("state") ?? formValues.state),
      postalCode: String(formData.get("postalCode") ?? formValues.postalCode),
      country: String(formData.get("country") ?? formValues.country),
    };
  };

  const handleCreateOrganization = (form: HTMLFormElement | null) => {
    if (!selectedType) {
      return;
    }

    const nextValues = collectFormValues(form);
    setFormValues(nextValues);

    const formData = new FormData();
    formData.set("intent", "create-organization");
    formData.set("businessType", selectedType);

    Object.entries(nextValues).forEach(([key, value]) => {
      if (value) {
        formData.set(key, value);
      }
    });

    submit(formData, { method: "post" });
  };

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
            <span>{t("common.back")}</span>
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
          <h1 className="text-2xl font-bold text-foreground">{t("organizations.createYourOrg")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("organizations.createSubtitle")}
          </p>
        </div>

        {actionData?.error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {actionData.error}
          </div>
        )}

        <Form ref={formRef} method="post" className="bg-card border rounded-lg p-6 space-y-6">
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                {t("organizations.businessType")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("organizations.businessTypeDesc")}
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
                <UnifiedButton
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!selectedType}
                >
                  {t("common.next")}
                </UnifiedButton>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {t("organizations.orgDetails")}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("organizations.name")} *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    maxLength={120}
                    value={formValues.name}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, name: event.target.value }))
                    }
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="Acme Rentals Inc."
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("organizations.description")}
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    maxLength={2000}
                    value={formValues.description}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, description: event.target.value }))
                    }
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="Tell us about your rental business..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("organizations.businessEmail")} *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    maxLength={254}
                    value={formValues.email}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, email: event.target.value }))
                    }
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="contact@acmerentals.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("organizations.phone")}
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    maxLength={20}
                    value={formValues.phoneNumber}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, phoneNumber: event.target.value }))
                    }
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder={APP_PHONE_PLACEHOLDER}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("organizations.taxId")}
                  </label>
                  <input
                    type="text"
                    name="taxId"
                    maxLength={50}
                    value={formValues.taxId}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, taxId: event.target.value }))
                    }
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="XX-XXXXXXX"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <UnifiedButton type="button" variant="outline" onClick={() => setStep(1)}>
                  {t("common.back")}
                </UnifiedButton>
                <UnifiedButton
                  type="button"
                  onClick={() => {
                    setFormValues(collectFormValues(formRef.current));
                    setStep(3);
                  }}
                >
                  {t("common.next")}
                </UnifiedButton>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                {t("organizations.businessAddress")}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("organizations.addressLine1")}
                  </label>
                  <input
                    type="text"
                    name="addressLine1"
                    maxLength={120}
                    value={formValues.addressLine1}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, addressLine1: event.target.value }))
                    }
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="123 Business St"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("organizations.addressLine2")}
                  </label>
                  <input
                    type="text"
                    name="addressLine2"
                    maxLength={120}
                    value={formValues.addressLine2}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, addressLine2: event.target.value }))
                    }
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="Suite 100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("organizations.city")}
                  </label>
                  <input
                    type="text"
                    name="city"
                    maxLength={80}
                    value={formValues.city}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, city: event.target.value }))
                    }
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="Kathmandu"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("organizations.stateProvince")}
                  </label>
                  <input
                    type="text"
                    name="state"
                    maxLength={80}
                    value={formValues.state}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, state: event.target.value }))
                    }
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="Bagmati"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("organizations.postalCode")}
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    maxLength={20}
                    value={formValues.postalCode}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, postalCode: event.target.value }))
                    }
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                    placeholder="44600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("organizations.country")}
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={formValues.country}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, country: event.target.value }))
                    }
                    maxLength={80}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <UnifiedButton type="button" variant="outline" onClick={() => setStep(2)}>
                  {t("common.back")}
                </UnifiedButton>
                <UnifiedButton
                  type="button"
                  onClick={() => handleCreateOrganization(formRef.current)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("organizations.creating")}
                    </>
                  ) : (
                    t("organizations.create")
                  )}
                </UnifiedButton>
              </div>
            </>
          )}
        </Form>

        {/* Benefits Section */}
        <div className="mt-8 bg-muted/50 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-4">
            {t("organizations.benefits")}
          </h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{t("organizations.benefitMultiListings")}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{t("organizations.benefitTeamMembers")}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{t("organizations.benefitFinancial")}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{t("organizations.benefitVerification")}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

