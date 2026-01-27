import { Form, useSearchParams } from "react-router";
import { Search, Filter, X } from "lucide-react";

interface UserFiltersProps {
    initialFilters: {
        search: string;
        role: string;
        status: string;
    };
}

export function UserFilters({ initialFilters }: UserFiltersProps) {
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
                            placeholder="Search users..."
                            defaultValue={initialFilters.search}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Role Filter */}
                    <select
                        name="role"
                        defaultValue={initialFilters.role}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Roles</option>
                        <option value="ADMIN">Admin</option>
                        <option value="OWNER">Owner</option>
                        <option value="CUSTOMER">Customer</option>
                        <option value="SUPPORT">Support</option>
                    </select>

                    {/* Status Filter */}
                    <select
                        name="status"
                        defaultValue={initialFilters.status}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="DELETED">Deleted</option>
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
                {(initialFilters.search || initialFilters.role || initialFilters.status) && (
                    <div className="flex items-center space-x-2 pt-2 border-t">
                        <span className="text-sm text-gray-600">Active filters:</span>
                        {initialFilters.search && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Search: {initialFilters.search}
                            </span>
                        )}
                        {initialFilters.role && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Role: {initialFilters.role}
                            </span>
                        )}
                        {initialFilters.status && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Status: {initialFilters.status}
                            </span>
                        )}
                        <a
                            href="/admin/users"
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
