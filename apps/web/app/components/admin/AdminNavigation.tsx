import { Link, useLocation } from "react-router";
import { useEffect, useMemo, useState } from "react";
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
  Activity,
  Package,
  Banknote,
  Zap,
  Star,
  Heart,
  CheckSquare,
} from "lucide-react";

type AdminMenuPersona =
  | "all"
  | "operations"
  | "content"
  | "trust"
  | "finance"
  | "platform";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuCategory {
  category: string;
  personas: AdminMenuPersona[];
  items: MenuItem[];
}

const PERSONA_STORAGE_KEY = "admin-navigation-persona";

const PERSONA_OPTIONS: Array<{
  value: AdminMenuPersona;
  label: string;
  description: string;
}> = [
  { value: "all", label: "All access", description: "Show the full admin surface" },
  { value: "operations", label: "Operations", description: "Bookings, users, and frontline tasks" },
  { value: "content", label: "Content", description: "Listings, categories, and reviews" },
  { value: "trust", label: "Trust & Safety", description: "Disputes, fraud, and moderation" },
  { value: "finance", label: "Finance", description: "Payments, refunds, and payouts" },
  { value: "platform", label: "Platform", description: "System settings and power tools" },
];

const menuItems: MenuCategory[] = [
  {
    category: "admin.nav.main",
    personas: ["all", "operations"],
    items: [
      { name: "admin.nav.dashboard", href: "/admin", icon: LayoutDashboard },
      { name: "admin.nav.analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    category: "admin.nav.userManagement",
    personas: ["all", "operations"],
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
    personas: ["all", "content"],
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
    personas: ["all", "operations", "finance"],
    items: [
      { name: "admin.nav.bookings", href: "/admin/entities/bookings", icon: Calendar },
      { name: "admin.nav.payments", href: "/admin/entities/payments", icon: CreditCard },
      { name: "admin.nav.refunds", href: "/admin/entities/refunds", icon: Banknote },
      { name: "admin.nav.payouts", href: "/admin/entities/payouts", icon: TrendingUp },
    ],
  },
  {
    category: "admin.nav.disputesModeration",
    personas: ["all", "trust", "operations"],
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
    personas: ["all", "trust"],
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
    personas: ["all", "operations"],
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
    personas: ["all", "platform"],
    items: [
      { name: "admin.nav.systemSettings", href: "/admin/system", icon: Settings },
      { name: "Diagnostics", href: "/admin/diagnostics", icon: Activity },
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
  const [persona, setPersona] = useState<AdminMenuPersona>("all");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedPersona = window.localStorage.getItem(
      PERSONA_STORAGE_KEY
    ) as AdminMenuPersona | null;
    if (storedPersona && PERSONA_OPTIONS.some((option) => option.value === storedPersona)) {
      setPersona(storedPersona);
    }
  }, []);

  const activePersonaOption =
    PERSONA_OPTIONS.find((option) => option.value === persona) ?? PERSONA_OPTIONS[0];

  const visibleCategories = useMemo(() => {
    return menuItems.filter((category) => {
      const matchesPersona = persona === "all" || category.personas.includes(persona);
      const containsCurrentRoute = category.items.some(
        (item) =>
          location.pathname === item.href ||
          (item.href !== "/admin" && location.pathname.startsWith(item.href + "/"))
      );

      return matchesPersona || containsCurrentRoute;
    });
  }, [location.pathname, persona]);

  const handlePersonaChange = (nextPersona: AdminMenuPersona) => {
    setPersona(nextPersona);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PERSONA_STORAGE_KEY, nextPersona);
    }
  };

  return (
    <aside
      role="complementary"
      aria-label="Admin navigation"
      className="w-64 bg-white shadow-sm border-r h-screen overflow-y-auto flex flex-col"
    >
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">{t("admin.panel")}</h2>
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Menu focus
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PERSONA_OPTIONS.map((option) => {
              const isActive = option.value === persona;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePersonaChange(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {activePersonaOption.description}
          </p>
        </div>
      </div>
      <nav className="p-4 space-y-6 flex-1" aria-label="Main admin menu">
        {visibleCategories.map((category) => (
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
