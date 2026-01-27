import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { DataTable } from "~/components/admin/DataTable";
import { GenericFilters, type FilterField } from "~/components/admin/GenericFilters";
import { AdminPageLayout } from "~/components/admin/AdminPageLayout";
import { Button } from "~/components/ui/Button";
import { ErrorBoundary } from "~/components/ErrorBoundary";
import {
    Plus,
    Download,
    Upload,
    Eye,
    Edit,
    Trash2,
    UserCheck,
    UserX,
    Shield,
    Mail,
    Phone,
    MapPin,
    Calendar,
    Star
} from "lucide-react";

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'ADMIN' | 'OWNER' | 'CUSTOMER' | 'SUPPORT';
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';
    emailVerified: boolean;
    phoneVerified: boolean;
    createdAt: string;
    lastLoginAt?: string;
    city?: string;
    country?: string;
    averageRating: number;
    totalReviews: number;
    phoneNumber?: string;
}

interface UsersResponse {
    data: User[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

interface NormalizedResponseResult extends UsersResponse {
    usedFallbackData: boolean;
    usedFallbackPagination: boolean;
}

type PaginationInput = {
    page: number;
    limit: number;
};

// Mock data for development
function getMockData(
    page: number,
    limit: number,
    search: string,
    role: string,
    status: string,
    emailVerified: string,
    phoneVerified: string
) {
    const mockUsers: User[] = [
        {
            id: "1",
            email: "admin@example.com",
            firstName: "John",
            lastName: "Doe",
            role: "ADMIN",
            status: "ACTIVE",
            emailVerified: true,
            phoneVerified: true,
            createdAt: "2024-01-15T10:30:00Z",
            lastLoginAt: "2024-01-26T09:15:00Z",
            city: "New York",
            country: "USA",
            averageRating: 4.8,
            totalReviews: 124,
            phoneNumber: "+1-555-0123"
        },
        {
            id: "2",
            email: "owner@example.com",
            firstName: "Jane",
            lastName: "Smith",
            role: "OWNER",
            status: "ACTIVE",
            emailVerified: true,
            phoneVerified: false,
            createdAt: "2024-01-10T14:20:00Z",
            lastLoginAt: "2024-01-25T16:45:00Z",
            city: "Los Angeles",
            country: "USA",
            averageRating: 4.6,
            totalReviews: 89,
            phoneNumber: "+1-555-0124"
        },
        {
            id: "3",
            email: "customer@example.com",
            firstName: "Bob",
            lastName: "Johnson",
            role: "CUSTOMER",
            status: "ACTIVE",
            emailVerified: true,
            phoneVerified: true,
            createdAt: "2024-01-05T08:45:00Z",
            lastLoginAt: "2024-01-24T11:30:00Z",
            city: "Chicago",
            country: "USA",
            averageRating: 4.2,
            totalReviews: 45,
            phoneNumber: "+1-555-0125"
        },
        {
            id: "4",
            email: "support@example.com",
            firstName: "Alice",
            lastName: "Brown",
            role: "SUPPORT",
            status: "INACTIVE",
            emailVerified: false,
            phoneVerified: true,
            createdAt: "2023-12-20T12:15:00Z",
            lastLoginAt: "2024-01-20T13:20:00Z",
            city: "Houston",
            country: "USA",
            averageRating: 4.9,
            totalReviews: 67,
            phoneNumber: "+1-555-0126"
        },
        {
            id: "5",
            email: "suspended@example.com",
            firstName: "Charlie",
            lastName: "Wilson",
            role: "CUSTOMER",
            status: "SUSPENDED",
            emailVerified: true,
            phoneVerified: false,
            createdAt: "2023-11-15T09:30:00Z",
            lastLoginAt: "2024-01-18T10:45:00Z",
            city: "Phoenix",
            country: "USA",
            averageRating: 3.8,
            totalReviews: 23,
            phoneNumber: "+1-555-0127"
        }
    ];

    // Apply filters
    let filteredUsers = mockUsers.filter(user => {
        if (search && !user.email.toLowerCase().includes(search.toLowerCase()) &&
            !user.firstName.toLowerCase().includes(search.toLowerCase()) &&
            !user.lastName.toLowerCase().includes(search.toLowerCase())) {
            return false;
        }
        if (role && user.role !== role) return false;
        if (status && user.status !== status) return false;
        if (emailVerified && user.emailVerified.toString() !== emailVerified) return false;
        if (phoneVerified && user.phoneVerified.toString() !== phoneVerified) return false;
        return true;
    });

    // Apply pagination
    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    const stats = {
        total: mockUsers.length,
        active: mockUsers.filter(u => u.status === 'ACTIVE').length,
        admins: mockUsers.filter(u => u.role === 'ADMIN').length,
        newThisMonth: mockUsers.filter(u => {
            const created = new Date(u.createdAt);
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return created > monthAgo;
        }).length
    };

    return {
        users: paginatedUsers,
        pagination: {
            page,
            limit,
            total: filteredUsers.length,
            totalPages
        },
        stats,
        filters: { search, role, status, emailVerified, phoneVerified }
    };
}

function normalizeUsersResponse(raw: any, fallback: PaginationInput): NormalizedResponseResult {
    const candidateArrays: any[] = [
        raw?.data,
        raw?.data?.data,
        raw?.result,
        raw?.users,
        raw?.payload?.data,
        raw?.records,
        raw,
    ];

    let data: User[] = [];
    let usedFallbackData = true;
    for (const candidate of candidateArrays) {
        if (Array.isArray(candidate)) {
            data = candidate as User[];
            usedFallbackData = false;
            break;
        }
    }

    const paginationCandidates: any[] = [
        raw?.pagination,
        raw?.data?.pagination,
        raw?.meta,
        raw?.metadata,
        raw?.paginationInfo,
    ];

    let paginationSource = paginationCandidates.find(
        (candidate) =>
            candidate &&
            typeof candidate === 'object' &&
            typeof candidate.page === 'number' &&
            typeof candidate.limit === 'number'
    );

    let pagination;
    let usedFallbackPagination = false;

    if (!paginationSource) {
        usedFallbackPagination = true;
        pagination = {
            page: fallback.page,
            limit: fallback.limit,
            total: data.length,
            totalPages: Math.max(1, Math.ceil(data.length / fallback.limit) || 1)
        };
    } else {
        pagination = {
            page: paginationSource.page ?? fallback.page,
            limit: paginationSource.limit ?? fallback.limit,
            total: paginationSource.total ?? data.length,
            totalPages:
                paginationSource.totalPages ??
                Math.max(1, Math.ceil((paginationSource.total ?? data.length) / (paginationSource.limit ?? fallback.limit) || 1))
        };
    }

    return {
        data,
        pagination,
        usedFallbackData,
        usedFallbackPagination
    };
}

export async function loader({ request }: LoaderFunctionArgs) {
    try {
        const user = await requireAdmin(request);
        const token = await getUserToken(request);

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const search = url.searchParams.get("search") || "";
        const role = url.searchParams.get("role") || "";
        const status = url.searchParams.get("status") || "";
        const emailVerified = url.searchParams.get("emailVerified") || "";
        const phoneVerified = url.searchParams.get("phoneVerified") || "";

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };

        const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

        // Build query string
        const queryParams = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            ...(search && { search }),
            ...(role && { role }),
            ...(status && { status }),
            ...(emailVerified && { emailVerified }),
            ...(phoneVerified && { phoneVerified }),
        });

