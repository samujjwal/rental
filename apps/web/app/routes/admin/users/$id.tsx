import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { Button } from "~/components/ui/Button";
import { ArrowLeft, Edit, UserX, Check } from "lucide-react";

export async function loader({ params, request }: LoaderFunctionArgs) {
    const user = await requireAdmin(request);
    const token = await getUserToken(request);

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    const userResponse = await fetch(`${API_BASE_URL}/admin/users/${params.id}`, { headers });

    if (!userResponse.ok) {
        throw new Response("User not found", { status: 404 });
    }

    const userData = await userResponse.json();

    return userData;
}

export default function AdminUserDetail() {
    const user = useLoaderData<typeof loader>();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link to="/admin/users" className="text-gray-600 hover:text-gray-900">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">User Details</h1>
                        <p className="text-gray-600">Manage user account and settings</p>
                    </div>
                </div>
                <div className="flex space-x-3">
                    <Link to={`/admin/users/${user.id}/edit`}>
                        <Button>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit User
                        </Button>
                    </Link>
                    {user.status === 'ACTIVE' ? (
                        <Button variant="destructive">
                            <UserX className="w-4 h-4 mr-2" />
                            Suspend
                        </Button>
                    ) : (
                        <Button>
                            <Check className="w-4 h-4 mr-2" />
                            Activate
                        </Button>
                    )}
                </div>
            </div>

            {/* User Profile Card */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-start space-x-6">
                    <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-medium text-gray-700">
                            {user.firstName[0]}{user.lastName[0]}
                        </span>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {user.firstName} {user.lastName}
                        </h2>
                        <p className="text-gray-600">{user.email}</p>
                        <div className="flex items-center space-x-4 mt-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                }`}>
                                {user.status}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                                user.role === 'OWNER' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                {user.role}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
                    <dl className="space-y-3">
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                            <dd className="text-sm text-gray-900">{user.firstName} {user.lastName}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Email</dt>
                            <dd className="text-sm text-gray-900">{user.email}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Phone</dt>
                            <dd className="text-sm text-gray-900">{user.phoneNumber || 'Not provided'}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                            <dd className="text-sm text-gray-900">
                                {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'Not provided'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Location</dt>
                            <dd className="text-sm text-gray-900">
                                {[user.city, user.state, user.country].filter(Boolean).join(', ') || 'Not provided'}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* Account Information */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
                    <dl className="space-y-3">
                        <div>
                            <dt className="text-sm font-medium text-gray-500">User ID</dt>
                            <dd className="text-sm text-gray-900">{user.id}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Registration Date</dt>
                            <dd className="text-sm text-gray-900">
                                {new Date(user.createdAt).toLocaleDateString()}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Last Login</dt>
                            <dd className="text-sm text-gray-900">
                                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* Verification Status */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Verification Status</h3>
                    <dl className="space-y-3">
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Email Verification</dt>
                            <dd className="text-sm">
                                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${user.emailVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    {user.emailVerified ? 'Verified' : 'Not Verified'}
                                </span>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Phone Verification</dt>
                            <dd className="text-sm">
                                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${user.phoneVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    {user.phoneVerified ? 'Verified' : 'Not Verified'}
                                </span>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">ID Verification</dt>
                            <dd className="text-sm">
                                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${user.idVerificationStatus === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                                    user.idVerificationStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    {user.idVerificationStatus}
                                </span>
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* Statistics */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Statistics</h3>
                    <dl className="space-y-3">
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Average Rating</dt>
                            <dd className="text-sm text-gray-900">
                                <div className="flex items-center">
                                    <span className="text-yellow-400">★</span>
                                    <span className="ml-1">{user.averageRating.toFixed(1)}</span>
                                </div>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Total Reviews</dt>
                            <dd className="text-sm text-gray-900">{user.totalReviews}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Response Rate</dt>
                            <dd className="text-sm text-gray-900">{(user.responseRate * 100).toFixed(1)}%</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Response Time</dt>
                            <dd className="text-sm text-gray-900">{user.responseTime} minutes</dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>
    );
}
