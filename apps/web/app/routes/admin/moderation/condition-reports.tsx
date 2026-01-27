import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { Camera } from "lucide-react";

export const meta: MetaFunction = () => {
    return [{ title: "Condition Reports | Gharbatai Admin" }];
};

interface Report {
    id: string;
    bookingRef: string;
    type: 'check-in' | 'check-out';
    photosCount: number;
    submittedBy: string;
    date: string;
    status: 'verified' | 'pending';
}

const columns: Column<Report>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "Booking", accessorKey: "bookingRef", cell: ({ value: value }) => <span className="font-mono">{value}</span> },
    {
        header: "Type",
        accessorKey: "type",
        cell: ({ value: value }) => value === 'check-in' ? <Badge variant="outline">Check-In</Badge> : <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100">Check-Out</Badge>,
        filterable: true
    },
    {
        header: "Photos",
        accessorKey: "photosCount",
        cell: ({ value: value }) => (
            <div className="flex items-center gap-1 text-gray-600">
                <Camera className="w-4 h-4" />
                <span>{value}</span>
            </div>
        )
    },
    { header: "Submitted By", accessorKey: "submittedBy" },
    { header: "Date", accessorKey: "date", sortable: true },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => value === 'verified' ? <Badge className="bg-green-100 text-green-800">Verified</Badge> : <Badge variant="secondary">Pending</Badge>
    }
];

const mockData: Report[] = [
    { id: "1", bookingRef: "BK-1001", type: "check-in", photosCount: 5, submittedBy: "Host Alice", date: "2024-01-20 14:00", status: "verified" },
    { id: "2", bookingRef: "BK-1001", type: "check-out", photosCount: 8, submittedBy: "Host Alice", date: "2024-01-22 11:00", status: "pending" },
];

export default function ConditionReportsPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">Condition Reports</h1>
                    <p className="text-muted-foreground">Vehicle/Property condition logs with photo evidence.</p>
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
                searchPlaceholder="Search reports..."
            />
        </div>
    );
}
