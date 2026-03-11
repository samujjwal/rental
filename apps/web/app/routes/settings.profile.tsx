import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useLoaderData, useActionData } from "react-router";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "~/lib/store/auth";
import {
  User,
  Mail,
  Phone,
  Shield,
  Bell,
  Key,
  Save,
  Camera,
  CreditCard,
} from "lucide-react";
import { usersApi } from "~/lib/api/users";
import { authApi } from "~/lib/api/auth";
import { uploadApi } from "~/lib/api/upload";
import { getUser } from "~/utils/auth";
import { UnifiedButton, RouteErrorBoundary } from "~/components/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Profile Settings | GharBatai Rentals" },
    { name: "description", content: "Manage your account settings" },
  ];
};

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeInitial = (value: unknown): string => {
  const name = typeof value === "string" ? value.trim() : "";
  return (name[0] || "U").toUpperCase();
};

const profileSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must be less than 50 characters"),
  lastName: z.string().max(50, "Last name must be less than 50 characters").optional(),
  email: z
    .string()
    .max(320, "Email must be less than 320 characters")
    .email("Invalid email address"),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
});

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const currentUser = await getUser(request);
  if (!currentUser) {
    return redirect("/auth/login");
  }

  try {
    const [user, stats] = await Promise.all([
      usersApi.getCurrentUser(),
      usersApi.getUserStats(),
    ]);
    return {
      user: {
        ...user,
        totalBookings: stats.bookingsAsRenter ?? 0,
        totalListings: stats.listingsCount ?? 0,
        averageRating: stats.averageRating ?? null,
      },
    };
  } catch (error) {
    return redirect("/auth/login");
  }
}

export async function clientAction({ request }: ActionFunctionArgs) {
  const currentUser = await getUser(request);
  if (!currentUser) {
    return redirect("/auth/login");
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string | null;
  const allowedIntents = new Set(["update-profile", "change-password", "delete-account"]);
  if (!intent || !allowedIntents.has(intent)) {
    return { success: false, error: "Unsupported action." };
  }

  if (intent === "change-password") {
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!currentPassword || !newPassword) {
      return { success: false, error: "Please fill out all password fields." };
    }
    if (newPassword.length < 8) {
      return { success: false, error: "New password must be at least 8 characters." };
    }
    if (newPassword.length > 128) {
      return { success: false, error: "New password must be 128 characters or fewer." };
    }
    if (currentPassword.length > 128) {
      return { success: false, error: "Current password must be 128 characters or fewer." };
    }
    if (newPassword === currentPassword) {
      return { success: false, error: "New password must be different from current password." };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "New password and confirmation do not match." };
    }

    try {
      await authApi.changePassword({ currentPassword, newPassword });
      return { success: true, message: "Password updated successfully." };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { data?: { message?: string } } }).response
                ?.data?.message || "Failed to update password"
            : "Failed to update password",
      };
    }
  }

  if (intent === "delete-account") {
    const deleteConfirmation = String(formData.get("deleteConfirmation") ?? "")
      .trim()
      .toUpperCase();
    if (deleteConfirmation !== "DELETE") {
      return { success: false, error: "Type DELETE to confirm account deletion." };
    }
    try {
      await usersApi.deleteAccount();
      return { success: true, message: "Account deleted successfully." };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { data?: { message?: string } } }).response
                ?.data?.message || "Failed to delete account"
            : "Failed to delete account",
      };
    }
  }

  if (intent !== "update-profile") {
    return { success: false, error: "Unsupported action." };
  }

  const profilePayload = {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phoneNumber: String(formData.get("phoneNumber") ?? "").trim(),
  };

  const parsedProfile = profileSchema.safeParse(profilePayload);
  if (!parsedProfile.success) {
    const firstError = parsedProfile.error.issues[0]?.message ?? "Invalid profile data";
    return { success: false, error: firstError };
  }

  try {
    const user = await usersApi.updateCurrentUser(parsedProfile.data);
    return { success: true, user, message: "Profile updated successfully!" };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to update profile"
          : "Failed to update profile",
    };
  }
}

interface User {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phoneNumber?: string;
  profilePhotoUrl?: string | null;
  emailVerified?: boolean;
  totalBookings?: number;
  totalListings?: number;
  averageRating?: number | null;
}

