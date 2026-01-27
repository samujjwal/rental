import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { OrganizationsTable } from "~/components/admin/OrganizationsTable";
import { OrganizationFilters } from "~/components/admin/OrganizationFilters";
import { Button } from "~/components/ui/Button";
import { Plus, Download, Upload, Building, Users, Settings } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
    const user = await requireAdmin(request);
    const token = await getUserToken(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const plan = url.searchParams.get("plan") || "";

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    // Fetch organizations with filters
    const organizationsResponse = await fetch(
        `${API_BASE_URL}/admin/organizations?page=${page}&limit=${limit}&search=${search}&status=${status}&plan=${plan}`,
        { headers }
    );

    if (!organizationsResponse.ok) {
        throw new Response("Failed to fetch organizations", { status: 500 });
    }

    const organizationsData = await organizationsResponse.json();

    return {
        organizations: organizationsData.data || [],
        pagination: organizationsData.pagination || { page, limit, total: 0, totalPages: 0 },
        filters: { search, status, plan },
    };
}

export default function AdminOrganizations() {
    const { organizations, pagination, filters } = useLoaderData<typeof loader>();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Organizations Management</h1>
                    <p className="text-gray-600">Manage organizations, members, and subscription plans</p>
                </div>
                <div className="flex space-x-3">
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
                        Add Organization
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <OrganizationFilters initialFilters={filters} />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Total Organizations</h3>
                    <p className="text-2xl font-bold text-gray-900">{pagination.total}</p>
                </div>
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Active</h3>
                    <p className="text-2xl font-bold text-green-600">
                        {organizations.filter((o: any) => o.status === 'ACTIVE').length}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Total Members</h3>
                    <p className="text-2xl font-bold text-blue-600">
                        {organizations.reduce((sum: number, o: any) => sum + (o.memberCount || 0), 0)}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Premium Plans</h3>
                    <p className="text-2xl font-bold text-purple-600">
                        {organizations.filter((o: any) => o.plan === 'PREMIUM').length}
                    </p>
                </div>
            </div>

            {/* Organizations Table */}
            <div className="bg-white rounded-lg border">
                <OrganizationsTable organizations={organizations} />
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-700">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                        {pagination.total} results
                    </p>
                    <div className="flex space-x-2">
                        {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
                            <Link
                                key={pageNum}
                                to={`?page=${pageNum}&limit=${pagination.limit}&search=${filters.search}&status=${filters.status}&plan=${filters.plan}`}
                                className={`px-3 py-1 rounded ${pageNum === pagination.page
                                        ? "bg-blue-500 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                            >
                                {pageNum}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
