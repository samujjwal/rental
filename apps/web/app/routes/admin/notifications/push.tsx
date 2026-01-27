import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";

export const meta: MetaFunction = () => {
    return [{ title: "Push Notifications | Gharbatai Admin" }];
};

interface PushCampaign {
    id: string;
    title: string;
    targetAudience: string;
    sentCount: number;
    clickRate: string;
    status: 'scheduled' | 'sent';
}

const columns: Column<PushCampaign>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "Campaign Title", accessorKey: "title", cell: ({ value: value }) => <span className="font-medium">{value}</span> },
    { header: "Target", accessorKey: "targetAudience" },
    { header: "Sent", accessorKey: "sentCount" },
    { header: "CTR", accessorKey: "clickRate" },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => value === 'sent' ? <Badge className="bg-green-100 text-green-800">Sent</Badge> : <Badge variant="outline">Scheduled</Badge>
    }
];

const mockData: PushCampaign[] = [
    { id: "1", title: "Weekend Promo", targetAudience: "All Users", sentCount: 1500, clickRate: "2.4%", status: "sent" },
    { id: "2", title: "Host Reminder", targetAudience: "Hosts", sentCount: 0, clickRate: "-", status: "scheduled" },
];

export default function PushNotificationsPage() {
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
            <h1 className="text-2xl font-bold">Push Campaigns</h1>
            <DataTable
                data={mockData}
                columns={columns}
                getRowId={(row) => row.id}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                enableSelection={true}
                searchPlaceholder="Search push campaigns..."
            />
        </div>
    );
}
