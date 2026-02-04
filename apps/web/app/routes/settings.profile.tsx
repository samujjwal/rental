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
import { cn } from "~/lib/utils";
import { UnifiedButton } from "~/components/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui";

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

export async function clientLoader() {
  try {
    const user = await api.get("/users/me");
    return { user };
  } catch (error) {
    throw new Response("Unauthorized", { status: 401 });
  }
}

export async function clientAction({ request }: any) {
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

interface User {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  avatar?: string;
  verified?: boolean;
  totalBookings?: number;
  totalListings?: number;
  rating?: number;
}

export default function ProfileSettings() {
  const { user: loaderUser } = useLoaderData<{ user: User }>();
  const actionData = useActionData<typeof clientAction>();
  const { user, updateUser } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: loaderUser?.firstName || "",
      lastName: loaderUser?.lastName || "",
      email: loaderUser?.email || "",
      phone: loaderUser?.phone || "",
    },
  });

  if (!loaderUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">
            Profile Settings
          </h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <aside className="md:col-span-1">
            <nav className="bg-card rounded-lg border p-2 space-y-1">
              <button className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-lg font-medium">
                <User className="w-5 h-5" />
                Profile
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors">
                <Shield className="w-5 h-5" />
                Security
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                Notifications
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors">
                <CreditCard className="w-5 h-5" />
                Payments
              </button>
            </nav>
          </aside>

          {/* Main Content */}
          <div className="md:col-span-3 space-y-6">
            {/* Success Message */}
            {actionData?.success && (
              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                <p className="text-sm text-success">
                  Profile updated successfully!
                </p>
              </div>
            )}

            {/* Error Message */}
            {actionData?.error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{actionData.error}</p>
              </div>
            )}

            {/* Profile Photo */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Photo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center">
                      {loaderUser.avatar ? (
                        <img
                          src={loaderUser.avatar}
                          alt={loaderUser.firstName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl font-bold text-muted-foreground">
                          {loaderUser.firstName[0]}
                        </span>
                      )}
                    </div>
                    <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <UnifiedButton variant="outline">Change Photo</UnifiedButton>
                    <p className="text-sm text-muted-foreground mt-2">
                      JPG, PNG or GIF. Max size 5MB
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Form method="post">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          First Name
                        </label>
                        <input
                          {...register("firstName")}
                          name="firstName"
                          type="text"
                          className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                        {errors.firstName && (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.firstName.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Last Name
                        </label>
                        <input
                          {...register("lastName")}
                          name="lastName"
                          type="text"
                          className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                          {...register("email")}
                          name="email"
                          type="email"
                          className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.email.message}
                        </p>
                      )}
                      {loaderUser.verified && (
                        <p className="mt-1 text-sm text-success flex items-center gap-1">
                          <Shield className="w-4 h-4" />
                          Verified
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                          {...register("phone")}
                          name="phone"
                          type="tel"
                          className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>
                      {errors.phone && (
                        <p className="mt-1 text-sm text-destructive">
                          {errors.phone.message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end pt-4 border-t border-border">
                      <UnifiedButton type="submit" className="flex items-center gap-2">
                        <Save className="w-5 h-5" />
                        Save Changes
                      </UnifiedButton>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Form>

            {/* Account Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Account Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {loaderUser.totalBookings || 0}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Bookings
                    </div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {loaderUser.totalListings || 0}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Listings
                    </div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {loaderUser.rating ? loaderUser.rating.toFixed(1) : "N/A"}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Rating
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                    />
                  </div>
                  <div className="flex items-center justify-end pt-4 border-t border-border">
                    <UnifiedButton
                      variant="primary"
                      leftIcon={<Key className="w-5 h-5" />}
                    >
                      Update Password
                    </UnifiedButton>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Once you delete your account, there is no going back. Please
                  be certain.
                </p>
                <UnifiedButton variant="destructive">Delete Account</UnifiedButton>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
