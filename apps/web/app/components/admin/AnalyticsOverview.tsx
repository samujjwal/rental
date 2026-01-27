import { TrendingUp, TrendingDown, Users, DollarSign, Calendar, Home, Star, Activity } from "lucide-react";

interface AnalyticsOverviewProps {
    data: {
        totalUsers?: number;
        activeUsers?: number;
        totalListings?: number;
        activeListings?: number;
        totalBookings?: number;
        completedBookings?: number;
        totalRevenue?: number;
        averageRating?: number;
        userGrowthRate?: number;
        listingGrowthRate?: number;
        bookingGrowthRate?: number;
        revenueGrowthRate?: number;
    };
    period: string;
}

export function AnalyticsOverview({ data, period }: AnalyticsOverviewProps) {
    const formatGrowth = (rate: number) => {
        const isPositive = rate >= 0;
        return (
            <div className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                <span>{isPositive ? '+' : ''}{rate.toFixed(1)}%</span>
            </div>
        );
    };

    const metrics = [
        {
            title: "Total Users",
            value: data.totalUsers || 0,
            growth: data.userGrowthRate || 0,
            icon: Users,
            color: "blue",
            description: "Registered users"
        },
        {
            title: "Active Listings",
            value: data.activeListings || 0,
            growth: data.listingGrowthRate || 0,
            icon: Home,
            color: "green",
            description: "Published properties"
        },
        {
            title: "Total Bookings",
            value: data.totalBookings || 0,
            growth: data.bookingGrowthRate || 0,
            icon: Calendar,
            color: "purple",
            description: "All time bookings"
        },
        {
            title: "Total Revenue",
            value: `$${(data.totalRevenue || 0).toLocaleString()}`,
            growth: data.revenueGrowthRate || 0,
            icon: DollarSign,
            color: "yellow",
            description: "Gross revenue"
        },
        {
            title: "Active Users",
            value: data.activeUsers || 0,
            growth: 0, // Would need separate calculation
            icon: Activity,
            color: "indigo",
            description: "Users this period"
        },
        {
            title: "Completed Bookings",
            value: data.completedBookings || 0,
            growth: 0, // Would need separate calculation
            icon: Star,
            color: "pink",
            description: "Successful rentals"
        }
    ];

    const getColorClasses = (color: string) => {
        const colors = {
            blue: "bg-blue-50 text-blue-600",
            green: "bg-green-50 text-green-600",
            purple: "bg-purple-50 text-purple-600",
            yellow: "bg-yellow-50 text-yellow-600",
            indigo: "bg-indigo-50 text-indigo-600",
            pink: "bg-pink-50 text-pink-600"
        };
        return colors[color as keyof typeof colors] || "bg-gray-50 text-gray-600";
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-medium text-gray-900">Overview</h2>
                <p className="text-sm text-gray-600">Key performance indicators for the selected period</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {metrics.map((metric, index) => {
                    const Icon = metric.icon;
                    const colorClasses = getColorClasses(metric.color);

                    return (
                        <div key={index} className="bg-white rounded-lg border p-6">
                            <div className="flex items-center justify-between">
                                <div className={`p-3 rounded-lg ${colorClasses}`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                {metric.growth !== 0 && formatGrowth(metric.growth)}
                            </div>

                            <div className="mt-4">
                                <h3 className="text-2xl font-bold text-gray-900">{metric.value}</h3>
                                <p className="text-sm font-medium text-gray-900 mt-1">{metric.title}</p>
                                <p className="text-sm text-gray-500 mt-1">{metric.description}</p>
                            </div>

                            {/* Mini Chart Placeholder */}
                            <div className="mt-4 h-16 bg-gray-50 rounded-lg flex items-center justify-center">
                                <div className="text-xs text-gray-400">Chart data for {metric.title.toLowerCase()}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
