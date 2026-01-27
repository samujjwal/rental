import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin } from "~/utils/auth.server";
import { getAdminAnalytics } from "~/utils/adminAnalytics.server";
import { ArrowRight, Users, Home, Calendar, DollarSign, ShieldCheck, TrendingUp, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
    const user = await requireAdmin(request);
    const analytics = await getAdminAnalytics(request, "30d");
    return { user, analytics };
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

export default function AdminDashboard() {
    const { user, analytics } = useLoaderData<typeof loader>();
    const { summary, alerts } = analytics;

    const quickLinks = [
        { href: "/admin/users", label: "User Directory", description: "Review accounts & roles" },
        { href: "/admin/listings", label: "Listings", description: "Moderate submissions" },
        { href: "/admin/bookings", label: "Bookings", description: "Resolve issues fast" },
        { href: "/admin/payments", label: "Payments", description: "Audit payouts & refunds" },
    ];

    const criticalAlerts = alerts.filter(a => a.severity === "critical");
    const warningAlerts = alerts.filter(a => a.severity === "warning");

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <section className="rounded-2xl border bg-gradient-to-r from-blue-50 to-indigo-50 p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Admin Control Center</p>
                        <h1 className="mt-2 text-3xl font-bold text-gray-900">Welcome back, {user.firstName ?? user.email}</h1>
                        <p className="mt-2 text-gray-600">
                            Keep the marketplace healthy by monitoring activity, triaging issues, and guiding partners.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            to="/admin/system"
                            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                            System health
                        </Link>
                        <Link
                            to="/admin/analytics"
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                            Full Analytics
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Critical Alerts */}
            {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
                <section className="space-y-3">
                    <h2 className="text-lg font-semibold text-gray-900">Active Alerts</h2>
                    <div className="grid gap-3">
                        {criticalAlerts.map((alert) => (
                            <div key={alert.id} className="rounded-lg border border-red-200 bg-red-50 p-4">
                                <div className="flex gap-3">
                                    <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-red-900">{alert.title}</h3>
                                        <p className="text-sm text-red-800 mt-1">{alert.description}</p>
                                        {alert.action && (
                                            <Link
                                                to={alert.action.to}
                                                className="inline-block mt-2 text-sm font-medium text-red-600 hover:text-red-700"
                                            >
                                                {alert.action.label} →
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {warningAlerts.map((alert) => (
                            <div key={alert.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <div className="flex gap-3">
                                    <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-amber-900">{alert.title}</h3>
                                        <p className="text-sm text-amber-800 mt-1">{alert.description}</p>
                                        {alert.action && (
                                            <Link
                                                to={alert.action.to}
                                                className="inline-block mt-2 text-sm font-medium text-amber-600 hover:text-amber-700"
                                            >
                                                {alert.action.label} →
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Live KPI Cards */}
            <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics (Last 30 Days)</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {summary.kpis.map((kpi) => {
                        const Icon = kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingUp : CheckCircle;
                        return (
                            <div key={kpi.id} className="rounded-lg border bg-white p-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">{kpi.label}</p>
                                        <p className="mt-2 text-2xl font-bold text-gray-900">
                                            {kpi.unit === "currency" ? formatCurrency(kpi.value) : formatNumber(kpi.value)}
                                        </p>
                                    </div>
                                    <div className={`flex-shrink-0 ${kpi.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                                        <Icon className={`h-5 w-5 ${kpi.trend === "down" ? "rotate-180" : ""}`} />
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-2">
                                    <span className={`text-sm font-medium ${kpi.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                                        {kpi.change > 0 ? "+" : ""}{kpi.change.toFixed(1)}%
                                    </span>
                                    <span className="text-xs text-gray-600">vs previous period</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Business Summary */}
            <section className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-lg border bg-white p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        Bookings
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Total</span>
                            <span className="font-semibold text-gray-900">{formatNumber(summary.bookings.total)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Confirmed</span>
                            <span className="font-semibold text-green-600">{formatNumber(summary.bookings.confirmed)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Disputes</span>
                            <span className="font-semibold text-amber-600">{formatNumber(summary.bookings.disputes)}</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border bg-white p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-600" />
                        Revenue
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Gross</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(summary.revenue.gross)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Net</span>
                            <span className="font-semibold text-green-600">{formatCurrency(summary.revenue.net)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Take Rate</span>
                            <span className="font-semibold text-gray-900">{summary.revenue.takeRate.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border bg-white p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-indigo-600" />
                        Operations
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Open Disputes</span>
                            <span className="font-semibold text-amber-600">{summary.operations.openDisputes}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Moderation Queue</span>
                            <span className="font-semibold text-gray-900">{summary.operations.moderationBacklog}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700">Fraud Signals</span>
                            <span className="font-semibold text-red-600">{summary.operations.fraudSignals}</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick Navigation */}
            <section className="rounded-lg border bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Navigation</h2>
                <p className="text-sm text-gray-600 mb-6">Jump into high-signal workflows.</p>
                <div className="grid gap-3 md:grid-cols-2">
                    {quickLinks.map((link) => (
                        <Link
                            key={link.href}
                            to={link.href}
                            className="flex items-center justify-between rounded-lg border p-4 transition hover:border-blue-300 hover:bg-blue-50"
                        >
                            <div>
                                <p className="font-medium text-gray-900">{link.label}</p>
                                <p className="text-sm text-gray-600">{link.description}</p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        </Link>
                    ))}
                </div>
            </section>

            {/* Daily Checklist */}
            <section className="rounded-lg border bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
                    Daily Operational Checklist
                </h2>
                <p className="text-sm text-gray-600 mb-6">Daily touchpoints to keep the marketplace trustworthy.</p>
                <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">Review new listings awaiting moderation ({summary.operations.moderationBacklog} pending)</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">Check disputes & escalations for quick resolutions ({summary.operations.openDisputes} open)</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">Monitor payouts and refund queues ({formatCurrency(summary.revenue.payoutVolume)} pending)</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">Review fraud signals and suspicious activity ({summary.operations.fraudSignals} detected)</span>
                    </li>
                </ul>
            </section>
        </div>
    );
}
