import { type MetaFunction } from "react-router";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Badge } from "~/components/ui/Badge";
import { Edit, Folder, Plus } from "lucide-react";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => {
    return [{ title: "Categories | Gharbatai Admin" }];
};

interface Category {
    id: string;
    name: string;
    slug: string;
    listingsCount: number;
    status: 'active' | 'inactive';
}

const columns: Column<Category>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    {
        header: "Name",
        accessorKey: "name",
        cell: ({ value: value }) => (
            <div className="flex items-center gap-2">
                <div className="p-1 bg-blue-50 rounded">
                    <Folder className="w-4 h-4 text-blue-500" />
                </div>
                <span className="font-medium">{value}</span>
            </div>
        )
    },
    { header: "Slug", accessorKey: "slug", cell: ({ value: value }) => <code className="bg-gray-100 px-1 rounded text-xs">{value}</code> },
    {
        header: "Listings",
        accessorKey: "listingsCount",
        sortable: true,
        cell: ({ value: value }) => <span className="font-semibold">{value}</span>
    },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => value === 'active' ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
        filterable: true
    },
    {
        id: "actions",
        header: "Actions",
        cell: () => (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Edit className="h-4 w-4" />
            </Button>
        )
    }
];

const mockData: Category[] = [
    { id: "1", name: "Apartments", slug: "apartments", listingsCount: 156, status: "active" },
    { id: "2", name: "Houses", slug: "houses", listingsCount: 89, status: "active" },
    { id: "3", name: "Commercial", slug: "commercial", listingsCount: 42, status: "active" },
    { id: "4", name: "Land", slug: "land", listingsCount: 23, status: "active" },
    { id: "5", name: "Events", slug: "events", listingsCount: 5, status: "inactive" },
];

export default function CategoriesPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
                    <p className="text-muted-foreground">Manage property categories and hierarchy.</p>
                </div>
                <Button className="flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Category
                </Button>
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
                searchPlaceholder="Search categories..."
            />
        </div>
    );
}
