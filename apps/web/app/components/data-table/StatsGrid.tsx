/**
 * Stats Card Component
 * 
 * Displays key metrics and statistics with:
 * - Trend indicators
 * - Custom icons
 * - Responsive layout
 * - Loading states
 */

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface StatCard {
    id: string;
    label: string;
    value: string | number;
    icon?: React.ComponentType<{ className?: string }>;
    trend?: {
        value: number;
        label: string;
        direction: 'up' | 'down' | 'neutral';
    };
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
    onClick?: () => void;
}

export interface StatsGridProps {
    stats: StatCard[];
    loading?: boolean;
    className?: string;
}

const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600',
};

const trendClasses = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600',
};

export function StatsGrid({ stats, loading = false, className = '' }: StatsGridProps) {
    if (loading) {
        return (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                        <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(stats.length, 4)} gap-4 ${className}`}>
            {stats.map(stat => {
                const Icon = stat.icon;
                const TrendIcon = stat.trend
                    ? stat.trend.direction === 'up'
                        ? TrendingUp
                        : stat.trend.direction === 'down'
                            ? TrendingDown
                            : Minus
                    : null;

                return (
                    <div
                        key={stat.id}
                        className={`
                            bg-white rounded-lg border p-6 transition-all
                            ${stat.onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300' : ''}
                        `}
                        onClick={stat.onClick}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                            {Icon && (
                                <div className={`p-2 rounded-lg ${colorClasses[stat.color || 'gray']}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>

                            {stat.trend && TrendIcon && (
                                <div className="flex items-center gap-1">
                                    <TrendIcon className={`w-4 h-4 ${trendClasses[stat.trend.direction]}`} />
                                    <span className={`text-sm font-medium ${trendClasses[stat.trend.direction]}`}>
                                        {Math.abs(stat.trend.value)}%
                                    </span>
                                    <span className="text-sm text-gray-500">{stat.trend.label}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
