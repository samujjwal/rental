import { DollarSign, TrendingUp, Calendar, Home, Users, CreditCard, Target, PieChart } from "lucide-react";

interface BusinessAnalyticsProps {
    data: {
        totalRevenue?: number;
        revenueGrowthRate?: number;
        averageBookingValue?: number;
        totalBookings?: number;
        bookingConversionRate?: number;
        revenueByCategory?: Array<{
            category: string;
            revenue: number;
            percentage: number;
            bookings: number;
        }>;
        revenueByMonth?: Array<{
            month: string;
            revenue: number;
            bookings: number;
        }>;
        topPerformingListings?: Array<{
            title: string;
            revenue: number;
            bookings: number;
            occupancyRate: number;
        }>;
        paymentMethods?: Array<{
            method: string;
            revenue: number;
            percentage: number;
            transactions: number;
        }>;
    };
    period: string;
}

export function BusinessAnalytics({ data, period }: BusinessAnalyticsProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-medium text-gray-900">Business Analytics</h2>
                <p className="text-sm text-gray-600">Revenue, bookings, and business performance metrics</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Metrics */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Revenue Overview</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <DollarSign className="w-5 h-5 text-green-500 mr-2" />
                                <span className="text-sm text-gray-600">Total Revenue</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">
                                ${(data.totalRevenue || 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <TrendingUp className="w-5 h-5 text-blue-500 mr-2" />
                                <span className="text-sm text-gray-600">Growth Rate</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">
                                {(data.revenueGrowthRate || 0).toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Target className="w-5 h-5 text-purple-500 mr-2" />
                                <span className="text-sm text-gray-600">Avg. Booking Value</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">
                                ${(data.averageBookingValue || 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Users className="w-5 h-5 text-orange-500 mr-2" />
                                <span className="text-sm text-gray-600">Conversion Rate</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">
                                {(data.bookingConversionRate || 0).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Revenue by Category */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Revenue by Category</h3>
                    <div className="space-y-3">
                        {(data.revenueByCategory || []).map((category, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-gray-900">{category.category}</div>
                                    <div className="text-xs text-gray-500">{category.bookings} bookings</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium text-gray-900">
                                        ${category.revenue.toLocaleString()}
                                    </div>
                                    <div className="flex items-center justify-end mt-1">
                                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                            <div
                                                className="bg-green-500 h-2 rounded-full"
                                                style={{ width: `${category.percentage}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs text-gray-500 w-10">{category.percentage.toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Revenue Chart */}
                <div className="bg-white rounded-lg border p-6 lg:col-span-2">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Revenue Trend</h3>
                    <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                            <DollarSign className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Revenue trend visualization</p>
                            <p className="text-xs text-gray-400 mt-1">Monthly revenue and bookings for {period}</p>
                        </div>
                    </div>
                </div>

                {/* Top Performing Listings */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Top Performing Listings</h3>
                    <div className="space-y-3">
                        {(data.topPerformingListings || []).slice(0, 5).map((listing, index) => (
                            <div key={index} className="border-b border-gray-100 pb-3 last:border-0">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center">
                                        <Home className="w-4 h-4 text-gray-400 mr-2" />
                                        <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                            {listing.title}
                                        </span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900">
                                        ${listing.revenue.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>{listing.bookings} bookings</span>
                                    <span>{listing.occupancyRate.toFixed(1)}% occupancy</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payment Methods */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Payment Methods</h3>
                    <div className="space-y-3">
                        {(data.paymentMethods || []).map((method, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <CreditCard className="w-4 h-4 text-gray-400 mr-2" />
                                    <span className="text-sm text-gray-900">{method.method}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium text-gray-900">
                                        ${method.revenue.toLocaleString()}
                                    </div>
                                    <div className="flex items-center justify-end mt-1">
                                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                            <div
                                                className="bg-blue-500 h-2 rounded-full"
                                                style={{ width: `${method.percentage}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs text-gray-500 w-10">{method.percentage.toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Business Health Metrics */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Business Health</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Monthly Recurring Revenue</span>
                            <span className="text-lg font-bold text-green-600">
                                ${Math.round((data.totalRevenue || 0) / 12).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Customer Lifetime Value</span>
                            <span className="text-lg font-bold text-blue-600">
                                ${Math.round((data.averageBookingValue || 0) * 3.5).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Average Order Frequency</span>
                            <span className="text-lg font-bold text-purple-600">
                                2.3 per month
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Revenue Per User</span>
                            <span className="text-lg font-bold text-orange-600">
                                ${Math.round((data.totalRevenue || 0) / (data.totalBookings || 1)).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
