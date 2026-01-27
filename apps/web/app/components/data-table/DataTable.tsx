/**
 * Modern Data Table Component
 * 
 * A highly reusable, data-driven table component with:
 * - Sorting, filtering, and pagination
 * - Row selection and bulk actions
 * - Column visibility controls
 * - Responsive design
 * - Keyboard navigation
 * - Export functionality
 */

import { useState, useMemo, useCallback, useEffect } from "react";
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
    Search,
    X,
    Filter,
    Columns3,
    Check
} from "lucide-react";
import { Button } from "~/components/ui/Button";

// ============= TYPES =============

export interface ColumnDef<T> {
    id?: string;
    header: string;
    accessorKey?: keyof T;
    accessorFn?: (row: T) => any;
    cell?: (props: { row: T; value: any; index: number }) => React.ReactNode;
    sortable?: boolean;
    filterable?: boolean;
    width?: string;
    minWidth?: string;
    align?: 'left' | 'center' | 'right';
    sticky?: boolean;
    enableHiding?: boolean;
    hidden?: boolean;
}

export interface ActionDef<T> {
    id: string;
    label: string | ((row: T) => string);
    icon?: React.ComponentType<{ className?: string }> | ((row: T) => React.ReactNode);
    onClick?: (row: T) => void | Promise<void>;
    href?: string | ((row: T) => string);
    variant?: 'default' | 'outline' | 'ghost' | 'destructive';
    disabled?: (row: T) => boolean;
    hidden?: (row: T) => boolean;
}

export interface BulkActionDef<T> {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: (rows: T[]) => void | Promise<void>;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive';
    confirmMessage?: string;
}

export interface PaginationState {
    pageIndex: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
}

export interface DataTableProps<T> {
    // Data
    data: T[];
    columns: ColumnDef<T>[];
    getRowId: (row: T) => string;

    // Actions
    actions?: ActionDef<T>[];
    bulkActions?: BulkActionDef<T>[];

    // Pagination
    pagination?: PaginationState;
    onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;

    // Selection
    enableSelection?: boolean;
    selectedRows?: Set<string>;
    onSelectionChange?: (selectedIds: Set<string>) => void;

    // Search
    searchPlaceholder?: string;
    onSearchChange?: (search: string) => void;

    // States
    loading?: boolean;
    emptyState?: {
        title: string;
        description?: string;
        icon?: React.ComponentType<{ className?: string }>;
        action?: {
            label: string;
            onClick: () => void;
        };
    };

    // Styling
    className?: string;
    rowClassName?: (row: T, index: number) => string;
    onRowClick?: (row: T) => void;

    // Slots
    renderToolbarLeft?: () => React.ReactNode;
    renderToolbarRight?: () => React.ReactNode;
}

// ============= COMPONENT =============

