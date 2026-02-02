import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, useRevalidator } from "react-router";
import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { paymentsApi } from "~/lib/api/payments";
import type { Transaction as PaymentTransaction } from "~/lib/api/payments";
import { Button, Badge } from "~/components/ui";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Payments & Earnings | GharBatai Rentals" },
    { name: "description", content: "Manage your earnings and payouts" },
  ];
};

interface PaymentsData {
  balance: {
    available: number;
    pending: number;
    currency: string;
  };
  earnings: {
    thisMonth: number;
    lastMonth: number;
    total: number;
    currency: string;
  };
  transactions: PaymentTransaction[];
  totalTransactions: number;
  page: number;
  limit: number;
  error?: string | null;
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const type = url.searchParams.get("type") || undefined;
  const status = url.searchParams.get("status") || undefined;

  try {
    // Fetch all payment data from real API
    const [balanceData, earningsData, transactionsData] = await Promise.all([
      paymentsApi.getBalance(),
      paymentsApi.getEarningsSummary({ period: "month" }),
      paymentsApi.getTransactions({
        page,
        limit: 20,
        type,
        status,
      }),
    ]);

    const data: PaymentsData = {
      balance: balanceData,
      earnings: {
        thisMonth: earningsData.thisMonth,
        lastMonth: earningsData.lastMonth,
        total: earningsData.total,
        currency: earningsData.currency,
      },
      transactions: transactionsData.transactions,
      totalTransactions: transactionsData.total,
      page: transactionsData.page,
      limit: transactionsData.limit,
      error: null,
    };

    return data;
  } catch (error) {
    console.error("Failed to load payments:", error);
    const data: PaymentsData = {
      balance: { available: 0, pending: 0, currency: "USD" },
      earnings: { thisMonth: 0, lastMonth: 0, total: 0, currency: "USD" },
      transactions: [],
      totalTransactions: 0,
      page: 1,
      limit: 20,
      error: "Failed to load payment data",
    };

    return data;
  }
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  BOOKING_PAYMENT: "Booking Payment",
  PAYOUT: "Payout",
  REFUND: "Refund",
  PLATFORM_FEE: "Platform Fee",
  DEPOSIT_HOLD: "Deposit Hold",
  DEPOSIT_RELEASE: "Deposit Release",
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-yellow-100", text: "text-yellow-800" },
  processing: { bg: "bg-blue-100", text: "text-blue-800" },
  completed: { bg: "bg-green-100", text: "text-green-800" },
  failed: { bg: "bg-red-100", text: "text-red-800" },
};

export default function PaymentsPage() {
  const data = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const currentType = searchParams.get("type");
  const currentStatus = searchParams.get("status");
  const currentPage = parseInt(searchParams.get("page") || "1");

  const handleFilterChange = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1"); // Reset to first page when filtering
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    setSearchParams(params);
  };

  const totalPages = Math.ceil(data.totalTransactions / 20);
  const earningsGrowth = data.earnings.lastMonth > 0
    ? ((data.earnings.thisMonth - data.earnings.lastMonth) / data.earnings.lastMonth) * 100
    : 0;

  if (data.error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Unable to load payments</h1>
            <p className="text-muted-foreground mb-6">{data.error}</p>
            <Button onClick={() => revalidator.revalidate()}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Payments & Earnings</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your earnings, payouts, and transaction history
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outlined">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button>
                <Wallet className="w-4 h-4 mr-2" />
                Request Payout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Available Balance */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  ${data.balance.available.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Ready for payout
            </p>
          </div>

          {/* Pending Balance */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  ${data.balance.pending.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Processing from recent bookings
            </p>
          </div>

          {/* This Month */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  ${data.earnings.thisMonth.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3">
              {earningsGrowth >= 0 ? (
                <>
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-600">
                    +{earningsGrowth.toFixed(1)}%
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-red-600">
                    {earningsGrowth.toFixed(1)}%
                  </span>
                </>
              )}
              <span className="text-xs text-muted-foreground ml-1">vs last month</span>
            </div>
          </div>

          {/* Total Earnings */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  ${data.earnings.total.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              All time
            </p>
          </div>
        </div>

        {/* Transactions Section */}
        <div className="bg-card border rounded-lg">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Transaction History</h2>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mr-2">Type:</label>
                  <select
                    value={currentType || ""}
                    onChange={(e) => handleFilterChange("type", e.target.value || null)}
                    className="border border-input rounded-md px-3 py-1.5 text-sm bg-background"
                  >
                    <option value="">All Types</option>
                    <option value="BOOKING_PAYMENT">Booking Payment</option>
                    <option value="PAYOUT">Payout</option>
                    <option value="REFUND">Refund</option>
                    <option value="PLATFORM_FEE">Platform Fee</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mr-2">Status:</label>
                  <select
                    value={currentStatus || ""}
                    onChange={(e) => handleFilterChange("status", e.target.value || null)}
                    className="border border-input rounded-md px-3 py-1.5 text-sm bg-background"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                {(currentType || currentStatus) && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => {
                      const params = new URLSearchParams();
                      setSearchParams(params);
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Transactions List */}
          {data.transactions.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No transactions found</p>
              {(currentType || currentStatus) && (
                <Button
                  variant="text"
                  className="mt-2"
                  onClick={() => setSearchParams(new URLSearchParams())}
                >
                  Clear filters to see all transactions
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          transaction.type === "PAYOUT" || transaction.type === "REFUND"
                            ? "bg-red-100"
                            : "bg-green-100"
                        )}
                      >
                        {transaction.type === "PAYOUT" || transaction.type === "REFUND" ? (
                          <ArrowUpRight className="w-5 h-5 text-red-600" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {TRANSACTION_TYPE_LABELS[transaction.type] || transaction.type}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.description}
                        </p>
                        {transaction.booking && (
                          <Link
                            to={`/bookings/${transaction.booking.id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {transaction.booking.listing.title}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "font-semibold",
                          transaction.type === "PAYOUT" ||
                            transaction.type === "REFUND" ||
                            transaction.type === "PLATFORM_FEE"
                            ? "text-red-600"
                            : "text-green-600"
                        )}
                      >
                        {transaction.type === "PAYOUT" ||
                        transaction.type === "REFUND" ||
                        transaction.type === "PLATFORM_FEE"
                          ? "-"
                          : "+"}
                        ${transaction.amount.toLocaleString()}
                      </p>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            STATUS_STYLES[transaction.status]?.bg,
                            STATUS_STYLES[transaction.status]?.text
                          )}
                        >
                          {transaction.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(transaction.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/settings/profile"
            className="bg-card border rounded-lg p-6 hover:border-primary/50 transition-colors"
          >
            <CreditCard className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-semibold text-foreground">Payout Settings</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Update your bank account or payment method
            </p>
          </Link>
          <Link
            to="/dashboard/owner"
            className="bg-card border rounded-lg p-6 hover:border-primary/50 transition-colors"
          >
            <TrendingUp className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-semibold text-foreground">Performance</h3>
            <p className="text-sm text-muted-foreground mt-1">
              View detailed analytics and insights
            </p>
          </Link>
          <a
            href="/help/payments"
            className="bg-card border rounded-lg p-6 hover:border-primary/50 transition-colors"
          >
            <AlertCircle className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-semibold text-foreground">Help & Support</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Get help with payment issues
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}
