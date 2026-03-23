import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "~/lib/api/auth";
import { useAuthStore } from "~/lib/store/auth";
import { createUserSession } from "~/utils/auth";
import { signupSchema, type SignupInput } from "~/lib/validation/auth";
import { APP_PHONE_PLACEHOLDER } from "~/config/locale";
import { cn } from "~/lib/utils";
import { UnifiedButton, RouteErrorBoundary } from "~/components/ui";
import { getUser } from "~/utils/auth";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const meta: MetaFunction = () => {
  return [
    { title: "Sign Up | GharBatai Rentals" },
    { name: "description", content: "Create a new account" },
  ];
};

export function getSignupError(
  error: unknown,
  fallbackMessage = "Registration failed. Please try again."
): string {
  const hasTransportContext = Boolean(
    error &&
      typeof error === "object" &&
      ("response" in error || "code" in error || "isAxiosError" in error)
  );
  const responseMessage =
    error &&
    typeof error === "object" &&
    "response" in error
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
      : undefined;

  if (responseMessage) {
    return responseMessage;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try creating your account again.";
  }

  if (hasTransportContext) {
    return getActionableErrorMessage(error, fallbackMessage, {
      [ApiErrorType.CONFLICT]: "An account with these details already exists. Review the form and try again.",
      [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try creating your account again.",
      [ApiErrorType.TIMEOUT_ERROR]: "Account creation timed out. Try again.",
    });
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) {
    return redirect("/dashboard");
  }
  return null;
}

export async function clientAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent !== "signup") {
    return { error: "Invalid request." };
  }
  const rawRole = String(formData.get("role") || "").trim().toLowerCase();
  const allowedRoles = new Set(["renter", "owner"]);
  const email = String(formData.get("email") || "").trim().slice(0, 320);
  const password = String(formData.get("password") || "").slice(0, 128);
  const confirmPassword = String(formData.get("confirmPassword") || "").slice(0, 128);
  const firstName = String(formData.get("firstName") || "").trim().slice(0, 50);
  const lastName = String(formData.get("lastName") || "").trim().slice(0, 50);
  const phone = String(formData.get("phone") || "").trim().slice(0, 20);
  const parsedForm = {
    email,
    password,
    confirmPassword,
    firstName,
    lastName,
    phone,
    role: allowedRoles.has(rawRole) ? rawRole : "renter",
  };

  const validation = signupSchema.safeParse(parsedForm);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Please fix the form errors.",
    };
  }

  const {
    email: validatedEmail,
    password: validatedPassword,
    firstName: validatedFirstName,
    lastName: validatedLastName,
    phone: validatedPhone,
  } = validation.data;
  const validatedRole = parsedForm.role;

  try {
    // Note: API doesn't accept a 'role' field on registration — new users are always USER
    const response = await authApi.signup({
      email: validatedEmail,
      password: validatedPassword,
      firstName: validatedFirstName,
      lastName: validatedLastName || undefined,
      phone: validatedPhone || undefined,
    });

    // Update auth store immediately for better SPA experience
    // B-29: refreshToken is now stored in httpOnly cookie by the API
    useAuthStore.getState().setAuth(response.user, response.accessToken);

    return createUserSession({
      userId: response.user.id,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      remember: false,
      redirectTo: "/dashboard",
    });
  } catch (error: unknown) {
    return { error: getSignupError(error) };
  }
}

