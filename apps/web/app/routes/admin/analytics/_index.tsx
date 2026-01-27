import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin } from "~/utils/auth.server";
import { getAdminAnalytics, type AnalyticsRange, type AdminAnalyticsPayload } from "~/utils/adminAnalytics.server";
import { Button } from "~/components/ui/Button";
import { Download, Calendar, TrendingUp, BarChart3, AlertCircle, CheckCircle, AlertTriangle, Info, Users, DollarSign, Activity, Zap } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
    await requireAdmin(request);

    const url = new URL(request.url);
    const range = (url.searchParams.get("range") || "30d") as AnalyticsRange;

    const analytics = await getAdminAnalytics(request, range);

    return {
        range,
        analytics,
    };
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
    }).format(value);
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat("en-US").format(value);
}

function getTrendIcon(trend: "up" | "down" | "flat") {
    if (trend === "up") return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend === "down") return <TrendingUp className="w-4 h-4 text-red-600 rotate-180" />;
    return <Activity className="w-4 h-4 text-gray-600" />;
}

function getAlertIcon(severity: "info" | "warning" | "critical") {
    if (severity === "critical") return <AlertCircle className="w-5 h-5 text-red-600" />;
    if (severity === "warning") return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    return <Info className="w-5 h-5 text-blue-600" />;
}

function getAlertBg(severity: "info" | "warning" | "critical") {
    if (severity === "critical") return "bg-red-50 border-red-200";
    if (severity === "warning") return "bg-amber-50 border-amber-200";
    return "bg-blue-50 border-blue-200";
}

