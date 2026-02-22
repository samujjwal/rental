import type { MetaFunction } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData, redirect } from "react-router";
import { useState, useCallback } from "react";
import {
  DollarSign,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Loader2,
  Download,
} from "lucide-react";
import { paymentsApi, type Transaction, type PayoutResponse } from "~/lib/api/payments";
import { UnifiedButton , RouteErrorBoundary } from "~/components/ui";
import { getUser } from "~/utils/auth";
import { exportToCsv } from "~/utils/export";

export const meta: MetaFunction = () => {
  return [
    { title: "Earnings | Owner Dashboard" },
    { name: "description", content: "View your rental earnings and payouts" },
  ];
};
const MAX_PAYOUT_AMOUNT = 1_000_000;
const payoutAmountPattern = /^\d+(\.\d{1,2})?$/;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeDateLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString();
};
const shortId = (value: unknown): string => {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, 8) : "";
};

export async function clientLoader({ request }: { request: Request }) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return redirect("/dashboard");
  }

  try {
    const results = await Promise.allSettled([
      paymentsApi.getBalance(),
      paymentsApi.getEarnings(),
      paymentsApi.getTransactions({ limit: 20 }),
      paymentsApi.getPayouts({ limit: 10 }),
    ]);

    const settled = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === 'fulfilled' ? r.value : fallback;

    const balanceRes = settled(results[0], { balance: 0, currency: 'USD' } as any);
    const earningsRes = settled(results[1], { amount: 0 } as any);
    const transactionsRes = settled(results[2], { transactions: [] } as any);
    const payoutsRes = settled(results[3], { payouts: [] } as any);

    const failedSections = results
      .map((r, i) => r.status === 'rejected' ? ['balance', 'earnings', 'transactions', 'payouts'][i] : null)
      .filter(Boolean) as string[];

    return {
      balance: {
        total: safeNumber(balanceRes.balance),
        currency: balanceRes.currency || "USD",
      },
      available: safeNumber(earningsRes.amount),
      transactions: Array.isArray(transactionsRes.transactions)
        ? transactionsRes.transactions
        : [],
      payouts: Array.isArray(payoutsRes.payouts) ? payoutsRes.payouts : [],
      error: failedSections.length > 0 ? `Failed to load: ${failedSections.join(', ')}` : null,
    };
  } catch (error: unknown) {
    return {
      balance: { total: 0, currency: "USD" },
      available: 0,
      transactions: [],
      payouts: [],
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load earnings data",
    };
  }
}

export async function clientAction({ request }: { request: Request }) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return redirect("/dashboard");
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "requestPayout") {
    const rawAmount = String(formData.get("amount") || "").trim();
    if (!payoutAmountPattern.test(rawAmount)) {
      return { success: false, error: "Amount must be a valid number with up to 2 decimals." };
    }
    const requestedAmount = Number(rawAmount);
    const amount = Math.round(requestedAmount * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: "Invalid payout amount" };
    }
    if (amount > MAX_PAYOUT_AMOUNT) {
      return { success: false, error: "Payout amount exceeds maximum allowed limit" };
    }
    try {
      const earnings = await paymentsApi.getEarnings();
      const availableAmount = safeNumber(earnings.amount);
      if (amount > availableAmount) {
        return { success: false, error: "Payout amount exceeds available balance" };
      }

      await paymentsApi.requestPayout({ amount });
      return { success: true, message: "Payout request submitted successfully" };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { data?: { message?: string } } }).response
                ?.data?.message || "Failed to request payout"
            : "Failed to request payout",
      };
    }
  }

  return { success: false, error: "Unknown action" };
}

export default function OwnerEarningsPage() {
  const { balance, available, transactions, payouts, error } =
    useLoaderData<typeof clientLoader>() as {
      balance: { total: number; currency: string };
      available: number;
      transactions: Transaction[];
      payouts: PayoutResponse[];
      error: string | null;
    };
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  const isSubmitting = navigation.state === "submitting";
  const availableAmount = safeNumber(available);
  const totalBalance = safeNumber(balance.total);

  const handleExportTransactions = useCallback(() => {
    if (transactions.length === 0) return;
    exportToCsv(
      transactions,
      [
        { header: 'Date', accessor: (t) => safeDateLabel(t.createdAt) },
        { header: 'Type', accessor: (t) => t.type },
        { header: 'Description', accessor: (t) => t.description || `Booking #${shortId(t.booking?.id)}` },
        { header: 'Amount', accessor: (t) => safeNumber(t.amount).toFixed(2) },
        { header: 'Status', accessor: (t) => t.status },
      ],
      'transactions',
    );
  }, [transactions]);

  const handleExportPayouts = useCallback(() => {
    if (payouts.length === 0) return;
    exportToCsv(
      payouts,
      [
        { header: 'Date', accessor: (p) => safeDateLabel(p.createdAt) },
        { header: 'Amount', accessor: (p) => safeNumber(p.amount).toFixed(2) },
        { header: 'Status', accessor: (p) => p.status },
        { header: 'Account', accessor: (p) => p.accountLast4 ? `****${p.accountLast4}` : 'Bank Account' },
      ],
      'payouts',
    );
  }, [payouts]);

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
            <p className="text-3xl font-bold text-foreground">${availableAmount.toFixed(2)}</p>
            <UnifiedButton
              onClick={() => setShowPayoutModal(true)}
              className="mt-4 w-full"
              disabled={availableAmount <= 0}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Request Payout
            </UnifiedButton>
          </div>
          <div className="bg-card border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Total Balance</h3>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold text-foreground">${totalBalance.toFixed(2)}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Reflects settled earnings and payouts
            </p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-card border rounded-xl overflow-hidden mb-8">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Transaction History</h3>
            <div className="flex items-center gap-3">
              {transactions.length > 0 && (
                <UnifiedButton variant="outline" size="sm" onClick={handleExportTransactions}>
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </UnifiedButton>
              )}
              <div className="text-sm text-muted-foreground">
                Showing the latest 20 transactions
              </div>
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
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm text-foreground">
                      {safeDateLabel(transaction.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(transaction.type)}
                        <span className="text-sm text-foreground">
                          {transaction.description ||
                            (shortId(transaction.booking?.id)
                              ? `Booking #${shortId(transaction.booking?.id)}`
                              : "Booking")}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      transaction.type === "PAYOUT" || transaction.type === "REFUND"
                        ? "text-red-600"
                        : "text-green-600"
                    }`}>
                      {transaction.type === "PAYOUT" || transaction.type === "REFUND" ? "-" : "+"}
                      ${safeNumber(transaction.amount).toFixed(2)}
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
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Recent Payouts</h3>
            {payouts.length > 0 && (
              <UnifiedButton variant="outline" size="sm" onClick={handleExportPayouts}>
                <Download className="w-4 h-4 mr-1" /> Export CSV
              </UnifiedButton>
            )}
          </div>
          <div className="divide-y divide-border">
            {payouts.map((payout) => (
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
                      {payout.createdAt
                        ? safeDateLabel(payout.createdAt)
                        : "Processing"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">
                    ${safeNumber(payout.amount).toFixed(2)}
                  </p>
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
                    max={availableAmount}
                    defaultValue={availableAmount.toFixed(2)}
                    inputMode="decimal"
                    className="w-full pl-8 pr-4 py-2 border border-input rounded-lg bg-background"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Available: ${availableAmount.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-3">
                <UnifiedButton
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

export { RouteErrorBoundary as ErrorBoundary };

