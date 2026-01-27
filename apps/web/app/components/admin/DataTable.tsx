import { useState, useMemo } from "react";
import { Link } from "react-router";
import {
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    MoreHorizontal,
    Search,
    X
} from "lucide-react";
import { Button } from "~/components/ui/Button";

interface Column<T> {
    key: keyof T | string;
    label: string;
    sortable?: boolean;
    render?: (value: any, row: T) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
}

interface Action<T> {
    label: string | ((row: T) => string);
    icon?: React.ReactNode | ((row: T) => React.ReactNode);
    onClick?: (row: T) => void;
    to?: string | ((row: T) => string);
    variant?: 'default' | 'outline' | 'ghost' | 'destructive';
    disabled?: boolean | ((row: T) => boolean);
    show?: (row: T) => boolean;
}

interface FilterConfig {
    key: string;
    label: string;
    type: 'text' | 'select' | 'date' | 'number';
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
}

interface StatCard {
    label: string;
    value: string | number;
    change?: {
        value: string;
        type: 'increase' | 'decrease' | 'neutral';
    };
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    actions?: Action<T>[];
    filters?: FilterConfig[];
    stats?: StatCard[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        onPageChange: (page: number) => void;
        onLimitChange: (limit: number) => void;
    };
    loading?: boolean;
    emptyState?: {
        title: string;
        description: string;
        action?: {
            label: string;
            onClick: () => void;
        };
    };
    onRowClick?: (row: T) => void;
    selectable?: boolean;
    selectedRows?: string[];
    onSelectionChange?: (selectedIds: string[]) => void;
    getRowId?: (row: T) => string;
    initialSort?: {
        key: keyof T;
        direction: 'asc' | 'desc';
    };
}

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    actions = [],
    filters = [],
    stats = [],
    pagination,
    loading = false,
    emptyState,
    onRowClick,
    selectable = false,
    selectedRows = [],
    onSelectionChange,
    getRowId = (row) => row.id,
    initialSort
}: DataTableProps<T>) {
    const [sort, setSort] = useState(initialSort || { key: columns[0]?.key, direction: 'asc' as const });
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [showFilters, setShowFilters] = useState(false);

    // Handle sorting
    const sortedData = useMemo(() => {
        if (!sort.key) return data;

        return [...data].sort((a, b) => {
            const aValue = a[sort.key];
            const bValue = b[sort.key];

            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sort.direction === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }

            return 0;
        });
    }, [data, sort]);

    // Handle filtering
    const filteredData = useMemo(() => {
        return sortedData.filter(row => {
            return Object.entries(filterValues).every(([key, value]) => {
                if (!value) return true;
                const cellValue = row[key];
                return cellValue?.toString().toLowerCase().includes(value.toLowerCase());
            });
        });
    }, [sortedData, filterValues]);

    // Handle selection
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = filteredData.map(getRowId);
            onSelectionChange?.(allIds);
        } else {
            onSelectionChange?.([]);
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelection = checked
            ? [...selectedRows, id]
            : selectedRows.filter(selectedId => selectedId !== id);
        onSelectionChange?.(newSelection);
    };

    const isAllSelected = filteredData.length > 0 && selectedRows.length === filteredData.length;
    const isIndeterminate = selectedRows.length > 0 && selectedRows.length < filteredData.length;

    const handleSort = (key: keyof T) => {
        if (sort.key === key) {
            setSort({
                key,
                direction: sort.direction === 'asc' ? 'desc' : 'asc'
            });
        } else {
            setSort({ key, direction: 'asc' });
        }
    };

    const getSortIcon = (column: Column<T>) => {
        if (!column.sortable) return <ChevronsUpDown className="w-4 h-4" />;

        if (sort.key !== column.key) return <ChevronsUpDown className="w-4 h-4" />;

        return sort.direction === 'asc'
            ? <ChevronUp className="w-4 h-4" />
            : <ChevronDown className="w-4 h-4" />;
    };

    const getStatColor = (color?: string) => {
        const colors = {
            blue: 'text-blue-600',
            green: 'text-green-600',
            yellow: 'text-yellow-600',
            red: 'text-red-600',
            purple: 'text-purple-600'
        };
        return colors[color as keyof typeof colors] || 'text-gray-600';
    };

    const getChangeColor = (type: 'increase' | 'decrease' | 'neutral') => {
        const colors = {
            increase: 'text-green-600',
            decrease: 'text-red-600',
            neutral: 'text-gray-600'
        };
        return colors[type];
    };

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            {stats.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, index) => (
                        <div key={index} className="bg-white p-6 rounded-lg border">
                            <h3 className="text-sm font-medium text-gray-500">{stat.label}</h3>
                            <p className={`text-2xl font-bold ${getStatColor(stat.color)}`}>
                                {stat.value}
                            </p>
                            {stat.change && (
                                <p className={`text-sm mt-1 ${getChangeColor(stat.change.type)}`}>
                                    {stat.change.value}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            {filters.length > 0 && (
                <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-700">Filters</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            {showFilters ? 'Hide' : 'Show'} Filters
                        </Button>
                    </div>

                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {filters.map((filter) => (
                                <div key={filter.key}>
                                    {filter.type === 'text' && (
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder={filter.placeholder || `Search ${filter.label}...`}
                                                value={filterValues[filter.key] || ''}
                                                onChange={(e) => setFilterValues(prev => ({
                                                    ...prev,
                                                    [filter.key]: e.target.value
                                                }))}
                                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}

                                    {filter.type === 'select' && (
                                        <select
                                            value={filterValues[filter.key] || ''}
                                            onChange={(e) => setFilterValues(prev => ({
                                                ...prev,
                                                [filter.key]: e.target.value
                                            }))}
                                            className="px-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">All {filter.label}</option>
                                            {filter.options?.map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            ))}

                            {(Object.values(filterValues).some(v => v)) && (
                                <Button
                                    variant="outline"
                                    onClick={() => setFilterValues({})}
                                    className="flex items-center"
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Clear Filters
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Selection Actions */}
            {selectable && selectedRows.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-700">
                            {selectedRows.length} item{selectedRows.length > 1 ? 's' : ''} selected
                        </span>
                        <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                                Export Selected
                            </Button>
                            <Button variant="destructive" size="sm">
                                Delete Selected
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                {selectable && (
                                    <th className="px-6 py-3 w-12">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            ref={(el) => {
                                                if (el) el.indeterminate = isIndeterminate;
                                            }}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                )}
                                {columns.map((column) => (
                                    <th
                                        key={String(column.key)}
                                        className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${column.align === 'center' ? 'text-center' :
                                            column.align === 'right' ? 'text-right' : 'text-left'
                                            }`}
                                        style={{ width: column.width }}
                                    >
                                        {column.sortable ? (
                                            <button
                                                onClick={() => handleSort(column.key)}
                                                className="flex items-center space-x-1 hover:text-gray-700"
                                            >
                                                <span>{column.label}</span>
                                                {getSortIcon(column)}
                                            </button>
                                        ) : (
                                            <span>{column.label}</span>
                                        )}
                                    </th>
                                ))}
                                {actions.length > 0 && (
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)} className="px-6 py-12 text-center">
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                            <span className="ml-2 text-gray-500">Loading...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)} className="px-6 py-12 text-center">
                                        {emptyState ? (
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                                    {emptyState.title}
                                                </h3>
                                                <p className="text-gray-500 mb-4">{emptyState.description}</p>
                                                {emptyState.action && (
                                                    <Button onClick={emptyState.action.onClick}>
                                                        {emptyState.action.label}
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-900 mb-2">No data found</h3>
                                                <p className="text-gray-500">Try adjusting your filters.</p>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row) => {
                                    const rowId = getRowId(row);
                                    const isSelected = selectedRows.includes(rowId);
                                    const visibleActions = actions.filter(action =>
                                        !action.show || action.show(row)
                                    );

                                    return (
                                        <tr
                                            key={rowId}
                                            className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''} ${isSelected ? 'bg-blue-50' : ''}`}
                                            onClick={() => onRowClick?.(row)}
                                        >
                                            {selectable && (
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectRow(rowId, e.target.checked);
                                                        }}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </td>
                                            )}
                                            {columns.map((column) => (
                                                <td
                                                    key={String(column.key)}
                                                    className={`px-6 py-4 whitespace-nowrap ${column.align === 'center' ? 'text-center' :
                                                        column.align === 'right' ? 'text-right' : 'text-left'
                                                        }`}
                                                >
                                                    {column.render
                                                        ? column.render(row[column.key], row)
                                                        : row[column.key]
                                                    }
                                                </td>
                                            ))}
                                            {visibleActions.length > 0 && (
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        {visibleActions.slice(0, 2).map((action, index) => {
                                                            const disabled = typeof action.disabled === 'function'
                                                                ? action.disabled(row)
                                                                : action.disabled;

                                                            const actionIcon = typeof action.icon === 'function'
                                                                ? action.icon(row)
                                                                : action.icon;

                                                            const actionTo = typeof action.to === 'function'
                                                                ? action.to(row)
                                                                : action.to;

                                                            return (
                                                                <Button
                                                                    key={index}
                                                                    variant={action.variant || 'ghost'}
                                                                    size="sm"
                                                                    disabled={disabled}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (actionTo) {
                                                                            window.location.href = actionTo;
                                                                        } else if (action.onClick) {
                                                                            action.onClick(row);
                                                                        }
                                                                    }}
                                                                    className="p-1"
                                                                >
                                                                    {actionIcon}
                                                                </Button>
                                                            );
                                                        })}
                                                        {visibleActions.length > 2 && (
                                                            <Button variant="ghost" size="sm" className="p-1">
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                        {pagination.total} results
                    </div>
                    <div className="flex items-center space-x-2">
                        <select
                            value={pagination.limit}
                            onChange={(e) => pagination.onLimitChange(Number(e.target.value))}
                            className="border border-gray-300 rounded px-3 py-1 text-sm"
                        >
                            <option value={10}>10 per page</option>
                            <option value={20}>20 per page</option>
                            <option value={50}>50 per page</option>
                            <option value={100}>100 per page</option>
                        </select>

                        <div className="flex space-x-1">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page === 1}
                                onClick={() => pagination.onPageChange(pagination.page - 1)}
                            >
                                Previous
                            </Button>

                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                let pageNum;
                                if (pagination.totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (pagination.page <= 3) {
                                    pageNum = i + 1;
                                } else if (pagination.page >= pagination.totalPages - 2) {
                                    pageNum = pagination.totalPages - 4 + i;
                                } else {
                                    pageNum = pagination.page - 2 + i;
                                }

                                return (
                                    <Button
                                        key={pageNum}
                                        variant={pageNum === pagination.page ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => pagination.onPageChange(pageNum)}
                                    >
                                        {pageNum}
                                    </Button>
                                );
                            })}

                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page === pagination.totalPages}
                                onClick={() => pagination.onPageChange(pagination.page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
