import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import type { ReactNode } from "react";
import { Link, redirect, useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "~/lib/store/auth";
import { getUser } from "~/utils/auth";
import { useEffect, useState } from "react";
import { messagingApi } from "~/lib/api/messaging";
import {
  Home,
  Search,
  Calendar,
  MessageSquare,
  Package,
  Banknote,
} from "lucide-react";
import { RecentActivity } from "~/components/dashboard/RecentActivity";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  RouteErrorBoundary,
} from "~/components/ui";
import { PortalPageLayout } from "~/components/layout";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard | GharBatai Rentals" },
    { name: "description", content: "Manage your rentals and bookings" },
  ];
};

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);

  if (!user) {
    return redirect("/auth/login");
  }

  // Redirect admin users to admin dashboard
  if (user.role === "admin") {
    return redirect("/admin");
  }

  // Redirect owners and renters to their specific dashboards
  if (user.role === "owner") {
    return redirect("/dashboard/owner");
  }

  if (user.role === "renter") {
    return redirect("/dashboard/renter");
  }

  return { user };
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconBg: string;
}

function StatCard({ title, value, icon, iconBg }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          </div>
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              iconBg
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user: loaderUser } = useLoaderData<typeof clientLoader>();
  const { user: storeUser } = useAuthStore();
  const user = storeUser ?? loaderUser;
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    messagingApi.getUnreadCount().then((r) => {
      setUnreadMessages(Number(r?.count || 0));
    }).catch(() => {});
  }, []);

  return (
    <PortalPageLayout
      title={t("dashboard.customerPortal", "Customer Portal")}
      description={t("dashboard.welcomeBack", { name: user?.firstName })}
      actions={
        <Link
          to="/search"
          className="inline-flex items-center rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {t("nav.searchRentals", "Search rentals")}
        </Link>
      }
    >
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title={t("dashboard.stats.activeBookings")}
          value={safeNumber(user?.totalBookings)}
          icon={<Calendar className="w-6 h-6 text-primary" />}
          iconBg="bg-primary/10"
        />
        <StatCard
          title={t("dashboard.myListings")}
          value={safeNumber(user?.totalListings)}
          icon={<Package className="w-6 h-6 text-success" />}
          iconBg="bg-success/10"
        />
        <StatCard
          title={t("dashboard.messages")}
          value={unreadMessages}
          icon={<MessageSquare className="w-6 h-6 text-info" />}
          iconBg="bg-info/10"
        />
        <StatCard
          title={t("dashboard.rating")}
          value={
            safeNumber(user?.rating) > 0
              ? safeNumber(user?.rating).toFixed(1)
              : t("dashboard.nA")
          }
          icon={<Banknote className="w-6 h-6 text-warning" />}
          iconBg="bg-warning/10"
        />
      </div>

      {/* Quick Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t("dashboard.quickActions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/search"
              className="flex items-center gap-3 p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Search className="w-6 h-6 text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  {t("dashboard.browseItems")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.findRentalsNearYou")}
                </p>
              </div>
            </Link>

            <Link
              to="/listings/new"
              className="flex items-center gap-3 p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Package className="w-6 h-6 text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  {t("dashboard.listAnItem")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.startEarningMoney")}
                </p>
              </div>
            </Link>

            <Link
              to="/messages"
              className="flex items-center gap-3 p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <MessageSquare className="w-6 h-6 text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  {t("dashboard.messages")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.chatWithUsers")}
                </p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <RecentActivity />
    </PortalPageLayout>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
