import { Form, useSearchParams } from "react-router";
import { Search, Filter, X, Calendar, User, Home, DollarSign } from "lucide-react";

interface Listing {
    id: string;
    title: string;
}

interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

interface BookingFiltersProps {
    initialFilters: {
        search: string;
        status: string;
        listingId: string;
        renterId: string;
        ownerId: string;
        dateFrom: string;
        dateTo: string;
    };
    listings: Listing[];
    users: User[];
}

export function BookingFilters({ initialFilters, listings, users }: BookingFiltersProps) {
    const [searchParams] = useSearchParams();

    return (
        <div className="bg-white p-4 rounded-lg border">
            <Form method="get" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            name="search"
                            placeholder="Search bookings..."
                            defaultValue={initialFilters.search}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        name="status"
                        defaultValue={initialFilters.status}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="DISPUTED">Disputed</option>
                        <option value="REFUNDED">Refunded</option>
                    </select>

                    {/* Listing Filter */}
                    <select
                        name="listingId"
                        defaultValue={initialFilters.listingId}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Listings</option>
                        {listings.map((listing) => (
                            <option key={listing.id} value={listing.id}>
                                {listing.title}
                            </option>
                        ))}
                    </select>

                    {/* Date Range */}
                    <div className="flex space-x-2">
                        <input
                            type="date"
                            name="dateFrom"
                            defaultValue={initialFilters.dateFrom}
                            placeholder="From"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="date"
                            name="dateTo"
                            defaultValue={initialFilters.dateTo}
                            placeholder="To"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Renter Filter */}
                    <select
                        name="renterId"
                        defaultValue={initialFilters.renterId}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Renters</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.firstName} {user.lastName} ({user.email})
                            </option>
                        ))}
                    </select>

                    {/* Owner Filter */}
                    <select
                        name="ownerId"
                        defaultValue={initialFilters.ownerId}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Owners</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.firstName} {user.lastName} ({user.email})
                            </option>
                        ))}
                    </select>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Apply Filters
                    </button>

                    {/* Clear Filters */}
                    <a
                        href="/admin/bookings"
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Clear All
                    </a>
                </div>

                {/* Active Filters */}
                {(initialFilters.search || initialFilters.status || initialFilters.listingId || initialFilters.renterId || initialFilters.ownerId || initialFilters.dateFrom || initialFilters.dateTo) && (
                    <div className="flex items-center space-x-2 pt-2 border-t">
                        <span className="text-sm text-gray-600">Active filters:</span>
                        {initialFilters.search && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Search: {initialFilters.search}
                            </span>
                        )}
                        {initialFilters.status && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Status: {initialFilters.status}
                            </span>
                        )}
                        {initialFilters.listingId && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Listing: {listings.find(l => l.id === initialFilters.listingId)?.title || initialFilters.listingId}
                            </span>
                        )}
                        {initialFilters.renterId && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Renter: {users.find(u => u.id === initialFilters.renterId)?.firstName || initialFilters.renterId}
                            </span>
                        )}
                        {initialFilters.ownerId && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Owner: {users.find(u => u.id === initialFilters.ownerId)?.firstName || initialFilters.ownerId}
                            </span>
                        )}
                        {(initialFilters.dateFrom || initialFilters.dateTo) && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Dates: {initialFilters.dateFrom || 'Start'} - {initialFilters.dateTo || 'End'}
                            </span>
                        )}
                    </div>
                )}
            </Form>
        </div>
    );
}
