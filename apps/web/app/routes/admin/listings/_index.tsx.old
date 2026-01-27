import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { ListingsTable } from "~/components/admin/ListingsTable";
import { ListingFilters } from "~/components/admin/ListingFilters";
import { AdminDataTable } from "~/components/admin/AdminDataTable";
import { Button } from "~/components/ui/Button";
import { Plus, Download, Upload, Eye, Edit, Trash2 } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
    const user = await requireAdmin(request);
    const token = await getUserToken(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const category = url.searchParams.get("category") || "";
    const ownerId = url.searchParams.get("ownerId") || "";

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    // Fetch listings with filters
    const [listingsResponse, categoriesResponse, ownersResponse] = await Promise.all([
        fetch(
            `${API_BASE_URL}/admin/listings?page=${page}&limit=${limit}&search=${search}&status=${status}&category=${category}&ownerId=${ownerId}`,
            { headers }
        ),
        fetch(`${API_BASE_URL}/admin/categories`, { headers }),
        fetch(`${API_BASE_URL}/admin/users/owners`, { headers }),
    ]);

    if (!listingsResponse.ok) {
        throw new Response("Failed to fetch listings", { status: 500 });
    }

    const listingsData = await listingsResponse.json();
    const categoriesData = categoriesResponse.ok ? await categoriesResponse.json() : { data: [] };
    const ownersData = ownersResponse.ok ? await ownersResponse.json() : { data: [] };

    return {
        listings: listingsData.data || [],
        pagination: listingsData.pagination || { page, limit, total: 0, totalPages: 0 },
        filters: { search, status, category, ownerId },
        categories: categoriesData.data || [],
        owners: ownersData.data || [],
    };
}

export default function AdminListings() {
    const { listings, pagination, filters, categories, owners } = useLoaderData<typeof loader>();

    return (
        <AdminDataTable
            title="Listings Management"
            description="Manage property listings, approvals, and content moderation"
            actions={
                <>
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
                </>
            }
            filters={<ListingFilters initialFilters={filters} categories={categories} owners={owners} />}
            stats={
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-lg border">
                        <h3 className="text-sm font-medium text-gray-500">Total Listings</h3>
                        <p className="text-2xl font-bold text-gray-900">{pagination.total}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg border">
                        <h3 className="text-sm font-medium text-gray-500">Active</h3>
                        <p className="text-2xl font-bold text-green-600">
                            {listings.filter((l: any) => l.status === 'ACTIVE').length}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg border">
                        <h3 className="text-sm font-medium text-gray-500">Pending Review</h3>
                        <p className="text-2xl font-bold text-yellow-600">
                            {listings.filter((l: any) => l.status === 'PENDING').length}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg border">
                        <h3 className="text-sm font-medium text-gray-500">Draft</h3>
                        <p className="text-2xl font-bold text-gray-600">
                            {listings.filter((l: any) => l.status === 'DRAFT').length}
                        </p>
                    </div>
                </div>
            }
            pagination={pagination}
            filtersToUrl={(page, limit) =>
                `?page=${page}&limit=${limit}&search=${filters.search}&status=${filters.status}&category=${filters.category}&ownerId=${filters.ownerId}`
            }
        >
            <ListingsTable listings={listings} />
        </AdminDataTable>
    );
}
