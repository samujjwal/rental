import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useLoaderData, useActionData, useNavigation, useRevalidator, useSubmit } from "react-router";
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
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

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
const getResponseMessage = (error: unknown): string | undefined =>
  error && typeof error === "object" && "response" in error
    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
    : undefined;
const hasTransportContext = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === "object" &&
      ("response" in error || "code" in error || "isAxiosError" in error)
  );

export function getProfileSettingsLoadError(error: unknown): string {
  const responseMessage = getResponseMessage(error);
  if (responseMessage) {
    return responseMessage;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try loading your profile again.";
  }

  return getActionableErrorMessage(error, "Unable to load your profile settings right now.", {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try loading your profile again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading your profile settings timed out. Try again.",
    [ApiErrorType.NETWORK_ERROR]: "We could not load your profile settings right now. Try again in a moment.",
  });
}

export function getProfilePhotoUploadError(
  error: unknown,
  fallbackMessage = "Failed to upload photo"
): string {
  const responseMessage = getResponseMessage(error);
  if (responseMessage) {
    return responseMessage;
  }

  const directMessage =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? String((error as { message: string }).message).trim()
      : "";

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try uploading your photo again.";
  }

  const actionableMessage = getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try uploading your photo again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Uploading the photo timed out. Try again.",
    [ApiErrorType.NETWORK_ERROR]: "We could not upload the photo right now. Try again in a moment.",
  });

  const genericMessages = new Set([
    "conflict",
    "network error",
    "timeout",
    fallbackMessage.toLowerCase(),
  ]);

  if (directMessage && !genericMessages.has(directMessage.toLowerCase())) {
    return directMessage;
  }

  return actionableMessage;
}

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
        phoneNumber:
          ("phoneNumber" in user && typeof user.phoneNumber === "string"
            ? user.phoneNumber
            : "phone" in user && typeof user.phone === "string"
              ? user.phone
              : undefined) || undefined,
        totalBookings: stats.bookingsAsRenter ?? 0,
        totalListings: stats.listingsCount ?? 0,
        averageRating: stats.averageRating ?? null,
      },
      error: null,
    };
  } catch (error) {
    return {
      user: null,
      error: getProfileSettingsLoadError(error),
    };
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
          getResponseMessage(error) ||
          (hasTransportContext(error)
            ? getActionableErrorMessage(error, "Failed to update password", {
                [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
                [ApiErrorType.TIMEOUT_ERROR]: "Updating your password timed out. Try again.",
                [ApiErrorType.CONFLICT]: "Your password state changed elsewhere. Refresh and try again.",
              })
            : "Failed to update password"),
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
          getResponseMessage(error) ||
          (hasTransportContext(error)
            ? getActionableErrorMessage(error, "Failed to delete account", {
                [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
                [ApiErrorType.TIMEOUT_ERROR]: "Deleting the account timed out. Try again.",
                [ApiErrorType.CONFLICT]: "Account state changed while you were working. Refresh and try again.",
              })
            : "Failed to delete account"),
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
        getResponseMessage(error) ||
        (hasTransportContext(error)
          ? getActionableErrorMessage(error, "Failed to update profile", {
              [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
              [ApiErrorType.TIMEOUT_ERROR]: "Saving your profile timed out. Try again.",
              [ApiErrorType.CONFLICT]: "Your profile changed elsewhere. Refresh and try again.",
            })
          : "Failed to update profile"),
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

type ProfileFormUser = Partial<User> & {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
};

function getProfileFormValues(
  user: ProfileFormUser | null | undefined,
  storedUser: ProfileFormUser | null | undefined,
) {
  const effectiveUser = user || storedUser;
  const pickText = (...values: Array<unknown>) => {
    for (const value of values) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }

    return "";
  };

  if (!effectiveUser) {
    return {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
    };
  }

  return {
    firstName: pickText(effectiveUser.firstName, storedUser?.firstName),
    lastName: pickText(effectiveUser.lastName, storedUser?.lastName),
    email: pickText(effectiveUser.email, storedUser?.email),
    phoneNumber: pickText(
      effectiveUser.phoneNumber,
      effectiveUser.phone,
      storedUser?.phoneNumber,
      storedUser?.phone,
    ),
  };
}

export default function ProfileSettings() {
  const { t } = useTranslation();
  const { user: loaderUser, error: loaderError } = useLoaderData<{
    user: User | null;
    error?: string | null;
  }>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const { revalidate } = useRevalidator();
  const submit = useSubmit();
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(
    loaderUser?.profilePhotoUrl || null
  );
  const [photoStatus, setPhotoStatus] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const authUser = useAuthStore((state) => state.user as ProfileFormUser | null);
  const [profileFormValues, setProfileFormValues] = useState(() =>
    getProfileFormValues(loaderUser as ProfileFormUser | null, authUser)
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { updateUser } = useAuthStore();
  const isSubmitting = navigation.state === "submitting";

  // Sync auth store when profile is successfully updated
  useEffect(() => {
    if (actionData?.success && actionData?.user) {
      updateUser(actionData.user as any);
    }
  }, [actionData, updateUser]);

  const {
    register,
    reset,
    handleSubmit,
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

  const firstNameField = register("firstName");
  const lastNameField = register("lastName");
  const emailField = register("email");
  const handleProfileSubmit = handleSubmit((_, event) => {
    const form = event?.currentTarget;
    if (form instanceof HTMLFormElement) {
      submit(form, { method: "post" });
    }
  });

  useEffect(() => {
    const latestUser = actionData?.success && actionData.user ? actionData.user : loaderUser;
    if (!latestUser) {
      return;
    }

    const nextValues = getProfileFormValues(latestUser as ProfileFormUser, authUser);

    reset(nextValues);
    setProfileFormValues(nextValues);
  }, [actionData, loaderUser, authUser, reset]);

  useEffect(() => {
    let isActive = true;

    void usersApi.getCurrentUser().then((user) => {
      if (!isActive) {
        return;
      }

      const nextValues = getProfileFormValues(user as ProfileFormUser, authUser);
      reset(nextValues);
      setProfileFormValues(nextValues);
      if (typeof user.profilePhotoUrl !== "undefined") {
        setProfilePhotoUrl(user.profilePhotoUrl || null);
      }
      updateUser(user as any);
    }).catch(() => {
      // Keep loader data as the fallback source of truth if the refresh fails.
    });

    return () => {
      isActive = false;
    };
  }, [authUser, reset, updateUser]);

  if (!loaderUser) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold text-foreground">Profile settings unavailable</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {loaderError || "Unable to load your profile settings right now."}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <UnifiedButton type="button" onClick={() => revalidate()}>
                Try Again
              </UnifiedButton>
              <UnifiedButton type="button" variant="outline" asChild>
                <Link to="/settings/security">Go to Security Settings</Link>
              </UnifiedButton>
            </div>
          </div>
        </div>
      </div>
    );
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
        message: hasTransportContext(error)
          ? getProfilePhotoUploadError(error)
          : getProfilePhotoUploadError(error),
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
                      disabled={uploadingPhoto || isSubmitting}
                      className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                      aria-label="Upload profile photo"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <UnifiedButton
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      loading={uploadingPhoto}
                      disabled={uploadingPhoto || isSubmitting}
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
            <Form method="post" onSubmit={handleProfileSubmit}>
              <input type="hidden" name="intent" value="update-profile" />
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.profileSettings.personalInfo")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">
                          {t("settings.profileSettings.firstName")}
                        </label>
                        <input
                          {...firstNameField}
                          id="firstName"
                          name="firstName"
                          type="text"
                          maxLength={50}
                          disabled={isSubmitting}
                          value={profileFormValues.firstName}
                          onChange={(event) => {
                            firstNameField.onChange(event);
                            setProfileFormValues((current) => ({
                              ...current,
                              firstName: event.target.value,
                            }));
                          }}
                          className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                        {errors.firstName && (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.firstName.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">
                          {t("settings.profileSettings.lastName")}
                        </label>
                        <input
                          {...lastNameField}
                          id="lastName"
                          name="lastName"
                          type="text"
                          maxLength={50}
                          disabled={isSubmitting}
                          value={profileFormValues.lastName}
                          onChange={(event) => {
                            lastNameField.onChange(event);
                            setProfileFormValues((current) => ({
                              ...current,
                              lastName: event.target.value,
                            }));
                          }}
                          className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                        {t("settings.profileSettings.emailAddress")}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                          {...emailField}
                          id="email"
                          name="email"
                          type="email"
                          maxLength={320}
                          disabled={isSubmitting}
                          value={profileFormValues.email}
                          onChange={(event) => {
                            emailField.onChange(event);
                            setProfileFormValues((current) => ({
                              ...current,
                              email: event.target.value,
                            }));
                          }}
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
                      <label htmlFor="phoneNumber" className="block text-sm font-medium text-foreground mb-2">
                        {t("settings.profileSettings.phoneNumber")}
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                          id="phoneNumber"
                          name="phoneNumber"
                          type="tel"
                          maxLength={20}
                          disabled={isSubmitting}
                          value={profileFormValues.phoneNumber}
                          onChange={(event) => {
                            setProfileFormValues((current) => ({
                              ...current,
                              phoneNumber: event.target.value,
                            }));
                          }}
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
                      <UnifiedButton type="submit" className="flex items-center gap-2" loading={isSubmitting} disabled={isSubmitting}>
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
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground mb-2">
                        {t("settings.profileSettings.currentPassword")}
                      </label>
                      <input
                        id="currentPassword"
                        type="password"
                        name="currentPassword"
                        maxLength={128}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-foreground mb-2">
                        {t("settings.profileSettings.newPassword")}
                      </label>
                      <input
                        id="newPassword"
                        type="password"
                        name="newPassword"
                        maxLength={128}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                        {t("settings.profileSettings.confirmPassword")}
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        name="confirmPassword"
                        maxLength={128}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>
                    <div className="flex items-center justify-end pt-4 border-t border-border">
                      <UnifiedButton
                        type="submit"
                        variant="primary"
                        leftIcon={<Key className="w-5 h-5" />}
                        loading={isSubmitting}
                        disabled={isSubmitting}
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
                    <label htmlFor="deleteConfirmation" className="block text-sm font-medium text-foreground mb-2">
                      {t("settings.profileSettings.typeDeleteToConfirm")}
                    </label>
                    <input
                      id="deleteConfirmation"
                      type="text"
                      name="deleteConfirmation"
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      maxLength={20}
                      disabled={isSubmitting}
                      className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      autoComplete="off"
                    />
                  </div>
                  <UnifiedButton
                    variant="destructive"
                    type="submit"
                    loading={isSubmitting}
                    disabled={isSubmitting || deleteConfirmation.trim().toUpperCase() !== "DELETE"}
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

