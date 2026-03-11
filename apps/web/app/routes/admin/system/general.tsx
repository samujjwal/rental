import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "react-router";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import {
  Settings,
  Globe,
  Clock,
  Banknote,
  Save,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { adminApi, type SystemSettings } from "~/lib/api/admin";
import { UnifiedButton , RouteErrorBoundary } from "~/components/ui";
import { requireAdmin } from "~/utils/auth";
import { APP_CURRENCY } from "~/config/locale";

export const meta: MetaFunction = () => {
  return [
    { title: "General Settings | Admin" },
    { name: "description", content: "Configure general platform settings" },
  ];
};

const defaultSettings: SystemSettings = {
  siteName: "RentalPortal",
  supportEmail: "support@example.com",
  defaultCurrency: APP_CURRENCY,
  timezone: "UTC",
  maintenanceMode: false,
  allowRegistration: true,
  requireEmailVerification: true,
  maxListingsPerUser: 10,
  commissionRate: 10,
  minRentalDays: 1,
  maxRentalDays: 30,
};
const MAX_SITE_NAME_LENGTH = 100;
const MAX_SUPPORT_EMAIL_LENGTH = 254;
const MAX_LISTINGS_PER_USER = 1000;
const MAX_RENTAL_DAYS = 365;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  try {
    const settingsRes = await adminApi.getSettings();
    return {
      settings: settingsRes.settings || defaultSettings,
      error: null,
    };
  } catch (error: unknown) {
    return {
      settings: defaultSettings,
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load settings",
    };
  }
}

export async function clientAction({ request }: ActionFunctionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent !== "save") {
    return { success: false, error: "Invalid action" };
  }
  const parseBoundedInt = (
    value: FormDataEntryValue | null,
    fallback: number,
    min: number,
    max: number
  ) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
  };
  const parseBoundedFloat = (
    value: FormDataEntryValue | null,
    fallback: number,
    min: number,
    max: number
  ) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };
  const siteName = String(formData.get("siteName") || "")
    .trim()
    .slice(0, MAX_SITE_NAME_LENGTH);
  const supportEmail = String(formData.get("supportEmail") || "")
    .trim()
    .slice(0, MAX_SUPPORT_EMAIL_LENGTH);
  const defaultCurrency = String(formData.get("defaultCurrency") || "");
  const timezone = String(formData.get("timezone") || "");
  if (siteName.length < 2) {
    return { success: false, error: "Site name must be at least 2 characters." };
  }
  if (!EMAIL_PATTERN.test(supportEmail)) {
    return { success: false, error: "Support email must be valid." };
  }
  if (!currencies.includes(defaultCurrency)) {
    return { success: false, error: "Invalid default currency." };
  }
  if (!timezones.includes(timezone)) {
    return { success: false, error: "Invalid timezone." };
  }
  const minRentalDays = parseBoundedInt(
    formData.get("minRentalDays"),
    defaultSettings.minRentalDays,
    1,
    MAX_RENTAL_DAYS
  );
  const maxRentalDays = parseBoundedInt(
    formData.get("maxRentalDays"),
    defaultSettings.maxRentalDays,
    minRentalDays,
    MAX_RENTAL_DAYS
  );
  const data: Partial<SystemSettings> = {
    siteName,
    supportEmail,
    defaultCurrency,
    timezone,
    maintenanceMode: formData.get("maintenanceMode") === "true",
    allowRegistration: formData.get("allowRegistration") === "true",
    requireEmailVerification: formData.get("requireEmailVerification") === "true",
    maxListingsPerUser: parseBoundedInt(
      formData.get("maxListingsPerUser"),
      defaultSettings.maxListingsPerUser,
      1,
      MAX_LISTINGS_PER_USER
    ),
    commissionRate: parseBoundedFloat(
      formData.get("commissionRate"),
      defaultSettings.commissionRate,
      0,
      100
    ),
    minRentalDays,
    maxRentalDays,
  };

  try {
    await adminApi.updateSettings(data);
    return { success: true, message: "Settings updated successfully" };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        (error &&
          typeof error === "object" &&
          "response" in error &&
          (error as { response?: { data?: { message?: string } } }).response
            ?.data?.message) ||
        "Failed to update settings",
    };
  }
}

const currencies = [APP_CURRENCY, "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"];
const timezones = [
  "Asia/Kathmandu",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
];

