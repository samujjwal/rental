import type { MetaFunction, ActionFunctionArgs } from "react-router";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import { authApi } from "~/lib/api/auth";
import { createUserSession } from "~/utils/auth.server";
import { signupSchema, type SignupInput } from "~/lib/validation/auth";
import { useAuthStore } from "~/lib/store/auth";

export const meta: MetaFunction = () => {
    return [
        { title: "Sign Up - Universal Rental Portal" },
        { name: "description", content: "Create a new account" },
    ];
};

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const phone = formData.get("phone") as string;
    const role = formData.get("role") as "renter" | "owner";

    try {
        const response = await authApi.signup({
            email,
            password,
            firstName,
            lastName: lastName || undefined,
            phone: phone || undefined,
            role,
        });

        return createUserSession({
            userId: response.user.id,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            remember: false,
            redirectTo: "/dashboard",
        });
    } catch (error: any) {
        return {
            error:
                error.response?.data?.message ||
                "Registration failed. Please try again.",
        };
    }
}

export default function Signup() {
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
    } = useForm<SignupInput>({
        resolver: zodResolver(signupSchema),
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

        if (strength <= 1)
            return { strength, label: "Weak", color: "red" };
        if (strength === 2)
            return { strength, label: "Fair", color: "yellow" };
        if (strength === 3)
            return { strength, label: "Good", color: "blue" };
        return { strength, label: "Strong", color: "green" };
    };

    const passwordStrength = getPasswordStrength(password);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white px-4 py-8">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-block">
                        <h1 className="text-3xl font-bold text-blue-600">
                            Rental Portal
                        </h1>
                    </Link>
                    <p className="text-gray-600 mt-2">Create your account to get started</p>
                </div>

                {/* Signup Form */}
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <Form method="post" onSubmit={handleSubmit(() => { })}>
                        {/* Error Message */}
                        {actionData?.error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">{actionData.error}</p>
                            </div>
                        )}

                        {/* Role Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                I want to
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="relative flex items-center justify-center p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                                    <input
                                        {...register("role")}
                                        type="radio"
                                        value="renter"
                                        className="sr-only"
                                    />
                                    <span className="text-sm font-medium">Rent items</span>
                                </label>
                                <label className="relative flex items-center justify-center p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                                    <input
                                        {...register("role")}
                                        type="radio"
                                        value="owner"
                                        className="sr-only"
                                    />
                                    <span className="text-sm font-medium">List items</span>
                                </label>
                            </div>
                            {errors.role && (
                                <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                            )}
                        </div>

                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label
                                    htmlFor="firstName"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    First Name *
                                </label>
                                <input
                                    {...register("firstName")}
                                    type="text"
                                    id="firstName"
                                    name="firstName"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="John"
                                />
                                {errors.firstName && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.firstName.message}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label
                                    htmlFor="lastName"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Last Name
                                </label>
                                <input
                                    {...register("lastName")}
                                    type="text"
                                    id="lastName"
                                    name="lastName"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Doe"
                                />
                                {errors.lastName && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.lastName.message}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Email Field */}
                        <div className="mb-6">
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Email Address *
                            </label>
                            <input
                                {...register("email")}
                                type="email"
                                id="email"
                                name="email"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="you@example.com"
                            />
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Phone Field */}
                        <div className="mb-6">
                            <label
                                htmlFor="phone"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Phone Number
                            </label>
                            <input
                                {...register("phone")}
                                type="tel"
                                id="phone"
                                name="phone"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="+1234567890"
                            />
                            {errors.phone && (
                                <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div className="mb-6">
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Password *
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
                                            style={{ width: `${(passwordStrength.strength / 4) * 100}%` }}
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
                                Confirm Password *
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
                            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-5 h-5" />
                                    Create Account
                                </>
                            )}
                        </button>
                    </Form>

                    {/* Sign In Link */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600">
                            Already have an account?{" "}
                            <Link
                                to="/auth/login"
                                className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
