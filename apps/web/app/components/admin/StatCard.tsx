import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

export interface StatCardData {
    id: string;
    label: string;
    value: string | number;
    change?: {
        value: string | number;
        type: 'increase' | 'decrease' | 'neutral';
        period?: string;
    };
    trend?: Array<number>;
    icon?: React.ReactNode;
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'pink';
    href?: string;
    description?: string;
    loading?: boolean;
}

interface StatCardProps {
    stat: StatCardData;
    onClick?: () => void;
    compact?: boolean;
}

const colorStyles = {
    blue: {
        bg: 'bg-blue-100',
        icon: 'text-blue-600',
        badge: 'bg-blue-50 text-blue-700',
        border: 'border-blue-200'
    },
    green: {
        bg: 'bg-green-100',
        icon: 'text-green-600',
        badge: 'bg-green-50 text-green-700',
        border: 'border-green-200'
    },
    yellow: {
        bg: 'bg-yellow-100',
        icon: 'text-yellow-600',
        badge: 'bg-yellow-50 text-yellow-700',
        border: 'border-yellow-200'
    },
    red: {
        bg: 'bg-red-100',
        icon: 'text-red-600',
        badge: 'bg-red-50 text-red-700',
        border: 'border-red-200'
    },
    purple: {
        bg: 'bg-purple-100',
        icon: 'text-purple-600',
        badge: 'bg-purple-50 text-purple-700',
        border: 'border-purple-200'
    },
    indigo: {
        bg: 'bg-indigo-100',
        icon: 'text-indigo-600',
        badge: 'bg-indigo-50 text-indigo-700',
        border: 'border-indigo-200'
    },
    pink: {
        bg: 'bg-pink-100',
        icon: 'text-pink-600',
        badge: 'bg-pink-50 text-pink-700',
        border: 'border-pink-200'
    }
};

export function StatCard({ stat, onClick, compact = false }: StatCardProps) {
    const styles = colorStyles[stat.color || 'blue'];

    const changeIcon = stat.change?.type === 'increase' ? '↑' : stat.change?.type === 'decrease' ? '↓' : '→';
    const changeColor = stat.change?.type === 'increase' ? 'text-green-600' : stat.change?.type === 'decrease' ? 'text-red-600' : 'text-gray-600';

    const CardContent = () => (
        <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${onClick || stat.href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''} ${compact ? 'p-4' : 'p-6'}`}>
            {stat.loading ? (
                <div className="animate-pulse">
                    <div className="flex items-center justify-between mb-4">
                        <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
                        <div className="h-4 w-16 bg-gray-200 rounded"></div>
                    </div>
                    <div className="h-8 w-24 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between mb-4">
                        {stat.icon && (
                            <div className={`${styles.bg} ${styles.icon} p-3 rounded-lg`}>
                                {stat.icon}
                            </div>
                        )}
                        {stat.change && (
                            <span className={`text-sm font-medium ${changeColor} flex items-center gap-1`}>
                                <span>{changeIcon}</span>
                                <span>{stat.change.value}</span>
                                {stat.change.period && (
                                    <span className="text-xs text-gray-500">
                                        {stat.change.period}
                                    </span>
                                )}
                            </span>
                        )}
                    </div>

                    <div className={compact ? 'space-y-1' : 'space-y-2'}>
                        <p className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>
                            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                        </p>
                        <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600 font-medium`}>
                            {stat.label}
                        </p>
                        {stat.description && !compact && (
                            <p className="text-xs text-gray-500 mt-1">
                                {stat.description}
                            </p>
                        )}
                    </div>

                    {stat.trend && stat.trend.length > 0 && !compact && (
                        <div className="mt-4 flex items-end h-12 gap-1">
                            {stat.trend.map((value, index) => {
                                const maxValue = Math.max(...stat.trend!);
                                const height = (value / maxValue) * 100;
                                return (
                                    <div
                                        key={index}
                                        className={`flex-1 ${styles.bg} rounded-t`}
                                        style={{ height: `${height}%` }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );

    if (stat.href) {
        return (
            <Link to={stat.href}>
                <CardContent />
            </Link>
        );
    }

    if (onClick) {
        return (
            <button onClick={onClick} className="w-full text-left">
                <CardContent />
            </button>
        );
    }

    return <CardContent />;
}

interface StatCardsGridProps {
    stats: StatCardData[];
    columns?: 2 | 3 | 4;
    compact?: boolean;
}

export function StatCardsGrid({ stats, columns = 4, compact = false }: StatCardsGridProps) {
    const gridCols = {
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
    };

    return (
        <div className={`grid ${gridCols[columns]} gap-4`}>
            {stats.map((stat) => (
                <StatCard key={stat.id} stat={stat} compact={compact} />
            ))}
        </div>
    );
}
