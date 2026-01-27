import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { Bell, Mail, Smartphone } from "lucide-react";

export const meta: MetaFunction = () => {
    return [{ title: "Notifications | Gharbatai Admin" }];
};

interface NotificationLog {
    id: string;
    recipient: string;
    title: string;
    channel: 'email' | 'push' | 'in-app';
    status: 'sent' | 'failed' | 'queued';
    sentAt: string;
}

const columns: Column<NotificationLog>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "Recipient", accessorKey: "recipient" },
    { header: "Title", accessorKey: "title", cell: ({ value: value }) => <span className="font-medium">{value}</span> },
    {
        header: "Channel",
        accessorKey: "channel",
        cell: ({ value: value }) => {
            if (value === 'email') return <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> Email</span>;
            if (value === 'push') return <span className="flex items-center gap-1"><Smartphone className="w-4 h-4" /> Push</span>;
            return <span className="flex items-center gap-1"><Bell className="w-4 h-4" /> In-App</span>;
        },
        filterable: true
    },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => {
            if (value === 'sent') return <Badge className="bg-green-100 text-green-800">Sent</Badge>;
            if (value === 'failed') return <Badge variant="destructive">Failed</Badge>;
            return <Badge variant="outline">Queued</Badge>;
        },
        filterable: true
    },
    { header: "Sent At", accessorKey: "sentAt", sortable: true },
];

const mockData: NotificationLog[] = [
    { id: "1", recipient: "john@example.com", title: "Booking Confirmed", channel: "email", status: "sent", sentAt: "2024-01-26 10:00" },
    { id: "2", recipient: "jane@example.com", title: "New Message", channel: "push", status: "sent", sentAt: "2024-01-26 10:05" },
    { id: "3", recipient: "bob@example.com", title: "Payment Failed", channel: "email", status: "failed", sentAt: "2024-01-26 10:10" },
];

export default function NotificationsPage() {
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
        totalRows: mockData.length,
        totalPages: Math.ceil(mockData.length / limit),
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Notification Logs</h1>
                    <p className="text-muted-foreground">History of system alerts and user messages.</p>
                </div>
            </div>

            <DataTable
                data={mockData}
                columns={columns}
                getRowId={(row) => row.id}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                enableSelection={true}
                searchPlaceholder="Search notifications..."
            />
        </div>
    );
}