export default function ProfileSettings() {
  const { t } = useTranslation();
  const { user: loaderUser } = useLoaderData<{ user: User }>();
  const actionData = useActionData<typeof clientAction>();
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(
    loaderUser?.profilePhotoUrl || null
  );
  const [photoStatus, setPhotoStatus] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { updateUser } = useAuthStore();

  // Sync auth store when profile is successfully updated
  useEffect(() => {
    if (actionData?.success && actionData?.user) {
      updateUser(actionData.user as any);
    }
  }, [actionData, updateUser]);

  const {
    register,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: loaderUser?.firstName || "",
      lastName: loaderUser?.lastName || "",
      email: loaderUser?.email || "",
      phoneNumber: loaderUser?.phoneNumber || "",
    },
  });

  if (!loaderUser) {
    return <div>{t("common.loading")}</div>;
  }

  const handlePhotoSelect = async (file?: File) => {
    if (!file) return;
    const maxSizeBytes = 5 * 1024 * 1024;
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    if (file.size > maxSizeBytes) {
      setPhotoStatus({ type: "error", message: "Image must be 5MB or smaller." });
      return;
    }
    if (!allowedTypes.has(file.type)) {
      setPhotoStatus({ type: "error", message: "Only JPG, PNG, WEBP, or GIF images are allowed." });
      return;
    }
    setUploadingPhoto(true);
    setPhotoStatus(null);
    try {
      const upload = await uploadApi.uploadImage(file);
      await usersApi.updateCurrentUser({ profilePhotoUrl: upload.url } as any);
      setProfilePhotoUrl(upload.url);
      setPhotoStatus({ type: "success", message: "Profile photo updated." });
    } catch (error: unknown) {
      setPhotoStatus({
        type: "error",
        message:
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { data?: { message?: string } } }).response
                ?.data?.message || "Failed to upload photo"
            : "Failed to upload photo",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">{t("settings.profileSettings.title")}</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <aside className="md:col-span-1">
            <nav className="bg-card rounded-lg border p-2 space-y-1">
              <Link
                to="/settings/profile"
                className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-lg font-medium"
              >
                <User className="w-5 h-5" />
                {t("settings.profile")}
              </Link>
              <Link
                to="/settings/notifications"
                className="w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5" />
                {t("settings.notifications")}
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

          {/* Main Content */}
          <div className="md:col-span-3 space-y-6">
            {/* Success Message */}
            {actionData?.success && (
              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                <p className="text-sm text-success">{actionData.message}</p>
              </div>
            )}

            {/* Error Message */}
            {actionData?.error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{actionData.error}</p>
              </div>
            )}
            {photoStatus && (
              <div
                className={`p-4 rounded-lg border ${
                  photoStatus.type === "success"
                    ? "bg-success/10 border-success/20 text-success"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}
              >
                <p className="text-sm">{photoStatus.message}</p>
              </div>
            )}

            {/* Profile Photo */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.profileSettings.avatar")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center">
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt={loaderUser.firstName}
                        className="w-full h-full rounded-full object-cover"
                      />
                      ) : (
                        <span className="text-3xl font-bold text-muted-foreground">
                          {safeInitial(loaderUser.firstName)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <UnifiedButton
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                    >
                      {uploadingPhoto ? t("settings.profileSettings.uploading") : t("settings.profileSettings.changePhoto")}
                    </UnifiedButton>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        handlePhotoSelect(file);
                        if (event.target) {
                          event.target.value = "";
                        }
                      }}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      {t("settings.profileSettings.photoInfo")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Form method="post">
              <input type="hidden" name="intent" value="update-profile" />
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.profileSettings.personalInfo")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          {t("settings.profileSettings.firstName")}
                        </label>
                        <input
                          {...register("firstName")}
                          name="firstName"
                          type="text"
                          maxLength={50}
                          className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                        {errors.firstName && (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.firstName.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          {t("settings.profileSettings.lastName")}
                        </label>
                        <input
                          {...register("lastName")}
                          name="lastName"
                          type="text"
                          maxLength={50}
                          className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t("settings.profileSettings.emailAddress")}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                          {...register("email")}
                          name="email"
                          type="email"
                          maxLength={320}
                          className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.email.message}
                        </p>
                      )}
                      {loaderUser.emailVerified && (
                        <p className="mt-1 text-sm text-success flex items-center gap-1">
                          <Shield className="w-4 h-4" />
                          {t("settings.profileSettings.verified")}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t("settings.profileSettings.phoneNumber")}
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                          {...register("phoneNumber")}
                          name="phoneNumber"
                          type="tel"
                          maxLength={20}
                          className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>
                      {errors.phoneNumber && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.phoneNumber.message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end pt-4 border-t border-border">
                      <UnifiedButton type="submit" className="flex items-center gap-2">
                        <Save className="w-5 h-5" />
                        {t("settings.profileSettings.save")}
                      </UnifiedButton>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Form>

            {/* Account Stats */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.profileSettings.accountStats")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {loaderUser.totalBookings || 0}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {t("settings.profileSettings.bookings")}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {loaderUser.totalListings || 0}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {t("settings.profileSettings.listings")}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {loaderUser.averageRating != null
                        ? safeNumber(loaderUser.averageRating).toFixed(1)
                        : "N/A"}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {t("settings.profileSettings.rating")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.profileSettings.changePassword")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Form method="post">
                  <input type="hidden" name="intent" value="change-password" />
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t("settings.profileSettings.currentPassword")}
                      </label>
                      <input
                        type="password"
                        name="currentPassword"
                        maxLength={128}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t("settings.profileSettings.newPassword")}
                      </label>
                      <input
                        type="password"
                        name="newPassword"
                        maxLength={128}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t("settings.profileSettings.confirmPassword")}
                      </label>
                      <input
                        type="password"
                        name="confirmPassword"
                        maxLength={128}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>
                    <div className="flex items-center justify-end pt-4 border-t border-border">
                      <UnifiedButton
                        type="submit"
                        variant="primary"
                        leftIcon={<Key className="w-5 h-5" />}
                      >
                        {t("settings.profileSettings.updatePassword")}
                      </UnifiedButton>
                    </div>
                  </div>
                </Form>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">{t("settings.profileSettings.dangerZone")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("settings.profileSettings.deleteWarning")}
                </p>
                <Form method="post">
                  <input type="hidden" name="intent" value="delete-account" />
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("settings.profileSettings.typeDeleteToConfirm")}
                    </label>
                    <input
                      type="text"
                      name="deleteConfirmation"
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      maxLength={20}
                      className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      autoComplete="off"
                    />
                  </div>
                  <UnifiedButton
                    variant="destructive"
                    type="submit"
                    disabled={deleteConfirmation.trim().toUpperCase() !== "DELETE"}
                  >
                    {t("settings.profileSettings.deleteAccount")}
                  </UnifiedButton>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

