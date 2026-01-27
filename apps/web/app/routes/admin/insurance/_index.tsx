import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";

export const meta: MetaFunction = () => {
    return [{ title: "Insurance Policies | Gharbatai Admin" }];
};

interface Policy {
    id: string;
    policyNumber: string;
    holder: string;
    coverage: string;
    premium: number;
    expiryDate: string;
    status: 'active' | 'expired' | 'cancelled';
}

const columns: Column<Policy>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "Policy #", accessorKey: "policyNumber", cell: ({ value: value }) => <span className="font-mono">{value}</span> },
    { header: "Holder", accessorKey: "holder" },
    { header: "Coverage", accessorKey: "coverage" },
    { header: "Premium", accessorKey: "premium", cell: ({ value: value }) => <span>${value}/mo</span> },
    { header: "Expiry", accessorKey: "expiryDate", sortable: true },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => {
            if (value === 'active') return <Badge className="bg-green-100 text-green-800">Active</Badge>;
            if (value === 'expired') return <Badge variant="secondary">Expired</Badge>;
            return <Badge variant="destructive">Cancelled</Badge>;
        },
        filterable: true
    }
];

const mockData: Policy[] = [
    { id: "1", policyNumber: "POL-88219", holder: "John Doe", coverage: "Full Protection", premium: 45, expiryDate: "2025-01-01", status: "active" },
    { id: "2", policyNumber: "POL-88220", holder: "Jane Smith", coverage: "Basic", premium: 15, expiryDate: "2024-12-01", status: "active" },
    { id: "3", policyNumber: "POL-82100", holder: "Mike Ross", coverage: "Full Protection", premium: 45, expiryDate: "2023-11-01", status: "expired" },
];

export default function InsurancePoliciesPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">Insurance Policies</h1>
                    <p className="text-muted-foreground">Manage active insurance coverages.</p>
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
                searchPlaceholder="Search policies..."
            />
        </div>
    );
}
