import type { MetaFunction } from "react-router";
import { Link, redirect } from "react-router";
import { useAuthStore } from "~/lib/store/auth";
import {
    Home,
    Search,
    Calendar,
    MessageSquare,
    Settings,
    LogOut,
    Package,
    DollarSign,
} from "lucide-react";

export const meta: MetaFunction = () => {
    return [
        { title: "Dashboard - Universal Rental Portal" },
        { name: "description", content: "Manage your rentals and bookings" },
    ];
};

export async function loader() {
    // Check if user is authenticated (this will be handled by middleware later)
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            return redirect("/auth/login");
        }
    }
    return {};
}

export default function Dashboard() {
    const { user, clearAuth } = useAuthStore();

    const handleLogout = () => {
        clearAuth();
        window.location.href = "/auth/login";
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Bar */}
            <nav className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <Link to="/" className="text-xl font-bold text-primary-600">
                                Rental Portal
                            </Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-700">
                                {user?.firstName} {user?.lastName}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Welcome back, {user?.firstName}!
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Here's what's happening with your rentals today.
                    </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Active Bookings</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {user?.totalBookings || 0}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                                <Calendar className="w-6 h-6 text-primary-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">My Listings</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {user?.totalListings || 0}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Messages</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <MessageSquare className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Rating</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {user?.rating ? user.rating.toFixed(1) : "N/A"}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-yellow-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Quick Actions
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Link
                            to="/search"
                            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
                        >
                            <Search className="w-6 h-6 text-primary-600" />
                            <div>
                                <p className="font-medium text-gray-900">Browse Items</p>
                                <p className="text-sm text-gray-600">Find rentals near you</p>
                            </div>
                        </Link>

                        <Link
                            to="/listings/new"
                            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
                        >
                            <Package className="w-6 h-6 text-primary-600" />
                            <div>
                                <p className="font-medium text-gray-900">List an Item</p>
                                <p className="text-sm text-gray-600">Start earning money</p>
                            </div>
                        </Link>

                        <Link
                            to="/messages"
                            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
                        >
                            <MessageSquare className="w-6 h-6 text-primary-600" />
                            <div>
                                <p className="font-medium text-gray-900">Messages</p>
                                <p className="text-sm text-gray-600">Chat with users</p>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Recent Activity Placeholder */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Recent Activity
                    </h2>
                    <div className="text-center py-12">
                        <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600">No recent activity to display</p>
                        <p className="text-sm text-gray-500 mt-1">
                            Start browsing or list an item to get started
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
