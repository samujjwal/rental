import { type MetaFunction } from "react-router";
import { DataTable, type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { Shield } from "lucide-react";

export const meta: MetaFunction = () => {
    return [{ title: "User Roles | Gharbatai Admin" }];
};

interface Role {
    id: string;
    name: string;
    usersCount: number;
    description: string;
    status: 'active' | 'deprecated';
}

const columns: Column<Role>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    {
        header: "Role Name",
        accessorKey: "name",
        cell: ({ value: value }) => (
            <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-500" />
                <span className="font-semibold">{value}</span>
            </div>
        )
    },
    { header: "Description", accessorKey: "description" },
    { header: "Users", accessorKey: "usersCount", cell: ({ value: value }) => <span>{value} users</span>, sortable: true },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => value === 'active' ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="secondary">Deprecated</Badge>
    }
];

const mockData: Role[] = [
    { id: "1", name: "Super Admin", description: "Full access to all resources", usersCount: 3, status: "active" },
    { id: "2", name: "Moderator", description: "Can manage content and disputes", usersCount: 12, status: "active" },
    { id: "3", name: "Support Agent", description: "Can view bookings and users", usersCount: 25, status: "active" },
    { id: "4", name: "Host", description: "Default role for property owners", usersCount: 1540, status: "active" },
];

export default function RolesPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">Role Management</h1>
                    <p className="text-muted-foreground">Define and assign permissions to user roles.</p>
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
                searchPlaceholder="Search roles..."
            />
        </div>
    );
}
