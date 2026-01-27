import { Form, useSearchParams } from "react-router";
import { Search, Filter, X, Home, User, MapPin } from "lucide-react";

interface Category {
    id: string;
    name: string;
}

interface Owner {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

interface ListingFiltersProps {
    initialFilters: {
        search: string;
        status: string;
        category: string;
        ownerId: string;
    };
    categories: Category[];
    owners: Owner[];
}

export function ListingFilters({ initialFilters, categories, owners }: ListingFiltersProps) {
    const [searchParams] = useSearchParams();

    return (
        <div className="bg-white p-4 rounded-lg border">
            <Form method="get" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            name="search"
                            placeholder="Search listings..."
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
                        <option value="ACTIVE">Active</option>
                        <option value="PENDING">Pending Review</option>
                        <option value="DRAFT">Draft</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="SUSPENDED">Suspended</option>
                    </select>

                    {/* Category Filter */}
                    <select
                        name="category"
                        defaultValue={initialFilters.category}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Categories</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
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
                        {owners.map((owner) => (
                            <option key={owner.id} value={owner.id}>
                                {owner.firstName} {owner.lastName} ({owner.email})
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
                </div>

                {/* Active Filters */}
                {(initialFilters.search || initialFilters.status || initialFilters.category || initialFilters.ownerId) && (
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
                        {initialFilters.category && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Category: {categories.find(c => c.id === initialFilters.category)?.name || initialFilters.category}
                            </span>
                        )}
                        {initialFilters.ownerId && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Owner: {owners.find(o => o.id === initialFilters.ownerId)?.firstName || initialFilters.ownerId}
                            </span>
                        )}
                        <a
                            href="/admin/listings"
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                        >
                            <X className="w-3 h-3 mr-1" />
                            Clear all
                        </a>
                    </div>
                )}
            </Form>
        </div>
    );
}
