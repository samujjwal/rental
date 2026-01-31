import type {
  MetaFunction,
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { useState } from "react";
import { authApi } from "~/lib/api/auth";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "~/lib/validation/auth";
import { redirect } from "react-router";
import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Reset Password - Universal Rental Portal" },
    { name: "description", content: "Set a new password for your account" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return redirect("/auth/forgot-password");
  }

  return { token };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;

  try {
    const response = await authApi.resetPassword({
      token,
      newPassword: password,
    });
    return { success: true, message: response.message };
  } catch (error: any) {
    return {
      success: false,
      error:
        error.response?.data?.message ||
        "Failed to reset password. Please try again.",
    };
  }
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isSubmitting = navigation.state === "submitting";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
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

  const inputClasses = cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50"
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-bold text-primary">Rental Portal</h1>
          </Link>
          <p className="text-muted-foreground mt-2">Enter your new password</p>
        </div>

        {/* Reset Password Form */}
        <div className="bg-card border rounded-lg shadow-lg p-8">
          {actionData?.success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Password reset successful
              </h2>
              <p className="text-muted-foreground mb-6">
                Your password has been reset successfully. You can now sign in
                with your new password.
              </p>
              <Link
                to="/auth/login"
                className="inline-flex items-center justify-center w-full h-10 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Go to Login
              </Link>
            </div>
          ) : (
            <Form method="post" onSubmit={handleSubmit(() => {})}>
              <input type="hidden" name="token" value={token || ""} />

              {/* Error Message */}
              {actionData?.error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{actionData.error}</p>
                </div>
              )}

              {/* Password Field */}
              <div className="space-y-2 mb-6">
                <label
                  htmlFor="password"
                  className="text-sm font-medium leading-none"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    className={cn(inputClasses, "pr-10")}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        Password strength:
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
                  <p className="text-sm text-destructive">
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
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    {...register("confirmPassword")}
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    className={cn(inputClasses, "pr-10")}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Resetting password...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
