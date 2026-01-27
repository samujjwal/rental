import type { MetaFunction, ActionFunctionArgs } from "react-router";
import { Form, Link, useActionData, useNavigation, redirect } from "react-router";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import { authApi } from "~/lib/api/auth";
import { createUserSession } from "~/utils/auth.server";
import { useAuthStore } from "~/lib/store/auth";

export const meta: MetaFunction = () => {
    return [
        { title: "Login - Universal Rental Portal" },
        { name: "description", content: "Sign in to your account" },
    ];
};

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const remember = formData.get("remember") === "true";
    const redirectTo = formData.get("redirectTo") as string || "/dashboard";

    try {
        const response = await authApi.login({ email, password });

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
        return {
            error: error.response?.data?.message || "Login failed. Please try again.",
        };
    }
}

export default function Login() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const [showPassword, setShowPassword] = useState(false);
    const isSubmitting = navigation.state === "submitting";
    
    // Update auth store when login succeeds
    useEffect(() => {
        if (actionData && !actionData.error && typeof window !== 'undefined') {
            // The session action will handle redirect
            // Auth store will be restored via useAuthInit on the next page load
        }
    }, [actionData]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-block">
                        <h1 className="text-3xl font-bold text-blue-600">
                            Rental Portal
                        </h1>
                    </Link>
                    <p className="text-gray-600 mt-2">Welcome back! Please sign in.</p>
                </div>

                {/* Login Form */}
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <Form method="post" className="space-y-6">
                        {/* Error Message */}
                        {actionData?.error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">{actionData.error}</p>
                            </div>
                        )}

                        {/* Email Field */}
                        <div className="mb-6">
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        {/* Password Field */}
                        <div className="mb-6">
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    name="password"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-12"
                                    placeholder="•••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Forgot Password Link */}
                        <div className="mb-6 text-right">
                            <Link
                                to="/auth/forgot-password"
                                className="text-sm text-blue-600 hover:text-blue-700"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    Sign In
                                </>
                            )}
                        </button>
                    </Form>

                    {/* Sign Up Link */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600">
                            Don't have an account?{" "}
                            <Link
                                to="/auth/signup"
                                className="text-blue-600 hover:text-blue-700 font-medium"
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
