import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useActionData, useNavigation, useSubmit } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { authApi } from "~/lib/api/auth";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "~/lib/validation/auth";
import { UnifiedButton , RouteErrorBoundary } from "~/components/ui";
import { cn } from "~/lib/utils";
import { getUser } from "~/utils/auth";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const meta: MetaFunction = () => {
  return [
    { title: "Forgot Password | GharBatai Rentals" },
    { name: "description", content: "Reset your password" },
  ];
};

export function getForgotPasswordError(
  error: unknown,
  fallbackMessage = "Failed to send reset email. Please try again."
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
    return "You appear to be offline. Reconnect and try sending the reset email again.";
  }

  if (hasTransportContext) {
    return getActionableErrorMessage(error, fallbackMessage, {
      [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try sending the reset email again.",
      [ApiErrorType.TIMEOUT_ERROR]: "Sending the reset email timed out. Try again.",
    });
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
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
  if (intent !== "forgot-password") {
    return {
      success: false,
      error: "Invalid request.",
    };
  }
  const email = String(formData.get("email") ?? "").trim();
  if (email.length > 320) {
    return {
      success: false,
      error: "Please enter a valid email address.",
    };
  }
  const validation = forgotPasswordSchema.safeParse({ email });
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Please enter a valid email address.",
    };
  }

  try {
    const response = await authApi.forgotPassword({ email: validation.data.email });
    return { success: true, message: response.message };
  } catch (error: unknown) {
    return {
      success: false,
      error: getForgotPasswordError(error),
    };
  }
}

export default function ForgotPassword() {
  const { t } = useTranslation();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });
  const submit = useSubmit();

  const inputClasses = cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50"
  );
  const actionErrorId = actionData?.error ? "forgot-password-form-error" : undefined;
  const emailErrorId = errors.email ? "forgot-password-email-error" : undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-bold text-primary">{t('auth.forgotPassword.title')}</h1>
          </Link>
          <p className="text-muted-foreground mt-2">
            {t('auth.forgotPassword.description')}
          </p>
        </div>

        {/* Forgot Password Form */}
        <div className="bg-card border rounded-lg shadow-lg p-8">
          {actionData?.success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {t('auth.forgotPassword.checkEmail', 'Check your email')}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t('auth.forgotPassword.sentMessage', "We've sent a password reset link to your email address.")}
              </p>
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/90 font-medium underline-offset-4 hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : (
            <Form
              method="post"
              onSubmit={handleSubmit((_, event) => {
                if (event?.target) {
                  submit(event.target as HTMLFormElement);
                }
              })}
            >
              <input type="hidden" name="intent" value="forgot-password" />
              {/* Error Message */}
              {actionData?.error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p id="forgot-password-form-error" className="text-sm text-destructive">{actionData.error}</p>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2 mb-6">
                <label
                  htmlFor="email"
                  className="text-sm font-medium leading-none"
                >
                  {t('auth.login.email')}
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
                  <p id="forgot-password-email-error" className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <UnifiedButton type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    {t('auth.forgotPassword.sending')}
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {t('auth.forgotPassword.send')}
                  </>
                )}
              </UnifiedButton>

              {/* Back to Login */}
              <div className="mt-6 text-center">
                <Link
                  to="/auth/login"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('auth.forgotPassword.backToLogin')}
                </Link>
              </div>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

