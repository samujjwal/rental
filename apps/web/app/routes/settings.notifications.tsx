import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, useActionData, useLoaderData, redirect } from "react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { User, Bell, Shield, CreditCard } from "lucide-react";
import { notificationsApi, type NotificationPreferences } from "~/lib/api/notifications";
import { getUser } from "~/utils/auth";
import { RouteErrorBoundary } from "~/components/ui";

const DEFAULT_PREFS: NotificationPreferences = {
  email: true,
  sms: false,
  push: true,
  inApp: true,
  bookingUpdates: true,
  paymentUpdates: true,
  reviewAlerts: true,
  messageAlerts: true,
  marketingEmails: false,
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  try {
    const preferences = await notificationsApi.getPreferences();
    return { preferences, error: null };
  } catch (error: unknown) {
    // Return default preferences if API fails
    return {
      preferences: DEFAULT_PREFS,
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load preferences",
    };
  }
}

export async function clientAction({ request }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent !== "save") {
    return { success: false, message: "Invalid action" };
  }
  const rawPreferences = formData.get("preferences");
  if (typeof rawPreferences !== "string") {
    return { success: false, message: "Invalid preferences payload" };
  }
  if (rawPreferences.length > 20_000) {
    return { success: false, message: "Preferences payload is too large" };
  }

  let parsedPreferences: unknown;
  try {
    parsedPreferences = JSON.parse(rawPreferences);
  } catch {
    return { success: false, message: "Invalid preferences payload" };
  }

  const parsedObject =
    parsedPreferences && typeof parsedPreferences === "object"
      ? (parsedPreferences as Record<string, unknown>)
      : {};

  const preferences: NotificationPreferences = {
    email: Boolean(parsedObject.email ?? DEFAULT_PREFS.email),
    sms: Boolean(parsedObject.sms ?? DEFAULT_PREFS.sms),
    push: Boolean(parsedObject.push ?? DEFAULT_PREFS.push),
    inApp: Boolean(parsedObject.inApp ?? DEFAULT_PREFS.inApp),
    bookingUpdates: Boolean(
      parsedObject.bookingUpdates ?? DEFAULT_PREFS.bookingUpdates
    ),
    paymentUpdates: Boolean(
      parsedObject.paymentUpdates ?? DEFAULT_PREFS.paymentUpdates
    ),
    reviewAlerts: Boolean(parsedObject.reviewAlerts ?? DEFAULT_PREFS.reviewAlerts),
    messageAlerts: Boolean(
      parsedObject.messageAlerts ?? DEFAULT_PREFS.messageAlerts
    ),
    marketingEmails: Boolean(
      parsedObject.marketingEmails ?? DEFAULT_PREFS.marketingEmails
    ),
  };

  try {
    await notificationsApi.updatePreferences(preferences);
    return { success: true, message: "Preferences updated successfully" };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message ||
            (error as { message?: string }).message ||
            "Failed to update preferences"
          : "Failed to update preferences",
    };
  }
}

export const meta: MetaFunction = () => {
  return [
    { title: "Notification Settings | GharBatai Rentals" },
    { name: "description", content: "Manage your email and push notification preferences" },
  ];
};

