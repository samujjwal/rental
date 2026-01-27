import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";

export const meta: MetaFunction = () => {
    return [{ title: "Insurance Claims | Gharbatai Admin" }];
};

interface Claim {
    id: string;
    claimNumber: string;
    policyNumber: string;
    incident: string;
    amount: number;
    status: 'submitted' | 'reviewing' | 'approved' | 'rejected';
    date: string;
}

const columns: Column<Claim>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "Claim #", accessorKey: "claimNumber", cell: ({ value: value }) => <span className="font-bold">{value}</span> },
    { header: "Policy #", accessorKey: "policyNumber", cell: ({ value: value }) => <span className="font-mono text-sm">{value}</span> },
    { header: "Incident Type", accessorKey: "incident" },
    { header: "Claim Amount", accessorKey: "amount", cell: ({ value: value }) => <span>${value}</span>, sortable: true },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => {
            if (value === 'approved') return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
            if (value === 'reviewing') return <Badge className="bg-blue-100 text-blue-800">Reviewing</Badge>;
            if (value === 'submitted') return <Badge variant="secondary">Submitted</Badge>;
            return <Badge variant="destructive">Rejected</Badge>;
        },
        filterable: true
    },
    { header: "Date", accessorKey: "date", sortable: true },
];

const mockData: Claim[] = [
    { id: "1", claimNumber: "CLM-001", policyNumber: "POL-88219", incident: "Accidental Damage", amount: 500, status: "reviewing", date: "2024-01-26" },
    { id: "2", claimNumber: "CLM-002", policyNumber: "POL-88220", incident: "Theft", amount: 1200, status: "submitted", date: "2024-01-25" },
];

export default function InsuranceClaimsPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">Claim Management</h1>
                    <p className="text-muted-foreground">Process insurance claims.</p>
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
                searchPlaceholder="Search claims..."
            />
        </div>
    );
}
