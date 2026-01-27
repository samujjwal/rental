import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router";
import {
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Download,
    Eye,
    EyeOff
} from "lucide-react";
import { Button } from "~/components/ui/Button";

export interface TableColumn<T> {
    key: keyof T | string;
    label: string;
    sortable?: boolean;
    filterable?: boolean;
    render?: (value: any, row: T, index: number) => React.ReactNode;
    width?: string;
    minWidth?: string;
    align?: 'left' | 'center' | 'right';
    hide?: boolean;
    sticky?: boolean;
}

export interface TableAction<T> {
    label: string | ((row: T) => string);
    icon?: React.ReactNode | ((row: T) => React.ReactNode);
    onClick?: (row: T, event: React.MouseEvent) => void;
    to?: string | ((row: T) => string);
    variant?: 'default' | 'outline' | 'ghost' | 'destructive';
    disabled?: boolean | ((row: T) => boolean);
    show?: (row: T) => boolean;
    className?: string;
}

export interface BulkAction<T> {
    label: string;
    icon?: React.ReactNode;
    onClick: (selectedRows: T[]) => void;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive';
    confirm?: {
        title: string;
        description: string;
    };
}

export interface TablePagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}

interface EnhancedDataTableProps<T extends Record<string, any>> {
    data: T[];
    columns: TableColumn<T>[];
    actions?: TableAction<T>[];
    bulkActions?: BulkAction<T>[];
    pagination?: TablePagination;
    loading?: boolean;
    emptyState?: {
        title: string;
        description: string;
        icon?: React.ReactNode;
        action?: {
            label: string;
            onClick: () => void;
        };
    };
    onRowClick?: (row: T, index: number) => void;
    selectable?: boolean;
    selectedRows?: Set<string>;
    onSelectionChange?: (selectedIds: Set<string>) => void;
    getRowId?: (row: T) => string;
    initialSort?: {
        key: keyof T;
        direction: 'asc' | 'desc';
    };
    rowClassName?: (row: T, index: number) => string;
    stickyHeader?: boolean;
    compactMode?: boolean;
    showRowNumbers?: boolean;
    exportable?: boolean;
    onExport?: () => void;
    columnToggle?: boolean;
}

