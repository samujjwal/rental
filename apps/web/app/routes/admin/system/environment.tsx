import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";

export const meta: MetaFunction = () => {
    return [{ title: "Environment | Gharbatai Admin" }];
};

interface EnvVar {
    id: string;
    key: string;
    value: string;
    context: 'production' | 'staging' | 'development';
    isSecret: boolean;
}

const columns: Column<EnvVar>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "Variable Name", accessorKey: "key", cell: ({ value: value }) => <code className="font-mono font-bold text-blue-700">{value}</code> },
    {
        header: "Value",
        accessorKey: "value",
        cell: ({ value: value, row: row }) => row.isSecret ? <span className="text-gray-400">••••••••••••••</span> : <code>{value}</code>
    },
    {
        header: "Context",
        accessorKey: "context",
        cell: ({ value: value }) => {
            if (value === 'production') return <Badge className="bg-red-100 text-red-800">Production</Badge>;
            if (value === 'staging') return <Badge className="bg-orange-100 text-orange-800">Staging</Badge>;
            return <Badge className="bg-green-100 text-green-800">Dev</Badge>;
        },
        filterable: true
    }
];

const mockData: EnvVar[] = [
    { id: "1", key: "DATABASE_URL", value: "postgres://...", context: "production", isSecret: true },
    { id: "2", key: "NODE_ENV", value: "production", context: "production", isSecret: false },
    { id: "3", key: "API_PORT", value: "3000", context: "production", isSecret: false },
];

export default function EnvironmentPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">Environment Variables</h1>
                    <p className="text-muted-foreground">View run-time configuration.</p>
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
                searchPlaceholder="Search env variables..."
            />
        </div>
    );
}
