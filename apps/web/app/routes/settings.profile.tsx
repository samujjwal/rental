import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useActionData } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    User,
    Mail,
    Phone,
    MapPin,
    Shield,
    Bell,
    CreditCard,
    Key,
    Save,
    Camera,
} from "lucide-react";
import { useAuthStore } from "~/lib/store/auth";
import { api } from "~/lib/api-client";

export const meta: MetaFunction = () => {
    return [
        { title: "Profile Settings - Universal Rental Portal" },
        { name: "description", content: "Manage your account settings" },
    ];
};

const profileSchema = z.object({
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().optional(),
    email: z.string().email("Invalid email address"),
    phone: z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number")
        .optional()
        .or(z.literal("")),
});

export async function loader() {
    try {
        const user = await api.get("/users/me");
        return { user };
    } catch (error) {
        throw new Response("Unauthorized", { status: 401 });
    }
}

export async function action({ request }: any) {
    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    try {
        const user = await api.patch("/users/me", data);
        return { success: true, user };
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data?.message || "Failed to update profile",
        };
    }
}

export default function ProfileSettings() {
    const { user: loaderUser } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const { user, updateUser } = useAuthStore();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            firstName: loaderUser.firstName || "",
            lastName: loaderUser.lastName || "",
            email: loaderUser.email || "",
            phone: loaderUser.phone || "",
        },
    });

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Sidebar Navigation */}
                    <aside className="md:col-span-1">
                        <nav className="bg-white rounded-lg shadow-sm border p-2 space-y-1">
                            <button className="w-full flex items-center gap-3 px-4 py-3 bg-primary-50 text-primary-700 rounded-lg font-medium">
                                <User className="w-5 h-5" />
                                Profile
                            </button>
                            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                                <Shield className="w-5 h-5" />
                                Security
                            </button>
                            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                                <Bell className="w-5 h-5" />
                                Notifications
                            </button>
                            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                                <CreditCard className="w-5 h-5" />
                                Payments
                            </button>
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <div className="md:col-span-3 space-y-6">
                        {/* Success Message */}
                        {actionData?.success && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm text-green-600">
                                    Profile updated successfully!
                                </p>
                            </div>
                        )}

                        {/* Error Message */}
                        {actionData?.error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">{actionData.error}</p>
                            </div>
                        )}

                        {/* Profile Photo */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Profile Photo
                            </h2>
                            <div className="flex items-center gap-6">
                                <div className="relative">
                                    <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                                        {loaderUser.avatar ? (
                                            <img
                                                src={loaderUser.avatar}
                                                alt={loaderUser.firstName}
                                                className="w-full h-full rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-3xl font-bold text-gray-600">
                                                {loaderUser.firstName[0]}
                                            </span>
                                        )}
                                    </div>
                                    <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700">
                                        <Camera className="w-4 h-4" />
                                    </button>
                                </div>
                                <div>
                                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
                                        Change Photo
                                    </button>
                                    <p className="text-sm text-gray-600 mt-2">
                                        JPG, PNG or GIF. Max size 5MB
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Personal Information */}
                        <Form method="post" className="bg-white rounded-lg shadow-sm border p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Personal Information
                            </h2>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            First Name
                                        </label>
                                        <input
                                            {...register("firstName")}
                                            name="firstName"
                                            type="text"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                        />
                                        {errors.firstName && (
                                            <p className="mt-1 text-sm text-red-600">
                                                {errors.firstName.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Last Name
                                        </label>
                                        <input
                                            {...register("lastName")}
                                            name="lastName"
                                            type="text"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            {...register("email")}
                                            name="email"
                                            type="email"
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.email.message}
                                        </p>
                                    )}
                                    {loaderUser.verified && (
                                        <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                                            <Shield className="w-4 h-4" />
                                            Verified
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Phone Number
                                    </label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            {...register("phone")}
                                            name="phone"
                                            type="tel"
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>
                                    {errors.phone && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.phone.message}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center justify-end pt-4 border-t">
                                    <button
                                        type="submit"
                                        className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                                    >
                                        <Save className="w-5 h-5" />
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </Form>

                        {/* Account Stats */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Account Statistics
                            </h2>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-gray-900">
                                        {loaderUser.totalBookings || 0}
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">Bookings</div>
                                </div>
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-gray-900">
                                        {loaderUser.totalListings || 0}
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">Listings</div>
                                </div>
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-gray-900">
                                        {loaderUser.rating ? loaderUser.rating.toFixed(1) : "N/A"}
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">Rating</div>
                                </div>
                            </div>
                        </div>

                        {/* Change Password */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Change Password
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Current Password
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        New Password
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Confirm New Password
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div className="flex items-center justify-end pt-4 border-t">
                                    <button className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium">
                                        <Key className="w-5 h-5" />
                                        Update Password
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
                            <h2 className="text-lg font-semibold text-red-600 mb-4">
                                Danger Zone
                            </h2>
                            <p className="text-sm text-gray-600 mb-4">
                                Once you delete your account, there is no going back. Please be
                                certain.
                            </p>
                            <button className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
