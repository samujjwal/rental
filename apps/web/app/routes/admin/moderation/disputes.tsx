import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { AlertTriangle, Lock, CheckCircle } from "lucide-react";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => {
    return [{ title: "Disputes | Gharbatai Admin" }];
};

interface Dispute {
    id: string;
    ticketId: string;
    bookingRef: string;
    reporter: string;
    type: 'damage' | 'fraud' | 'service' | 'other';
    priority: 'high' | 'medium' | 'low';
    status: 'open' | 'investigating' | 'resolved' | 'closed';
    created: string;
}

interface LoaderData {
    disputes: Dispute[];
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
    const page = url.searchParams.get("page") || "1";
    const limit = url.searchParams.get("limit") || "10";
    const status = url.searchParams.get("status");

    const API_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    const params = new URLSearchParams({ page, limit });
    if (status) params.append("status", status.toUpperCase());

    const res = await fetch(`${API_URL}/admin/disputes?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Failed to fetch disputes");
    return await res.json();
}

export async function action({ request }: ActionFunctionArgs) {
    await requireAdmin(request);
    const token = await getUserToken(request);
    const formData = await request.formData();
    const disputeId = formData.get("disputeId");
    const status = formData.get("status");

    const API_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    const res = await fetch(`${API_URL}/admin/disputes/${disputeId}/status`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
    });

    if (!res.ok) return { error: "Failed to update dispute status" };
    return { success: true };
}

const DisputeActions = ({ dispute }: { dispute: Dispute }) => {
    const fetcher = useFetcher();

    if (dispute.status === 'resolved') return <Badge variant="secondary">Resolved</Badge>;

    return (
        <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => fetcher.submit({ disputeId: dispute.id, status: 'RESOLVED' }, { method: 'post' })}
        >
            <CheckCircle className="w-4 h-4" /> Resolve
        </Button>
    );
};

const columns: Column<Dispute>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    {
        header: "Ticket",
        accessorKey: "ticketId",
        cell: ({ value: value }) => <span className="font-mono font-bold text-gray-800">#{value}</span>
    },
    { header: "Booking", accessorKey: "bookingRef", cell: ({ value: value }) => <span className="text-blue-600 hover:underline">{value}</span> },
    { header: "Reporter", accessorKey: "reporter" },
    {
        header: "Type",
        accessorKey: "type",
        filterable: true
    },
    {
        header: "Priority",
        accessorKey: "priority",
        cell: ({ value: value }) => {
            if (value === 'high') return <Badge variant="destructive">High</Badge>;
            if (value === 'medium') return <Badge className="bg-orange-100 text-orange-800">Medium</Badge>;
            return <Badge variant="outline">Low</Badge>;
        },
        filterable: true,
        sortable: true
    },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => {
            if (value === 'open') return <Badge className="bg-blue-100 text-blue-800">Open</Badge>;
            if (value === 'investigating') return <Badge className="bg-purple-100 text-purple-800">Investigating</Badge>;
            return <Badge variant="secondary">Resolved</Badge>;
        },
        filterable: true
    },
    { header: "Created", accessorKey: "created", sortable: true },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row: row }) => <DisputeActions dispute={row} />
    }
];

export default function DisputesPage() {
    const { disputes, pagination: initialPagination } = useLoaderData<LoaderData>();

    const {
        selectedRows,
        setSelectedRows,
        handlePaginationChange,
        page,
        limit
    } = useDataTable();

    const pagination = {
        pageIndex: page - 1,
        pageSize: limit,
        totalRows: initialPagination?.total || 0,
        totalPages: initialPagination?.totalPages || 0,
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dispute Resolution</h1>
                    <p className="text-muted-foreground">Manage conflicts and moderation tickets.</p>
                </div>
            </div>

            <DataTable
                data={disputes || []}
                columns={columns}
                getRowId={(row) => row.id}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                enableSelection={true}
                searchPlaceholder="Search disputes..."
            />
        </div>
    );
}
