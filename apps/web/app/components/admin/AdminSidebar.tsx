import { Link, useLocation } from "react-router";
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
    Database,
    Key,
    Globe,
    BarChart3,
    Archive,
    Building,
    Mail,
    Phone,
    Camera,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    Package,
    DollarSign,
    HelpCircle,
    BookOpen,
    Zap,
    Lock,
    UserCheck,
    FileSearch,
    ClipboardList,
    Activity,
    MapPin,
    Star,
    Heart,
    Filter
} from "lucide-react";

const menuItems = [
    {
        category: "Main",
        items: [
            { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
            { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
        ]
    },
    {
        category: "User Management",
        items: [
            { name: "Users", href: "/admin/users", icon: Users },
            { name: "Organizations", href: "/admin/organizations", icon: Building },
            { name: "Roles & Permissions", href: "/admin/users/roles", icon: Shield },
            { name: "Sessions", href: "/admin/users/sessions", icon: Key },
        ]
    },
    {
        category: "Content Management",
        items: [
            { name: "Listings", href: "/admin/listings", icon: Home },
            { name: "Categories", href: "/admin/content/categories", icon: Package },
            { name: "Reviews", href: "/admin/content/reviews", icon: Star },
            { name: "Messages", href: "/admin/content/messages", icon: MessageSquare },
            { name: "Favorites", href: "/admin/content/favorites", icon: Heart },
        ]
    },
    {
        category: "Bookings & Payments",
        items: [
            { name: "Bookings", href: "/admin/bookings", icon: Calendar },
            { name: "Payments", href: "/admin/payments", icon: CreditCard },
            { name: "Refunds", href: "/admin/finance/refunds", icon: DollarSign },
            { name: "Payouts", href: "/admin/finance/payouts", icon: TrendingUp },
            { name: "Ledger", href: "/admin/finance/ledger", icon: FileText },
        ]
    },
    {
        category: "Disputes & Moderation",
        items: [
            { name: "Disputes", href: "/admin/moderation/disputes", icon: AlertTriangle },
            { name: "Moderation Queue", href: "/admin/moderation/queue", icon: Shield },
            { name: "Condition Reports", href: "/admin/moderation/condition-reports", icon: Camera },
        ]
    },
    {
        category: "Insurance",
        items: [
            { name: "Insurance Policies", href: "/admin/insurance", icon: Shield },
            { name: "Claims", href: "/admin/insurance/claims", icon: FileText },
        ]
    },
    {
        category: "Notifications",
        items: [
            { name: "Notifications", href: "/admin/notifications", icon: Mail },
            { name: "Email Templates", href: "/admin/notifications/templates", icon: FileText },
            { name: "Push Notifications", href: "/admin/notifications/push", icon: Phone },
            { name: "Device Tokens", href: "/admin/notifications/tokens", icon: Key },
        ]
    },
    {
        category: "System Configuration",
        items: [
            { name: "System Settings", href: "/admin/system/settings", icon: Settings },
            { name: "API Keys", href: "/admin/system/api-keys", icon: Key },
            { name: "Service Config", href: "/admin/system/services", icon: Zap },
            { name: "Environment", href: "/admin/system/environment", icon: Globe },
            { name: "Audit Logs", href: "/admin/system/audit", icon: FileSearch },
        ]
    },
    {
        category: "Monitoring",
        items: [
            { name: "System Health", href: "/admin/system/health", icon: Activity },
            { name: "Performance", href: "/admin/monitoring/performance", icon: TrendingUp },
            { name: "Error Logs", href: "/admin/system/logs", icon: AlertTriangle },
        ]
    },
    {
        category: "Data Management",
        items: [
            { name: "Database", href: "/admin/system/database", icon: Database },
            { name: "Backups", href: "/admin/system/backups", icon: Archive },
            { name: "Exports", href: "/admin/system/exports", icon: FileText },
            { name: "Imports", href: "/admin/system/imports", icon: FileText },
        ]
    }
];

export function AdminSidebar() {
    const location = useLocation();

    return (
        <aside className="w-64 bg-white shadow-sm border-r h-screen overflow-y-auto">
            <nav className="p-4 space-y-6">
                {menuItems.map((category) => (
                    <div key={category.category}>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            {category.category}
                        </h3>
                        <ul className="space-y-1">
                            {category.items.map((item) => {
                                const isActive = location.pathname === item.href;
                                const Icon = item.icon;

                                return (
                                    <li key={item.name}>
                                        <Link
                                            to={item.href}
                                            className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                                ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                                                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                                }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span>{item.name}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>
        </aside>
    );
}
