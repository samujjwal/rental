import { Link } from "react-router";
import {
    MoreHorizontal,
    Eye,
    Edit,
    Trash2,
    Shield,
    UserCheck,
    UserX,
    Mail,
    Phone,
    Calendar,
    MapPin
} from "lucide-react";

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    createdAt: string;
    lastLoginAt?: string;
    city?: string;
    country?: string;
    averageRating: number;
    totalReviews: number;
}

interface UsersTableProps {
    users: User[];
}

export function UsersTable({ users }: UsersTableProps) {
    const getStatusBadge = (status: string) => {
        const styles = {
            ACTIVE: "bg-green-100 text-green-800",
            INACTIVE: "bg-gray-100 text-gray-800",
            SUSPENDED: "bg-red-100 text-red-800",
            DELETED: "bg-gray-100 text-gray-400"
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100'}`}>
                {status}
            </span>
        );
    };

    const getRoleBadge = (role: string) => {
        const styles = {
            ADMIN: "bg-purple-100 text-purple-800",
            OWNER: "bg-blue-100 text-blue-800",
            CUSTOMER: "bg-gray-100 text-gray-800",
            SUPPORT: "bg-yellow-100 text-yellow-800"
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[role as keyof typeof styles] || 'bg-gray-100'}`}>
                {role}
            </span>
        );
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rating
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Joined
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                            <span className="text-sm font-medium text-gray-700">
                                                {user.firstName[0]}{user.lastName[0]}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900">
                                            {user.firstName} {user.lastName}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            ID: {user.id.slice(0, 8)}...
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{user.email}</div>
                                <div className="flex items-center space-x-2 text-xs text-gray-500">
                                    <Mail className="w-3 h-3" />
                                    <span className={user.emailVerified ? "text-green-600" : "text-red-600"}>
                                        {user.emailVerified ? "Verified" : "Not Verified"}
                                    </span>
                                    {user.phoneVerified && (
                                        <>
                                            <Phone className="w-3 h-3 ml-2" />
                                            <span className="text-green-600">Phone Verified</span>
                                        </>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {getRoleBadge(user.role)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(user.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user.city && user.country ? (
                                    <div className="flex items-center">
                                        <MapPin className="w-3 h-3 mr-1" />
                                        {user.city}, {user.country}
                                    </div>
                                ) : (
                                    <span className="text-gray-400">Not set</span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center">
                                    <span className="text-yellow-400">★</span>
                                    <span className="ml-1">{user.averageRating.toFixed(1)}</span>
                                    <span className="text-gray-400 ml-1">({user.totalReviews})</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </div>
                                {user.lastLoginAt && (
                                    <div className="text-xs text-gray-400 mt-1">
                                        Last: {new Date(user.lastLoginAt).toLocaleDateString()}
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center space-x-2">
                                    <Link
                                        to={`/admin/users/${user.id}`}
                                        className="text-blue-600 hover:text-blue-900"
                                        title="View Details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Link>
                                    <Link
                                        to={`/admin/users/${user.id}/edit`}
                                        className="text-green-600 hover:text-green-900"
                                        title="Edit User"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Link>
                                    {user.status === 'ACTIVE' ? (
                                        <button
                                            className="text-yellow-600 hover:text-yellow-900"
                                            title="Suspend User"
                                        >
                                            <UserX className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button
                                            className="text-green-600 hover:text-green-900"
                                            title="Activate User"
                                        >
                                            <UserCheck className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        className="text-red-600 hover:text-red-900"
                                        title="Delete User"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {users.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-gray-500">
                        <UserX className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No users found</p>
                        <p className="text-sm">Try adjusting your filters or add a new user.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
