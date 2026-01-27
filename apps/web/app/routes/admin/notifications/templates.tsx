import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { Edit } from "lucide-react";

export const meta: MetaFunction = () => {
    return [{ title: "Email Templates | Gharbatai Admin" }];
};

interface Template {
    id: string;
    name: string;
    subject: string;
    type: 'transactional' | 'marketing';
    lastUpdated: string;
}

const columns: Column<Template>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "Name", accessorKey: "name", cell: ({ value: value }) => <span className="font-semibold">{value}</span> },
    { header: "Subject Line", accessorKey: "subject" },
    {
        header: "Type",
        accessorKey: "type",
        filterable: true
    },
    { header: "Last Updated", accessorKey: "lastUpdated" },
    {
        id: "actions",
        header: "Actions",
        cell: () => <button className="p-1 hover:bg-gray-100 rounded"><Edit className="w-4 h-4 text-gray-600" /></button>
    }
];

const mockData: Template[] = [
    { id: "1", name: "Welcome Email", subject: "Welcome to Gharbatai!", type: "transactional", lastUpdated: "2024-01-10" },
    { id: "2", name: "Booking Confirmed", subject: "Your booking is confirmed", type: "transactional", lastUpdated: "2024-01-12" },
];

export default function EmailTemplatesPage() {
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
            <h1 className="text-2xl font-bold">Email Templates</h1>
            <DataTable
                data={mockData}
                columns={columns}
                getRowId={(row) => row.id}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                enableSelection={true}
                searchPlaceholder="Search templates..."
            />
        </div>
    );
}
