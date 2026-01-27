import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { DataTable, type ColumnDef, type ActionDef, type BulkActionDef, type PaginationState } from "~/components/data-table/DataTable";
import { FilterPanel, type FilterField } from "~/components/data-table/FilterPanel";
import { StatsGrid, type StatCard } from "~/components/data-table/StatsGrid";
import { Button } from "~/components/ui/Button";
import { useDataTable } from "~/hooks/use-data-table";
import {
    Plus,
    Download,
    Upload,
    Eye,
    Edit,
    Trash2,
    CheckCircle2,
    Clock,
    XCircle,
    Building2,
    MapPin,
    Tag,
    ShieldCheck,
    AlertCircle
} from "lucide-react";

// ============= TYPES =============

interface Listing {
    id: string;
    title: string;
    description: string;
    price: number;
    pricePeriod: string;
    status: 'ACTIVE' | 'PENDING' | 'DRAFT' | 'INACTIVE' | 'REJECTED';
    category: {
        id: string;
        name: string;
    };
    owner: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    address: string;
    city: string;
    isVerified: boolean;
    createdAt: string;
}

interface LoaderData {
    listings: Listing[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    stats: {
        total: number;
        active: number;
        pending: number;
        rejected: number;
    };
    categories: any[];
}

// ============= ACTION =============

export async function action({ request }: ActionFunctionArgs) {
    const user = await requireAdmin(request);
    const token = await getUserToken(request);
    const formData = await request.formData();
    const intent = formData.get("intent");
    const listingId = formData.get("listingId");

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    if (!listingId || typeof listingId !== "string") {
        return { error: "Invalid listing ID" };
    }

    try {
        if (intent === "approve" || intent === "reject") {
            const status = intent === "approve" ? "ACTIVE" : "REJECTED";

            // For rejection, we might want to capture a reason (not implemented in UI yet)
            const body = { status };

            const response = await fetch(`${API_BASE_URL}/admin/listings/${listingId}/status`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                return { error: `Failed to ${intent} listing` };
            }

            return { success: true };
        } else if (intent === "delete") {
            const response = await fetch(`${API_BASE_URL}/admin/listings/${listingId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                return { error: "Failed to delete listing" };
            }

            return { success: true };
        }
    } catch (error) {
        return { error: "Network error" };
    }

    return null;
}

// ============= LOADER =============

export async function loader({ request }: LoaderFunctionArgs) {
    const user = await requireAdmin(request);
    const token = await getUserToken(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '25');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    const categoryId = url.searchParams.get('categoryId') || '';

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            ...(search && { search }),
            ...(status && { status }),
            ...(categoryId && { categoryId }),
        });

        const [listingsRes, categoriesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/admin/listings?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }),
            fetch(`${API_BASE_URL}/admin/categories`, { // Assuming this endpoint exists, or mocked
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            })
        ]);

        const listingsData = listingsRes.ok ? await listingsRes.json() : { listings: [], total: 0 };
        const categoriesData = categoriesRes.ok ? await categoriesRes.json() : { data: [] };

        // Normalize response
        return {
            listings: listingsData.listings || [],
            pagination: {
                page,
                limit,
                total: listingsData.total || 0,
                totalPages: Math.ceil((listingsData.total || 0) / limit)
            },
            stats: {
                total: listingsData.total || 0,
                active: (listingsData.listings || []).filter((l: any) => l.status === 'ACTIVE').length,
                pending: (listingsData.listings || []).filter((l: any) => l.status === 'PENDING').length,
                rejected: (listingsData.listings || []).filter((l: any) => l.status === 'REJECTED').length,
            },
            categories: categoriesData.data || []
        };
    } catch (error) {
        console.error('Error loading listings:', error);
        return {
            listings: [],
            pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
            stats: { total: 0, active: 0, pending: 0, rejected: 0 },
            categories: []
        };
    }
}

// ============= COMPONENT =============

export default function AdminListingsPage() {
    const data = useLoaderData<LoaderData>();
    const navigate = useNavigate();
    const fetcher = useFetcher();
    const {
        handlePaginationChange,
        selectedRows,
        setSelectedRows
    } = useDataTable();

    // ============= STATS CONFIGURATION =============

    const stats: StatCard[] = [
        {
            id: 'total',
            label: 'Total Listings',
            value: data.stats.total,
            icon: Building2,
            color: 'blue',
            trend: { value: 5, label: 'vs last week', direction: 'up' }
        },
        {
            id: 'active',
            label: 'Active',
            value: data.stats.active,
            icon: CheckCircle2,
            color: 'green',
            trend: { value: 12, label: 'vs last month', direction: 'up' }
        },
        {
            id: 'pending',
            label: 'Pending Review',
            value: data.stats.pending,
            icon: Clock,
            color: 'yellow',
            trend: { value: 2, label: 'new today', direction: 'up' }
        },
        {
            id: 'rejected',
            label: 'Rejected',
            value: data.stats.rejected,
            icon: XCircle,
            color: 'red',
        }
    ];

    // ============= TABLE CONFIGURATION =============

    const columns: ColumnDef<Listing>[] = [
        {
            id: 'title',
            header: 'Listing Info',
            accessorKey: 'title',
            sortable: true,
            className: 'min-w-[250px]',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-gray-900 line-clamp-1">{row.title}</span>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        {row.city}
                    </div>
                </div>
            )
        },
        {
            id: 'owner',
            header: 'Owner',
            cell: ({ row }) => (
                <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 uppercase">
                        {row.owner?.firstName?.[0] || 'U'}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">{row.owner?.firstName} {row.owner?.lastName}</span>
                        <span className="text-xs text-gray-500">{row.owner?.email}</span>
                    </div>
                </div>
            )
        },
        {
            id: 'category',
            header: 'Category',
            cell: ({ row }) => (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                    <Tag className="w-3 h-3 mr-1" />
                    {row.category?.name || 'Uncategorized'}
                </span>
            )
        },
        {
            id: 'price',
            header: 'Price',
            sortable: true,
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">Rs. {row.price?.toLocaleString()}</span>
                    <span className="text-xs text-gray-500">per {row.pricePeriod}</span>
                </div>
            )
        },
        {
            id: 'status',
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row }) => {
                const styles = {
                    ACTIVE: 'bg-green-100 text-green-800',
                    PENDING: 'bg-yellow-100 text-yellow-800',
                    DRAFT: 'bg-gray-100 text-gray-800',
                    REJECTED: 'bg-red-100 text-red-800',
                    INACTIVE: 'bg-orange-100 text-orange-800',
                };
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[row.status] || styles.DRAFT}`}>
                        {row.status}
                    </span>
                );
            }
        },
        {
            id: 'verification',
            header: 'Verification',
            cell: ({ row }) => (
                row.isVerified ? (
                    <span className="flex items-center text-blue-600 text-xs font-medium">
                        <ShieldCheck className="w-4 h-4 mr-1" />
                        Verified
                    </span>
                ) : (
                    <span className="flex items-center text-gray-400 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        Unverified
                    </span>
                )
            )
        }
    ];

    const actions: ActionDef<Listing>[] = [
        {
            id: 'view',
            label: 'View Details',
            icon: Eye,
            onClick: (row) => navigate(`/admin/listings/${row.id}`),
        },
        {
            id: 'approve',
            label: 'Approve Listing',
            icon: CheckCircle2,
            show: (row) => row.status === 'PENDING',
            onClick: async (row) => {
                if (confirm('Approve this listing for publication?')) {
                    fetcher.submit(
                        { intent: "approve", listingId: row.id },
                        { method: "post" }
                    );
                }
            },
        },
        {
            id: 'edit',
            label: 'Edit Content',
            icon: Edit,
            onClick: (row) => navigate(`/admin/listings/${row.id}/edit`),
        },
        {
            id: 'delete',
            label: 'Delete Listing',
            icon: Trash2,
            variant: 'destructive',
            onClick: async (row) => {
                if (confirm('This action cannot be undone. Delete this listing?')) {
                    fetcher.submit(
                        { intent: "delete", listingId: row.id },
                        { method: "post" }
                    );
                }
            },
        },
    ];

    const bulkActions: BulkActionDef<Listing>[] = [
        {
            id: 'approve_all',
            label: 'Approve Selected',
            icon: CheckCircle2,
            onClick: async (rows) => alert(`Approving ${rows.length} listings...`),
        },
        {
            id: 'reject_all',
            label: 'Reject Selected',
            icon: XCircle,
            variant: 'destructive',
            onClick: async (rows) => alert(`Rejecting ${rows.length} listings...`),
        },
        {
            id: 'export',
            label: 'Export CSV',
            icon: Download,
            onClick: async (rows) => alert(`Exporting ${rows.length} listings...`),
        },
    ];

    // ============= FILTER CONFIGURATION =============

    const filterFields: FilterField[] = [
        {
            id: 'search',
            label: 'Search',
            type: 'text',
            placeholder: 'Title, location...',
        },
        {
            id: 'status',
            label: 'Status',
            type: 'select',
            options: [
                { label: 'All Statuses', value: '' },
                { label: 'Active', value: 'ACTIVE' },
                { label: 'Pending', value: 'PENDING' },
                { label: 'Draft', value: 'DRAFT' },
                { label: 'Rejected', value: 'REJECTED' },
            ],
        },
        {
            id: 'categoryId',
            label: 'Category',
            type: 'select',
            options: [
                { label: 'All Categories', value: '' },
                ...data.categories.map(c => ({ label: c.name, value: c.id }))
            ],
        },
        {
            id: 'isVerified',
            label: 'Verification',
            type: 'boolean',
        },
    ];

    const pagination: PaginationState = {
        pageIndex: (data.pagination?.page ?? 1) - 1,
        pageSize: data.pagination?.limit ?? 25,
        totalRows: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
    };

    // ============= RENDER =============

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Listings</h1>
                    <p className="text-gray-600 mt-1">Manage rental properties and moderation</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Upload className="w-4 h-4 mr-2" />
                        Import
                    </Button>
                    <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Listing
                    </Button>
                </div>
            </div>

            <StatsGrid stats={stats} />

            <FilterPanel
                fields={filterFields}
                presetStorageKey="admin-listings-filters"
            />

            <DataTable
                data={data.listings}
                columns={columns}
                getRowId={(row) => row.id}
                actions={actions}
                bulkActions={bulkActions}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                enableSelection={true}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                searchPlaceholder="Quick search listings..."
                onRowClick={(row) => navigate(`/admin/listings/${row.id}`)}
                emptyState={{
                    title: 'No listings found',
                    description: 'Try adjusting your filters or search query',
                    icon: Building2,
                }}
            />
        </div>
    );
}
