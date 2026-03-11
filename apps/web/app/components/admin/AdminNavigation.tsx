import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  Home,
  Calendar,
  MessageSquare,
  Settings,
  Shield,
  FileText,
  CreditCard,
  AlertTriangle,
  BarChart3,
  Building,
  Mail,
  TrendingUp,
  Package,
  Banknote,
  Zap,
  Star,
  Heart,
  CheckSquare,
} from "lucide-react";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuCategory {
  category: string;
  items: MenuItem[];
}

const menuItems: MenuCategory[] = [
  {
    category: "admin.nav.main",
    items: [
      { name: "admin.nav.dashboard", href: "/admin", icon: LayoutDashboard },
      { name: "admin.nav.analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    category: "admin.nav.userManagement",
    items: [
      { name: "admin.nav.users", href: "/admin/entities/users", icon: Users },
      {
        name: "admin.nav.organizations",
        href: "/admin/entities/organizations",
        icon: Building,
      },
    ],
  },
  {
    category: "admin.nav.contentManagement",
    items: [
      { name: "admin.nav.listings", href: "/admin/entities/listings", icon: Home },
      { name: "admin.nav.listingApprovals", href: "/admin/listings", icon: CheckSquare },
      { name: "admin.nav.categories", href: "/admin/entities/categories", icon: Package },
      { name: "admin.nav.reviews", href: "/admin/entities/reviews", icon: Star },
      {
        name: "admin.nav.messages",
        href: "/admin/entities/messages",
        icon: MessageSquare,
      },
      { name: "admin.nav.favorites", href: "/admin/entities/favorites", icon: Heart },
    ],
  },
  {
    category: "admin.nav.bookingsPayments",
    items: [
      { name: "admin.nav.bookings", href: "/admin/entities/bookings", icon: Calendar },
      { name: "admin.nav.payments", href: "/admin/entities/payments", icon: CreditCard },
      { name: "admin.nav.refunds", href: "/admin/entities/refunds", icon: Banknote },
      { name: "admin.nav.payouts", href: "/admin/entities/payouts", icon: TrendingUp },
    ],
  },
  {
    category: "admin.nav.disputesModeration",
    items: [
      {
        name: "admin.nav.disputes",
        href: "/admin/entities/disputes",
        icon: AlertTriangle,
      },
    ],
  },
  {
    category: "admin.nav.insurance",
    items: [
      {
        name: "admin.nav.insurancePolicies",
        href: "/admin/entities/insurance",
        icon: Shield,
      },
      { name: "admin.nav.claims", href: "/admin/entities/claims", icon: FileText },
    ],
  },
  {
    category: "admin.nav.notifications",
    items: [
      {
        name: "admin.nav.notificationsItem",
        href: "/admin/entities/notifications",
        icon: Mail,
      },
    ],
  },
  {
    category: "admin.nav.system",
    items: [
      { name: "admin.nav.systemSettings", href: "/admin/system", icon: Settings },
      {
        name: "admin.nav.powerOperations",
        href: "/admin/system/power-operations",
        icon: Zap,
      },
    ],
  },
];

export function AdminNavigation() {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <aside
      role="complementary"
      aria-label="Admin navigation"
      className="w-64 bg-white shadow-sm border-r h-screen overflow-y-auto flex flex-col"
    >
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">{t("admin.panel")}</h2>
      </div>
      <nav className="p-4 space-y-6 flex-1" aria-label="Main admin menu">
        {menuItems.map((category) => (
          <div key={category.category}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t(category.category)}
            </h3>
            <ul className="space-y-1">
              {category.items.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== "/admin" &&
                    location.pathname.startsWith(item.href + "/"));
                const Icon = item.icon;

                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{t(item.name)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t">
        <p className="text-xs text-gray-500 text-center">{t("admin.footer")}</p>
      </div>
    </aside>
  );
}

export default AdminNavigation;
