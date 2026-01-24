import type {
    MetaFunction,
    ActionFunctionArgs,
    LoaderFunctionArgs,
} from "react-router";
import { Form, Link, useActionData, useNavigation, useSearchParams } from "react-router";
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
        if (!pwd) return { strength: 0, label: "None", color: "gray" };
        let strength = 0;
        if (pwd.length >= 8) strength++;
        if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
        if (/\d/.test(pwd)) strength++;
        if (/[@$!%*?&]/.test(pwd)) strength++;

        if (strength <= 1) return { strength, label: "Weak", color: "red" };
        if (strength === 2) return { strength, label: "Fair", color: "yellow" };
        if (strength === 3) return { strength, label: "Good", color: "blue" };
        return { strength, label: "Strong", color: "green" };
    };

    const passwordStrength = getPasswordStrength(password);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-block">
                        <h1 className="text-3xl font-bold text-primary-600">
                            Rental Portal
                        </h1>
                    </Link>
                    <p className="text-gray-600 mt-2">Enter your new password</p>
                </div>

                {/* Reset Password Form */}
                <div className="bg-white rounded-lg shadow-lg p-8">
                    {actionData?.success ? (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                Password reset successful
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Your password has been reset successfully. You can now sign in
                                with your new password.
                            </p>
                            <Link
                                to="/auth/login"
                                className="inline-block w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 font-medium"
                            >
                                Go to Login
                            </Link>
                        </div>
                    ) : (
                        <Form method="post" onSubmit={handleSubmit(() => { })}>
                            <input type="hidden" name="token" value={token || ""} />

                            {/* Error Message */}
                            {actionData?.error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-600">{actionData.error}</p>
                                </div>
                            )}

                            {/* Password Field */}
                            <div className="mb-6">
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    New Password
                                </label>
                                <div className="relative">
                                    <input
                                        {...register("password")}
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        name="password"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-12"
                                        placeholder="••••••••"
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

                                {/* Password Strength Indicator */}
                                {password && (
                                    <div className="mt-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-gray-600">
                                                Password strength:
                                            </span>
                                            <span
                                                className={`text-xs font-medium text-${passwordStrength.color}-600`}
                                            >
                                                {passwordStrength.label}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full bg-${passwordStrength.color}-500 transition-all duration-300`}
                                                style={{
                                                    width: `${(passwordStrength.strength / 4) * 100}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {errors.password && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.password.message}
                                    </p>
                                )}
                            </div>

                            {/* Confirm Password Field */}
                            <div className="mb-6">
                                <label
                                    htmlFor="confirmPassword"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <input
                                        {...register("confirmPassword")}
                                        type={showConfirmPassword ? "text" : "password"}
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-12"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="w-5 h-5" />
                                        ) : (
                                            <Eye className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                                {errors.confirmPassword && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.confirmPassword.message}
                                    </p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Resetting password...
                                    </>
                                ) : (
                                    "Reset Password"
                                )}
                            </button>
                        </Form>
                    )}
                </div>
            </div>
        </div>
    );
}
