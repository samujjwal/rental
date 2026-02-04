import type { MetaFunction } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "react-router";
import { useState } from "react";
import {
  DollarSign,
  Download,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  CreditCard,
  Loader2,
} from "lucide-react";
import { paymentsApi } from "~/lib/api/payments";
import { UnifiedButton } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Earnings | Owner Dashboard" },
    { name: "description", content: "View your rental earnings and payouts" },
  ];
};

export async function clientLoader() {
  try {
    const [balanceRes, transactionsRes, payoutsRes, summaryRes] = await Promise.all([
      paymentsApi.getBalance(),
      paymentsApi.getTransactions({ limit: 20 }),
      paymentsApi.getPayouts({ limit: 10 }),
      paymentsApi.getEarningsSummary({ period: "month" }),
    ]);

    // Format breakdown data for chart
    const chartData = summaryRes.breakdown.map(item => ({
      month: new Date(item.date).toLocaleDateString('en-US', { month: 'short' }),
      amount: item.amount,
    }));

    return {
      balance: balanceRes,
      transactions: transactionsRes.transactions || [],
      payouts: payoutsRes.payouts || [],
      summary: {
        thisMonth: summaryRes.thisMonth,
        lastMonth: summaryRes.lastMonth,
        total: summaryRes.total,
      },
      chartData,
      error: null,
    };
  } catch (error: any) {
    return {
      balance: { available: 0, pending: 0 },
      transactions: [],
      payouts: [],
      summary: { thisMonth: 0, lastMonth: 0, total: 0 },
      chartData: [],
      error: error?.message || "Failed to load earnings data",
    };
  }
}

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "requestPayout") {
    const amount = parseFloat(formData.get("amount") as string);
    try {
      await paymentsApi.requestPayout({ amount });
      return { success: true, message: "Payout request submitted successfully" };
    } catch (error: any) {
      return { success: false, error: error?.response?.data?.message || "Failed to request payout" };
    }
  }

  return { success: false, error: "Unknown action" };
}

export default function OwnerEarningsPage() {
  const { balance, transactions, payouts, summary, chartData, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [selectedPeriod, setSelectedPeriod] = useState("30days");
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  const maxAmount = chartData && chartData.length > 0 
    ? Math.max(...chartData.map((d) => d.amount))
    : 1000;

  const getTransactionIcon = (type: string) => {
    if (type === "PAYOUT") return <ArrowUpRight className="w-4 h-4 text-red-500" />;
    if (type === "REFUND") return <ArrowDownRight className="w-4 h-4 text-red-500" />;
    return <ArrowDownRight className="w-4 h-4 text-green-500 rotate-180" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full"><CheckCircle className="w-3 h-3" /> Completed</span>;
      case "PENDING":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full"><Clock className="w-3 h-3" /> Pending</span>;
      case "PROCESSING":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full"><Loader2 className="w-3 h-3 animate-spin" /> Processing</span>;
      default:
        return <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">{status}</span>;
    }
  };

  if (error && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard/owner" className="text-muted-foreground hover:text-foreground">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-foreground">Earnings</h1>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-input rounded-lg bg-background text-sm"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="year">This Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Success/Error Messages */}
        {actionData?.success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {actionData.message}
          </div>
        )}
        {actionData?.error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {actionData.error}
          </div>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Available for Payout</h3>
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-foreground">${balance.available?.toFixed(2) || "0.00"}</p>
            <Button
              onClick={() => setShowPayoutModal(true)}
              className="mt-4 w-full"
              disabled={!balance.available || balance.available <= 0}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Request Payout
            </UnifiedButton>
          </div>
          <div className="bg-card border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Pending Clearance</h3>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold text-foreground">${balance.pending?.toFixed(2) || "0.00"}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Clears in 3-5 business days
            </p>
          </div>
        </div>

        {/* Earnings Chart */}
        <div className="bg-card border rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Earnings Overview</h3>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">This Month:</span>{" "}
                <span className="font-semibold text-foreground">${summary.thisMonth?.toFixed(2) || "0.00"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Last Month:</span>{" "}
                <span className="font-semibold text-foreground">${summary.lastMonth?.toFixed(2) || "0.00"}</span>
              </div>
            </div>
          </div>
          
          {/* Simple Bar Chart */}
          <div className="h-48 flex items-end gap-4">
            {chartData.map((data, index) => (
              <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-primary/80 rounded-t-lg transition-all hover:bg-primary"
                  style={{ height: `${(data.amount / maxAmount) * 100}%` }}
                />
                <span className="text-xs text-muted-foreground">{data.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-card border rounded-xl overflow-hidden mb-8">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Transaction History</h3>
            <div className="flex items-center gap-2">
              <UnifiedButton variant="outline" size="small">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </UnifiedButton>
              <UnifiedButton variant="outline" size="small">
                <FileText className="w-4 h-4 mr-2" />
                Tax Documents
              </UnifiedButton>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((transaction: any) => (
                  <tr key={transaction.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm text-foreground">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(transaction.type)}
                        <span className="text-sm text-foreground">
                          {transaction.description || `Booking #${transaction.bookingId?.slice(0, 8)}`}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      transaction.type === "PAYOUT" || transaction.type === "REFUND"
                        ? "text-red-600"
                        : "text-green-600"
                    }`}>
                      {transaction.type === "PAYOUT" || transaction.type === "REFUND" ? "-" : "+"}
                      ${transaction.amount?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(transaction.status)}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payouts */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-foreground">Recent Payouts</h3>
          </div>
          <div className="divide-y divide-border">
            {payouts.map((payout: any) => (
              <div key={payout.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      Payout to {payout.accountLast4 ? `****${payout.accountLast4}` : "Bank Account"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payout.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">${payout.amount?.toFixed(2)}</p>
                  {getStatusBadge(payout.status)}
                </div>
              </div>
            ))}
            {payouts.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No payouts yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">Request Payout</h3>
            <Form method="post">
              <input type="hidden" name="intent" value="requestPayout" />
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="1"
                    max={balance.available}
                    defaultValue={balance.available?.toFixed(2)}
                    className="w-full pl-8 pr-4 py-2 border border-input rounded-lg bg-background"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Available: ${balance.available?.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPayoutModal(false)}
                >
                  Cancel
                </UnifiedButton>
                <UnifiedButton type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Request Payout"
                  )}
                </UnifiedButton>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