export default function AdminAnalytics() {
    const { range, analytics } = useLoaderData<typeof loader>();
    const { summary, trends, funnel, regions, topCategories, alerts, channels, userSegments } = analytics;

    return (
        <div className="space-y-8">
            {/* Header & Controls */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
                    <p className="mt-1 text-gray-600">Real-time insights into platform performance and user behavior</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm">
                        <Calendar className="w-4 h-4 mr-2" />
                        Custom Range
                    </Button>
                    <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Range Selector */}
            <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm font-medium text-gray-700">Period:</span>
                    <div className="flex gap-2">
                        {(['7d', '30d', '90d', '365d'] as const).map((r) => (
                            <Link
                                key={r}
                                to={`/admin/analytics?range=${r}`}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${range === r
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                            >
                                {r === '7d' ? '7 days' : r === '30d' ? '30 days' : r === '90d' ? '90 days' : '1 year'}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Critical Alerts */}
            {alerts.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-gray-900">Alerts & Actions</h2>
                    <div className="grid gap-3">
                        {alerts.map((alert) => (
                            <div key={alert.id} className={`rounded-lg border p-4 ${getAlertBg(alert.severity)}`}>
                                <div className="flex gap-3">
                                    <div className="flex-shrink-0 mt-0.5">{getAlertIcon(alert.severity)}</div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                                        <p className="text-sm text-gray-700 mt-1">{alert.description}</p>
                                        <p className="text-xs font-medium text-gray-600 mt-2">Impact: {alert.impact}</p>
                                        {alert.action && (
                                            <Link
                                                to={alert.action.to}
                                                className="inline-block mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                                            >
                                                {alert.action.label} →
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Performance Indicators</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {summary.kpis.map((kpi) => (
                        <div key={kpi.id} className="rounded-lg border bg-white p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">{kpi.label}</p>
                                    <p className="mt-2 text-2xl font-bold text-gray-900">
                                        {kpi.unit === "currency" ? formatCurrency(kpi.value) : formatNumber(kpi.value)}
                                    </p>
                                </div>
                                <div className="flex-shrink-0">{getTrendIcon(kpi.trend)}</div>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                <span className={`text-sm font-medium ${kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                    {kpi.change > 0 ? '+' : ''}{kpi.change.toFixed(1)}%
                                </span>
                                <span className="text-xs text-gray-600">vs previous period</span>
                            </div>
                            <p className="mt-3 text-xs text-gray-600">{kpi.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bookings & Revenue Summary */}
            <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-lg border bg-white p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        Bookings Overview
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center pb-3 border-b">
                            <span className="text-gray-700">Total Bookings</span>
                            <span className="font-semibold text-gray-900">{formatNumber(summary.bookings.total)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b">
                            <span className="text-gray-700">Confirmed</span>
                            <span className="font-semibold text-green-600">{formatNumber(summary.bookings.confirmed)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b">
                            <span className="text-gray-700">Cancelled</span>
                            <span className="font-semibold text-red-600">{formatNumber(summary.bookings.cancelled)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b">
                            <span className="text-gray-700">Disputes</span>
                            <span className="font-semibold text-amber-600">{formatNumber(summary.bookings.disputes)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-gray-700">Avg Duration</span>
                            <span className="font-semibold text-gray-900">{summary.bookings.avgDurationDays.toFixed(1)} days</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border bg-white p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        Revenue Metrics
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center pb-3 border-b">
                            <span className="text-gray-700">Gross Revenue</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(summary.revenue.gross)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b">
                            <span className="text-gray-700">Net Revenue</span>
                            <span className="font-semibold text-green-600">{formatCurrency(summary.revenue.net)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b">
                            <span className="text-gray-700">Take Rate</span>
                            <span className="font-semibold text-gray-900">{summary.revenue.takeRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-gray-700">Payout Volume</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(summary.revenue.payoutVolume)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Operations Health */}
            <div className="rounded-lg border bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-600" />
                    Operations Health
                </h3>
                <div className="grid gap-4 md:grid-cols-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Open Disputes</p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">{summary.operations.openDisputes}</p>
                        <p className="mt-1 text-xs text-gray-600">Awaiting resolution</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Moderation Backlog</p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">{summary.operations.moderationBacklog}</p>
                        <p className="mt-1 text-xs text-gray-600">Pending review</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Support SLA</p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">{summary.operations.supportSla.toFixed(1)}h</p>
                        <p className="mt-1 text-xs text-gray-600">Avg response time</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Fraud Signals</p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">{summary.operations.fraudSignals}</p>
                        <p className="mt-1 text-xs text-gray-600">Detected this period</p>
                    </div>
                </div>
            </div>

            {/* Top Categories */}
            <div className="rounded-lg border bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Categories</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Bookings</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Revenue</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Change</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Fulfillment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topCategories.map((cat) => (
                                <tr key={cat.category} className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-4 text-gray-900 font-medium">{cat.category}</td>
                                    <td className="text-right py-3 px-4 text-gray-700">{formatNumber(cat.bookings)}</td>
                                    <td className="text-right py-3 px-4 text-gray-700">{formatCurrency(cat.revenue)}</td>
                                    <td className={`text-right py-3 px-4 font-medium ${cat.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {cat.change > 0 ? '+' : ''}{cat.change.toFixed(1)}%
                                    </td>
                                    <td className="text-right py-3 px-4 text-gray-700">{cat.fulfillmentTime}h avg</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Regional Performance */}
            <div className="rounded-lg border bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Performance</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    {regions.map((region) => (
                        <div key={region.region} className="p-4 bg-gray-50 rounded-lg">
                            <p className="font-medium text-gray-900">{region.region}</p>
                            <p className="mt-2 text-2xl font-bold text-gray-900">{formatNumber(region.bookings)}</p>
                            <p className="text-xs text-gray-600 mt-1">bookings</p>
                            <div className="mt-3 flex items-center justify-between">
                                <span className={`text-sm font-medium ${region.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {region.change > 0 ? '+' : ''}{region.change.toFixed(1)}%
                                </span>
                                <span className="text-xs text-gray-600">{region.revenueShare}% revenue</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* User Segments */}
            <div className="rounded-lg border bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Segments</h3>
                <div className="space-y-3">
                    {userSegments.map((segment) => (
                        <div key={segment.segment} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <p className="font-medium text-gray-900">{segment.segment}</p>
                                <p className="text-sm text-gray-600 mt-1">{formatNumber(segment.count)} users</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-sm font-medium ${segment.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {segment.change > 0 ? '+' : ''}{segment.change.toFixed(1)}%
                                </p>
                                <p className="text-xs text-gray-600 mt-1">{segment.retention}% retention</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Acquisition Channels */}
            <div className="rounded-lg border bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Acquisition Channels</h3>
                <div className="space-y-3">
                    {channels.map((channel) => (
                        <div key={channel.channel} className="flex items-center gap-4">
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-gray-900">{channel.channel}</span>
                                    <span className={`text-sm font-medium ${channel.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {channel.change > 0 ? '+' : ''}{channel.change.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full"
                                        style={{ width: `${channel.contribution}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-600 mt-1">{channel.contribution}% of traffic</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
