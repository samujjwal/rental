import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { Edit } from "lucide-react";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => {
    return [{ title: "System Settings | Gharbatai Admin" }];
};

interface Setting {
    id: string;
    key: string;
    value: string;
    group: string;
    lastUpdated: string;
}

const columns: Column<Setting>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "Key", accessorKey: "key", cell: ({ value: value }) => <code className="text-sm font-semibold text-gray-700">{value}</code> },
    { header: "Value", accessorKey: "value", cell: ({ value: value }) => <span className="text-gray-600 italic truncate max-w-xs block">{value}</span> },
    { header: "Group", accessorKey: "group", filterable: true },
    { header: "Last Updated", accessorKey: "lastUpdated", sortable: true },
    {
        id: "actions",
        header: "Actions",
        cell: () => (
            <Button variant="ghost" size="sm">
                <Edit className="w-4 h-4" />
            </Button>
        )
    }
];

const mockData: Setting[] = [
    { id: "1", key: "MAX_UPLOAD_SIZE", value: "10MB", group: "Files", lastUpdated: "2024-01-01" },
    { id: "2", key: "DEFAULT_CURRENCY", value: "NPR", group: "Finance", lastUpdated: "2023-12-01" },
    { id: "3", key: "ENABLE_REGISTRATION", value: "true", group: "Auth", lastUpdated: "2024-01-15" },
];

export default function SystemSettingsPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">System Configuration</h1>
                    <p className="text-muted-foreground">Manage global application settings.</p>
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
                searchPlaceholder="Search settings..."
            />
        </div>
    );
}
