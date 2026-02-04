import type { MetaFunction, ActionFunctionArgs } from "react-router";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, ArrowLeft } from "lucide-react";
import { authApi } from "~/lib/api/auth";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "~/lib/validation/auth";
import { UnifiedButton } from "~/components/ui";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Forgot Password - Universal Rental Portal" },
    { name: "description", content: "Reset your password" },
  ];
};

export async function clientAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;

  try {
    const response = await authApi.forgotPassword({ email });
    return { success: true, message: response.message };
  } catch (error: any) {
    return {
      success: false,
      error:
        error.response?.data?.message ||
        "Failed to send reset email. Please try again.",
    };
  }
}

export default function ForgotPassword() {
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
          <p className="text-muted-foreground mt-2">
            Enter your email to reset your password
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
                Check your email
              </h2>
              <p className="text-muted-foreground mb-6">
                We've sent a password reset link to your email address. Please
                check your inbox and follow the instructions.
              </p>
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/90 font-medium underline-offset-4 hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </div>
          ) : (
            <Form method="post" onSubmit={handleSubmit(() => {})}>
              {/* Error Message */}
              {actionData?.error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{actionData.error}</p>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2 mb-6">
                <label
                  htmlFor="email"
                  className="text-sm font-medium leading-none"
                >
                  Email Address
                </label>
                <input
                  {...register("email")}
                  type="email"
                  id="email"
                  name="email"
                  className={inputClasses}
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <UnifiedButton type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Reset Link
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
                  Back to login
                </Link>
              </div>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