export default function Signup() {
  const { t } = useTranslation();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isSubmitting = navigation.state === "submitting";

  const {
    register,
    watch,
    trigger,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: "renter",
    },
  });

  const password = watch("password", "");

  // Password strength indicator
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { strength: 0, label: "None", color: "bg-muted" as const };
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[@$!%*?&]/.test(pwd)) strength++;

    if (strength <= 1)
      return { strength, label: "Weak", color: "bg-destructive" as const };
    if (strength === 2)
      return { strength, label: "Fair", color: "bg-warning" as const };
    if (strength === 3)
      return { strength, label: "Good", color: "bg-primary" as const };
    return { strength, label: "Strong", color: "bg-success" as const };
  };

  const passwordStrength = getPasswordStrength(password);
  const actionErrorId = actionData?.error ? "signup-form-error" : undefined;
  const roleErrorId = errors.role ? "signup-role-error" : undefined;
  const firstNameErrorId = errors.firstName ? "signup-first-name-error" : undefined;
  const lastNameErrorId = errors.lastName ? "signup-last-name-error" : undefined;
  const emailErrorId = errors.email ? "signup-email-error" : undefined;
  const phoneErrorId = errors.phone ? "signup-phone-error" : undefined;
  const passwordStrengthId = password ? "signup-password-strength" : undefined;
  const passwordErrorId = errors.password ? "signup-password-error" : undefined;
  const confirmPasswordErrorId = errors.confirmPassword ? "signup-confirm-password-error" : undefined;

  const inputClasses = cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50"
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-bold text-primary">{t('auth.signup.title')}</h1>
          </Link>
          <p className="text-muted-foreground mt-2">
            {t('auth.signup.subtitle', 'Create your account to get started')}
          </p>
        </div>

        {/* Signup Form */}
        <div className="bg-card border rounded-lg shadow-lg p-8">
          <Form
            method="post"
            onSubmit={async (event) => {
              const isValid = await trigger();
              if (!isValid) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="signup" />
            {/* Error Message */}
            {actionData?.error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p id="signup-form-error" className="text-sm text-destructive">{actionData.error}</p>
              </div>
            )}

            {/* Role Selection */}
            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium leading-none">
                {t('auth.signup.iWantTo', 'I want to')}
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="relative flex items-center justify-center p-4 border-2 border-input rounded-lg cursor-pointer hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    {...register("role")}
                    type="radio"
                    value="renter"
                    aria-invalid={!!errors.role}
                    aria-describedby={roleErrorId || actionErrorId}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{t('auth.signup.rentItems', 'Rent items')}</span>
                </label>
                <label className="relative flex items-center justify-center p-4 border-2 border-input rounded-lg cursor-pointer hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    {...register("role")}
                    type="radio"
                    value="owner"
                    aria-invalid={!!errors.role}
                    aria-describedby={roleErrorId || actionErrorId}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{t('auth.signup.listItems', 'List items')}</span>
                </label>
              </div>
              {errors.role && (
                <p id="signup-role-error" className="text-sm text-destructive">
                  {errors.role.message}
                </p>
              )}
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <label
                  htmlFor="firstName"
                  className="text-sm font-medium leading-none"
                >
                  {t('auth.signup.firstName')} *
                </label>
                <input
                  {...register("firstName")}
                  type="text"
                  id="firstName"
                  name="firstName"
                  maxLength={50}
                  aria-invalid={!!errors.firstName}
                  aria-describedby={firstNameErrorId || actionErrorId}
                  className={inputClasses}
                  placeholder="Ram"
                />
                {errors.firstName && (
                  <p id="signup-first-name-error" className="text-sm text-destructive">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="lastName"
                  className="text-sm font-medium leading-none"
                >
                  {t('auth.signup.lastName')}
                </label>
                <input
                  {...register("lastName")}
                  type="text"
                  id="lastName"
                  name="lastName"
                  maxLength={50}
                  aria-invalid={!!errors.lastName}
                  aria-describedby={lastNameErrorId || actionErrorId}
                  className={inputClasses}
                  placeholder="Sharma"
                />
                {errors.lastName && (
                  <p id="signup-last-name-error" className="text-sm text-destructive">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2 mb-6">
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none"
              >
                {t('auth.signup.email')} *
              </label>
              <input
                {...register("email")}
                type="email"
                id="email"
                name="email"
                maxLength={320}
                aria-invalid={!!errors.email}
                aria-describedby={emailErrorId || actionErrorId}
                className={inputClasses}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p id="signup-email-error" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Phone Field */}
            <div className="space-y-2 mb-6">
              <label
                htmlFor="phone"
                className="text-sm font-medium leading-none"
              >
                {t('auth.signup.phone')}
              </label>
              <input
                {...register("phone")}
                type="tel"
                id="phone"
                name="phone"
                maxLength={20}
                aria-invalid={!!errors.phone}
                aria-describedby={phoneErrorId || actionErrorId}
                className={inputClasses}
                placeholder={APP_PHONE_PLACEHOLDER}
              />
              {errors.phone && (
                <p id="signup-phone-error" className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2 mb-6">
              <label
                htmlFor="password"
                className="text-sm font-medium leading-none"
              >
                {t('auth.signup.password')} *
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  maxLength={128}
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    [passwordStrengthId, passwordErrorId, actionErrorId].filter(Boolean).join(" ") || undefined
                  }
                  className={cn(inputClasses, "pr-10")}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                  <div id="signup-password-strength" className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      {t('auth.signup.passwordStrength', 'Password strength:')}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        passwordStrength.color === "bg-destructive" &&
                        "text-destructive",
                        passwordStrength.color === "bg-warning" &&
                        "text-warning",
                        passwordStrength.color === "bg-primary" &&
                        "text-primary",
                        passwordStrength.color === "bg-success" &&
                        "text-success"
                      )}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        passwordStrength.color
                      )}
                      style={{
                        width: `${(passwordStrength.strength / 4) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {errors.password && (
                <p id="signup-password-error" className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2 mb-6">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-medium leading-none"
              >
                {t('auth.signup.confirmPassword')} *
              </label>
              <div className="relative">
                <input
                  {...register("confirmPassword")}
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  maxLength={128}
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={confirmPasswordErrorId || actionErrorId}
                  className={cn(inputClasses, "pr-10")}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p id="signup-confirm-password-error" className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <UnifiedButton
              type="submit"
              disabled={isSubmitting}
              loading={isSubmitting}
              leftIcon={!isSubmitting ? <UserPlus className="w-4 h-4" /> : undefined}
              fullWidth
              variant="primary"
            >
              {isSubmitting ? t('auth.signup.creating') : t('auth.signup.create')}
            </UnifiedButton>
          </Form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('auth.signup.hasAccount')}{" "}
              <Link
                to="/auth/login"
                className="text-primary hover:text-primary/90 font-medium underline-offset-4 hover:underline"
              >
                {t('auth.signup.signIn')}
              </Link>
            </p>
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground flex-wrap">
          <span>🔒 Secure &amp; encrypted</span>
          <span>⭐ 10,000+ renters</span>
          <span>🛡️ Insured transactions</span>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
