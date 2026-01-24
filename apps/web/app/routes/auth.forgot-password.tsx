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

export const meta: MetaFunction = () => {
    return [
        { title: "Forgot Password - Universal Rental Portal" },
        { name: "description", content: "Reset your password" },
    ];
};

export async function action({ request }: ActionFunctionArgs) {
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
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotPasswordInput>({
        resolver: zodResolver(forgotPasswordSchema),
    });

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
                    <p className="text-gray-600 mt-2">
                        Enter your email to reset your password
                    </p>
                </div>

                {/* Forgot Password Form */}
                <div className="bg-white rounded-lg shadow-lg p-8">
                    {actionData?.success ? (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Mail className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                Check your email
                            </h2>
                            <p className="text-gray-600 mb-6">
                                We've sent a password reset link to your email address. Please
                                check your inbox and follow the instructions.
                            </p>
                            <Link
                                to="/auth/login"
                                className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to login
                            </Link>
                        </div>
                    ) : (
                        <Form method="post" onSubmit={handleSubmit(() => { })}>
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
                                    {...register("email")}
                                    type="email"
                                    id="email"
                                    name="email"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="you@example.com"
                                />
                                {errors.email && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.email.message}
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
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="w-5 h-5" />
                                        Send Reset Link
                                    </>
                                )}
                            </button>

                            {/* Back to Login */}
                            <div className="mt-6 text-center">
                                <Link
                                    to="/auth/login"
                                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
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
