import { type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { DataTable } from "~/components/data-table/DataTable";
import { type ColumnDef as Column } from "~/components/data-table/DataTable";
import { useDataTable } from "~/hooks/use-data-table";
import { Star, Eye, EyeOff, Flag, MoreHorizontal } from "lucide-react";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => {
    return [{ title: "Reviews | Gharbatai Admin" }];
};

interface Review {
    id: string;
    author: string;
    listing: string;
    rating: number;
    comment: string;
    date: string;
    status: 'published' | 'hidden' | 'flagged';
}

interface LoaderData {
    reviews: Review[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export async function loader({ request }: LoaderFunctionArgs) {
    await requireAdmin(request);
    const token = await getUserToken(request);
    const url = new URL(request.url);
    const page = url.searchParams.get("page") || "1";
    const limit = url.searchParams.get("limit") || "10";
    const status = url.searchParams.get("status") || "";
    const search = url.searchParams.get("search") || "";

    const API_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    const params = new URLSearchParams({ page, limit });
    if (status) params.append("status", status.toUpperCase());
    if (search) params.append("search", search);

    const res = await fetch(`${API_URL}/admin/reviews?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Failed to fetch reviews");
    const { reviews: rawReviews, pagination } = await res.json();

    const reviews = rawReviews.map((r: any) => ({
        id: r.id,
        author: `${r.reviewer.firstName} ${r.reviewer.lastName}`,
        listing: r.listing.title,
        rating: r.overallRating,
        comment: r.content,
        date: r.createdAt,
        status: r.status.toLowerCase()
    }));

    return { reviews, pagination };
}

export async function action({ request }: ActionFunctionArgs) {
    await requireAdmin(request);
    const token = await getUserToken(request);
    const formData = await request.formData();
    const reviewId = formData.get("reviewId");
    const status = formData.get("status");

    const API_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    const res = await fetch(`${API_URL}/admin/reviews/${reviewId}/status`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
    });

    if (!res.ok) return { error: "Failed to update review status" };
    return { success: true };
}

const ReviewActions = ({ review }: { review: Review }) => {
    const fetcher = useFetcher();

    return (
        <div className="flex items-center gap-2">
            {review.status === 'published' ? (
                <Button
                    size="sm"
                    variant="ghost"
                    title="Hide Review"
                    onClick={() => fetcher.submit({ reviewId: review.id, status: 'HIDDEN' }, { method: 'post' })}
                >
                    <EyeOff className="w-4 h-4 text-orange-500" />
                </Button>
            ) : (
                <Button
                    size="sm"
                    variant="ghost"
                    title="Publish Review"
                    onClick={() => fetcher.submit({ reviewId: review.id, status: 'PUBLISHED' }, { method: 'post' })}
                >
                    <Eye className="w-4 h-4 text-green-500" />
                </Button>
            )}
            <Button
                size="sm"
                variant="ghost"
                title="Flag Review"
                onClick={() => fetcher.submit({ reviewId: review.id, status: 'FLAGGED' }, { method: 'post' })}
            >
                <Flag className="w-4 h-4 text-red-500" />
            </Button>
        </div>
    );
};

const columns: Column<Review>[] = [
    { header: "ID", accessorKey: "id", hidden: true },
    {
        header: "Author",
        accessorKey: "author",
        cell: ({ value: value }) => <span className="font-medium">{value}</span>
    },
    {
        header: "Listing",
        accessorKey: "listing",
        cell: ({ value: value }) => <span className="text-blue-600 hover:underline cursor-pointer">{value}</span>
    },
    {
        header: "Rating",
        accessorKey: "rating",
        cell: ({ value: value }) => (
            <div className="flex items-center text-yellow-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="ml-1 text-gray-700">{value}</span>
            </div>
        ),
        filterable: true
    },
    {
        header: "Comment",
        accessorKey: "comment",
        cell: ({ value: value }) => <span className="text-gray-600 truncate max-w-xs block" title={value as string}>{value}</span>
    },
    {
        header: "Status",
        accessorKey: "status",
        cell: ({ value: value }) => {
            const styles = {
                published: "bg-green-100 text-green-800",
                hidden: "bg-gray-100 text-gray-800",
                flagged: "bg-red-100 text-red-800",
                draft: "bg-gray-100 text-gray-800"
            };
            // @ts-ignore
            return <Badge className={styles[value] || "bg-gray-100"}>{value}</Badge>;
        },
        filterable: true
    },
    {
        header: "Date",
        accessorKey: "date",
        sortable: true
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => <ReviewActions review={row} />
    }
];

export default function ReviewsPage() {
    const { reviews, pagination: initialPagination } = useLoaderData<LoaderData>();

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
        totalRows: initialPagination.total,
        totalPages: initialPagination.totalPages,
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Review Management</h1>
                    <p className="text-muted-foreground">Monitor and moderate property reviews.</p>
                </div>
            </div>

            <DataTable
                data={reviews}
                columns={columns}
                getRowId={(row) => row.id}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                enableSelection={true}
                searchPlaceholder="Search reviews..."
            />
        </div>
    );
}