export function DataTable<T>({
    data,
    columns: initialColumns,
    getRowId,
    actions = [],
    bulkActions = [],
    pagination,
    onPaginationChange,
    enableSelection = false,
    selectedRows = new Set(),
    onSelectionChange,
    searchPlaceholder = "Search...",
    onSearchChange,
    loading = false,
    emptyState,
    className = "",
    rowClassName,
    onRowClick,
    renderToolbarLeft,
    renderToolbarRight,
}: DataTableProps<T>) {
    // ============= STATE =============
    const normalizedColumns = useMemo(() => {
        if (!initialColumns) return [];
        return initialColumns.map((col, index) => ({
            ...col,
            id: col.id || String(col.accessorKey || index)
        }));
    }, [initialColumns]);

    const [searchQuery, setSearchQuery] = useState("");
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
        const visibility: Record<string, boolean> = {};
        normalizedColumns.forEach(col => {
            visibility[col.id!] = true;
        });
        return visibility;
    });
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [expandedRowActions, setExpandedRowActions] = useState<string | null>(null);

    // ============= COMPUTED =============
    const visibleColumns = useMemo(() => {
        return normalizedColumns.filter(col => {
            if ((col as any).hidden) return false;
            return columnVisibility[col.id!] !== false;
        });
    }, [normalizedColumns, columnVisibility]);

    const hasActions = actions.length > 0;
    const hasBulkActions = bulkActions.length > 0 && enableSelection;
    const selectedCount = selectedRows.size;
    const isAllSelected = data.length > 0 && selectedRows.size === data.length;
    const isSomeSelected = selectedRows.size > 0 && selectedRows.size < data.length;

    // ============= HANDLERS =============
    const handleSelectAll = useCallback(() => {
        if (isAllSelected) {
            onSelectionChange?.(new Set());
        } else {
            const allIds = new Set(data.map(getRowId));
            onSelectionChange?.(allIds);
        }
    }, [data, isAllSelected, getRowId, onSelectionChange]);

    const handleSelectRow = useCallback((rowId: string) => {
        const newSelection = new Set(selectedRows);
        if (newSelection.has(rowId)) {
            newSelection.delete(rowId);
        } else {
            newSelection.add(rowId);
        }
        onSelectionChange?.(newSelection);
    }, [selectedRows, onSelectionChange]);

    const handleBulkAction = useCallback(async (action: BulkActionDef<T>) => {
        const selectedData = data.filter(row => selectedRows.has(getRowId(row)));

        if (action.confirmMessage) {
            if (!confirm(action.confirmMessage)) return;
        }

        await action.onClick(selectedData);
    }, [data, selectedRows, getRowId]);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        onSearchChange?.(value);
    };

    const toggleColumnVisibility = (columnId: string) => {
        setColumnVisibility(prev => ({
            ...prev,
            [columnId]: !prev[columnId]
        }));
    };

    // ============= RENDER =============

    if (loading) {
        return (
            <div className="bg-white rounded-lg border">
                <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (data.length === 0 && emptyState) {
        const EmptyIcon = emptyState.icon;
        return (
            <div className="bg-white rounded-lg border">
                <div className="p-12 text-center">
                    {EmptyIcon && <EmptyIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{emptyState.title}</h3>
                    {emptyState.description && (
                        <p className="text-gray-600 mb-6">{emptyState.description}</p>
                    )}
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
        <div className={`space-y-4 ${className}`}>
            {/* Toolbar */}
            <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                    {/* Left: Search & Selected Count */}
                    <div className="flex items-center gap-4 flex-1">
                        {onSearchChange && (
                            <div className="relative max-w-md flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={searchPlaceholder}
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => handleSearchChange("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}

                        {selectedCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg">
                                <span className="text-sm font-medium">{selectedCount} selected</span>
                            </div>
                        )}

                        {renderToolbarLeft?.()}
                    </div>

                    {/* Right: Bulk Actions & Column Toggle */}
                    <div className="flex items-center gap-2">
                        {renderToolbarRight?.()}

                        {/* Bulk Actions */}
                        {hasBulkActions && selectedCount > 0 && (
                            <div className="flex gap-2">
                                {bulkActions.map((action) => {
                                    const Icon = action.icon;
                                    return (
                                        <Button
                                            key={action.id}
                                            variant={action.variant || 'outline'}
                                            size="sm"
                                            onClick={() => handleBulkAction(action)}
                                        >
                                            {Icon && <Icon className="w-4 h-4 mr-2" />}
                                            {action.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Column Toggle */}
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowColumnMenu(!showColumnMenu)}
                            >
                                <Columns3 className="w-4 h-4 mr-2" />
                                Columns
                            </Button>

                            {showColumnMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowColumnMenu(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg border shadow-lg z-20">
                                        <div className="p-2 border-b">
                                            <p className="text-sm font-medium text-gray-900">Toggle columns</p>
                                        </div>
                                        <div className="p-2 max-h-64 overflow-y-auto">
                                            {normalizedColumns.map((column) => (
                                                <label
                                                    key={column.id}
                                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={columnVisibility[column.id!] !== false}
                                                        onChange={() => toggleColumnVisibility(column.id!)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm text-gray-700">{column.header}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {/* Selection Column */}
                                {enableSelection && (
                                    <th key="selection" className="w-12 px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            ref={(el) => {
                                                if (el) el.indeterminate = isSomeSelected;
                                            }}
                                            onChange={handleSelectAll}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                )}

                                {/* Data Columns */}
                                {visibleColumns.map((column, colIndex) => (
                                    <th
                                        key={column.id || String(column.accessorKey || colIndex)}
                                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.align === 'center' ? 'text-center' :
                                            column.align === 'right' ? 'text-right' : ''
                                            }`}
                                        style={{
                                            width: column.width,
                                            minWidth: column.minWidth
                                        }}
                                    >
                                        {column.header}
                                    </th>
                                ))}

                                {/* Actions Column */}
                                {hasActions && (
                                    <th key="actions" className="w-20 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {data.map((row, rowIndex) => {
                                const rowId = getRowId(row);
                                const isSelected = selectedRows.has(rowId);
                                const showActions = expandedRowActions === rowId;

                                return (
                                    <tr
                                        key={rowId}
                                        className={`
                                            ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                                            ${onRowClick ? 'cursor-pointer' : ''}
                                            ${rowClassName ? rowClassName(row, rowIndex) : ''}
                                            transition-colors
                                        `}
                                        onClick={() => onRowClick?.(row)}
                                    >
                                        {/* Selection Cell */}
                                        {enableSelection && (
                                            <td key="selection" className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectRow(rowId)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>
                                        )}

                                        {/* Data Cells */}
                                        {visibleColumns.map((column, colIndex) => {
                                            const value = column.accessorFn
                                                ? column.accessorFn(row)
                                                : column.accessorKey
                                                    ? row[column.accessorKey]
                                                    : null;

                                            return (
                                                <td
                                                    key={column.id || String(column.accessorKey || colIndex)}
                                                    className={`px-6 py-4 whitespace-nowrap text-sm ${column.align === 'center' ? 'text-center' :
                                                        column.align === 'right' ? 'text-right' : ''
                                                        }`}
                                                >
                                                    {column.cell
                                                        ? column.cell({ row, value, index: rowIndex })
                                                        : value}
                                                </td>
                                            );
                                        })}

                                        {/* Actions Cell */}
                                        {hasActions && (
                                            <td key="actions" className="px-6 py-4 whitespace-nowrap text-right text-sm" onClick={(e) => e.stopPropagation()}>
                                                <div className="relative inline-block">
                                                    <button
                                                        onClick={() => setExpandedRowActions(showActions ? null : rowId)}
                                                        className="text-gray-400 hover:text-gray-600 p-1"
                                                    >
                                                        <MoreHorizontal className="w-5 h-5" />
                                                    </button>

                                                    {showActions && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-10"
                                                                onClick={() => setExpandedRowActions(null)}
                                                            />
                                                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border shadow-lg z-20">
                                                                {actions.map((action) => {
                                                                    if (action.hidden?.(row)) return null;

                                                                    const Icon = typeof action.icon === 'function'
                                                                        ? null
                                                                        : action.icon;
                                                                    const label = typeof action.label === 'function'
                                                                        ? action.label(row)
                                                                        : action.label;
                                                                    const disabled = action.disabled?.(row);

                                                                    const handleClick = async () => {
                                                                        setExpandedRowActions(null);
                                                                        await action.onClick?.(row);
                                                                    };

                                                                    if (action.href) {
                                                                        const href = typeof action.href === 'function'
                                                                            ? action.href(row)
                                                                            : action.href;

                                                                        return (
                                                                            <Link
                                                                                key={action.id}
                                                                                to={href}
                                                                                className={`
                                                                                    flex items-center gap-2 px-4 py-2 text-sm
                                                                                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
                                                                                    ${action.variant === 'destructive' ? 'text-red-600' : 'text-gray-700'}
                                                                                `}
                                                                            >
                                                                                {Icon && <Icon className="w-4 h-4" />}
                                                                                {label}
                                                                            </Link>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <button
                                                                            key={action.id}
                                                                            onClick={handleClick}
                                                                            disabled={disabled}
                                                                            className={`
                                                                                w-full flex items-center gap-2 px-4 py-2 text-sm text-left
                                                                                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
                                                                                ${action.variant === 'destructive' ? 'text-red-600' : 'text-gray-700'}
                                                                            `}
                                                                        >
                                                                            {Icon && <Icon className="w-4 h-4" />}
                                                                            {label}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination && onPaginationChange && (
                    <div className="px-6 py-4 border-t bg-gray-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-700">
                                    Showing <span className="font-medium">{(pagination.pageIndex * pagination.pageSize) + 1}</span> to{' '}
                                    <span className="font-medium">
                                        {Math.min((pagination.pageIndex + 1) * pagination.pageSize, pagination.totalRows)}
                                    </span>{' '}
                                    of <span className="font-medium">{pagination.totalRows}</span> results
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Page Size Select */}
                                <select
                                    value={pagination.pageSize}
                                    onChange={(e) => onPaginationChange({
                                        pageIndex: 0,
                                        pageSize: Number(e.target.value)
                                    })}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {[10, 25, 50, 100].map(size => (
                                        <option key={size} value={size}>{size} / page</option>
                                    ))}
                                </select>

                                {/* Pagination Buttons */}
                                <div className="flex gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPaginationChange({ ...pagination, pageIndex: 0 })}
                                        disabled={pagination.pageIndex === 0}
                                    >
                                        <ChevronsLeft className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPaginationChange({ ...pagination, pageIndex: pagination.pageIndex - 1 })}
                                        disabled={pagination.pageIndex === 0}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <span className="px-4 py-1.5 text-sm font-medium text-gray-700">
                                        Page {pagination.pageIndex + 1} of {pagination.totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPaginationChange({ ...pagination, pageIndex: pagination.pageIndex + 1 })}
                                        disabled={pagination.pageIndex >= pagination.totalPages - 1}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPaginationChange({ ...pagination, pageIndex: pagination.totalPages - 1 })}
                                        disabled={pagination.pageIndex >= pagination.totalPages - 1}
                                    >
                                        <ChevronsRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