        console.log(`Fetching users from: ${API_BASE_URL}/admin/users?${queryParams.toString()}`);

        // Fetch users with filters
        const usersResponse = await fetch(
            `${API_BASE_URL}/admin/users?${queryParams.toString()}`,
            { headers }
        );

        if (!usersResponse.ok) {
            const errorText = await usersResponse.text();
            console.error('API Error Response:', errorText);

            // If API is not available, use mock data for development
            if (usersResponse.status === 401 || usersResponse.status === 404 || usersResponse.status === 500) {
                console.log('API not available, using mock data');
                return getMockData(page, limit, search, role, status, emailVerified, phoneVerified);
            }

            throw new Response(`Failed to fetch users: ${usersResponse.status} ${errorText}`, {
                status: usersResponse.status
            });
        }

        const rawUsersData: unknown = await usersResponse.json();
        console.log('Users data received:', rawUsersData);

        const normalized = normalizeUsersResponse(rawUsersData, { page, limit });

        if (normalized.usedFallbackData) {
            console.warn('API response missing users array. Falling back to empty dataset.');
        }
        if (normalized.usedFallbackPagination) {
            console.warn('API response missing pagination. Using fallback pagination values.');
        }

        // Calculate stats from the data
        const stats = {
            total: normalized.pagination.total,
            active: normalized.data.filter(u => u.status === 'ACTIVE').length,
            admins: normalized.data.filter(u => u.role === 'ADMIN').length,
            newThisMonth: normalized.data.filter(u => {
                const created = new Date(u.createdAt);
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return created > monthAgo;
            }).length
        };

        return {
            users: normalized.data,
            pagination: normalized.pagination,
            stats,
            filters: { search, role, status, emailVerified, phoneVerified }
        };
    } catch (error) {
        console.error('Error loading users:', error);

        // Return a more specific error message
        if (error instanceof Response) {
            throw error;
        }

        throw new Response("Failed to load users", { status: 500 });
    }
}