export function EnhancedDataTable<T extends Record<string, any>>({
    data,
    columns: initialColumns,
    actions = [],
    bulkActions = [],
    pagination,
    loading = false,
    emptyState,
    onRowClick,
    selectable = false,
    selectedRows = new Set(),
    onSelectionChange,
    getRowId = (row) => row.id,
    initialSort,
    rowClassName,
    stickyHeader = true,
    compactMode = false,
    showRowNumbers = false,
    exportable = false,
    onExport,
    columnToggle = true
}: EnhancedDataTableProps<T>) {
    const [sort, setSort] = useState(initialSort || null);
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
    const [showColumnToggle, setShowColumnToggle] = useState(false);

    // Filter out hidden columns
    const columns = useMemo(() => 
        initialColumns.filter(col => !hiddenColumns.has(col.key as string)),
        [initialColumns, hiddenColumns]
    );

    // Handle sorting
    const sortedData = useMemo(() => {
        if (!sort?.key) return data;

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

            // Handle dates (as strings)
            const aDate = new Date(aValue);
            const bDate = new Date(bValue);
            if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                return sort.direction === 'asc' 
                    ? aDate.getTime() - bDate.getTime()
                    : bDate.getTime() - aDate.getTime();
            }

            return 0;
        });
    }, [data, sort]);

    // Handle selection
    const isAllSelected = selectedRows.size > 0 && selectedRows.size === data.length;
    const isSomeSelected = selectedRows.size > 0 && selectedRows.size < data.length;

    const handleSelectAll = useCallback(() => {
        if (isAllSelected) {
            onSelectionChange?.(new Set());
        } else {
            const allIds = data.map(getRowId);
            onSelectionChange?.(new Set(allIds));
        }
    }, [isAllSelected, data, getRowId, onSelectionChange]);

    const handleSelectRow = useCallback((id: string) => {
        const newSelection = new Set(selectedRows);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        onSelectionChange?.(newSelection);
    }, [selectedRows, onSelectionChange]);

    const handleSort = (columnKey: keyof T) => {
        const column = columns.find(col => col.key === columnKey);
        if (!column?.sortable) return;

        setSort(prev => {
            if (!prev || prev.key !== columnKey) {
                return { key: columnKey, direction: 'asc' };
            }
            if (prev.direction === 'asc') {
                return { key: columnKey, direction: 'desc' };
            }
            return null; // Reset sort
        });
    };

    const getSortIcon = (columnKey: keyof T) => {
        if (!sort || sort.key !== columnKey) {
            return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
        }
        return sort.direction === 'asc' 
            ? <ChevronUp className="w-4 h-4 text-blue-600" />
            : <ChevronDown className="w-4 h-4 text-blue-600" />;
    };

    const toggleColumn = (columnKey: string) => {
        setHiddenColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(columnKey)) {
                newSet.delete(columnKey);
            } else {
                newSet.add(columnKey);
            }
            return newSet;
        });
    };

    const getSelectedRows = () => {
        return data.filter(row => selectedRows.has(getRowId(row)));
    };

    // Render action buttons for a row
    const renderActions = (row: T) => {
        const visibleActions = actions.filter(action => 
            action.show ? action.show(row) : true
        );

        if (visibleActions.length === 0) return null;

        const primaryActions = visibleActions.slice(0, 2);
        const moreActions = visibleActions.slice(2);

        return (
            <div className="flex items-center gap-1">
                {primaryActions.map((action, idx) => {
                    const label = typeof action.label === 'function' ? action.label(row) : action.label;
                    const icon = typeof action.icon === 'function' ? action.icon(row) : action.icon;
                    const disabled = typeof action.disabled === 'function' ? action.disabled(row) : action.disabled;
                    const to = typeof action.to === 'function' ? action.to(row) : action.to;

                    const buttonContent = (
                        <>
                            {icon}
                            {!compactMode && <span>{label}</span>}
                        </>
                    );

                    const className = `${action.className || ''} ${compactMode ? 'px-2' : ''}`;

                    if (to) {
                        return (
                            <Link 
                                key={idx}
                                to={to} 
                                onClick={(e) => e.stopPropagation()}
                                className={`inline-flex items-center justify-center h-8 px-3 text-sm rounded-md font-medium transition-colors ${
                                    action.variant === 'destructive' ? 'bg-red-600 text-white hover:bg-red-700' :
                                    action.variant === 'outline' ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50' :
                                    action.variant === 'default' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                                    'hover:bg-gray-100 text-gray-700'
                                } ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
                            >
                                {buttonContent}
                            </Link>
                        );
                    }

                    return (
                        <Button
                            key={idx}
                            variant={action.variant || 'ghost'}
                            size="sm"
                            disabled={disabled}
                            className={className}
                            onClick={(e) => {
                                e.stopPropagation();
                                action.onClick?.(row, e);
                            }}
                        >
                            {buttonContent}
                        </Button>
                    );
                })}

                {moreActions.length > 0 && (
                    <div className="relative group">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </Button>
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10">
                            {moreActions.map((action, idx) => {
                                const label = typeof action.label === 'function' ? action.label(row) : action.label;
                                const icon = typeof action.icon === 'function' ? action.icon(row) : action.icon;
                                const disabled = typeof action.disabled === 'function' ? action.disabled(row) : action.disabled;

                                return (
                                    <button
                                        key={idx}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={disabled}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            action.onClick?.(row, e);
                                        }}
                                    >
                                        {icon}
                                        <span>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-8 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-gray-500">Loading data...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (data.length === 0 && emptyState) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-12 flex flex-col items-center justify-center text-center">
                    {emptyState.icon && (
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                            {emptyState.icon}
                        </div>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {emptyState.title}
                    </h3>
                    <p className="text-gray-500 mb-6 max-w-md">
                        {emptyState.description}
                    </p>
                    {emptyState.action && (
                        <Button onClick={emptyState.action.onClick}>
                            {emptyState.action.label}
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Table Header with Actions */}
            {(selectable && selectedRows.size > 0) || exportable || columnToggle ? (
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {selectable && selectedRows.size > 0 && (
                            <>
                                <span className="text-sm text-gray-600">
                                    {selectedRows.size} selected
                                </span>
                                {bulkActions.map((action, idx) => (
                                    <Button
                                        key={idx}
                                        variant={action.variant || 'outline'}
                                        size="sm"
                                        onClick={() => action.onClick(getSelectedRows())}
                                    >
                                        {action.icon}
                                        <span>{action.label}</span>
                                    </Button>
                                ))}
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {exportable && onExport && (
                            <Button variant="outline" size="sm" onClick={onExport}>
                                <Download className="w-4 h-4" />
                                Export
                            </Button>
                        )}
                        
                        {columnToggle && (
                            <div className="relative">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowColumnToggle(!showColumnToggle)}
                                >
                                    {hiddenColumns.size > 0 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    Columns
                                </Button>
                                
                                {showColumnToggle && (
                                    <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
                                        <div className="p-2">
                                            {initialColumns.map(column => (
                                                <label
                                                    key={column.key as string}
                                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={!hiddenColumns.has(column.key as string)}
                                                        onChange={() => toggleColumn(column.key as string)}
                                                        className="rounded border-gray-300"
                                                    />
                                                    <span className="text-sm">{column.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className={`bg-gray-50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
                        <tr>
                            {selectable && (
                                <th className="w-12 px-4 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        ref={input => {
                                            if (input) input.indeterminate = isSomeSelected;
                                        }}
                                        onChange={handleSelectAll}
                                        className="rounded border-gray-300"
                                    />
                                </th>
                            )}
                            {showRowNumbers && (
                                <th className="w-16 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    #
                                </th>
                            )}
                            {columns.map((column) => (
                                <th
                                    key={column.key as string}
                                    className={`px-4 py-3 text-${column.align || 'left'} text-xs font-medium text-gray-500 uppercase tracking-wider ${
                                        column.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''
                                    }`}
                                    style={{ width: column.width, minWidth: column.minWidth }}
                                    onClick={() => column.sortable && handleSort(column.key as keyof T)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{column.label}</span>
                                        {column.sortable && getSortIcon(column.key as keyof T)}
                                    </div>
                                </th>
                            ))}
                            {actions.length > 0 && (
                                <th className="w-32 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedData.map((row, index) => {
                            const rowId = getRowId(row);
                            const isSelected = selectedRows.has(rowId);
                            const customClassName = rowClassName ? rowClassName(row, index) : '';

                            return (
                                <tr
                                    key={rowId}
                                    className={`${
                                        onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                                    } ${isSelected ? 'bg-blue-50' : ''} ${customClassName} transition-colors ${
                                        compactMode ? 'text-sm' : ''
                                    }`}
                                    onClick={() => onRowClick?.(row, index)}
                                >
                                    {selectable && (
                                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleSelectRow(rowId)}
                                                className="rounded border-gray-300"
                                            />
                                        </td>
                                    )}
                                    {showRowNumbers && (
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {((pagination?.page || 1) - 1) * (pagination?.limit || 10) + index + 1}
                                        </td>
                                    )}
                                    {columns.map((column) => {
                                        const value = row[column.key];
                                        return (
                                            <td
                                                key={column.key as string}
                                                className={`px-4 ${compactMode ? 'py-2' : 'py-3'} text-${column.align || 'left'}`}
                                            >
                                                {column.render ? column.render(value, row, index) : value}
                                            </td>
                                        );
                                    })}
                                    {actions.length > 0 && (
                                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                            {renderActions(row)}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-700">
                            Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
                            <span className="font-medium">
                                {Math.min(pagination.page * pagination.limit, pagination.total)}
                            </span>{' '}
                            of <span className="font-medium">{pagination.total}</span> results
                        </span>

                        <select
                            value={pagination.limit}
                            onChange={(e) => pagination.onLimitChange(Number(e.target.value))}
                            className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                        >
                            <option value={10}>10 per page</option>
                            <option value={25}>25 per page</option>
                            <option value={50}>50 per page</option>
                            <option value={100}>100 per page</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pagination.onPageChange(1)}
                            disabled={pagination.page === 1}
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pagination.onPageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>

                        {/* Page numbers */}
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            let pageNumber;
                            if (pagination.totalPages <= 5) {
                                pageNumber = i + 1;
                            } else if (pagination.page <= 3) {
                                pageNumber = i + 1;
                            } else if (pagination.page >= pagination.totalPages - 2) {
                                pageNumber = pagination.totalPages - 4 + i;
                            } else {
                                pageNumber = pagination.page - 2 + i;
                            }

                            return (
                                <Button
                                    key={pageNumber}
                                    variant={pagination.page === pageNumber ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => pagination.onPageChange(pageNumber)}
                                    className="w-10"
                                >
                                    {pageNumber}
                                </Button>
                            );
                        })}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pagination.onPageChange(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pagination.onPageChange(pagination.totalPages)}
                            disabled={pagination.page === pagination.totalPages}
                        >
                            <ChevronsRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
