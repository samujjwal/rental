import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { DataTable, type ColumnDef, type ActionDef, type PaginationState } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";

const API_URL = process.env.API_URL || "http://localhost:3400/api/v1";

interface Payout {
    id: string;
    host: string;
    amount: number;
    status: 'scheduled' | 'processing' | 'paid' | 'failed';
    scheduledDate: string;
    processedDate?: string;
    method: string;
}

interface LoaderData {
    payouts: Payout[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export async function loader({ request }: LoaderFunctionArgs) {
    await requireAdmin(request);
    const token = await getUserToken(request);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
    });

    try {
        const res = await fetch(`${API_URL}/admin/payouts?${params}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Failed to fetch");
        return await res.json();
    } catch (e) {
        return {
            payouts: [],
            pagination: { page, limit, total: 0, totalPages: 0 }
        };
    }
}

export async function action({ request }: ActionFunctionArgs) {
    const token = await getUserToken(request);
    const formData = await request.formData();
    const intent = formData.get("intent");
    const payoutId = formData.get("payoutId");

    // Mock implementation for demo
    return { success: true };
}

export default function PayoutsPage() {
    const data = useLoaderData<LoaderData>();
    const navigate = useNavigate();
    const fetcher = useFetcher();

    const {
        handlePaginationChange,
        selectedRows,
        setSelectedRows
    } = useDataTable();

    const columns: ColumnDef<Payout>[] = [
        {
            id: 'host',
            header: "Host",
            accessorKey: "host",
            cell: ({ row }) => <span className="font-medium text-gray-900">{row.host}</span>
        },
        {
            id: 'amount',
            header: "Amount",
            accessorKey: "amount",
            cell: ({ row }) => <span className="font-bold text-gray-900">${(row.amount).toFixed(2)}</span>,
            sortable: true
        },
        {
            id: 'method',
            header: "Payout Method",
            accessorKey: "method",
            cell: ({ row }) => <span className="text-sm text-gray-600 uppercase">{row.method}</span>
        },
        {
            id: 'status',
            header: "Status",
            accessorKey: "status",
            cell: ({ row }) => {
                const styles = {
                    paid: "bg-green-100 text-green-800",
                    processing: "bg-blue-100 text-blue-800",
                    failed: "bg-red-100 text-red-800",
                    scheduled: "bg-yellow-100 text-yellow-800"
                };
                const statusKey = row.status?.toLowerCase() as keyof typeof styles;
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[statusKey] || styles.scheduled}`}>
                        {row.status}
                    </span>
                );
            }
        },
        {
            id: 'scheduledDate',
            header: "Scheduled",
            accessorKey: "scheduledDate",
            cell: ({ row }) => new Date(row.scheduledDate).toLocaleDateString()
        },
    ];

    const actions: ActionDef<Payout>[] = [
        {
            id: 'process',
            label: 'Process Now',
            icon: ArrowUpRight,
            show: (row) => row.status === 'scheduled',
            onClick: async (row) => {
                if (confirm('Process this payout immediately?')) {
                    fetcher.submit(
                        { intent: "process", payoutId: row.id },
                        { method: "post" }
                    );
                }
            }
        },
        {
            id: 'retry',
            label: 'Retry Failed Payout',
            icon: CheckCircle2,
            show: (row) => row.status === 'failed',
            onClick: async (row) => {
                if (confirm('Retry this payout?')) {
                    fetcher.submit(
                        { intent: "retry", payoutId: row.id },
                        { method: "post" }
                    );
                }
            }
        },
    ];

    const pagination: PaginationState = {
        pageIndex: (data.pagination?.page ?? 1) - 1,
        pageSize: data.pagination?.limit ?? 10,
        totalRows: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Host Payouts</h1>
                    <p className="text-muted-foreground">Monitor outgoing payments to hosts and partners.</p>
                </div>
            </div>

            <DataTable
                data={data.payouts}
                columns={columns}
                getRowId={(row) => row.id}
                actions={actions}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                enableSelection={true}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                searchPlaceholder="Search payouts..."
                emptyState={{
                    title: "No Payouts Found",
                    description: "No payouts found.",
                    icon: ArrowUpRight
                }}
            />
        </div>
    );
}