export default function AdminUsers() {
    return (
        <ErrorBoundary
            onError={(error, errorInfo) => {
                console.error('Admin Users Error:', error, errorInfo);
            }}
        >
            <AdminUsersContent />
        </ErrorBoundary>
    );
}

function AdminUsersContent() {
    const data = useLoaderData<typeof loader>();
    const { users, pagination, stats, filters } = data!;
    const navigate = useNavigate();

    // Validate data before rendering
    if (!users || !Array.isArray(users)) {
        console.error('Invalid users data:', data);
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h2 className="text-red-800 font-semibold">Data Error</h2>
                    <p className="text-red-600">Invalid user data received. Please try refreshing the page.</p>
                    <Button
                        onClick={() => window.location.reload()}
                        className="mt-2"
                    >
                        Refresh Page
                    </Button>
                </div>
            </div>
        );
    }

    if (!pagination) {
        console.error('Missing pagination data:', data);
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h2 className="text-red-800 font-semibold">Data Error</h2>
                    <p className="text-red-600">Missing pagination data. Please try refreshing the page.</p>
                    <Button
                        onClick={() => window.location.reload()}
                        className="mt-2"
                    >
                        Refresh Page
                    </Button>
                </div>
            </div>
        );
    }

    // Define filter configuration
    const filterFields: FilterField[] = [
        {
            key: 'search',
            label: 'Search',
            type: 'text',
            placeholder: 'Search by name, email, or ID...'
        },
        {
            key: 'role',
            label: 'Role',
            type: 'select',
            options: [
                { value: 'ADMIN', label: 'Admin' },
                { value: 'OWNER', label: 'Owner' },
                { value: 'CUSTOMER', label: 'Customer' },
                { value: 'SUPPORT', label: 'Support' }
            ]
        },
        {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
                { value: 'SUSPENDED', label: 'Suspended' },
                { value: 'DELETED', label: 'Deleted' }
            ]
        },
        {
            key: 'emailVerified',
            label: 'Email Verified',
            type: 'boolean'
        },
        {
            key: 'phoneVerified',
            label: 'Phone Verified',
            type: 'boolean'
        }
    ];

    // Define table columns
    const columns = [
        {
            key: 'name' as keyof User,
            label: 'User',
            sortable: true,
            render: (value: any, row: User) => (
                <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                                {row.firstName[0]}{row.lastName[0]}
                            </span>
                        </div>
                    </div>
                    <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                            {row.firstName} {row.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                            ID: {row.id.slice(0, 8)}...
                        </div>
                    </div>
                </div>
            ),
            width: '250px'
        },
        {
            key: 'email' as keyof User,
            label: 'Contact',
            sortable: true,
            render: (value: any, row: User) => (
                <div>
                    <div className="text-sm text-gray-900">{row.email}</div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Mail className="w-3 h-3" />
                        <span className={row.emailVerified ? "text-green-600" : "text-red-600"}>
                            {row.emailVerified ? "Verified" : "Not Verified"}
                        </span>
                        {row.phoneNumber && (
                            <>
                                <Phone className="w-3 h-3 ml-2" />
                                <span className={row.phoneVerified ? "text-green-600" : "text-red-600"}>
                                    {row.phoneVerified ? "Phone Verified" : "Phone Not Verified"}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            ),
            width: '200px'
        },
        {
            key: 'role',
            label: 'Role',
            sortable: true,
            render: (value: string) => {
                const styles = {
                    ADMIN: "bg-purple-100 text-purple-800",
                    OWNER: "bg-blue-100 text-blue-800",
                    CUSTOMER: "bg-gray-100 text-gray-800",
                    SUPPORT: "bg-yellow-100 text-yellow-800"
                };
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[value as keyof typeof styles] || 'bg-gray-100'}`}>
                        {value}
                    </span>
                );
            },
            width: '100px'
        },
        {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (value: string) => {
                const styles = {
                    ACTIVE: "bg-green-100 text-green-800",
                    INACTIVE: "bg-gray-100 text-gray-800",
                    SUSPENDED: "bg-red-100 text-red-800",
                    DELETED: "bg-gray-100 text-gray-400"
                };
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[value as keyof typeof styles] || 'bg-gray-100'}`}>
                        {value}
                    </span>
                );
            },
            width: '100px'
        },
        {
            key: 'location' as keyof User,
            label: 'Location',
            render: (value: any, row: User) => (
                <div className="text-sm text-gray-500">
                    {row.city && row.country ? (
                        <div className="flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {row.city}, {row.country}
                        </div>
                    ) : (
                        <span className="text-gray-400">Not set</span>
                    )}
                </div>
            ),
            width: '150px'
        },
        {
            key: 'rating' as keyof User,
            label: 'Rating',
            sortable: true,
            render: (value: any, row: User) => (
                <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-400 mr-1" />
                    <span className="text-sm">{row.averageRating.toFixed(1)}</span>
                    <span className="text-gray-400 ml-1">({row.totalReviews})</span>
                </div>
            ),
            width: '120px'
        },
        {
            key: 'createdAt',
            label: 'Joined',
            sortable: true,
            render: (value: string, row: User) => (
                <div className="text-sm text-gray-500">
                    <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(row.createdAt).toLocaleDateString()}
                    </div>
                    {row.lastLoginAt && (
                        <div className="text-xs text-gray-400 mt-1">
                            Last: {new Date(row.lastLoginAt).toLocaleDateString()}
                        </div>
                    )}
                </div>
            ),
            width: '120px'
        }
    ];

    // Define actions
    const actions = [
        {
            label: 'View',
            icon: <Eye className="w-4 h-4" />,
            to: (row: User) => `/admin/users/${row.id}`,
            variant: 'ghost' as const
        },
        {
            label: 'Edit',
            icon: <Edit className="w-4 h-4" />,
            to: (row: User) => `/admin/users/${row.id}/edit`,
            variant: 'ghost' as const
        },
        {
            label: (row: User) => row.status === 'ACTIVE' ? 'Suspend' : 'Activate',
            icon: (row: User) => row.status === 'ACTIVE' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />,
            variant: 'ghost' as const,
            onClick: (row: User) => {
                // TODO: Implement suspend/activate functionality
                console.log(`${row.status === 'ACTIVE' ? 'Suspend' : 'Activate'} user:`, row.id);
            }
        },
        {
            label: 'Delete',
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive' as const,
            onClick: (row: User) => {
                // TODO: Implement delete functionality
                console.log('Delete user:', row.id);
            },
            show: (row: User) => row.status !== 'DELETED'
        }
    ];

    // Define stats
    const statCards = [
        {
            id: 'total',
            label: 'Total Users',
            value: stats.total,
            color: 'blue' as const,
            icon: <Shield className="w-6 h-6" />
        },
        {
            id: 'active',
            label: 'Active Users',
            value: stats.active,
            color: 'green' as const,
            icon: <UserCheck className="w-6 h-6" />
        },
        {
            id: 'admins',
            label: 'Admins',
            value: stats.admins,
            color: 'purple' as const,
            icon: <Shield className="w-6 h-6" />
        },
        {
            id: 'new',
            label: 'New This Month',
            value: stats.newThisMonth,
            color: 'yellow' as const,
            icon: <Calendar className="w-6 h-6" />
        }
    ];

    // Define page actions
    const pageActions = [
        {
            label: 'Import',
            icon: <Upload className="w-4 h-4" />,
            variant: 'outline' as const,
            onClick: () => {
                // TODO: Implement import functionality
                console.log('Import users');
            }
        },
        {
            label: 'Export',
            icon: <Download className="w-4 h-4" />,
            variant: 'outline' as const,
            onClick: () => {
                // TODO: Implement export functionality
                console.log('Export users');
            }
        },
        {
            label: 'Add User',
            icon: <Plus className="w-4 h-4" />,
            variant: 'default' as const,
            onClick: () => {
                navigate('/admin/users/new');
            }
        }
    ];

    return (
        <AdminPageLayout
            title="Users Management"
            description="Manage user accounts, roles, and permissions"
            breadcrumbs={[
                { label: 'Admin', href: '/admin' },
                { label: 'Users' }
            ]}
            actions={pageActions}
            stats={statCards}
        >
            <div className="space-y-6">
                <GenericFilters
                    groups={[{ title: 'User Filters', fields: filterFields }]}
                    initialFilters={filters}
                />

                <DataTable
                    data={users}
                    columns={columns}
                    actions={actions}
                    pagination={{
                        ...pagination,
                        onPageChange: (page) => {
                            const params = new URLSearchParams(window.location.search);
                            params.set('page', page.toString());
                            navigate(`${window.location.pathname}?${params.toString()}`);
                        },
                        onLimitChange: (limit) => {
                            const params = new URLSearchParams(window.location.search);
                            params.set('limit', limit.toString());
                            params.set('page', '1');
                            navigate(`${window.location.pathname}?${params.toString()}`);
                        }
                    }}
                    selectable={true}
                    emptyState={{
                        title: 'No users found',
                        description: 'Try adjusting your filters or add a new user to get started.',
                        action: {
                            label: 'Add User',
                            onClick: () => navigate('/admin/users/new')
                        }
                    }}
                    onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
                    initialSort={{ key: 'createdAt', direction: 'desc' }}
                />
            </div>
        </AdminPageLayout>
    );
}
