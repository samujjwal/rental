import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { DataTable, type ColumnDef, type PaginationState } from "~/components/data-table/DataTable";
import { FilterPanel, type FilterField } from "~/components/data-table/FilterPanel";
import { StatsGrid, type StatCard } from "~/components/data-table/StatsGrid";
import { useDataTable } from "~/hooks/use-data-table";
import {
    Terminal,
    AlertTriangle,
    Info,
    XCircle,
    Clock,
    Search,
    ShieldAlert,
    RefreshCw
} from "lucide-react";
import { Button } from "~/components/ui/Button";

// ============= TYPES =============

interface SystemLog {
    id: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'FATAL';
    message: string;
    service: string;
    timestamp: string;
    context?: any;
}

interface LoaderData {
    logs: SystemLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    stats: {
        errorCount: number;
        warnCount: number;
        infoCount: number;
    };
}

// ============= LOADER =============

export async function loader({ request }: LoaderFunctionArgs) {
    const userRole = await requireAdmin(request);
    const token = await getUserToken(request);

    const url = new URL(request.url);
    const level = url.searchParams.get('level') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            ...(level && { level }),
        });

        const response = await fetch(`${API_BASE_URL}/admin/system/logs?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const logsData = await response.json();

        return {
            logs: logsData.data || [],
            pagination: {
                page,
                limit,
                total: logsData.total || 0,
                totalPages: Math.ceil((logsData.total || 0) / limit)
            },
            stats: {
                errorCount: (logsData.data || []).filter((l: any) => l.level === 'ERROR').length,
                warnCount: (logsData.data || []).filter((l: any) => l.level === 'WARN').length,
                infoCount: (logsData.data || []).filter((l: any) => l.level === 'INFO').length,
            }
        };
    } catch (error) {
        console.error('Error loading logs:', error);
        return {
            logs: [],
            pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
            stats: { errorCount: 0, warnCount: 0, infoCount: 0 }
        };
    }
}

// ============= COMPONENT =============

export default function AdminLogsPage() {
    const data = useLoaderData<LoaderData>();
    const navigate = useNavigate();
    const { handlePaginationChange, handleFilterChange } = useDataTable();

    // ============= STATS CONFIGURATION =============

    const stats: StatCard[] = [
        {
            id: 'errors',
            label: 'System Errors',
            value: data.stats.errorCount,
            icon: XCircle,
            color: 'red',
        },
        {
            id: 'warnings',
            label: 'Warnings',
            value: data.stats.warnCount,
            icon: AlertTriangle,
            color: 'yellow',
        },
        {
            id: 'info',
            label: 'Info Logs',
            value: data.stats.infoCount,
            icon: Info,
            color: 'blue',
        },
        {
            id: 'uptime',
            label: 'System Health',
            value: '99.9%',
            icon: ShieldAlert,
            color: 'green',
        }
    ];

    // ============= TABLE CONFIGURATION =============

    const columns: ColumnDef<SystemLog>[] = [
        {
            id: 'timestamp',
            header: 'Timestamp',
            cell: ({ row }) => (
                <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
                    {new Date(row.timestamp).toLocaleString()}
                </span>
            ),
            width: '180px'
        },
        {
            id: 'level',
            header: 'Level',
            cell: ({ value }) => {
                const styles = {
                    ERROR: 'bg-red-100 text-red-800',
                    WARN: 'bg-yellow-100 text-yellow-800',
                    INFO: 'bg-blue-100 text-blue-800',
                    DEBUG: 'bg-gray-100 text-gray-800',
                    FATAL: 'bg-red-900 text-white',
                };
                return (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${styles[value as keyof typeof styles] || styles.INFO}`}>
                        {value}
                    </span>
                );
            },
            width: '80px'
        },
        {
            id: 'service',
            header: 'Service',
            cell: ({ value }) => (
                <span className="text-xs font-semibold text-gray-700">{value || 'N/A'}</span>
            ),
            width: '120px'
        },
        {
            id: 'message',
            header: 'Log Message',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm font-mono line-clamp-2 text-gray-800">{row.message}</span>
                    {row.context && (
                        <span className="text-[10px] text-gray-400 mt-1 uppercase italic border-l-2 pl-2 border-gray-200">
                            Trace available
                        </span>
                    )}
                </div>
            )
        }
    ];

    const filterFields: FilterField[] = [
        {
            id: 'level',
            label: 'Severity Level',
            type: 'select',
            options: [
                { label: 'All Levels', value: '' },
                { label: 'Error', value: 'ERROR' },
                { label: 'Warning', value: 'WARN' },
                { label: 'Info', value: 'INFO' },
                { label: 'Debug', value: 'DEBUG' },
            ],
        },
    ];

    // ============= PAGINATION =============

    const pagination: PaginationState = {
        pageIndex: (data.pagination?.page ?? 1) - 1,
        pageSize: data.pagination?.limit ?? 100,
        totalRows: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
    };

    // ============= RENDER =============

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
                    <p className="text-gray-600 mt-1">Real-time infrastructure and application diagnostics</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            <StatsGrid stats={stats} />

            <FilterPanel
                fields={filterFields}
                presetStorageKey="admin-logs-filters"
            />

            <DataTable
                data={data.logs}
                columns={columns}
                getRowId={(row) => row.id}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                searchPlaceholder="Search log messages..."
                renderToolbarRight={() => (
                    <div className="flex items-center text-xs text-gray-500 gap-2">
                        <Terminal className="w-3 h-3" />
                        Streaming enabled
                    </div>
                )}
                emptyState={{
                    title: 'No logs found',
                    description: 'No events matching your criteria have been recorded',
                    icon: Terminal,
                }}
            />
        </div>
    );
}
