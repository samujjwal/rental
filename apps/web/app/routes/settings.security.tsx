import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import {
  AlertCircle,
  Bell,
  CheckCircle,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  Key,
  Shield,
  Smartphone,
  User,
} from "lucide-react";
import { useState } from "react";
import { getUser } from "~/utils/auth";
import { authApi } from "~/lib/api/auth";
import { RouteErrorBoundary } from "~/components/ui";
import { Card, CardContent } from "~/components/ui/card";
import { useTranslation } from "react-i18next";

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  return { user };
}

export async function clientAction({ request }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) return redirect("/auth/login");

  const formData = await request.formData();
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required." };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  try {
    await authApi.changePassword({ currentPassword, newPassword });
    return { success: true };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to change password.";
    return { error: msg };
  }
}

export const meta: MetaFunction = () => [
  { title: "Security Settings | GharBatai Rentals" },
  { name: "description", content: "Manage your account security settings" },
];

export default function SettingsSecurityPage() {
  const { user } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const isSubmitting = navigation.state === "submitting";
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">
          {t("settings.securitySettings.title", "Security Settings")}
        </h1>
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
                className="w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5" />
                {t("settings.notifications", "Notifications")}
              </Link>
              <Link
                to="/settings/security"
                className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-lg font-medium"
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

          {/* Main Content */}
          <div className="md:col-span-3 space-y-6">
            {/* Change Password */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("settings.securitySettings.changePassword", "Change Password")}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  {t(
                    "settings.securitySettings.passwordDesc",
                    "Keep your account secure with a strong, unique password."
                  )}
                </p>

                {actionData && "success" in actionData && actionData.success && (
                  <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/20 px-4 py-3 mb-4">
                    <CheckCircle className="w-4 h-4 text-success shrink-0" />
                    <p className="text-sm text-success font-medium">
                      {t("settings.securitySettings.passwordChanged", "Password updated successfully.")}
                    </p>
                  </div>
                )}

                {actionData && "error" in actionData && actionData.error && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 mb-4">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                    <p className="text-sm text-destructive">{actionData.error}</p>
                  </div>
                )}

                <Form method="post" className="space-y-4">
                  {/* Current password */}
                  <div>
                    <label
                      htmlFor="currentPassword"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      {t("settings.securitySettings.currentPassword", "Current Password")}
                    </label>
                    <div className="relative">
                      <input
                        id="currentPassword"
                        name="currentPassword"
                        type={showCurrent ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showCurrent ? "Hide password" : "Show password"}
                      >
                        {showCurrent ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div>
                    <label
                      htmlFor="newPassword"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      {t("settings.securitySettings.newPassword", "New Password")}
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        name="newPassword"
                        type={showNew ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showNew ? "Hide password" : "Show password"}
                      >
                        {showNew ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("settings.securitySettings.passwordMinLength", "Minimum 8 characters.")}
                    </p>
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      {t("settings.securitySettings.confirmPassword", "Confirm New Password")}
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirm ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                      >
                        {showConfirm ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Key className="w-4 h-4" />
                      {isSubmitting
                        ? t("settings.securitySettings.saving", "Saving…")
                        : t("settings.securitySettings.updatePassword", "Update Password")}
                    </button>
                  </div>
                </Form>
              </CardContent>
            </Card>

            {/* Two-Factor Authentication */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">
                      {t("settings.securitySettings.twoFactor", "Two-Factor Authentication")}
                    </h2>
                  </div>
                  <Link
                    to="/auth/mfa/setup"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {t("settings.securitySettings.enable2FA", "Enable 2FA")}
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "settings.securitySettings.twoFactorDesc",
                    "Add an extra layer of security using an authenticator app like Google Authenticator or Authy."
                  )}
                </p>
              </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("settings.securitySettings.activeSessions", "Active Sessions")}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "settings.securitySettings.activeSessionsDesc",
                    "You are currently signed in as"
                  )}{" "}
                  <span className="font-medium text-foreground">{user.email}</span>.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {t(
                    "settings.securitySettings.sessionSignOut",
                    "To revoke all sessions, sign out and change your password."
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
