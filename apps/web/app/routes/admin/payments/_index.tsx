import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { DataTable, type ColumnDef, type ActionDef, type BulkActionDef, type PaginationState } from "~/components/data-table/DataTable";
import { FilterPanel, type FilterField } from "~/components/data-table/FilterPanel";
import { StatsGrid, type StatCard } from "~/components/data-table/StatsGrid";
import { Button } from "~/components/ui/Button";
import { useDataTable } from "~/hooks/use-data-table";
import {
    Plus,
    Download,
    Eye,
    CheckCircle2,
    XCircle,
    Clock,
    DollarSign,
    CreditCard,
    ArrowUpRight,
    ArrowDownLeft,
    PieChart,
    Calendar,
    Receipt,
    History,
    FileText
} from "lucide-react";

// ============= TYPES =============

interface Payment {
    id: string;
    booking: {
        id: string;
        listing: { title: string };
    };
    amount: number;
    currency: string;
    status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED';
    provider: 'STRIPE' | 'ESEWA' | 'KHALTI' | 'BANK_TRANSFER';
    transactionId: string;
    payer: {
        firstName: string;
        lastName: string;
        email: string;
    };
    createdAt: string;
}

interface LoaderData {
    payments: Payment[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    stats: {
        totalRevenue: number;
        completedCount: number;
        pendingCount: number;
        refundedAmount: number;
    };
}

// ============= LOADER =============

export async function loader({ request }: LoaderFunctionArgs) {
    const user = await requireAdmin(request);
    const token = await getUserToken(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '25');
    const status = url.searchParams.get('status') || '';

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            ...(status && { status }),
        });

        const response = await fetch(`${API_BASE_URL}/admin/payments?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const paymentsData = response.ok ? await response.json() : { data: [], total: 0 };

        // Normalize response
        return {
            payments: paymentsData.data || [],
            pagination: {
                page,
                limit,
                total: paymentsData.total || 0,
                totalPages: Math.ceil((paymentsData.total || 0) / limit)
            },
            stats: {
                totalRevenue: (paymentsData.data || []).reduce((sum: number, p: any) => sum + (p.status === 'COMPLETED' ? p.amount : 0), 0),
                completedCount: (paymentsData.data || []).filter((p: any) => p.status === 'COMPLETED').length,
                pendingCount: (paymentsData.data || []).filter((p: any) => p.status === 'PENDING').length,
                refundedAmount: (paymentsData.data || []).reduce((sum: number, p: any) => sum + (p.status === 'REFUNDED' ? p.amount : 0), 0),
            }
        };
    } catch (error) {
        console.error('Error loading payments:', error);
        return {
            payments: [],
            pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
            stats: { totalRevenue: 0, completedCount: 0, pendingCount: 0, refundedAmount: 0 }
        };
    }
}

// ============= COMPONENT =============

export default function AdminPaymentsPage() {
    const data = useLoaderData<LoaderData>();
    const navigate = useNavigate();
    const {
        handlePaginationChange,
        selectedRows,
        setSelectedRows
    } = useDataTable();

    // ============= STATS CONFIGURATION =============

    const stats: StatCard[] = [
        {
            id: 'revenue',
            label: 'Net Revenue',
            value: `Rs. ${data.stats.totalRevenue.toLocaleString()}`,
            icon: DollarSign,
            color: 'green',
            trend: { value: 8.2, label: 'vs last month', direction: 'up' }
        },
        {
            id: 'completed',
            label: 'Successful Txns',
            value: data.stats.completedCount,
            icon: CheckCircle2,
            color: 'blue',
        },
        {
            id: 'pending',
            label: 'Pending Volume',
            value: data.stats.pendingCount,
            icon: History,
            color: 'yellow',
        },
        {
            id: 'refunded',
            label: 'Total Refunds',
            value: `Rs. ${data.stats.refundedAmount.toLocaleString()}`,
            icon: ArrowDownLeft,
            color: 'red',
        }
    ];

    // ============= TABLE CONFIGURATION =============

    const columns: ColumnDef<Payment>[] = [
        {
            id: 'transaction',
            header: 'Transaction',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-mono text-xs text-gray-900">ID: {row.transactionId || row.id.substring(0, 12)}</span>
                    <span className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleString()}</span>
                </div>
            )
        },
        {
            id: 'payer',
            header: 'Payer',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm font-medium">{row.payer?.firstName} {row.payer?.lastName}</span>
                    <span className="text-xs text-gray-500">{row.payer?.email}</span>
                </div>
            )
        },
        {
            id: 'booking',
            header: 'Booking/Listing',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm line-clamp-1">{row.booking?.listing?.title || 'Unknown Listing'}</span>
                    <span className="text-xs text-blue-600">#{row.booking?.id.substring(0, 8)}</span>
                </div>
            )
        },
        {
            id: 'amount',
            header: 'Amount',
            sortable: true,
            cell: ({ row }) => (
                <div className="flex flex-col items-end mr-4">
                    <span className="text-sm font-bold text-gray-900">Rs. {row.amount.toLocaleString()}</span>
                    <span className="text-xs text-gray-500">{row.currency || 'NPR'}</span>
                </div>
            )
        },
        {
            id: 'provider',
            header: 'Method',
            cell: ({ row }) => (
                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-[10px] font-bold text-gray-600 tracking-wider">
                    {row.provider}
                </span>
            )
        },
        {
            id: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const styles = {
                    COMPLETED: 'bg-green-100 text-green-800',
                    PENDING: 'bg-yellow-100 text-yellow-800',
                    FAILED: 'bg-red-100 text-red-800',
                    REFUNDED: 'bg-orange-100 text-orange-800',
                };
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[row.status] || styles.PENDING}`}>
                        {row.status}
                    </span>
                );
            }
        }
    ];

    const actions: ActionDef<Payment>[] = [
        {
            id: 'receipt',
            label: 'View Receipt',
            icon: Receipt,
            onClick: (row) => alert(`Generating receipt for ${row.id}...`),
        },
        {
            id: 'refund',
            label: 'Initiate Refund',
            icon: ArrowDownLeft,
            variant: 'destructive',
            show: (row) => row.status === 'COMPLETED',
            onClick: async (row) => {
                if (confirm('Are you sure you want to refund this payment? This cannot be undone.')) {
                    alert(`Refund initiated for ${row.id}`);
                }
            },
        },
        {
            id: 'audit',
            label: 'Transaction Audit',
            icon: History,
            onClick: (row) => alert(`Opening audit trail for ${row.id}...`),
        },
    ];

    const bulkActions: BulkActionDef<Payment>[] = [
        {
            id: 'export_csv',
            label: 'Export to CSV',
            icon: FileText,
            onClick: (rows) => alert(`Exporting ${rows.length} transactions to CSV...`),
        },
    ];

    // ============= FILTER CONFIGURATION =============

    const filterFields: FilterField[] = [
        {
            id: 'status',
            label: 'Payment Status',
            type: 'select',
            options: [
                { label: 'All Statuses', value: '' },
                { label: 'Completed', value: 'COMPLETED' },
                { label: 'Pending', value: 'PENDING' },
                { label: 'Refunded', value: 'REFUNDED' },
                { label: 'Failed', value: 'FAILED' },
            ],
        },
        {
            id: 'provider',
            label: 'Method',
            type: 'select',
            options: [
                { label: 'All Methods', value: '' },
                { label: 'Stripe', value: 'STRIPE' },
                { label: 'eSewa', value: 'ESEWA' },
                { label: 'Khalti', value: 'KHALTI' },
                { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
            ],
        },
    ];

    const pagination: PaginationState = {
        pageIndex: (data.pagination?.page ?? 1) - 1,
        pageSize: data.pagination?.limit ?? 25,
        totalRows: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
    };

    // ============= RENDER =============

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
                    <p className="text-gray-600 mt-1">Monitor transactions, refunds and daily revenue</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <PieChart className="w-4 h-4 mr-2" />
                        Analytics
                    </Button>
                    <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            <StatsGrid stats={stats} />

            <FilterPanel
                fields={filterFields}
                presetStorageKey="admin-payments-filters"
            />

            <DataTable
                data={data.payments}
                columns={columns}
                getRowId={(row) => row.id}
                actions={actions}
                bulkActions={bulkActions}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                enableSelection={true}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                searchPlaceholder="Search by transaction ID or email..."
                emptyState={{
                    title: 'No transactions found',
                    description: 'Try adjusting your payment filters',
                    icon: CreditCard,
                }}
            />
        </div>
    );
}
