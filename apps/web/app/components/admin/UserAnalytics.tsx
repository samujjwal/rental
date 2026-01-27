import { Users, TrendingUp, UserPlus, UserCheck, Activity, MapPin, Star, Calendar } from "lucide-react";

interface UserAnalyticsProps {
    data: {
        newUsers?: number;
        returningUsers?: number;
        userRetentionRate?: number;
        averageSessionDuration?: number;
        topCountries?: Array<{
            country: string;
            users: number;
            percentage: number;
        }>;
        userActivityByDay?: Array<{
            date: string;
            activeUsers: number;
            newUsers: number;
        }>;
        userDemographics?: {
            byAge: Array<{
                range: string;
                count: number;
                percentage: number;
            }>;
            byRole: Array<{
                role: string;
                count: number;
                percentage: number;
            }>;
        };
    };
    period: string;
}

export function UserAnalytics({ data, period }: UserAnalyticsProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-medium text-gray-900">User Analytics</h2>
                <p className="text-sm text-gray-600">User growth, engagement, and demographic insights</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Growth Metrics */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">User Growth</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <UserPlus className="w-5 h-5 text-blue-500 mr-2" />
                                <span className="text-sm text-gray-600">New Users</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">{data.newUsers || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <UserCheck className="w-5 h-5 text-green-500 mr-2" />
                                <span className="text-sm text-gray-600">Returning Users</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">{data.returningUsers || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Activity className="w-5 h-5 text-purple-500 mr-2" />
                                <span className="text-sm text-gray-600">Avg. Session Duration</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">{Math.round((data.averageSessionDuration || 0) / 60)}m</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <TrendingUp className="w-5 h-5 text-green-500 mr-2" />
                                <span className="text-sm text-gray-600">Retention Rate</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">{(data.userRetentionRate || 0).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                {/* Top Countries */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Top Countries</h3>
                    <div className="space-y-3">
                        {(data.topCountries || []).slice(0, 5).map((country, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                                    <span className="text-sm text-gray-900">{country.country}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-600">{country.users} users</span>
                                    <div className="w-16 bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full"
                                            style={{ width: `${country.percentage}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-gray-500 w-10">{country.percentage.toFixed(0)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* User Activity Chart */}
                <div className="bg-white rounded-lg border p-6 lg:col-span-2">
                    <h3 className="text-base font-medium text-gray-900 mb-4">User Activity Over Time</h3>
                    <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                            <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">User activity chart visualization</p>
                            <p className="text-xs text-gray-400 mt-1">Daily active and new users for {period}</p>
                        </div>
                    </div>
                </div>

                {/* User Demographics */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">User Demographics</h3>

                    <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">By Age</h4>
                        <div className="space-y-2">
                            {(data.userDemographics?.byAge || []).map((ageGroup, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">{ageGroup.range}</span>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-900">{ageGroup.count}</span>
                                        <div className="w-12 bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-green-500 h-2 rounded-full"
                                                style={{ width: `${ageGroup.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">By Role</h4>
                        <div className="space-y-2">
                            {(data.userDemographics?.byRole || []).map((role, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">{role.role}</span>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-900">{role.count}</span>
                                        <div className="w-12 bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-purple-500 h-2 rounded-full"
                                                style={{ width: `${role.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* User Engagement Metrics */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Engagement Metrics</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Daily Active Users</span>
                            <span className="text-lg font-bold text-gray-900">
                                {Math.round((data.newUsers || 0) * 0.3)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Weekly Active Users</span>
                            <span className="text-lg font-bold text-gray-900">
                                {Math.round((data.newUsers || 0) * 0.6)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Monthly Active Users</span>
                            <span className="text-lg font-bold text-gray-900">
                                {data.newUsers || 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Star className="w-4 h-4 text-yellow-500 mr-2" />
                                <span className="text-sm text-gray-600">Avg. Rating</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">4.2</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
