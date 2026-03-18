import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, redirect, useLoaderData } from "react-router";
import {
  ArrowUpRight,
  Banknote,
  Bell,
  CheckCircle,
  CreditCard,
  Receipt,
  Shield,
  User,
} from "lucide-react";
import { getUser } from "~/utils/auth";
import { paymentsApi } from "~/lib/api/payments";
import { RouteErrorBoundary } from "~/components/ui";
import { Card, CardContent } from "~/components/ui/card";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "~/lib/utils";

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  // Fetch balance and last 5 transactions in parallel; degrade gracefully  
  const [balanceResult, txResult] = await Promise.allSettled([
    paymentsApi.getBalance(),
    paymentsApi.getTransactions({ limit: 5 }),
  ]);

  const balance =
    balanceResult.status === "fulfilled" ? balanceResult.value : null;
  const transactions =
    txResult.status === "fulfilled"
      ? txResult.value.transactions ?? []
      : [];

  return { user, balance, transactions };
}

export const meta: MetaFunction = () => [
  { title: "Billing Settings | GharBatai Rentals" },
  { name: "description", content: "Manage your billing and payment methods" },
];

export default function SettingsBillingPage() {
  const { user, balance, transactions } = useLoaderData<typeof clientLoader>();
  const { t } = useTranslation();
  const canOpenPayments = user.role === "owner" || user.role === "admin";
  const canManagePayouts = canOpenPayments;

  const formatMoney = (amount: number, currency = balance?.currency || "USD") =>
    formatCurrency(amount, currency);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">
          {t("settings.billingSettings.title", "Billing & Payments")}
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <aside className="md:col-span-1">
            <nav className="bg-card rounded-lg border p-2 space-y-1">
              <Link
                to="/settings/profile"
                className="w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <User className="w-5 h-5" />
                {t("settings.profile", "Profile")}
              </Link>
              <Link
                to="/settings/notifications"
                className="w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5" />
                {t("settings.notifications", "Notifications")}
              </Link>
              <Link
                to="/settings/security"
                className="w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <Shield className="w-5 h-5" />
                {t("settings.security", "Security")}
              </Link>
              <Link
                to="/settings/billing"
                className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-lg font-medium"
              >
                <CreditCard className="w-5 h-5" />
                {t("settings.billing", "Billing")}
              </Link>
            </nav>
          </aside>

          {/* Main Content */}
          <div className="md:col-span-3 space-y-6">
            {/* Current Balance */}
            {balance && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.billingSettings.availableBalance", "Available Balance")}
                      </p>
                      <p className="text-3xl font-bold text-foreground mt-1">
                        {formatMoney(balance.balance ?? 0, balance.currency)}
                      </p>
                      {balance.pendingBalance != null &&
                        balance.pendingBalance > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatMoney(balance.pendingBalance, balance.currency)}{" "}
                            {t("settings.billingSettings.pending", "pending")}
                          </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-8 h-8 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Transactions */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Receipt className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">
                      {t("settings.billingSettings.recentTransactions", "Recent Transactions")}
                    </h2>
                  </div>
                  {canOpenPayments && (
                    <Link
                      to="/payments"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
                    >
                      {t("settings.billingSettings.viewAll", "View all")}
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>

                {transactions.length === 0 ? (
                  <div className="py-8 text-center">
                    <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t("settings.billingSettings.noTransactions", "No transactions yet.")}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {tx.description ?? tx.type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-semibold ${
                            (tx.amountSigned ?? tx.amount) > 0
                              ? "text-success"
                              : "text-foreground"
                          }`}
                        >
                          {(tx.amountSigned ?? tx.amount) > 0 ? "+" : ""}
                          {formatMoney(
                            tx.amountSigned ?? tx.amount,
                            tx.currency || balance?.currency || "USD"
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payout Settings */}
            {canManagePayouts && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Banknote className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">
                      {t("settings.billingSettings.payoutSettings", "Payout Settings")}
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t(
                      "settings.billingSettings.payoutSettingsDesc",
                      "Configure your bank account and payout preferences for owner earnings."
                    )}
                  </p>
                  <Link
                    to="/dashboard/owner/earnings"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    {t("settings.billingSettings.managePayouts", "Manage payouts →")}
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