export default function GeneralSettingsPage() {
  const { t } = useTranslation();
  const { settings, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const actionMessage =
    typeof actionData?.message === "string" ? actionData.message : null;
  const actionError =
    typeof actionData?.error === "string" ? actionData.error : null;

  const [formValues, setFormValues] = useState<SystemSettings>(settings);

  useEffect(() => {
    if (settings) {
      setFormValues(settings);
    }
  }, [settings]);

  if (error && !settings) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">{t("admin.errorLoadingSettings")}</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/admin/system"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          {t("admin.backToSystemSettings")}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">{t("admin.generalSettings")}</h1>
        <p className="text-gray-600 mt-1">
          {t("admin.generalSettingsSubtitle")}
        </p>
      </div>

      {/* Action Messages */}
      {actionData?.success && actionMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5 inline-block mr-2" />
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <XCircle className="w-5 h-5 inline-block mr-2" />
          {actionError}
        </div>
      )}

      <Form method="post">
        <input type="hidden" name="intent" value="save" />
        {/* Site Information */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">{t("admin.siteInformation")}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">
                {t("admin.siteNameLabel")}
              </label>
              <input
                type="text"
                id="siteName"
                name="siteName"
                value={formValues.siteName || ""}
                onChange={(e) => setFormValues({ ...formValues, siteName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="supportEmail" className="block text-sm font-medium text-gray-700 mb-1">
                {t("admin.supportEmail")}
              </label>
              <input
                type="email"
                id="supportEmail"
                name="supportEmail"
                value={formValues.supportEmail || ""}
                onChange={(e) => setFormValues({ ...formValues, supportEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Regional Settings */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900">{t("admin.regionalSettings")}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="defaultCurrency" className="block text-sm font-medium text-gray-700 mb-1">
                {t("admin.defaultCurrency")}
              </label>
              <select
                id="defaultCurrency"
                name="defaultCurrency"
                value={formValues.defaultCurrency || APP_CURRENCY}
                onChange={(e) => setFormValues({ ...formValues, defaultCurrency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                {t("admin.defaultTimezone")}
              </label>
              <select
                id="timezone"
                name="timezone"
                value={formValues.timezone || "UTC"}
                onChange={(e) => setFormValues({ ...formValues, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Business Rules */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Banknote className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-semibold text-gray-900">{t("admin.businessRules")}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="commissionRate" className="block text-sm font-medium text-gray-700 mb-1">
                {t("admin.commissionRate")}
              </label>
              <input
                type="number"
                id="commissionRate"
                name="commissionRate"
                min="0"
                max="100"
                step="0.5"
                value={formValues.commissionRate || 10}
                onChange={(e) => setFormValues({ ...formValues, commissionRate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="minRentalDays" className="block text-sm font-medium text-gray-700 mb-1">
                {t("admin.minRentalDays")}
              </label>
              <input
                type="number"
                id="minRentalDays"
                name="minRentalDays"
                min="1"
                value={formValues.minRentalDays || 1}
                onChange={(e) => setFormValues({ ...formValues, minRentalDays: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="maxRentalDays" className="block text-sm font-medium text-gray-700 mb-1">
                {t("admin.maxRentalDays")}
              </label>
              <input
                type="number"
                id="maxRentalDays"
                name="maxRentalDays"
                min="1"
                value={formValues.maxRentalDays || 30}
                onChange={(e) => setFormValues({ ...formValues, maxRentalDays: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="maxListingsPerUser" className="block text-sm font-medium text-gray-700 mb-1">
                {t("admin.maxListingsPerUser")}
              </label>
              <input
                type="number"
                id="maxListingsPerUser"
                name="maxListingsPerUser"
                min="1"
                value={formValues.maxListingsPerUser || 10}
                onChange={(e) => setFormValues({ ...formValues, maxListingsPerUser: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Platform Controls */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold text-gray-900">{t("admin.platformControls")}</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{t("admin.maintenanceMode")}</p>
                <p className="text-sm text-gray-500">
                  {t("admin.maintenanceModeDesc")}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="maintenanceMode"
                  value="true"
                  checked={formValues.maintenanceMode || false}
                  onChange={(e) => setFormValues({ ...formValues, maintenanceMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <input type="hidden" name="maintenanceMode" value={formValues.maintenanceMode ? "true" : "false"} />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{t("admin.allowRegistration")}</p>
                <p className="text-sm text-gray-500">
                  {t("admin.allowRegistrationDesc")}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="allowRegistrationCheck"
                  checked={formValues.allowRegistration ?? true}
                  onChange={(e) => setFormValues({ ...formValues, allowRegistration: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <input type="hidden" name="allowRegistration" value={formValues.allowRegistration ? "true" : "false"} />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{t("admin.requireEmailVerification")}</p>
                <p className="text-sm text-gray-500">
                  {t("admin.requireEmailVerificationDesc")}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="requireEmailVerificationCheck"
                  checked={formValues.requireEmailVerification ?? true}
                  onChange={(e) => setFormValues({ ...formValues, requireEmailVerification: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <input type="hidden" name="requireEmailVerification" value={formValues.requireEmailVerification ? "true" : "false"} />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <UnifiedButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("admin.saving")}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {t("admin.saveSettings")}
              </>
            )}
          </UnifiedButton>
        </div>
      </Form>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

