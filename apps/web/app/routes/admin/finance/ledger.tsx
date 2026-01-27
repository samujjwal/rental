import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { DataTable, type ColumnDef, type PaginationState } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { ArrowDownLeft, ArrowUpRight, DollarSign } from "lucide-react";

interface Transaction {
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    reference: string;
    date: string;
    balanceAfter: number;
}

interface LoaderData {
    transactions: Transaction[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

const API_URL = process.env.API_URL || "http://localhost:3400/api/v1";

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
        const res = await fetch(`${API_URL}/admin/ledger?${params}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Failed to fetch");
        return await res.json();
    } catch (e) {
        return {
            transactions: [],
            pagination: { page, limit, total: 0, totalPages: 0 }
        };
    }
}

export default function LedgerPage() {
    const data = useLoaderData<LoaderData>();

    // Ledger is typically read-only, no actions/selection needed usually
    const {
        handlePaginationChange,
        selectedRows,
        setSelectedRows
    } = useDataTable();

    const columns: ColumnDef<Transaction>[] = [
        {
            id: 'date',
            header: "Date",
            accessorKey: "date",
            cell: ({ row }) => new Date(row.date).toLocaleString(),
            sortable: true
        },
        {
            id: 'description',
            header: "Description",
            accessorKey: "description",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{row.description}</span>
                    <span className="text-xs text-gray-500 font-mono">{row.reference}</span>
                </div>
            )
        },
        {
            id: 'amount',
            header: "Amount",
            accessorKey: "amount",
            cell: ({ row }) => (
                <span className={`font-bold flex items-center ${row.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                    {row.type === 'credit' ? <ArrowDownLeft className="w-4 h-4 mr-1" /> : <ArrowUpRight className="w-4 h-4 mr-1" />}
                    ${row.amount.toFixed(2)}
                </span>
            ),
            sortable: true
        },
        {
            id: 'type',
            header: "Type",
            accessorKey: "type",
            cell: ({ row }) => (
                <span className={`uppercase text-xs font-bold px-2 py-1 rounded bg-gray-100 ${row.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>
                    {row.type}
                </span>
            )
        },
        {
            id: 'balance',
            header: "Balance",
            accessorKey: "balanceAfter",
            cell: ({ row }) => <span className="font-mono text-gray-600">${row.balanceAfter?.toFixed(2)}</span>
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
                    <h1 className="text-2xl font-bold tracking-tight">Financial Ledger</h1>
                    <p className="text-muted-foreground">Detailed record of all system financial transactions.</p>
                </div>
            </div>

            <DataTable
                data={data.transactions}
                columns={columns}
                getRowId={(row) => row.id}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                searchPlaceholder="Search transactions..."
                emptyState={{
                    title: "No Transactions",
                    description: "The ledger is empty.",
                    icon: DollarSign
                }}
            />
        </div>
    );
}
