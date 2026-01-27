import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { Check, Copy } from "lucide-react";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => {
    return [{ title: "API Keys | Gharbatai Admin" }];
};

interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    created: string;
    lastUsed: string;
    status: 'active' | 'revoked';
}

const columns: Column<ApiKey>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "Name", accessorKey: "name", cell: ({ value: value }) => <span className="font-medium">{value}</span> },
    {
        header: "Key Prefix",
        accessorKey: "prefix",
        cell: ({ value: value }) => (
            <div className="flex items-center gap-2">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm">{value}****</code>
                <Copy className="w-3 h-3 text-gray-400 cursor-pointer hover:text-gray-600" />
            </div>
        )
    },
    { header: "Created", accessorKey: "created", sortable: true },
    { header: "Last Used", accessorKey: "lastUsed", sortable: true },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => value === 'active' ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="secondary">Revoked</Badge>,
        filterable: true
    },
    {
        id: "actions",
        header: "Actions",
        cell: () => (
            <Button variant="outline" size="sm" className="text-red-500 hover:bg-red-50">Revoke</Button>
        )
    }
];

const mockData: ApiKey[] = [
    { id: "1", name: "Mobile App Prod", prefix: "gh_live_8821", created: "2023-11-20", lastUsed: "Just now", status: "active" },
    { id: "2", name: "Web Client", prefix: "gh_live_9921", created: "2023-11-20", lastUsed: "5 mins ago", status: "active" },
    { id: "3", name: "Test Server", prefix: "gh_test_1120", created: "2023-12-05", lastUsed: "2 days ago", status: "revoked" },
];

export default function ApiKeysPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
                    <p className="text-muted-foreground">Manage access keys for third-party integrations.</p>
                </div>
                <Button>Generate New Key</Button>
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
                searchPlaceholder="Search API keys..."
            />
        </div>
    );
}
