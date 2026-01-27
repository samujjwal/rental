import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { ShieldAlert, User, Image } from "lucide-react";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => {
    return [{ title: "Moderation Queue | Gharbatai Admin" }];
};

interface QueueItem {
    id: string;
    type: 'user_profile' | 'listing_image' | 'listing_text';
    targetId: string;
    reason: string;
    flaggedBy: string;
    score: number; // AI Score
    timeInQueue: string;
}

const columns: Column<QueueItem>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    {
        header: "Type",
        accessorKey: "type",
        cell: ({ value: value }) => {
            if (value === 'user_profile') return <span className="flex items-center gap-1"><User className="w-4 h-4" /> Profile</span>;
            if (value === 'listing_image') return <span className="flex items-center gap-1"><Image className="w-4 h-4" /> Image</span>;
            return <span>Text</span>
        },
        filterable: true
    },
    { header: "Target ID", accessorKey: "targetId", cell: ({ value: value }) => <code className="text-xs bg-gray-100 p-1 rounded">{value}</code> },
    { header: "Reason", accessorKey: "reason" },
    {
        header: "Trust Score",
        accessorKey: "score",
        cell: ({ value: value }) => {
            const v = Number(value);
            const color = v > 0.8 ? 'text-green-600' : v < 0.4 ? 'text-red-600' : 'text-orange-600';
            return <span className={`font-bold ${color}`}>{v.toFixed(2)}</span>
        },
        sortable: true
    },
    { header: "Flagged By", accessorKey: "flaggedBy" },
    { header: "Wait Time", accessorKey: "timeInQueue" },
    {
        id: "actions",
        header: "Actions",
        cell: () => (
            <div className="flex gap-2">
                <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700">Approve</Button>
                <Button size="sm" variant="destructive">Reject</Button>
            </div>
        )
    }
];

const mockData: QueueItem[] = [
    { id: "1", type: "listing_image", targetId: "IMG_992", reason: "NSFW Content Detection", flaggedBy: "AI Model V2", score: 0.12, timeInQueue: "2h 15m" },
    { id: "2", type: "user_profile", targetId: "USR_221", reason: "Suspicious bio", flaggedBy: "User Report", score: 0.45, timeInQueue: "45m" },
    { id: "3", type: "listing_text", targetId: "LST_551", reason: "Phone number in description", flaggedBy: "Regex Filter", score: 0.05, timeInQueue: "10m" },
];

export default function ModerationQueuePage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">Moderation Queue</h1>
                    <p className="text-muted-foreground">Review content flagged by AI or users.</p>
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
                searchPlaceholder="Search queue..."
            />
        </div>
    );
}
