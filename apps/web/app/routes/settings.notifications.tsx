import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, redirect } from "react-router";
import { useState } from "react";
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
    console.error("Failed to fetch notification preferences:", error);
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

export default function NotificationSettings() {
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
    { key: "email", label: "Email", description: "Send updates to your inbox" },
    { key: "push", label: "Push", description: "Real-time alerts on your device" },
    { key: "sms", label: "SMS", description: "Text messages for urgent updates" },
    { key: "inApp", label: "In-App", description: "In-app activity notifications" },
  ];

  const typePrefs: Array<{
    key: keyof NotificationPreferences;
    label: string;
    description: string;
  }> = [
    {
      key: "bookingUpdates",
      label: "Booking Updates",
      description: "Booking requests, confirmations, and changes",
    },
    {
      key: "paymentUpdates",
      label: "Payment Updates",
      description: "Payments sent, received, and payouts",
    },
    {
      key: "messageAlerts",
      label: "Messages",
      description: "New messages from other users",
    },
    {
      key: "reviewAlerts",
      label: "Reviews",
      description: "New reviews and rating updates",
    },
    {
      key: "marketingEmails",
      label: "Marketing",
      description: "Promotions and product updates",
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
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card shadow rounded-lg">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border">
            <h1 className="text-2xl font-bold text-foreground">
              Notification Preferences
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose how you want to receive notifications for different
              activities
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
                Channels
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
                Activity Types
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
                  Enable All
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
                  Disable All
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
                  Save Preferences
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
                  <strong>Note:</strong> Some notifications (like critical
                  security alerts) cannot be disabled for your account safety.
                </p>
                <p className="mt-1">
                  SMS notifications may incur standard message rates from your
                  carrier.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export { RouteErrorBoundary as ErrorBoundary };
