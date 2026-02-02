import type { MetaFunction } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "react-router";
import { useState, useEffect } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Save,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { adminApi } from "~/lib/api/admin";
import { Button } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Notification Settings | Admin" },
    { name: "description", content: "Configure platform notification settings" },
  ];
};

interface NotificationSettings {
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  // Email templates
  welcomeEmailEnabled: boolean;
  bookingConfirmationEnabled: boolean;
  paymentNotificationEnabled: boolean;
  reviewRequestEnabled: boolean;
  // Admin notifications
  newUserNotification: boolean;
  newListingNotification: boolean;
  disputeNotification: boolean;
  paymentFailureNotification: boolean;
  // Digest settings
  dailyDigestEnabled: boolean;
  weeklyReportEnabled: boolean;
  adminDigestTime: string;
  // Rate limits
  maxEmailsPerHour: number;
  maxPushPerHour: number;
}

const defaultSettings: NotificationSettings = {
  emailEnabled: true,
  pushEnabled: true,
  smsEnabled: false,
  welcomeEmailEnabled: true,
  bookingConfirmationEnabled: true,
  paymentNotificationEnabled: true,
  reviewRequestEnabled: true,
  newUserNotification: true,
  newListingNotification: true,
  disputeNotification: true,
  paymentFailureNotification: true,
  dailyDigestEnabled: false,
  weeklyReportEnabled: true,
  adminDigestTime: "09:00",
  maxEmailsPerHour: 100,
  maxPushPerHour: 50,
};

export async function clientLoader() {
  try {
    const settingsRes = await adminApi.getSettings();
    return {
      settings: (settingsRes.notifications as unknown as NotificationSettings) || defaultSettings,
      error: null,
    };
  } catch (error: any) {
    return {
      settings: defaultSettings,
      error: error?.message || "Failed to load notification settings",
    };
  }
}

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData();
  
  const settings: Partial<NotificationSettings> = {
    emailEnabled: formData.get("emailEnabled") === "true",
    pushEnabled: formData.get("pushEnabled") === "true",
    smsEnabled: formData.get("smsEnabled") === "true",
    welcomeEmailEnabled: formData.get("welcomeEmailEnabled") === "true",
    bookingConfirmationEnabled: formData.get("bookingConfirmationEnabled") === "true",
    paymentNotificationEnabled: formData.get("paymentNotificationEnabled") === "true",
    reviewRequestEnabled: formData.get("reviewRequestEnabled") === "true",
    newUserNotification: formData.get("newUserNotification") === "true",
    newListingNotification: formData.get("newListingNotification") === "true",
    disputeNotification: formData.get("disputeNotification") === "true",
    paymentFailureNotification: formData.get("paymentFailureNotification") === "true",
    dailyDigestEnabled: formData.get("dailyDigestEnabled") === "true",
    weeklyReportEnabled: formData.get("weeklyReportEnabled") === "true",
    adminDigestTime: formData.get("adminDigestTime") as string,
    maxEmailsPerHour: parseInt(formData.get("maxEmailsPerHour") as string, 10),
    maxPushPerHour: parseInt(formData.get("maxPushPerHour") as string, 10),
  };

  try {
    await adminApi.updateSettings({ notifications: settings });
    return { success: true, message: "Notification settings updated successfully" };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.message || "Failed to update settings",
    };
  }
}

