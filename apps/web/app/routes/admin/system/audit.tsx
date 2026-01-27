import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { DataTable, type ColumnDef, type ActionDef, type PaginationState } from "~/components/data-table/DataTable";
import { FilterPanel, type FilterField } from "~/components/data-table/FilterPanel";
import { StatsGrid, type StatCard } from "~/components/data-table/StatsGrid";
import { useDataTable } from "~/hooks/use-data-table";
import {
    Clock,
    User as UserIcon,
    Activity,
    ShieldAlert,
    Eye,
    ArrowRightLeft,
    Database,
    LogIn
} from "lucide-react";

// ============= TYPES =============

interface AuditLog {
    id: string;
    action: string;
    description: string;
    timestamp: string;
    ipAddress: string;
    userAgent: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    metadata?: any;
}

interface LoaderData {
    logs: AuditLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    stats: {
        totalToday: number;
        securityAlerts: number;
        activeUsers: number;
    };
}

// ============= LOADER =============

export async function loader({ request }: LoaderFunctionArgs) {
    const userAccess = await requireAdmin(request);
    const token = await getUserToken(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const action = url.searchParams.get('action') || '';

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            ...(action && { action }),
        });

        const response = await fetch(`${API_BASE_URL}/admin/system/audit?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const auditData = await response.json();

        return {
            logs: auditData.data || [],
            pagination: {
                page,
                limit,
                total: auditData.total || 0,
                totalPages: Math.ceil((auditData.total || 0) / limit)
            },
            stats: {
                totalToday: (auditData.data || []).length,
                securityAlerts: (auditData.data || []).filter((l: any) => l.action.includes('SECURITY') || l.action.includes('LOGIN_FAILED')).length,
                activeUsers: 8
            }
        };
    } catch (error) {
        console.error('Error loading audit logs:', error);
        return {
            logs: [],
            pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
            stats: { totalToday: 0, securityAlerts: 0, activeUsers: 0 }
        };
    }
}

// ============= COMPONENT =============

export default function AdminAuditLogsPage() {
    const data = useLoaderData<LoaderData>();
    const navigate = useNavigate();
    const { handlePaginationChange, selectedRows, setSelectedRows } = useDataTable();

    // ============= STATS CONFIGURATION =============

    const stats: StatCard[] = [
        {
            id: 'today',
            label: 'Actions Today',
            value: data.stats.totalToday,
            icon: Activity,
            color: 'blue',
        },
        {
            id: 'security',
            label: 'Security Flagged',
            value: data.stats.securityAlerts,
            icon: ShieldAlert,
            color: 'red',
        },
        {
            id: 'users',
            label: 'Active Admins',
            value: data.stats.activeUsers,
            icon: UserIcon,
            color: 'green',
        }
    ];

    // ============= TABLE CONFIGURATION =============

    const columns: ColumnDef<AuditLog>[] = [
        {
            id: 'timestamp',
            header: 'Time',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">
                        {new Date(row.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-xs text-gray-500">
                        {new Date(row.timestamp).toLocaleDateString()}
                    </span>
                </div>
            ),
            width: '120px'
        },
        {
            id: 'user',
            header: 'User',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-600">
                        {row.user?.firstName?.[0] || 'A'}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">{row.user?.firstName} {row.user?.lastName}</span>
                        <span className="text-[10px] text-gray-500">{row.ipAddress}</span>
                    </div>
                </div>
            )
        },
        {
            id: 'action',
            header: 'Action',
            cell: ({ row }) => {
                const getActionIcon = (action: string) => {
                    if (action.includes('LOGIN')) return LogIn;
                    if (action.includes('UPDATE') || action.includes('EDIT')) return ArrowRightLeft;
                    if (action.includes('DELETE')) return Database;
                    return Activity;
                };
                const Icon = getActionIcon(row.action);

                return (
                    <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-mono font-bold text-gray-700 bg-gray-50 px-2 py-0.5 rounded border">
                            {row.action}
                        </span>
                    </div>
                );
            }
        },
        {
            id: 'description',
            header: 'Activity Details',
            cell: ({ row }) => (
                <span className="text-sm text-gray-600 line-clamp-1">{row.description}</span>
            )
        }
    ];

    const actions: ActionDef<AuditLog>[] = [
        {
            id: 'view',
            label: 'Raw JSON',
            icon: Eye,
            onClick: (row) => alert(JSON.stringify(row.metadata || 'No metadata', null, 2)),
        }
    ];

    const filterFields: FilterField[] = [
        {
            id: 'action',
            label: 'Filter Action',
            type: 'select',
            options: [
                { label: 'All Actions', value: '' },
                { label: 'Login', value: 'LOGIN' },
                { label: 'Update', value: 'UPDATE' },
                { label: 'Delete', value: 'DELETE' },
                { label: 'Create', value: 'CREATE' },
            ],
        },
    ];

    // ============= PAGINATION =============

    const pagination: PaginationState = {
        pageIndex: (data.pagination?.page ?? 1) - 1,
        pageSize: data.pagination?.limit ?? 50,
        totalRows: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
    };

    // ============= RENDER =============

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
                    <p className="text-gray-600 mt-1">Immutable record of all administrative activities</p>
                </div>
            </div>

            <StatsGrid stats={stats} />

            <FilterPanel
                fields={filterFields}
                presetStorageKey="admin-audit-filters"
            />

            <DataTable
                data={data.logs}
                columns={columns}
                getRowId={(row) => row.id}
                actions={actions}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                searchPlaceholder="Search by user or description..."
                emptyState={{
                    title: 'No audit logs found',
                    description: 'The system has not recorded any matching activities',
                    icon: Clock,
                }}
            />
        </div>
    );
}
