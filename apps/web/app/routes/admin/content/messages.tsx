import { type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { MessageSquare, Flag } from "lucide-react";

export const meta: MetaFunction = () => {
    return [{ title: "Messages | Gharbatai Admin" }];
};

interface MessageThread {
    id: string;
    participants: string[];
    lastMessage: string;
    sentAt: string;
    flagged: boolean;
    listing: string;
}

interface LoaderData {
    conversations: MessageThread[];
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
    const flagged = url.searchParams.get("flagged");

    const API_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    const params = new URLSearchParams({ page, limit });
    if (flagged) params.append("flagged", flagged);

    const res = await fetch(`${API_URL}/admin/messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Failed to fetch messages");
    return await res.json();
}


const columns: Column<MessageThread>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    {
        header: "Participants",
        accessorKey: "participants",
        cell: ({ value: value }) => (value as string[]).join(" & ")
    },
    {
        header: "Related Listing",
        accessorKey: "listing",
        cell: ({ value: value }) => <span className="text-sm text-gray-600">{value}</span>
    },
    {
        header: "Last Message",
        accessorKey: "lastMessage",
        cell: ({ value: value }) => <span className="block truncate max-w-md text-gray-500 italic">"{value}"</span>
    },
    {
        header: "Status",
        accessorKey: "flagged",
        cell: ({ value: value }) => value ? <Badge variant="destructive" className="gap-1"><Flag className="w-3 h-3" /> Flagged</Badge> : <Badge variant="outline">Normal</Badge>,
        filterable: true
    },
    {
        header: "Date",
        accessorKey: "sentAt",
        sortable: true
    },
    {
        id: "actions",
        header: "Actions",
        cell: () => (
            <button className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> View Thread
            </button>
        )
    }
];

export default function MessagesPage() {
    const { conversations, pagination: initialPagination } = useLoaderData<LoaderData>();

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
                    <h1 className="text-2xl font-bold tracking-tight">Message Moderation</h1>
                    <p className="text-muted-foreground">Review flagged messages and user communications.</p>
                </div>
            </div>

            <DataTable
                data={conversations || []}
                columns={columns}
                getRowId={(row) => row.id}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                enableSelection={true}
                searchPlaceholder="Search messages..."
            />
        </div>
    );
}
