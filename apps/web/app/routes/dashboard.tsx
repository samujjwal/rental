import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { Link, redirect } from "react-router";
import { useAuthStore } from "~/lib/store/auth";
import { getUser } from "~/utils/auth.server";
import {
    Home,
    Search,
    Calendar,
    MessageSquare,
    LogOut,
    Package,
    DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui";
import { PageContainer } from "~/components/layout";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => {
    return [
        { title: "Dashboard - Universal Rental Portal" },
        { name: "description", content: "Manage your rentals and bookings" },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    console.log("Dashboard loader: starting");
    const user = await getUser(request);
    console.log("Dashboard loader: user result:", user ? user.email : "null");

    if (!user) {
        console.log("Dashboard loader: no user, redirecting to login");
        return redirect("/auth/login");
    }

    // Redirect admin users to admin dashboard
    if (user.role === "ADMIN") {
        console.log("Dashboard loader: admin user detected, redirecting to /admin");
        return redirect("/admin");
    }

    // Redirect owners and renters to their specific dashboards
    if (user.role === "OWNER") {
        console.log("Dashboard loader: owner user, redirecting to /dashboard/owner");
        return redirect("/dashboard/owner");
    }

    if (user.role === "RENTER") {
        console.log("Dashboard loader: renter user, redirecting to /dashboard/renter");
        return redirect("/dashboard/renter");
    }

    console.log("Dashboard loader: returning user data for:", user.email);
    return { user };
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    iconBg: string;
}

function StatCard({ title, value, icon, iconBg }: StatCardProps) {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                    </div>
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", iconBg)}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function Dashboard() {
    const { user, clearAuth } = useAuthStore();

    const handleLogout = () => {
        clearAuth();
        window.location.href = "/auth/login";
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Navigation Bar */}
            <nav className="bg-card border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <Link to="/" className="text-xl font-bold text-primary">
                                Rental Portal
                            </Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                                {user?.firstName} {user?.lastName}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <PageContainer>
                {/* Welcome Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground">
                        Welcome back, {user?.firstName}!
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Here's what's happening with your rentals today.
                    </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="Active Bookings"
                        value={user?.totalBookings || 0}
                        icon={<Calendar className="w-6 h-6 text-primary" />}
                        iconBg="bg-primary/10"
                    />
                    <StatCard
                        title="My Listings"
                        value={user?.totalListings || 0}
                        icon={<Package className="w-6 h-6 text-success" />}
                        iconBg="bg-success/10"
                    />
                    <StatCard
                        title="Messages"
                        value={0}
                        icon={<MessageSquare className="w-6 h-6 text-info" />}
                        iconBg="bg-info/10"
                    />
                    <StatCard
                        title="Rating"
                        value={user?.rating ? user.rating.toFixed(1) : "N/A"}
                        icon={<DollarSign className="w-6 h-6 text-warning" />}
                        iconBg="bg-warning/10"
                    />
                </div>

                {/* Quick Actions */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Link
                                to="/search"
                                className="flex items-center gap-3 p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                            >
                                <Search className="w-6 h-6 text-primary" />
                                <div>
                                    <p className="font-medium text-foreground">Browse Items</p>
                                    <p className="text-sm text-muted-foreground">Find rentals near you</p>
                                </div>
                            </Link>

                            <Link
                                to="/listings/new"
                                className="flex items-center gap-3 p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                            >
                                <Package className="w-6 h-6 text-primary" />
                                <div>
                                    <p className="font-medium text-foreground">List an Item</p>
                                    <p className="text-sm text-muted-foreground">Start earning money</p>
                                </div>
                            </Link>

                            <Link
                                to="/messages"
                                className="flex items-center gap-3 p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                            >
                                <MessageSquare className="w-6 h-6 text-primary" />
                                <div>
                                    <p className="font-medium text-foreground">Messages</p>
                                    <p className="text-sm text-muted-foreground">Chat with users</p>
                                </div>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity Placeholder */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-12">
                            <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No recent activity to display</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Start browsing or list an item to get started
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </PageContainer>
        </div>
    );
}
