import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { BookingsTable } from "~/components/admin/BookingsTable";
import { BookingFilters } from "~/components/admin/BookingFilters";
import { Button } from "~/components/ui/Button";
import { Plus, Download, Upload, Calendar, DollarSign, AlertTriangle } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
    const user = await requireAdmin(request);
    const token = await getUserToken(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const listingId = url.searchParams.get("listingId") || "";
    const renterId = url.searchParams.get("renterId") || "";
    const ownerId = url.searchParams.get("ownerId") || "";
    const dateFrom = url.searchParams.get("dateFrom") || "";
    const dateTo = url.searchParams.get("dateTo") || "";

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    // Fetch bookings with filters
    const [bookingsResponse, listingsResponse, usersResponse] = await Promise.all([
        fetch(
            `${API_BASE_URL}/admin/bookings?page=${page}&limit=${limit}&search=${search}&status=${status}&listingId=${listingId}&renterId=${renterId}&ownerId=${ownerId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
            { headers }
        ),
        fetch(`${API_BASE_URL}/admin/listings`, { headers }),
        fetch(`${API_BASE_URL}/admin/users`, { headers }),
    ]);

    if (!bookingsResponse.ok) {
        throw new Response("Failed to fetch bookings", { status: 500 });
    }

    const bookingsData = await bookingsResponse.json();
    const listingsData = listingsResponse.ok ? await listingsResponse.json() : { data: [] };
    const usersData = usersResponse.ok ? await usersResponse.json() : { data: [] };

    return {
        bookings: bookingsData.data || [],
        pagination: bookingsData.pagination || { page, limit, total: 0, totalPages: 0 },
        filters: { search, status, listingId, renterId, ownerId, dateFrom, dateTo },
        listings: listingsData.data || [],
        users: usersData.data || [],
    };
}

export default function AdminBookings() {
    const { bookings, pagination, filters, listings, users } = useLoaderData<typeof loader>();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Bookings Management</h1>
                    <p className="text-gray-600">Manage booking reservations, payments, and disputes</p>
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
                        Create Booking
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <BookingFilters
                initialFilters={filters}
                listings={listings}
                users={users}
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Total Bookings</h3>
                    <p className="text-2xl font-bold text-gray-900">{pagination.total}</p>
                </div>
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Confirmed</h3>
                    <p className="text-2xl font-bold text-green-600">
                        {bookings.filter((b: any) => b.status === 'CONFIRMED').length}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Pending</h3>
                    <p className="text-2xl font-bold text-yellow-600">
                        {bookings.filter((b: any) => b.status === 'PENDING').length}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-500">Disputed</h3>
                    <p className="text-2xl font-bold text-red-600">
                        {bookings.filter((b: any) => b.status === 'DISPUTED').length}
                    </p>
                </div>
            </div>

            {/* Revenue Summary */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <p className="text-sm text-gray-500">Total Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">
                            ${bookings.reduce((sum: number, b: any) => sum + (b.totalPrice || 0), 0).toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Pending Revenue</p>
                        <p className="text-2xl font-bold text-yellow-600">
                            ${bookings.filter((b: any) => b.status === 'PENDING')
                                .reduce((sum: number, b: any) => sum + (b.totalPrice || 0), 0).toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Refunded Amount</p>
                        <p className="text-2xl font-bold text-red-600">
                            ${bookings.filter((b: any) => b.status === 'REFUNDED')
                                .reduce((sum: number, b: any) => sum + (b.totalPrice || 0), 0).toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-white rounded-lg border">
                <BookingsTable bookings={bookings} />
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
                                to={`?page=${pageNum}&limit=${pagination.limit}&search=${filters.search}&status=${filters.status}&listingId=${filters.listingId}&renterId=${filters.renterId}&ownerId=${filters.ownerId}&dateFrom=${filters.dateFrom}&dateTo=${filters.dateTo}`}
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
