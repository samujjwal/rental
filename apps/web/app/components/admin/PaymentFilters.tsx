import { Form, useSearchParams } from "react-router";
import { Search, Filter, X, CreditCard, Calendar, DollarSign } from "lucide-react";

interface PaymentFiltersProps {
    initialFilters: {
        search: string;
        status: string;
        method: string;
        dateFrom: string;
        dateTo: string;
        amountMin: string;
        amountMax: string;
    };
}

export function PaymentFilters({ initialFilters }: PaymentFiltersProps) {
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
                            placeholder="Search payments..."
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
                        <option value="PAID">Paid</option>
                        <option value="FAILED">Failed</option>
                        <option value="REFUNDED">Refunded</option>
                        <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
                    </select>

                    {/* Method Filter */}
                    <select
                        name="method"
                        defaultValue={initialFilters.method}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Methods</option>
                        <option value="STRIPE">Stripe</option>
                        <option value="PAYPAL">PayPal</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CREDIT_CARD">Credit Card</option>
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

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                    {/* Amount Range */}
                    <div className="flex space-x-2">
                        <div className="relative flex-1">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="number"
                                name="amountMin"
                                placeholder="Min"
                                defaultValue={initialFilters.amountMin}
                                className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="relative flex-1">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="number"
                                name="amountMax"
                                placeholder="Max"
                                defaultValue={initialFilters.amountMax}
                                className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Quick Date Filters */}
                    <div className="flex space-x-2">
                        <button
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                                const form = document.querySelector('form');
                                const dateFrom = form?.querySelector('input[name="dateFrom"]') as HTMLInputElement;
                                const dateTo = form?.querySelector('input[name="dateTo"]') as HTMLInputElement;
                                if (dateFrom) dateFrom.value = lastWeek.toISOString().split('T')[0];
                                if (dateTo) dateTo.value = today.toISOString().split('T')[0];
                                form?.requestSubmit();
                            }}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                        >
                            Last 7 days
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                                const form = document.querySelector('form');
                                const dateFrom = form?.querySelector('input[name="dateFrom"]') as HTMLInputElement;
                                const dateTo = form?.querySelector('input[name="dateTo"]') as HTMLInputElement;
                                if (dateFrom) dateFrom.value = lastMonth.toISOString().split('T')[0];
                                if (dateTo) dateTo.value = today.toISOString().split('T')[0];
                                form?.requestSubmit();
                            }}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                        >
                            Last 30 days
                        </button>
                    </div>

                    {/* Clear Filters */}
                    <a
                        href="/admin/payments"
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Clear All
                    </a>
                </div>

                {/* Active Filters */}
                {(initialFilters.search || initialFilters.status || initialFilters.method || initialFilters.dateFrom || initialFilters.dateTo || initialFilters.amountMin || initialFilters.amountMax) && (
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
                        {initialFilters.method && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Method: {initialFilters.method}
                            </span>
                        )}
                        {(initialFilters.dateFrom || initialFilters.dateTo) && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Dates: {initialFilters.dateFrom || 'Start'} - {initialFilters.dateTo || 'End'}
                            </span>
                        )}
                        {(initialFilters.amountMin || initialFilters.amountMax) && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                                Amount: ${initialFilters.amountMin || '0'} - ${initialFilters.amountMax || '∞'}
                            </span>
                        )}
                    </div>
                )}
            </Form>
        </div>
    );
}
