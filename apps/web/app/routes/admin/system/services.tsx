import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { CheckCircle, XCircle } from "lucide-react";

export const meta: MetaFunction = () => {
    return [{ title: "System Services | Gharbatai Admin" }];
};

interface Service {
    id: string;
    name: string;
    version: string;
    uptime: string;
    status: 'operational' | 'degraded' | 'down';
    lastCheck: string;
}

const columns: Column<Service>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "Service Name", accessorKey: "name", cell: ({ value: value }) => <span className="font-medium">{value}</span> },
    { header: "Version", accessorKey: "version", cell: ({ value: value }) => <code className="bg-gray-100 text-xs p-1 rounded">v{value}</code> },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => {
            if (value === 'operational') return <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle className="w-3 h-3" /> Operational</Badge>;
            if (value === 'degraded') return <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>;
            return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Down</Badge>;
        },
        filterable: true
    },
    { header: "Uptime", accessorKey: "uptime" },
    { header: "Last Check", accessorKey: "lastCheck" },
];

const mockData: Service[] = [
    { id: "1", name: "Auth Service", version: "2.1.0", uptime: "99.99%", status: "operational", lastCheck: "Just now" },
    { id: "2", name: "Payment Gateway", version: "1.5.2", uptime: "99.95%", status: "operational", lastCheck: "1 min ago" },
    { id: "3", name: "Image Processing", version: "3.0.1", uptime: "98.50%", status: "degraded", lastCheck: "5 mins ago" },
];

export default function ServiceConfigPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">Service Status</h1>
                    <p className="text-muted-foreground">Monitor microservices and external integrations.</p>
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
                searchPlaceholder="Search services..."
            />
        </div>
    );
}
