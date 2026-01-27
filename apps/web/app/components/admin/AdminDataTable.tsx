import type { ReactNode } from "react";
import { Link } from "react-router";

interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface AdminDataTableProps {
    title?: string;
    description?: string;
    actions?: ReactNode;
    filters: ReactNode;
    stats: ReactNode;
    children: ReactNode; // Table content
    pagination: PaginationInfo;
    filtersToUrl: (page: number, limit: number) => string;
}

export function AdminDataTable({
    title,
    description,
    actions,
    filters,
    stats,
    children,
    pagination,
    filtersToUrl,
}: AdminDataTableProps) {
    return (
        <div className="space-y-6">
            {title || description || actions ? (
                <div className="flex items-start justify-between gap-4">
                    <div>
                        {title ? <h1 className="text-2xl font-bold text-gray-900">{title}</h1> : null}
                        {description ? <p className="text-gray-600">{description}</p> : null}
                    </div>
                    {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
                </div>
            ) : null}

            {filters}

            {stats}

            <div className="bg-white rounded-lg border">{children}</div>

            {pagination.totalPages > 1 ? (
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
                                to={filtersToUrl(pageNum, pagination.limit)}
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
            ) : null}
        </div>
    );
}
