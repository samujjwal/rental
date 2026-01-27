import { type LoaderFunctionArgs } from "react-router";
import { useState, useEffect } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { EnhancedDataTable, type TableColumn, type TableAction, type BulkAction } from "~/components/admin/EnhancedDataTable";
import { AdvancedFilters, type AdvancedFilterField, type AdvancedFilterGroup } from "~/components/admin/AdvancedFilters";
import { StatCardsGrid, type StatCardData } from "~/components/admin/StatCard";
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
    Star,
    Users,
    TrendingUp,
    Ban,
    ChevronDown,
    BarChart3,
    Save,
    Bookmark
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
    // Start with no rows selected - users must explicitly select
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    
    // Filter Presets - Saved filter combinations for quick access
    const [savedPresets, setSavedPresets] = useState<Array<{
        id: string;
        name: string;
        filters: Record<string, any>;
        createdAt: string;
    }>>([]);
    const [showPresetMenu, setShowPresetMenu] = useState(false);

    // Load saved presets from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('admin-users-filter-presets');
        if (stored) {
            try {
                setSavedPresets(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to load filter presets:', e);
            }
        }
    }, []);

    // Save current filters as a preset
    const saveCurrentFilters = () => {
        const currentFilters = new URLSearchParams(window.location.search);
        const filterObj: Record<string, any> = {};
        currentFilters.forEach((value, key) => {
            if (key !== 'page' && key !== 'limit') {
                filterObj[key] = value;
            }
        });

        const presetName = prompt('Enter a name for this filter preset:');
        if (!presetName) return;

        const newPreset = {
            id: Date.now().toString(),
            name: presetName,
            filters: filterObj,
            createdAt: new Date().toISOString()
        };

        const updated = [...savedPresets, newPreset];
        setSavedPresets(updated);
        localStorage.setItem('admin-users-filter-presets', JSON.stringify(updated));
        alert('Filter preset saved successfully!');
    };

    // Apply a saved preset
    const applyPreset = (preset: typeof savedPresets[0]) => {
        const params = new URLSearchParams();
        Object.entries(preset.filters).forEach(([key, value]) => {
            params.set(key, String(value));
        });
        params.set('page', '1');
        navigate(`${window.location.pathname}?${params.toString()}`);
        setShowPresetMenu(false);
    };

    // Delete a preset
    const deletePreset = (presetId: string) => {
        if (!confirm('Are you sure you want to delete this filter preset?')) return;
        const updated = savedPresets.filter(p => p.id !== presetId);
        setSavedPresets(updated);
        localStorage.setItem('admin-users-filter-presets', JSON.stringify(updated));
    };

    // Check if any filters are currently active
    const hasActiveFilters = () => {
        const params = new URLSearchParams(window.location.search);
        const filterKeys = Array.from(params.keys()).filter(k => k !== 'page' && k !== 'limit');
        return filterKeys.length > 0;
    };

    // Clear all active filters
    const clearAllFilters = () => {
        const params = new URLSearchParams();
        params.set('page', '1');
        navigate(`${window.location.pathname}?${params.toString()}`);
    };

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
    const filterGroups: AdvancedFilterGroup[] = [
        {
            title: 'Basic Filters',
            fields: [
                {
                    key: 'search',
                    label: 'Search',
                    type: 'text',
                    placeholder: 'Search by name, email, or ID...',
                    icon: <Mail className="w-4 h-4" />
                },
                {
                    key: 'role',
                    label: 'Role',
                    type: 'multiselect',
                    options: [
                        { value: 'ADMIN', label: 'Admin', icon: <Shield className="w-4 h-4" /> },
                        { value: 'OWNER', label: 'Owner', icon: <Users className="w-4 h-4" /> },
                        { value: 'CUSTOMER', label: 'Customer', icon: <Users className="w-4 h-4" /> },
                        { value: 'SUPPORT', label: 'Support', icon: <Users className="w-4 h-4" /> }
                    ]
                },
                {
                    key: 'status',
                    label: 'Status',
                    type: 'multiselect',
                    options: [
                        { value: 'ACTIVE', label: 'Active', icon: <UserCheck className="w-4 h-4" /> },
                        { value: 'INACTIVE', label: 'Inactive', icon: <UserX className="w-4 h-4" /> },
                        { value: 'SUSPENDED', label: 'Suspended', icon: <Ban className="w-4 h-4" /> },
                        { value: 'DELETED', label: 'Deleted', icon: <Trash2 className="w-4 h-4" /> }
                    ]
                }
            ],
            defaultExpanded: true
        },
        {
            title: 'Verification Filters',
            fields: [
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
            ],
            collapsible: true,
            defaultExpanded: false
        }
    ];

    // Define table columns
    const columns: TableColumn<User>[] = [
        {
            key: 'name' as keyof User,
            label: 'User',
            sortable: true,
            render: (value: any, row: User) => (
                <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <span className="text-sm font-semibold text-white">
                                {row.firstName[0]}{row.lastName[0]}
                            </span>
                        </div>
                    </div>
                    <div className="ml-4">
                        <div className="text-sm font-semibold text-gray-900">
                            {row.firstName} {row.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                            ID: {row.id.slice(0, 8)}...
                        </div>
                    </div>
                </div>
            ),
            width: '250px',
            sticky: true
        },
        {
            key: 'email' as keyof User,
            label: 'Contact',
            sortable: true,
            render: (value: any, row: User) => (
                <div>
                    <div className="text-sm text-gray-900 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-gray-400" />
                        {row.email}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.emailVerified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}>
                            {row.emailVerified ? "✓" : "✗"} Email
                        </span>
                        {row.phoneNumber && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                row.phoneVerified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                            }`}>
                                {row.phoneVerified ? "✓" : "✗"} Phone
                            </span>
                        )}
                    </div>
                </div>
            ),
            width: '250px'
        },
        {
            key: 'role',
            label: 'Role',
            sortable: true,
            render: (value: string) => {
                const config = {
                    ADMIN: { bg: "bg-purple-100", text: "text-purple-800", icon: Shield },
                    OWNER: { bg: "bg-blue-100", text: "text-blue-800", icon: Users },
                    CUSTOMER: { bg: "bg-gray-100", text: "text-gray-800", icon: Users },
                    SUPPORT: { bg: "bg-yellow-100", text: "text-yellow-800", icon: Users }
                };
                const { bg, text, icon: Icon } = config[value as keyof typeof config] || config.CUSTOMER;
                return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {value}
                    </span>
                );
            },
            width: '120px'
        },
        {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (value: string) => {
                const config = {
                    ACTIVE: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
                    INACTIVE: { bg: "bg-gray-100", text: "text-gray-800", dot: "bg-gray-500" },
                    SUSPENDED: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
                    DELETED: { bg: "bg-gray-100", text: "text-gray-400", dot: "bg-gray-400" }
                };
                const { bg, text, dot } = config[value as keyof typeof config] || config.INACTIVE;
                return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                        {value}
                    </span>
                );
            },
            width: '120px'
        },
        {
            key: 'location' as keyof User,
            label: 'Location',
            render: (value: any, row: User) => (
                row.city && row.country ? (
                    <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                        {row.city}, {row.country}
                    </div>
                ) : (
                    <span className="text-sm text-gray-400 italic">Not set</span>
                )
            ),
            width: '150px'
        },
        {
            key: 'rating' as keyof User,
            label: 'Rating',
            sortable: true,
            render: (value: any, row: User) => (
                <div className="flex items-center gap-1.5">
                    <div className="flex items-center">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="ml-1 text-sm font-semibold text-gray-900">
                            {row.averageRating.toFixed(1)}
                        </span>
                    </div>
                    <span className="text-xs text-gray-500">
                        ({row.totalReviews})
                    </span>
                </div>
            ),
            width: '120px'
        },
        {
            key: 'createdAt',
            label: 'Joined',
            sortable: true,
            render: (value: string, row: User) => (
                <div className="text-sm">
                    <div className="flex items-center text-gray-900 font-medium">
                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                        {new Date(row.createdAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                        })}
                    </div>
                    {row.lastLoginAt && (
                        <div className="text-xs text-gray-500 mt-0.5 ml-5">
                            Last: {new Date(row.lastLoginAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                            })}
                        </div>
                    )}
                </div>
            ),
            width: '140px'
        }
    ];

    // Define row actions
    const actions: TableAction<User>[] = [
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
                console.log(`${row.status === 'ACTIVE' ? 'Suspend' : 'Activate'} user:`, row.id);
                // TODO: Implement suspend/activate
            }
        },
        {
            label: 'Delete',
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive' as const,
            onClick: (row: User) => {
                if (confirm(`Are you sure you want to delete ${row.firstName} ${row.lastName}?`)) {
                    console.log('Delete user:', row.id);
                    // TODO: Implement delete
                }
            },
            show: (row: User) => row.status !== 'DELETED'
        }
    ];

    // Define bulk actions
    const bulkActions: BulkAction<User>[] = [
        {
            label: 'Export Selected',
            icon: <Download className="w-4 h-4" />,
            variant: 'outline',
            onClick: (selectedUsers) => {
                console.log('Export users:', selectedUsers.map(u => u.id));
                // TODO: Implement export
            }
        },
        {
            label: 'Suspend Selected',
            icon: <Ban className="w-4 h-4" />,
            variant: 'destructive',
            onClick: (selectedUsers) => {
                if (confirm(`Suspend ${selectedUsers.length} users?`)) {
                    console.log('Suspend users:', selectedUsers.map(u => u.id));
                    // TODO: Implement bulk suspend
                }
            }
        },
        {
            label: 'Delete Selected',
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'destructive',
            onClick: (selectedUsers) => {
                if (confirm(`Delete ${selectedUsers.length} users permanently?`)) {
                    console.log('Delete users:', selectedUsers.map(u => u.id));
                    // TODO: Implement bulk delete
                }
            }
        }
    ];

    // Define stats cards
    const statCards: StatCardData[] = [
        {
            id: 'total',
            label: 'Total Users',
            value: stats.total,
            color: 'blue' as const,
            icon: <Users className="w-6 h-6" />,
            href: '/admin/users',
            description: 'All registered users',
            change: {
                value: '+12.5%',
                type: 'increase',
                period: 'vs last month'
            }
        },
        {
            id: 'active',
            label: 'Active Users',
            value: stats.active,
            color: 'green' as const,
            icon: <UserCheck className="w-6 h-6" />,
            description: 'Currently active accounts',
            change: {
                value: '+8.2%',
                type: 'increase',
                period: 'vs last month'
            }
        },
        {
            id: 'admins',
            label: 'Administrators',
            value: stats.admins,
            color: 'purple' as const,
            icon: <Shield className="w-6 h-6" />,
            description: 'Admin & moderator accounts'
        },
        {
            id: 'new',
            label: 'New This Month',
            value: stats.newThisMonth,
            color: 'yellow' as const,
            icon: <TrendingUp className="w-6 h-6" />,
            description: 'Recently joined users',
            change: {
                value: '+23%',
                type: 'increase',
                period: 'vs last month'
            }
        }
    ];

    // Define page actions - Export moved to table toolbar
    const pageActions = [
        {
            label: 'Import',
            icon: <Upload className="w-4 h-4" />,
            variant: 'outline' as const,
            onClick: () => {
                console.log('Import users');
                // TODO: Implement import
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
            description="Manage user accounts, roles, and permissions across the platform"
            actions={pageActions}
        >
            <div className="space-y-3 sm:space-y-4">
                {/* Collapsible Stats Section - Mobile Optimized */}
                <details className="bg-white rounded-lg border shadow-sm">
                    <summary 
                        className="px-3 sm:px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between group"
                        aria-label="Toggle statistics panel"
                    >
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-gray-500" aria-hidden="true" />
                            <span className="text-sm font-medium text-gray-700">Quick Stats</span>
                            <span 
                                className="hidden sm:inline text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                                aria-label={`${statCards.length} metrics available`}
                            >
                                {statCards.length} metrics
                            </span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="p-3 sm:p-4 border-t bg-gray-50">
                        <StatCardsGrid stats={statCards} columns={4} />
                    </div>
                </details>

                {/* Main Data Table with Integrated Filters - Mobile Optimized */}
                <div className="bg-white rounded-lg border shadow-sm">
                    {/* Filters integrated into table container with preset support */}
                    <div className="p-3 sm:p-4 border-b bg-gray-50/50">
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Filter Preset Dropdown */}
                                <div className="relative">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowPresetMenu(!showPresetMenu)}
                                        className="flex items-center gap-1.5"
                                        aria-haspopup="menu"
                                        aria-expanded={showPresetMenu}
                                    >
                                        <Bookmark className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Presets</span>
                                        {savedPresets.length > 0 && (
                                            <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                                                {savedPresets.length}
                                            </span>
                                        )}
                                    </Button>
                                    {showPresetMenu && (
                                        <div 
                                            className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-50"
                                            role="menu"
                                            aria-label="Filter presets menu"
                                        >
                                            <div className="p-2 border-b">
                                                <p className="text-xs font-medium text-gray-700">Saved Filter Presets</p>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {savedPresets.length === 0 ? (
                                                    <div className="p-3 text-sm text-gray-500 text-center">
                                                        No saved presets yet
                                                    </div>
                                                ) : (
                                                    savedPresets.map(preset => (
                                                        <div
                                                            key={preset.id}
                                                            className="p-2 hover:bg-gray-50 flex items-center justify-between group"
                                                            role="menuitem"
                                                        >
                                                            <button
                                                                onClick={() => applyPreset(preset)}
                                                                className="flex-1 text-left text-sm text-gray-700 hover:text-blue-600 truncate"
                                                                aria-label={`Apply preset: ${preset.name}`}
                                                            >
                                                                {preset.name}
                                                            </button>
                                                            <button
                                                                onClick={() => deletePreset(preset.id)}
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-opacity"
                                                                aria-label={`Delete preset: ${preset.name}`}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <div className="p-2 border-t">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={saveCurrentFilters}
                                                    disabled={!hasActiveFilters()}
                                                    className="w-full flex items-center justify-center gap-1.5"
                                                    aria-label="Save current filters as preset"
                                                >
                                                    <Save className="w-3.5 h-3.5" />
                                                    Save Current Filters
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                            </div>
                        </div>
                        <AdvancedFilters
                            groups={filterGroups}
                            initialFilters={filters}
                            showActiveCount={true}
                            activeFiltersLayout="inline"
                        />
                    </div>

                    {/* Data Table - Responsive with mobile card view */}
                    <div className="overflow-x-auto">
                        <EnhancedDataTable
                        data={users}
                        columns={columns}
                        actions={actions}
                        bulkActions={bulkActions}
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
                        selectedRows={selectedRows}
                        onSelectionChange={setSelectedRows}
                        emptyState={{
                            title: 'No users found',
                            description: 'Try adjusting your filters or add a new user to get started.',
                            icon: <Users className="w-12 h-12 text-gray-400" />,
                            action: {
                                label: 'Add User',
                                onClick: () => navigate('/admin/users/new')
                            }
                        }}
                        onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
                        initialSort={{ key: 'createdAt', direction: 'desc' }}
                        stickyHeader={true}
                        showRowNumbers={true}
                        exportable={true}
                        onExport={() => {
                            console.log('Export current view');
                            // TODO: Implement export
                        }}
                        columnToggle={true}
                        />
                    </div>
                </div>
            </div>
        </AdminPageLayout>
    );
}
