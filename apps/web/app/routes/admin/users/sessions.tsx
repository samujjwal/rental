import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { Laptop, Smartphone, Globe } from "lucide-react";

export const meta: MetaFunction = () => {
    return [{ title: "User Sessions | Gharbatai Admin" }];
};

interface Session {
    id: string;
    user: string;
    device: string;
    browser: string;
    ip: string;
    location: string;
    lastActive: string;
    status: 'active' | 'expired';
}

const columns: Column<Session>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "User", accessorKey: "user", cell: ({ value: value }) => <span className="font-medium">{value}</span> },
    {
        header: "Device",
        accessorKey: "device",
        cell: ({ value: value }) => (
            <div className="flex items-center gap-2">
                {value === 'Mobile' ? <Smartphone className="w-4 h-4 text-gray-500" /> : <Laptop className="w-4 h-4 text-gray-500" />}
                <span>{value} ({'Chrome'})</span>
            </div>
        )
    },
    { header: "IP Address", accessorKey: "ip", cell: ({ value: value }) => <code className="text-xs bg-gray-100 p-1 rounded">{value}</code> },
    {
        header: "Location",
        accessorKey: "location",
        cell: ({ value: value }) => <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-gray-400" /> {value}</span>
    },
    { header: "Last Active", accessorKey: "lastActive", sortable: true },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => value === 'active' ? <Badge className="bg-green-100 text-green-800">Online</Badge> : <Badge variant="secondary">Expired</Badge>,
        filterable: true
    }
];

const mockData: Session[] = [
    { id: "1", user: "John Doe", device: "Desktop", browser: "Chrome", ip: "192.168.1.1", location: "Kathmandu, NP", lastActive: "Just now", status: "active" },
    { id: "2", user: "Jane Smith", device: "Mobile", browser: "Safari", ip: "10.0.0.5", location: "Pokhara, NP", lastActive: "2 hours ago", status: "active" },
    { id: "3", user: "Admin", device: "Desktop", browser: "Firefox", ip: "127.0.0.1", location: "Lalitpur, NP", lastActive: "1 day ago", status: "expired" },
];

export default function SessionsPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">Active Sessions</h1>
                    <p className="text-muted-foreground">Monitor user login sessions and security.</p>
                </div>
            </div>

            <DataTable
                data={mockData}
                columns={columns}
                getRowId={(row) => row.id}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                enableSelection={true}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                searchPlaceholder="Search sessions..."
            />
        </div>
    );
}