export default function NotificationsSettingsPage() {
  const { settings, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [formValues, setFormValues] = useState<NotificationSettings>(settings);

  useEffect(() => {
    if (settings) {
      setFormValues(settings);
    }
  }, [settings]);

  const ToggleSwitch = ({
    name,
    checked,
    onChange,
    disabled = false,
  }: {
    name: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <>
      <label className={`relative inline-flex items-center ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
    </>
  );

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
        <h1 className="text-3xl font-bold text-gray-900">Notification Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure how and when notifications are sent
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
      {error && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
          <AlertTriangle className="w-5 h-5 inline-block mr-2" />
          Using default settings: {error}
        </div>
      )}

      <Form method="post">
        {/* Notification Channels */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">Notification Channels</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-500">Send notifications via email</p>
                </div>
              </div>
              <ToggleSwitch
                name="emailEnabled"
                checked={formValues.emailEnabled}
                onChange={(checked) => setFormValues({ ...formValues, emailEnabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">Push Notifications</p>
                  <p className="text-sm text-gray-500">Send browser/app push notifications</p>
                </div>
              </div>
              <ToggleSwitch
                name="pushEnabled"
                checked={formValues.pushEnabled}
                onChange={(checked) => setFormValues({ ...formValues, pushEnabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">SMS Notifications</p>
                  <p className="text-sm text-gray-500">Send SMS for critical alerts</p>
                </div>
              </div>
              <ToggleSwitch
                name="smsEnabled"
                checked={formValues.smsEnabled}
                onChange={(checked) => setFormValues({ ...formValues, smsEnabled: checked })}
              />
            </div>
          </div>
        </div>

        {/* User Email Templates */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900">User Email Templates</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Welcome Email</p>
                <p className="text-sm text-gray-500">Send welcome email to new users</p>
              </div>
              <ToggleSwitch
                name="welcomeEmailEnabled"
                checked={formValues.welcomeEmailEnabled}
                onChange={(checked) => setFormValues({ ...formValues, welcomeEmailEnabled: checked })}
                disabled={!formValues.emailEnabled}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Booking Confirmation</p>
                <p className="text-sm text-gray-500">Send confirmation when booking is made</p>
              </div>
              <ToggleSwitch
                name="bookingConfirmationEnabled"
                checked={formValues.bookingConfirmationEnabled}
                onChange={(checked) => setFormValues({ ...formValues, bookingConfirmationEnabled: checked })}
                disabled={!formValues.emailEnabled}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Payment Notifications</p>
                <p className="text-sm text-gray-500">Send email for payment receipts</p>
              </div>
              <ToggleSwitch
                name="paymentNotificationEnabled"
                checked={formValues.paymentNotificationEnabled}
                onChange={(checked) => setFormValues({ ...formValues, paymentNotificationEnabled: checked })}
                disabled={!formValues.emailEnabled}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Review Request</p>
                <p className="text-sm text-gray-500">Request reviews after rental completion</p>
              </div>
              <ToggleSwitch
                name="reviewRequestEnabled"
                checked={formValues.reviewRequestEnabled}
                onChange={(checked) => setFormValues({ ...formValues, reviewRequestEnabled: checked })}
                disabled={!formValues.emailEnabled}
              />
            </div>
          </div>
        </div>

        {/* Admin Notifications */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Volume2 className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold text-gray-900">Admin Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">New User Registration</p>
                <p className="text-sm text-gray-500">Notify when a new user registers</p>
              </div>
              <ToggleSwitch
                name="newUserNotification"
                checked={formValues.newUserNotification}
                onChange={(checked) => setFormValues({ ...formValues, newUserNotification: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">New Listing Created</p>
                <p className="text-sm text-gray-500">Notify when a new listing is created</p>
              </div>
              <ToggleSwitch
                name="newListingNotification"
                checked={formValues.newListingNotification}
                onChange={(checked) => setFormValues({ ...formValues, newListingNotification: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Dispute Filed</p>
                <p className="text-sm text-gray-500">Notify when a dispute is filed</p>
              </div>
              <ToggleSwitch
                name="disputeNotification"
                checked={formValues.disputeNotification}
                onChange={(checked) => setFormValues({ ...formValues, disputeNotification: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Payment Failure</p>
                <p className="text-sm text-gray-500">Notify when a payment fails</p>
              </div>
              <ToggleSwitch
                name="paymentFailureNotification"
                checked={formValues.paymentFailureNotification}
                onChange={(checked) => setFormValues({ ...formValues, paymentFailureNotification: checked })}
              />
            </div>
          </div>
        </div>

        {/* Digest Settings */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-semibold text-gray-900">Digest & Reports</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Daily Digest</p>
                <p className="text-sm text-gray-500">Send daily summary to admins</p>
              </div>
              <ToggleSwitch
                name="dailyDigestEnabled"
                checked={formValues.dailyDigestEnabled}
                onChange={(checked) => setFormValues({ ...formValues, dailyDigestEnabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Weekly Report</p>
                <p className="text-sm text-gray-500">Send weekly analytics report</p>
              </div>
              <ToggleSwitch
                name="weeklyReportEnabled"
                checked={formValues.weeklyReportEnabled}
                onChange={(checked) => setFormValues({ ...formValues, weeklyReportEnabled: checked })}
              />
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <label htmlFor="adminDigestTime" className="block font-medium text-gray-900 mb-2">
                Digest Delivery Time
              </label>
              <input
                type="time"
                id="adminDigestTime"
                name="adminDigestTime"
                value={formValues.adminDigestTime}
                onChange={(e) => setFormValues({ ...formValues, adminDigestTime: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Rate Limits */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <VolumeX className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900">Rate Limits</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="maxEmailsPerHour" className="block text-sm font-medium text-gray-700 mb-1">
                Max Emails Per Hour
              </label>
              <input
                type="number"
                id="maxEmailsPerHour"
                name="maxEmailsPerHour"
                min="1"
                max="1000"
                value={formValues.maxEmailsPerHour}
                onChange={(e) => setFormValues({ ...formValues, maxEmailsPerHour: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="maxPushPerHour" className="block text-sm font-medium text-gray-700 mb-1">
                Max Push Notifications Per Hour
              </label>
              <input
                type="number"
                id="maxPushPerHour"
                name="maxPushPerHour"
                min="1"
                max="500"
                value={formValues.maxPushPerHour}
                onChange={(e) => setFormValues({ ...formValues, maxPushPerHour: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
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
          </Button>
        </div>
      </Form>
    </div>
  );
}
