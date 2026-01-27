import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/Button";
import { Plus, Download, Upload, Settings } from "lucide-react";

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface Action {
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    to?: string;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive';
    disabled?: boolean;
}

interface StatCard {
    id: string;
    label: string;
    value: string | number;
    change?: {
        value: string;
        type: 'increase' | 'decrease' | 'neutral';
    };
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
    icon?: ReactNode;
}

interface AdminPageLayoutProps {
    title: string;
    description?: string;
    breadcrumbs?: BreadcrumbItem[];
    actions?: Action[];
    stats?: StatCard[];
    children: ReactNode;
    headerActions?: ReactNode;
    loading?: boolean;
    error?: string;
}

export function AdminPageLayout({
    title,
    description,
    breadcrumbs = [],
    actions = [],
    stats = [],
    children,
    headerActions,
    loading = false,
    error
}: AdminPageLayoutProps) {
    const getStatColor = (color?: string) => {
        const colors = {
            blue: 'text-blue-600 bg-blue-50',
            green: 'text-green-600 bg-green-50',
            yellow: 'text-yellow-600 bg-yellow-50',
            red: 'text-red-600 bg-red-50',
            purple: 'text-purple-600 bg-purple-50'
        };
        return colors[color as keyof typeof colors] || 'text-gray-600 bg-gray-50';
    };

    const getChangeColor = (type: 'increase' | 'decrease' | 'neutral') => {
        const colors = {
            increase: 'text-green-600',
            decrease: 'text-red-600',
            neutral: 'text-gray-600'
        };
        return colors[type];
    };

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
                    <div className="text-center">
                        <div className="text-red-600 text-5xl mb-4">⚠️</div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <Button onClick={() => window.location.reload()}>
                            Try Again
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <Link to="/admin" className="text-xl font-bold text-gray-900">
                                Admin Portal
                            </Link>
                        </div>
                        {headerActions}
                    </div>
                </div>
            </div>

            {/* Page Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Breadcrumbs */}
                {breadcrumbs.length > 0 && (
                    <nav className="flex mb-6" aria-label="Breadcrumb">
                        <ol className="flex items-center space-x-2">
                            <li>
                                <Link to="/admin" className="text-gray-500 hover:text-gray-700">
                                    Dashboard
                                </Link>
                            </li>
                            {breadcrumbs.map((item, index) => (
                                <li key={index} className="flex items-center">
                                    <span className="text-gray-400 mx-2">/</span>
                                    {item.href ? (
                                        <Link to={item.href} className="text-gray-500 hover:text-gray-700">
                                            {item.label}
                                        </Link>
                                    ) : (
                                        <span className="text-gray-900">{item.label}</span>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </nav>
                )}

                {/* Page Header */}
                <div className="flex items-start justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                        {description && (
                            <p className="text-gray-600 mt-1">{description}</p>
                        )}
                    </div>

                    {actions.length > 0 && (
                        <div className="flex shrink-0 gap-3">
                            {actions.map((action, index) => (
                                <Button
                                    key={index}
                                    variant={action.variant || 'default'}
                                    disabled={action.disabled}
                                    onClick={action.onClick}
                                    {...(action.to ? { as: Link, to: action.to } : {})}
                                >
                                    {action.icon && <span className="mr-2">{action.icon}</span>}
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Stats Cards */}
                {stats.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {stats.map((stat) => (
                            <div key={stat.id} className="bg-white p-6 rounded-lg border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                        <p className={`text-2xl font-bold ${getStatColor(stat.color).split(' ')[0]}`}>
                                            {stat.value}
                                        </p>
                                        {stat.change && (
                                            <p className={`text-sm mt-1 ${getChangeColor(stat.change.type)}`}>
                                                {stat.change.value}
                                            </p>
                                        )}
                                    </div>
                                    {stat.icon && (
                                        <div className={`p-3 rounded-lg ${getStatColor(stat.color).split(' ')[1]}`}>
                                            {stat.icon}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Main Content */}
                <div className="bg-white rounded-lg border shadow-sm">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-gray-500">Loading...</span>
                        </div>
                    ) : (
                        children
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper component for common admin page patterns
export function AdminDataTablePage<T>({
    title,
    description,
    breadcrumbs,
    actions,
    stats,
    filters,
    table,
    pagination,
    loading,
    error
}: {
    title: string;
    description?: string;
    breadcrumbs?: BreadcrumbItem[];
    actions?: Action[];
    stats?: StatCard[];
    filters?: ReactNode;
    table: ReactNode;
    pagination?: ReactNode;
    loading?: boolean;
    error?: string;
}) {
    return (
        <AdminPageLayout
            title={title}
            description={description}
            breadcrumbs={breadcrumbs}
            actions={actions}
            stats={stats}
            loading={loading}
            error={error}
        >
            <div className="space-y-6">
                {filters}
                {table}
                {pagination}
            </div>
        </AdminPageLayout>
    );
}
