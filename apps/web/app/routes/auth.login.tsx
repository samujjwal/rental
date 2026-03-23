import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { RouteErrorBoundary } from "~/components/ui";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "~/lib/api/auth";
import { createUserSession } from "~/utils/auth";
import { useAuthStore } from "~/lib/store/auth";
import { cn } from "~/lib/utils";
import { loginSchema, type LoginInput } from "~/lib/validation/auth";
import { getUser } from "~/utils/auth";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const meta: MetaFunction = () => {
  return [
    { title: "Login | GharBatai Rentals" },
    { name: "description", content: "Sign in to your account" },
  ];
};

function sanitizeRedirectPath(redirectTo?: string | null) {
  if (!redirectTo || redirectTo.length > 512) {
    return "/";
  }
  const normalized = redirectTo.trim();
  if (
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /[\r\n\t]/.test(normalized)
  ) {
    return "/";
  }
  if (normalized.startsWith("/auth/")) {
    return "/";
  }
  return normalized;
}

export function getLoginError(
  error: unknown,
  fallbackMessage = "Login failed. Please try again."
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
    return "You appear to be offline. Reconnect and try signing in again.";
  }

  if (hasTransportContext) {
    return getActionableErrorMessage(error, fallbackMessage, {
      [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try signing in again.",
      [ApiErrorType.TIMEOUT_ERROR]: "Sign in timed out. Try again.",
    });
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) return null;

  const redirectTo = sanitizeRedirectPath(
    new URL(request.url).searchParams.get("redirectTo")
  );
  return redirect(redirectTo);
}

export async function clientAction({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const intent = String(formData.get("intent") || "");
    if (intent !== "login") {
      return { error: "Invalid request." };
    }
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const mfaCode = String(formData.get("mfaCode") ?? "").trim() || undefined;
    if (email.length > 320 || password.length > 1024) {
      return { error: "Invalid credentials." };
    }
    const rememberValue = formData.get("remember");
    const remember = rememberValue === "true" || rememberValue === "on";
    const redirectTo = sanitizeRedirectPath(formData.get("redirectTo") as string);

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      return {
        error: validation.error.issues[0]?.message || "Invalid credentials.",
      };
    }

    const response = await authApi.login({ email, password, mfaCode });

    // Update auth store immediately for better SPA experience
    // B-29: refreshToken is now stored in httpOnly cookie by the API, not in localStorage
    useAuthStore.getState().setAuth(response.user, response.accessToken);

    // Store in server session
    const sessionResponse = await createUserSession({
      userId: response.user.id,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      remember,
      redirectTo,
    });

    return sessionResponse;
  } catch (error: unknown) {
    const errorMessage = getLoginError(error);

    // If MFA code is required, signal the UI to show MFA input
    if (errorMessage === "MFA code required") {
      return { requiresMfa: true };
    }

    return { error: errorMessage || "Login failed. Please try again." };
  }
}

export default function Login() {
  const { t } = useTranslation();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  const redirectTo = sanitizeRedirectPath(searchParams.get("redirectTo"));

  // Show MFA input when API signals it's required
  useEffect(() => {
    if (actionData && "requiresMfa" in actionData && actionData.requiresMfa) {
      setShowMfa(true);
    }
  }, [actionData]);

  const {
    register,
    formState: { errors },
    trigger,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const actionErrorId = actionData?.error ? "login-form-error" : undefined;
  const emailErrorId = errors.email ? "login-email-error" : undefined;
  const passwordErrorId = errors.password ? "login-password-error" : undefined;

  // Update auth store when login succeeds
  useEffect(() => {
    if (actionData && !actionData.error && typeof window !== "undefined") {
      // The session action will handle redirect
      // Auth store will be restored via useAuthInit on the next page load
    }
  }, [actionData]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-bold text-primary">{t('common.appName')}</h1>
          </Link>
          <p className="text-muted-foreground mt-2">
            {t('auth.login.welcome')}
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-card border rounded-lg shadow-lg p-8">
          <Form method="post" className="space-y-6">
            <input type="hidden" name="intent" value="login" />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            {/* Error Message */}
            {actionData?.error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p id="login-form-error" className="text-sm text-destructive">{actionData.error}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('auth.login.email')}
              </label>
              <input
                type="email"
                id="email"
                autoComplete="username"
                maxLength={320}
                {...register("email")}
                onBlur={() => trigger("email")}
                aria-invalid={!!errors.email}
                aria-describedby={emailErrorId || actionErrorId}
                className={cn(
                  "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  errors.email
                    ? "border-destructive focus-visible:ring-destructive"
                    : "border-input"
                )}
                placeholder={t('auth.login.emailPlaceholder')}
                required
              />
              {errors.email && (
                <p id="login-email-error" className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('auth.login.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  autoComplete="current-password"
                  maxLength={1024}
                  {...register("password")}
                  onBlur={() => trigger("password")}
                  aria-invalid={!!errors.password}
                  aria-describedby={passwordErrorId || actionErrorId}
                  className={cn(
                    "flex h-10 w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm ring-offset-background",
                    "placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    errors.password
                      ? "border-destructive focus-visible:ring-destructive"
                      : "border-input"
                  )}
                  placeholder={t('auth.login.passwordPlaceholder')}
                  required
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
              {errors.password && (
                <p id="login-password-error" className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* MFA Code Field */}
            {showMfa && (
              <div className="space-y-2">
                <label
                  htmlFor="mfaCode"
                  className="text-sm font-medium leading-none"
                >
                  Two-Factor Code
                </label>
                <input
                  type="text"
                  id="mfaCode"
                  name="mfaCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  aria-describedby="login-mfa-help"
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                    "placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                  placeholder={t('auth.login.mfaPlaceholder')}
                  required
                />
                <p id="login-mfa-help" className="text-xs text-muted-foreground">
                  {t('auth.login.mfaHelp')}
                </p>
              </div>
            )}

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  name="remember"
                  value="true"
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                />
                {t('auth.login.rememberMe')}
              </label>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link
                to="/auth/forgot-password"
                className="text-sm text-primary hover:text-primary/90 underline-offset-4 hover:underline"
              >
                {t('auth.login.forgotPassword')}
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {t('auth.login.signIn')}
                </>
              )}
            </button>
          </Form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('auth.login.noAccount')}{" "}
              <Link
                to="/auth/signup"
                className="text-primary hover:text-primary/90 font-medium underline-offset-4 hover:underline"
              >
                {t('auth.login.signUp')}
              </Link>
            </p>
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">🔒 Secure &amp; encrypted</span>
          <span className="flex items-center gap-1">⭐ 10,000+ renters</span>
          <span className="flex items-center gap-1">🛡️ Insured transactions</span>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