export default function NotificationSettings() {
  const { t } = useTranslation();
  const { preferences: initialPreferences, error: loadError } =
    useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const [preferences, setPreferences] =
    useState<NotificationPreferences>({
      ...DEFAULT_PREFS,
      ...initialPreferences,
    });

  const channelPrefs: Array<{
    key: keyof NotificationPreferences;
    label: string;
    description: string;
  }> = [
    { key: "email", label: t("settings.notificationSettings.email"), description: t("settings.notificationSettings.emailDesc") },
    { key: "push", label: t("settings.notificationSettings.push"), description: t("settings.notificationSettings.pushDesc") },
    { key: "sms", label: t("settings.notificationSettings.sms"), description: t("settings.notificationSettings.smsDesc") },
    { key: "inApp", label: t("settings.notificationSettings.inApp"), description: t("settings.notificationSettings.inAppDesc") },
  ];

  const typePrefs: Array<{
    key: keyof NotificationPreferences;
    label: string;
    description: string;
  }> = [
    {
      key: "bookingUpdates",
      label: t("settings.notificationSettings.bookingUpdates"),
      description: t("settings.notificationSettings.bookingUpdatesDesc"),
    },
    {
      key: "paymentUpdates",
      label: t("settings.notificationSettings.paymentUpdates"),
      description: t("settings.notificationSettings.paymentUpdatesDesc"),
    },
    {
      key: "messageAlerts",
      label: t("settings.notificationSettings.messages"),
      description: t("settings.notificationSettings.messagesDesc"),
    },
    {
      key: "reviewAlerts",
      label: t("settings.notificationSettings.reviews"),
      description: t("settings.notificationSettings.reviewsDesc"),
    },
    {
      key: "marketingEmails",
      label: t("settings.notificationSettings.marketing"),
      description: t("settings.notificationSettings.marketingDesc"),
    },
  ];

  const updatePreference = (
    key: keyof NotificationPreferences,
    value: boolean
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <aside className="md:col-span-1">
            <nav className="bg-card rounded-lg border p-2 space-y-1">
              <Link
                to="/settings/profile"
                className="w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <User className="w-5 h-5" />
                {t("settings.profile", "Profile")}
              </Link>
              <Link
                to="/settings/notifications"
                className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-lg font-medium"
              >
                <Bell className="w-5 h-5" />
                {t("settings.notifications", "Notifications")}
              </Link>
              <Link
                to="/settings/security"
                className="w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <Shield className="w-5 h-5" />
                {t("settings.security", "Security")}
              </Link>
              <Link
                to="/settings/billing"
                className="w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <CreditCard className="w-5 h-5" />
                {t("settings.billing", "Billing")}
              </Link>
            </nav>
          </aside>
          <div className="md:col-span-3">
            <div className="bg-card shadow rounded-lg">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border">
            <h1 className="text-2xl font-bold text-foreground">
              {t("settings.notificationSettings.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.notificationSettings.description")}
            </p>
          </div>

          {/* Success Message */}
          {actionData?.success && (
            <div className="mx-6 mt-6 bg-success/10 border border-success/20 text-success px-4 py-3 rounded">
              {actionData.message}
            </div>
          )}

          {/* Error Messages */}
          {(loadError || actionData?.success === false) && (
            <div className="mx-6 mt-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
              {loadError || actionData?.message}
            </div>
          )}

          {/* Preferences */}
          <div className="px-6 py-6 space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {t("settings.notificationSettings.channels")}
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4">
                {channelPrefs.map((pref) => (
                  <label
                    key={pref.key}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {pref.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pref.description}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences[pref.key])}
                      onChange={(e) =>
                        updatePreference(pref.key, e.target.checked)
                      }
                      className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {t("settings.notificationSettings.activityTypes")}
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4">
                {typePrefs.map((pref) => (
                  <label
                    key={pref.key}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {pref.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pref.description}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences[pref.key])}
                      onChange={(e) =>
                        updatePreference(pref.key, e.target.checked)
                      }
                      className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-6 py-4 bg-muted border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    const newPrefs = { ...preferences };
                    [...channelPrefs, ...typePrefs].forEach((pref) => {
                      newPrefs[pref.key] = true as NotificationPreferences[typeof pref.key];
                    });
                    setPreferences(newPrefs);
                  }}
                  className="text-primary hover:text-primary/80"
                >
                  {t("settings.notificationSettings.enableAll")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newPrefs = { ...preferences };
                    [...channelPrefs, ...typePrefs].forEach((pref) => {
                      newPrefs[pref.key] = false as NotificationPreferences[typeof pref.key];
                    });
                    setPreferences(newPrefs);
                  }}
                  className="text-primary hover:text-primary/80"
                >
                  {t("settings.notificationSettings.disableAll")}
                </button>
              </div>

              <Form method="post">
                <input type="hidden" name="intent" value="save" />
                <input
                  type="hidden"
                  name="preferences"
                  value={JSON.stringify(preferences)}
                />
                <button
                  type="submit"
                  className="px-6 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                >
                  {t("settings.notificationSettings.savePreferences")}
                </button>
              </Form>
            </div>
          </div>

          {/* Info Box */}
          <div className="px-6 py-4 bg-primary/5 border-t border-primary/10">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3 text-sm text-primary/80">
                <p>
                  <strong>{t("settings.notificationSettings.note")}</strong> {t("settings.notificationSettings.securityNote")}
                </p>
                <p className="mt-1">
                  {t("settings.notificationSettings.smsNote")}
                </p>
              </div>
            </div>
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export { RouteErrorBoundary as ErrorBoundary };

