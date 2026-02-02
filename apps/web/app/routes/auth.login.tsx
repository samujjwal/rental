import type { MetaFunction, ActionFunctionArgs } from "react-router";
import {
  Form,
  Link,
  useActionData,
  useNavigation,
  redirect,
} from "react-router";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import { authApi } from "~/lib/api/auth";
import { createUserSession } from "~/utils/auth";
import { useAuthStore } from "~/lib/store/auth";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Login - Universal Rental Portal" },
    { name: "description", content: "Sign in to your account" },
  ];
};

export async function clientAction({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const remember = formData.get("remember") === "true";
    const redirectTo = (formData.get("redirectTo") as string) || "/dashboard";

    if (!email || !password) {
      return {
        error: "Email and password are required.",
      };
    }

    const response = await authApi.login({ email, password });

    // Update auth store immediately for better SPA experience
    useAuthStore.getState().setAuth(response.user, response.accessToken, response.refreshToken);

    // Store in server session
    const sessionResponse = await createUserSession({
      userId: response.user.id,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      remember,
      redirectTo,
    });

    return sessionResponse;
  } catch (error: any) {
    console.error(
      "Login error:",
      error.response?.data?.message || error.message
    );
    return {
      error:
        error.response?.data?.message ||
        error.message ||
        "Login failed. Please try again.",
    };
  }
}

export default function Login() {
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [showPassword, setShowPassword] = useState(false);
  const isSubmitting = navigation.state === "submitting";

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
            <h1 className="text-3xl font-bold text-primary">Rental Portal</h1>
          </Link>
          <p className="text-muted-foreground mt-2">
            Welcome back! Please sign in.
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-card border rounded-lg shadow-lg p-8">
          <Form method="post" className="space-y-6">
            {/* Error Message */}
            {actionData?.error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{actionData.error}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
                placeholder="you@example.com"
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background",
                    "placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                  placeholder="•••••••••"
                  required
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
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link
                to="/auth/forgot-password"
                className="text-sm text-primary hover:text-primary/90 underline-offset-4 hover:underline"
              >
                Forgot password?
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
                  Sign In
                </>
              )}
            </button>
          </Form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/auth/signup"
                className="text-primary hover:text-primary/90 font-medium underline-offset-4 hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
