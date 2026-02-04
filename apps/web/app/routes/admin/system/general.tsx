import type { MetaFunction } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "react-router";
import { useState, useEffect } from "react";
import {
  Settings,
  Globe,
  Clock,
  DollarSign,
  Save,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { adminApi, type SystemSettings } from "~/lib/api/admin";
import { UnifiedButton } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "General Settings | Admin" },
    { name: "description", content: "Configure general platform settings" },
  ];
};

const defaultSettings: SystemSettings = {
  siteName: "RentalPortal",
  supportEmail: "support@example.com",
  defaultCurrency: "USD",
  timezone: "UTC",
  maintenanceMode: false,
  allowRegistration: true,
  requireEmailVerification: true,
  maxListingsPerUser: 10,
  commissionRate: 10,
  minRentalDays: 1,
  maxRentalDays: 30,
};

export async function clientLoader() {
  try {
    const settingsRes = await adminApi.getSettings();
    return {
      settings: settingsRes.settings || defaultSettings,
      error: null,
    };
  } catch (error: any) {
    return {
      settings: defaultSettings,
      error: error?.message || "Failed to load settings",
    };
  }
}

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData();
  const data: Partial<SystemSettings> = {
    siteName: formData.get("siteName") as string,
    supportEmail: formData.get("supportEmail") as string,
    defaultCurrency: formData.get("defaultCurrency") as string,
    timezone: formData.get("timezone") as string,
    maintenanceMode: formData.get("maintenanceMode") === "true",
    allowRegistration: formData.get("allowRegistration") === "true",
    requireEmailVerification: formData.get("requireEmailVerification") === "true",
    maxListingsPerUser: parseInt(formData.get("maxListingsPerUser") as string, 10),
    commissionRate: parseFloat(formData.get("commissionRate") as string),
    minRentalDays: parseInt(formData.get("minRentalDays") as string, 10),
    maxRentalDays: parseInt(formData.get("maxRentalDays") as string, 10),
  };

  try {
    await adminApi.updateSettings(data);
    return { success: true, message: "Settings updated successfully" };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.message || "Failed to update settings",
    };
  }
}

const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"];
const timezones = [
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
  const { settings, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

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
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Settings</h3>
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
          ← Back to System Settings
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">General Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure basic platform settings and defaults
        </p>
      </div>

      {/* Action Messages */}
      {actionData?.success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5 inline-block mr-2" />
          {actionData.message}
        </div>
      )}
      {actionData?.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <XCircle className="w-5 h-5 inline-block mr-2" />
          {actionData.error}
        </div>
      )}

      <Form method="post">
        {/* Site Information */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">Site Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">
                Site Name
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
                Support Email
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
            <h2 className="text-xl font-semibold text-gray-900">Regional Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="defaultCurrency" className="block text-sm font-medium text-gray-700 mb-1">
                Default Currency
              </label>
              <select
                id="defaultCurrency"
                name="defaultCurrency"
                value={formValues.defaultCurrency || "USD"}
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
                Default Timezone
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
            <DollarSign className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-semibold text-gray-900">Business Rules</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="commissionRate" className="block text-sm font-medium text-gray-700 mb-1">
                Commission Rate (%)
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
                Minimum Rental Days
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
                Maximum Rental Days
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
                Max Listings Per User
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
            <h2 className="text-xl font-semibold text-gray-900">Platform Controls</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Maintenance Mode</p>
                <p className="text-sm text-gray-500">
                  When enabled, only admins can access the platform
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
                <p className="font-medium text-gray-900">Allow Registration</p>
                <p className="text-sm text-gray-500">
                  Allow new users to register on the platform
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
                <p className="font-medium text-gray-900">Require Email Verification</p>
                <p className="text-sm text-gray-500">
                  Users must verify their email before accessing features
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
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </UnifiedButton>
        </div>
      </Form>
    </div>
  );
}
