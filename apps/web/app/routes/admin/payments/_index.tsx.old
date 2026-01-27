import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { PaymentsTable } from "~/components/admin/PaymentsTable";
import { PaymentFilters } from "~/components/admin/PaymentFilters";
import { Button } from "~/components/ui/Button";
import { Plus, Download, Upload, CreditCard, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
    const user = await requireAdmin(request);
    const token = await getUserToken(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const method = url.searchParams.get("method") || "";
    const dateFrom = url.searchParams.get("dateFrom") || "";
    const dateTo = url.searchParams.get("dateTo") || "";
    const amountMin = url.searchParams.get("amountMin") || "";
    const amountMax = url.searchParams.get("amountMax") || "";

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    // Fetch payments with filters
    const [paymentsResponse, summaryResponse] = await Promise.all([
        fetch(
            `${API_BASE_URL}/admin/payments?page=${page}&limit=${limit}&search=${search}&status=${status}&method=${method}&dateFrom=${dateFrom}&dateTo=${dateTo}&amountMin=${amountMin}&amountMax=${amountMax}`,
            { headers }
        ),
        fetch(`${API_BASE_URL}/admin/payments/summary`, { headers }),
    ]);

    if (!paymentsResponse.ok) {
        throw new Response("Failed to fetch payments", { status: 500 });
    }

    const paymentsData = await paymentsResponse.json();
    const summaryData = summaryResponse.ok ? await summaryResponse.json() : {
        totalRevenue: 0,
        pendingRevenue: 0,
        failedRevenue: 0,
        refundedRevenue: 0,
        totalTransactions: 0,
        successRate: 0
    };

    return {
        payments: paymentsData.data || [],
        pagination: paymentsData.pagination || { page, limit, total: 0, totalPages: 0 },
        filters: { search, status, method, dateFrom, dateTo, amountMin, amountMax },
        summary: summaryData,
    };
}

export default function AdminPayments() {
    const { payments, pagination, filters, summary } = useLoaderData<typeof loader>();

    const totalRevenue = typeof summary?.totalRevenue === "number" ? summary.totalRevenue : 0;
    const pendingRevenue = typeof summary?.pendingRevenue === "number" ? summary.pendingRevenue : 0;
    const failedRevenue = typeof summary?.failedRevenue === "number" ? summary.failedRevenue : 0;
    const successRate = typeof summary?.successRate === "number" ? summary.successRate : 0;
    const totalTransactions = typeof summary?.totalTransactions === "number" ? summary.totalTransactions : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Payments Management</h1>
                    <p className="text-gray-600">Manage payment transactions, refunds, and financial analytics</p>
                </div>
                <div className="flex space-x-3">
                    <Button variant="outline">
                        <Upload className="w-4 h-4 mr-2" />
                        Import
                    </Button>
                    <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Process Refund
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <PaymentFilters initialFilters={filters} />

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
                    <p className="text-2xl font-bold text-gray-900">
                        ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center mt-2">
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm text-green-600">+12.5% from last month</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Pending Revenue</h3>
                    <p className="text-2xl font-bold text-yellow-600">
                        ${pendingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="text-sm text-gray-500 mt-2">
                        {payments.filter((p: any) => p.status === 'PENDING').length} transactions
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Failed Revenue</h3>
                    <p className="text-2xl font-bold text-red-600">
                        ${failedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="text-sm text-gray-500 mt-2">
                        {payments.filter((p: any) => p.status === 'FAILED').length} transactions
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
                    <p className="text-2xl font-bold text-green-600">
                        {successRate.toFixed(1)}%
                    </p>
                    <div className="text-sm text-gray-500 mt-2">
                        {totalTransactions} total transactions
                    </div>
                </div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Methods</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {['STRIPE', 'PAYPAL', 'BANK_TRANSFER'].map((method) => {
                        const methodPayments = payments.filter((p: any) => p.method === method);
                        const total = methodPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                        const count = methodPayments.length;

                        return (
                            <div key={method} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-gray-900">{method}</h4>
                                    <CreditCard className="w-5 h-5 text-gray-400" />
                                </div>
                                <div className="mt-2">
                                    <p className="text-2xl font-bold text-gray-900">${total.toLocaleString()}</p>
                                    <p className="text-sm text-gray-500">{count} transactions</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Payments Table */}
            <div className="bg-white rounded-lg border">
                <PaymentsTable payments={payments} />
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-700">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                        {pagination.total} results
                    </p>
                    <div className="flex space-x-2">
                        {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
                            <Link
                                key={pageNum}
                                to={`?page=${pageNum}&limit=${pagination.limit}&search=${filters.search}&status=${filters.status}&method=${filters.method}&dateFrom=${filters.dateFrom}&dateTo=${filters.dateTo}&amountMin=${filters.amountMin}&amountMax=${filters.amountMax}`}
                                className={`px-3 py-1 rounded ${pageNum === pagination.page
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                            >
                                {pageNum}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
