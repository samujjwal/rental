import type { ActionFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { useState } from "react";
import { notificationsApi, type NotificationPreferences } from "~/lib/api/notifications";

export async function clientLoader() {
  try {
    const preferences = await notificationsApi.getPreferences();
    return { preferences, error: null };
  } catch (error: any) {
    console.error("Failed to fetch notification preferences:", error);
    // Return default preferences if API fails
    return {
      preferences: {} as NotificationPreferences,
      error: error?.message || "Failed to load preferences",
    };
  }
}

export async function clientAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const preferences = JSON.parse(formData.get("preferences") as string);

  try {
    await notificationsApi.updatePreferences(preferences);
    return { success: true, message: "Preferences updated successfully" };
  } catch (error: any) {
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || "Failed to update preferences",
    };
  }
}

export default function NotificationSettings() {
  const { preferences: initialPreferences, error: loadError } =
    useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(initialPreferences);

  const notificationTypes = [
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
      key: "messages",
      label: "Messages",
      description: "New messages from other users",
    },
    {
      key: "reviews",
      label: "Reviews",
      description: "New reviews and rating updates",
    },
    {
      key: "marketing",
      label: "Marketing",
      description: "Promotions and news",
    },
    {
      key: "securityAlerts",
      label: "Security Alerts",
      description: "Login alerts and security changes",
    },
  ];

  const updatePreference = (type: string, channel: string, value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      [channel]: {
        ...(prev as any)[channel],
        [type]: value,
      },
    }));
  };

  const channels = [
    { key: "email", label: "Email", icon: "📧" },
    { key: "push", label: "Push", icon: "🔔" },
    { key: "sms", label: "SMS", icon: "📱" },
  ];

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

          {/* Preferences Table */}
          <div className="px-6 py-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Notification Type
                    </th>
                    {channels.map((channel) => (
                      <th
                        key={channel.key}
                        className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-2xl mb-1">{channel.icon}</span>
                          <span>{channel.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {notificationTypes.map((type) => (
                    <tr key={type.key} className="hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {type.label}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {type.description}
                          </div>
                        </div>
                      </td>
                      {channels.map((channel) => (
                        <td key={channel.key} className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={
                              (preferences as any)[channel.key]?.[type.key] ?? false
                            }
                            onChange={(e) =>
                              updatePreference(
                                type.key,
                                channel.key,
                                e.target.checked
                              )
                            }
                            className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    const channels = ["email", "push", "sms"] as const;
                    
                    channels.forEach((channel) => {
                      if ((newPrefs as any)[channel]) {
                        const channelPrefs = { ...(newPrefs as any)[channel] };
                        notificationTypes.forEach((type) => {
                          if (Object.prototype.hasOwnProperty.call(channelPrefs, type.key)) {
                            channelPrefs[type.key] = true;
                          }
                        });
                        (newPrefs as any)[channel] = channelPrefs;
                      }
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
                    const channels = ["email", "push", "sms"] as const;
                    
                    channels.forEach((channel) => {
                      if ((newPrefs as any)[channel]) {
                        const channelPrefs = { ...(newPrefs as any)[channel] };
                        notificationTypes.forEach((type) => {
                          if (Object.prototype.hasOwnProperty.call(channelPrefs, type.key)) {
                            channelPrefs[type.key] = false;
                          }
                        });
                        (newPrefs as any)[channel] = channelPrefs;
                      }
                    });
                    setPreferences(newPrefs);
                  }}
                  className="text-primary hover:text-primary/80"
                >
                  Disable All
                </button>
              </div>

              <Form method="post">
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
