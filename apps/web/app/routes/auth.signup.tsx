import type { MetaFunction, ActionFunctionArgs } from "react-router";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useState } from "react";
import { authApi } from "~/lib/api/auth";
import { createUserSession } from "~/utils/auth.server";
import { signupSchema, type SignupInput } from "~/lib/validation/auth";
import {
    Box,
    Button,
    TextField,
    FormControl,
    InputLabel,
    InputAdornment,
    Typography,
    Paper,
    Alert,
} from '@mui/material';
import { cn } from "~/lib/utils";

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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background px-4 py-8">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-block">
                        <h1 className="text-3xl font-bold text-primary">
                            Rental Portal
                        </h1>
                    </Link>
                    <p className="text-muted-foreground mt-2">Create your account to get started</p>
                </div>

                {/* Signup Form */}
                <div className="bg-card border rounded-lg shadow-lg p-8">
                    <Form method="post" onSubmit={handleSubmit(() => { })}>
                        {/* Error Message */}
                        {actionData?.error && (
                            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                                <p className="text-sm text-destructive">{actionData.error}</p>
                            </div>
                        )}

                        {/* Role Selection */}
                        <div className="space-y-2 mb-6">
                            <label className="text-sm font-medium leading-none">
                                I want to
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="relative flex items-center justify-center p-4 border-2 border-input rounded-lg cursor-pointer hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                    <input
                                        {...register("role")}
                                        type="radio"
                                        value="renter"
                                        className="sr-only"
                                    />
                                    <span className="text-sm font-medium">Rent items</span>
                                </label>
                                <label className="relative flex items-center justify-center p-4 border-2 border-input rounded-lg cursor-pointer hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary/5">
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
                                <p className="text-sm text-destructive">{errors.role.message}</p>
                            )}
                        </div>

                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                                <label
                                    htmlFor="firstName"
                                    className="text-sm font-medium leading-none"
                                >
                                    First Name *
                                </label>
                                <input
                                    {...register("firstName")}
                                    type="text"
                                    id="firstName"
                                    name="firstName"
                                    className={inputClasses}
                                    placeholder="John"
                                />
                                {errors.firstName && (
                                    <p className="text-sm text-destructive">
                                        {errors.firstName.message}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label
                                    htmlFor="lastName"
                                    className="text-sm font-medium leading-none"
                                >
                                    Last Name
                                </label>
                                <input
                                    {...register("lastName")}
                                    type="text"
                                    id="lastName"
                                    name="lastName"
                                    className={inputClasses}
                                    placeholder="Doe"
                                />
                                {errors.lastName && (
                                    <p className="text-sm text-destructive">
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
                                Email Address *
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
                                <p className="text-sm text-destructive">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Phone Field */}
                        <div className="space-y-2 mb-6">
                            <label
                                htmlFor="phone"
                                className="text-sm font-medium leading-none"
                            >
                                Phone Number
                            </label>
                            <input
                                {...register("phone")}
                                type="tel"
                                id="phone"
                                name="phone"
                                className={inputClasses}
                                placeholder="+1234567890"
                            />
                            {errors.phone && (
                                <p className="text-sm text-destructive">{errors.phone.message}</p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2 mb-6">
                            <label
                                htmlFor="password"
                                className="text-sm font-medium leading-none"
                            >
                                Password *
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
                                                passwordStrength.color === "bg-destructive" && "text-destructive",
                                                passwordStrength.color === "bg-warning" && "text-warning",
                                                passwordStrength.color === "bg-primary" && "text-primary",
                                                passwordStrength.color === "bg-success" && "text-success"
                                            )}
                                        >
                                            {passwordStrength.label}
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full transition-all duration-300", passwordStrength.color)}
                                            style={{ width: `${(passwordStrength.strength / 4) * 100}%` }}
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
                                Confirm Password *
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
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                                    Creating account...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Create Account
                                </>
                            )}
                        </Button>
                    </Form>

                    {/* Sign In Link */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link
                                to="/auth/login"
                                className="text-primary hover:text-primary/90 font-medium underline-offset-4 hover:underline"
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
