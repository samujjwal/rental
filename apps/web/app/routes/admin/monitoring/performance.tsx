import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { TrendingUp, TrendingDown } from "lucide-react";

export const meta: MetaFunction = () => {
    return [{ title: "Performance | Gharbatai Admin" }];
};

interface Metric {
    id: string;
    name: string;
    average: number;
    p95: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    status: 'good' | 'warning' | 'critical';
}

const columns: Column<Metric>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "Metric Name", accessorKey: "name", cell: ({ value: value }) => <span className="font-semibold">{value}</span> },
    { header: "Average", accessorKey: "average", cell: ({ value: value, row: row }) => <span>{value} {row.unit}</span> },
    { header: "P95", accessorKey: "p95", cell: ({ value: value, row: row }) => <span>{value} {row.unit}</span> },
    {
        header: "Trend",
        accessorKey: "trend",
        cell: ({ value: value }) => value === 'up'
            ? <span className="text-red-500 flex items-center"><TrendingUp className="w-4 h-4 mr-1" /> Rising</span>
            : <span className="text-green-500 flex items-center"><TrendingDown className="w-4 h-4 mr-1" /> Improving</span>
    },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => {
            if (value === 'good') return <Badge className="bg-green-100 text-green-800">Good</Badge>;
            if (value === 'warning') return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
            return <Badge variant="destructive">Critical</Badge>;
        },
        filterable: true
    }
];

const mockData: Metric[] = [
    { id: "1", name: "API Response Time", average: 120, p95: 350, unit: "ms", trend: "stable", status: "good" },
    { id: "2", name: "Database Query Load", average: 45, p95: 100, unit: "ms", trend: "up", status: "warning" },
    { id: "3", name: "Image Processing", average: 1.2, p95: 2.5, unit: "s", trend: "down", status: "good" },
];

export default function PerformancePage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">System Performance</h1>
                    <p className="text-muted-foreground">Key metrics and health indicators.</p>
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
                searchPlaceholder="Search metrics..."
            />
        </div>
    );
}
