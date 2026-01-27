import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";

export const meta: MetaFunction = () => {
    return [{ title: "Device Tokens | Gharbatai Admin" }];
};

interface Token {
    id: string;
    user: string;
    platform: 'ios' | 'android' | 'web';
    lastActive: string;
    status: 'valid' | 'invalid';
}

const columns: Column<Token>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "User", accessorKey: "user" },
    { header: "Platform", accessorKey: "platform" },
    { header: "Last Active", accessorKey: "lastActive" },
    { header: "Status", accessorKey: "status" }
];

const mockData: Token[] = [
    { id: "1", user: "John Doe", platform: "ios", lastActive: "2024-01-26", status: "valid" },
    { id: "2", user: "Jane Smith", platform: "android", lastActive: "2024-01-25", status: "valid" },
];

export default function DeviceTokensPage() {
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
            <h1 className="text-2xl font-bold">Device Tokens</h1>
            <DataTable
                data={mockData}
                columns={columns}
                getRowId={(row) => row.id}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                enableSelection={true}
                searchPlaceholder="Search tokens..."
            />
        </div>
    );
}
