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
    TrendingUp,
    Package,
    DollarSign,
    Zap,
    FileSearch,
    Activity,
    Star,
    Heart,
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
        category: "Main",
        items: [
            { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
            { name: "Analytics", href: "/admin/entities/analytics", icon: BarChart3 },
        ]
    },
    {
        category: "User Management",
        items: [
            { name: "Users", href: "/admin/entities/users", icon: Users },
            { name: "Organizations", href: "/admin/entities/organizations", icon: Building },
        ]
    },
    {
        category: "Content Management",
        items: [
            { name: "Listings", href: "/admin/entities/listings", icon: Home },
            { name: "Categories", href: "/admin/entities/categories", icon: Package },
            { name: "Reviews", href: "/admin/entities/reviews", icon: Star },
            { name: "Messages", href: "/admin/entities/messages", icon: MessageSquare },
            { name: "Favorites", href: "/admin/entities/favorites", icon: Heart },
        ]
    },
    {
        category: "Bookings & Payments",
        items: [
            { name: "Bookings", href: "/admin/entities/bookings", icon: Calendar },
            { name: "Payments", href: "/admin/entities/payments", icon: CreditCard },
            { name: "Refunds", href: "/admin/entities/refunds", icon: DollarSign },
            { name: "Payouts", href: "/admin/entities/payouts", icon: TrendingUp },
        ]
    },
    {
        category: "Disputes & Moderation",
        items: [
            { name: "Disputes", href: "/admin/entities/disputes", icon: AlertTriangle },
            { name: "Condition Reports", href: "/admin/entities/condition-reports", icon: Camera },
        ]
    },
    {
        category: "Insurance",
        items: [
            { name: "Insurance Policies", href: "/admin/entities/insurance", icon: Shield },
            { name: "Claims", href: "/admin/entities/claims", icon: FileText },
        ]
    },
    {
        category: "Notifications",
        items: [
            { name: "Notifications", href: "/admin/entities/notifications", icon: Mail },
            { name: "Email Templates", href: "/admin/entities/email-templates", icon: FileText },
        ]
    },
    {
        category: "System",
        items: [
            { name: "System Settings", href: "/admin/system", icon: Settings },
            { name: "Power Operations", href: "/admin/system/power-operations", icon: Zap },
        ]
    },
];

export function AdminNavigation() {
    const location = useLocation();

    return (
        <aside role="complementary" aria-label="Admin navigation" className="w-64 bg-white shadow-sm border-r h-screen overflow-y-auto flex flex-col">
            <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
            </div>
            <nav className="p-4 space-y-6 flex-1" aria-label="Main admin menu">
                {menuItems.map((category) => (
                    <div key={category.category}>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            {category.category}
                        </h3>
                        <ul className="space-y-1">
                            {category.items.map((item) => {
                                const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
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
            <div className="p-4 border-t">
                <p className="text-xs text-gray-500 text-center">Rental Portal Admin</p>
            </div>
        </aside>
    );
}

export default AdminNavigation;
