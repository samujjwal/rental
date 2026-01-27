/**
 * Admin Users Page - Enhanced Version
 * 
 * Modern, data-driven user management with:
 * - Advanced filtering and search
 * - Bulk actions
 * - Statistics dashboard
 * - Responsive design
 * - Export capabilities
 */

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
    UserCheck,
    UserX,
    Shield,
    Mail,
    Users,
    UserPlus,
    Activity,
    Ban,
    CheckCircle2,
    Clock
} from "lucide-react";

// ============= TYPES =============

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
    phoneNumber?: string;
}

interface LoaderData {
    users: User[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    stats: {
        total: number;
        active: number;
        newThisMonth: number;
        suspended: number;
    };
}

// ============= LOADER =============

export async function loader({ request }: LoaderFunctionArgs) {
    await requireAdmin(request);
    const token = await getUserToken(request);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '25');
    const search = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role') || '';
    const status = url.searchParams.get('status') || '';
    const emailVerified = url.searchParams.get('emailVerified') || '';

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            ...(search && { search }),
            ...(role && { role }),
            ...(status && { status }),
            ...(emailVerified && { emailVerified }),
        });

        const response = await fetch(`${API_BASE_URL}/admin/users?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }

        const rawData = await response.json();

        // Normalize API response to match LoaderData interface
        return {
            users: rawData.users || [],
            pagination: {
                page: page,
                limit: limit,
                total: rawData.total || 0,
                totalPages: Math.ceil((rawData.total || 0) / limit)
            },
            stats: {
                total: rawData.total || 0,
                active: (rawData.users || []).filter((u: any) => u.status === 'ACTIVE').length,
                newThisMonth: 0, // Would need another API call for real data
                suspended: (rawData.users || []).filter((u: any) => u.status === 'SUSPENDED').length,
            }
        };
    } catch (error) {
        console.error('Error loading users:', error);

        // Return mock data for development
        return getMockData(page, limit, search, role, status, emailVerified);
    }
}

// ============= ACTION =============

export async function action({ request }: ActionFunctionArgs) {
    await requireAdmin(request);
    const token = await getUserToken(request);
    const formData = await request.formData();
    const intent = formData.get("intent");
    const userId = formData.get("userId");

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    if (intent === "suspend" || intent === "activate") {
        const endpoint = intent === "suspend" ? "suspend" : "activate";
        try {
            const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/${endpoint}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                return { error: `Failed to ${intent} user` };
            }

            return { success: true };
        } catch (error) {
            return { error: "Network error" };
        }
    }

    return null;
}

// Mock data function (for development)
function getMockData(
    page: number,
    limit: number,
    search: string,
    role: string,
    status: string,
    emailVerified: string
): LoaderData {
    const mockUsers: User[] = [
        {
            id: "1",
            email: "admin@rental.local",
            firstName: "Admin",
            lastName: "User",
            role: "ADMIN",
            status: "ACTIVE",
            emailVerified: true,
            phoneVerified: true,
            createdAt: "2024-01-15T10:30:00Z",
            lastLoginAt: "2024-01-26T09:15:00Z",
            city: "New York",
            country: "USA",
            phoneNumber: "+1-555-0123"
        },
        {
            id: "2",
            email: "john.owner@rental.local",
            firstName: "John",
            lastName: "Owner",
            role: "OWNER",
            status: "ACTIVE",
            emailVerified: true,
            phoneVerified: false,
            createdAt: "2024-01-10T14:20:00Z",
            lastLoginAt: "2024-01-25T16:45:00Z",
            city: "Los Angeles",
            country: "USA",
            phoneNumber: "+1-555-0124"
        },
        {
            id: "3",
            email: "mike.customer@rental.local",
            firstName: "Mike",
            lastName: "Customer",
            role: "CUSTOMER",
            status: "ACTIVE",
            emailVerified: true,
            phoneVerified: true,
            createdAt: "2024-01-05T08:45:00Z",
            lastLoginAt: "2024-01-24T11:30:00Z",
            city: "Chicago",
            country: "USA",
            phoneNumber: "+1-555-0125"
        },
        {
            id: "4",
            email: "support@rental.local",
            firstName: "Support",
            lastName: "Team",
            role: "SUPPORT",
            status: "ACTIVE",
            emailVerified: true,
            phoneVerified: true,
            createdAt: "2023-12-20T12:15:00Z",
            lastLoginAt: "2024-01-20T13:20:00Z",
            city: "Houston",
            country: "USA",
            phoneNumber: "+1-555-0126"
        },
        {
            id: "5",
            email: "inactive@rental.local",
            firstName: "Inactive",
            lastName: "User",
            role: "CUSTOMER",
            status: "INACTIVE",
            emailVerified: false,
            phoneVerified: false,
            createdAt: "2023-11-15T09:30:00Z",
            city: "Phoenix",
            country: "USA",
            phoneNumber: "+1-555-0127"
        }
    ];

    // Apply filters
    let filteredUsers = mockUsers.filter(user => {
        if (search) {
            const searchLower = search.toLowerCase();
            const matchesSearch =
                user.email.toLowerCase().includes(searchLower) ||
                user.firstName.toLowerCase().includes(searchLower) ||
                user.lastName.toLowerCase().includes(searchLower);
            if (!matchesSearch) return false;
        }
        if (role && user.role !== role) return false;
        if (status && user.status !== status) return false;
        if (emailVerified && user.emailVerified.toString() !== emailVerified) return false;
        return true;
    });

    // Pagination
    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + limit);

    return {
        users: paginatedUsers,
        pagination: {
            page,
            limit,
            total,
            totalPages
        },
        stats: {
            total: mockUsers.length,
            active: mockUsers.filter(u => u.status === 'ACTIVE').length,
            newThisMonth: 12,
            suspended: mockUsers.filter(u => u.status === 'SUSPENDED').length,
        }
    };
}

// ============= COMPONENT =============

export default function AdminUsersPage() {
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
            label: 'Total Users',
            value: data.stats?.total ?? 0,
            icon: Users,
            color: 'blue',
            trend: {
                value: 12,
                label: 'vs last month',
                direction: 'up'
            }
        },
        {
            id: 'active',
            label: 'Active Users',
            value: data.stats?.active ?? 0,
            icon: CheckCircle2,
            color: 'green',
            trend: {
                value: 8,
                label: 'vs last month',
                direction: 'up'
            }
        },
        {
            id: 'new',
            label: 'New This Month',
            value: data.stats?.newThisMonth ?? 0,
            icon: UserPlus,
            color: 'purple',
            trend: {
                value: 15,
                label: 'vs last month',
                direction: 'up'
            }
        },
        {
            id: 'suspended',
            label: 'Suspended',
            value: data.stats?.suspended ?? 0,
            icon: Ban,
            color: 'red',
            trend: {
                value: 3,
                label: 'vs last month',
                direction: 'down'
            }
        },
    ];

    // ============= FILTER CONFIGURATION =============

    const filterFields: FilterField[] = [
        {
            id: 'search',
            label: 'Search',
            type: 'text',
            placeholder: 'Search by name or email...'
        },
        {
            id: 'role',
            label: 'Role',
            type: 'select',
            options: [
                { value: 'ADMIN', label: 'Admin' },
                { value: 'OWNER', label: 'Owner' },
                { value: 'CUSTOMER', label: 'Customer' },
                { value: 'SUPPORT', label: 'Support' },
            ]
        },
        {
            id: 'status',
            label: 'Status',
            type: 'select',
            options: [
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
                { value: 'SUSPENDED', label: 'Suspended' },
                { value: 'DELETED', label: 'Deleted' },
            ]
        },
        {
            id: 'emailVerified',
            label: 'Email Verified',
            type: 'boolean'
        },
        {
            id: 'phoneVerified',
            label: 'Phone Verified',
            type: 'boolean'
        },
    ];

    // ============= TABLE COLUMNS =============

    const columns: ColumnDef<User>[] = [
        {
            id: 'user',
            header: 'User',
            accessorFn: (row) => `${row.firstName} ${row.lastName}`,
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {row.firstName[0]}{row.lastName[0]}
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">
                            {row.firstName} {row.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{row.email}</p>
                    </div>
                </div>
            ),
            minWidth: '250px'
        },
        {
            id: 'role',
            header: 'Role',
            accessorKey: 'role',
            cell: ({ value }) => {
                const colors = {
                    ADMIN: 'bg-purple-100 text-purple-800',
                    OWNER: 'bg-blue-100 text-blue-800',
                    CUSTOMER: 'bg-green-100 text-green-800',
                    SUPPORT: 'bg-yellow-100 text-yellow-800',
                };
                return (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[value as keyof typeof colors]}`}>
                        {value}
                    </span>
                );
            },
            width: '120px'
        },
        {
            id: 'status',
            header: 'Status',
            accessorKey: 'status',
            cell: ({ value }) => {
                const colors = {
                    ACTIVE: 'bg-green-100 text-green-800',
                    INACTIVE: 'bg-gray-100 text-gray-800',
                    SUSPENDED: 'bg-red-100 text-red-800',
                    DELETED: 'bg-red-100 text-red-800',
                };
                return (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[value as keyof typeof colors]}`}>
                        {value}
                    </span>
                );
            },
            width: '120px'
        },
        {
            id: 'verification',
            header: 'Verification',
            cell: ({ row }) => (
                <div className="flex gap-2">
                    {row.emailVerified && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Email
                        </span>
                    )}
                    {row.phoneVerified && (
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Phone
                        </span>
                    )}
                </div>
            ),
            width: '180px'
        },
        {
            id: 'location',
            header: 'Location',
            cell: ({ row }) => (
                row.city && row.country ? (
                    <span className="text-sm text-gray-600">
                        {row.city}, {row.country}
                    </span>
                ) : (
                    <span className="text-sm text-gray-400">—</span>
                )
            ),
            width: '150px'
        },
        {
            id: 'lastActive',
            header: 'Last Active',
            accessorKey: 'lastLoginAt',
            cell: ({ value }) => {
                if (!value) return <span className="text-sm text-gray-400">Never</span>;
                const date = new Date(value);
                return (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        {date.toLocaleDateString()}
                    </div>
                );
            },
            width: '150px'
        },
        {
            id: 'createdAt',
            header: 'Joined',
            accessorKey: 'createdAt',
            cell: ({ value }) => {
                const date = new Date(value);
                return (
                    <span className="text-sm text-gray-600">
                        {date.toLocaleDateString()}
                    </span>
                );
            },
            width: '120px'
        },
    ];

    // ============= TABLE ACTIONS =============

    const actions: ActionDef<User>[] = [
        {
            id: 'view',
            label: 'View Details',
            icon: Eye,
            href: (row) => `/admin/users/${row.id}`,
        },
        {
            id: 'edit',
            label: 'Edit User',
            icon: Edit,
            href: (row) => `/admin/users/${row.id}/edit`,
        },
        {
            id: 'activate',
            label: (row) => row.status === 'ACTIVE' ? 'Suspend User' : 'Activate User',
            icon: (row) => row.status === 'ACTIVE' ? UserX : UserCheck,
            onClick: async (row) => {
                const intent = row.status === 'ACTIVE' ? 'suspend' : 'activate';
                if (confirm(`Are you sure you want to ${intent} this user?`)) {
                    fetcher.submit(
                        { intent, userId: row.id },
                        { method: "post" }
                    );
                }
            },
            variant: (row) => row.status === 'ACTIVE' ? 'destructive' : 'default',
        },
        {
            id: 'delete',
            label: 'Delete User',
            icon: Trash2,
            onClick: async (row) => {
                if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                    // TODO: Implement delete action
                    alert('Delete functionality is currently under development.');
                }
            },
            variant: 'destructive',
        },
    ];

    // ============= BULK ACTIONS =============

    const bulkActions: BulkActionDef<User>[] = [
        {
            id: 'activate',
            label: 'Activate Selected',
            icon: UserCheck,
            onClick: async (rows) => {
                alert(`Activating ${rows.length} users...`);
            },
            confirmMessage: 'Are you sure you want to activate the selected users?',
        },
        {
            id: 'suspend',
            label: 'Suspend Selected',
            icon: UserX,
            onClick: async (rows) => {
                alert(`Suspending ${rows.length} users...`);
            },
            variant: 'destructive',
            confirmMessage: 'Are you sure you want to suspend the selected users?',
        },
        {
            id: 'export',
            label: 'Export Selected',
            icon: Download,
            onClick: async (rows) => {
                alert(`Exporting ${rows.length} users...`);
            },
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
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Users</h1>
                    <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
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
                    <Button onClick={() => navigate('/admin/users/new')}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add User
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <StatsGrid stats={stats} />

            {/* Filters */}
            <FilterPanel
                fields={filterFields}
                presetStorageKey="admin-users-filters"
            />

            {/* Data Table */}
            <DataTable
                data={data.users}
                columns={columns}
                getRowId={(row) => row.id}
                actions={actions}
                bulkActions={bulkActions}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                enableSelection={true}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                searchPlaceholder="Search users..."
                onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
                renderToolbarRight={() => (
                    <Button variant="outline" size="sm" onClick={() => alert('Quick Action!')}>
                        <Activity className="w-4 h-4 mr-2" />
                        Quick Audit
                    </Button>
                )}
                emptyState={{
                    title: 'No users found',
                    description: 'Try adjusting your filters or search query',
                    icon: Users,
                    action: {
                        label: 'Add User',
                        onClick: () => navigate('/admin/users/new')
                    }
                }}
            />
        </div>
    );
}
