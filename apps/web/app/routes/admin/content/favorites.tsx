import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Heart } from "lucide-react";
import { format } from "date-fns";

export const meta: MetaFunction = () => {
    return [{ title: "Favorites | Gharbatai Admin" }];
};

interface Favorite {
    id: string;
    user: string;
    listing: string;
    dateAdded: string;
}

const columns: Column<Favorite>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    { header: "User", accessorKey: "user", cell: ({ value: value }) => <span className="font-medium text-gray-700">{value}</span> },
    {
        header: "Listing",
        accessorKey: "listing",
        cell: ({ value: value }) => (
            <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500 fill-current" />
                <span className="text-blue-600 hover:underline cursor-pointer">{value}</span>
            </div>
        )
    },
    {
        header: "Date Added",
        accessorKey: "dateAdded",
        sortable: true,
        cell: ({ value: value }) => format(new Date(value as string), 'MMM dd, yyyy')
    }
];

const mockData: Favorite[] = [
    { id: "1", user: "John Doe", listing: "Modern Apartment", dateAdded: "2024-01-20" },
    { id: "2", user: "Jane Smith", listing: "Luxury Villa", dateAdded: "2024-01-21" },
    { id: "3", user: "Bob Brown", listing: "Modern Apartment", dateAdded: "2024-01-22" },
];

export default function FavoritesPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">Favorites Analysis</h1>
                    <p className="text-muted-foreground">Track user interests and popular listings.</p>
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
                searchPlaceholder="Search favorites..."
            />
        </div>
    );
}
