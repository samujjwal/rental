import { Link } from "react-router";
import {
    MoreHorizontal,
    Eye,
    Edit,
    Trash2,
    Users,
    Building,
    Settings,
    Crown,
    CheckCircle,
    XCircle,
    Clock,
    Mail,
    Phone,
    Globe,
    Calendar,
    CreditCard,
    UserPlus,
    Shield
} from "lucide-react";

interface Organization {
    id: string;
    name: string;
    slug: string;
    description?: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    plan: 'FREE' | 'PREMIUM' | 'ENTERPRISE';
    memberCount: number;
    maxMembers: number;
    owner: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    contact: {
        email?: string;
        phone?: string;
        website?: string;
        address?: {
            addressLine1?: string;
            city?: string;
            state?: string;
            country?: string;
        };
    };
    subscription?: {
        status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
        currentPeriodEnd?: string;
        amount?: number;
        currency?: string;
    };
    createdAt: string;
    updatedAt: string;
    lastActivityAt?: string;
}

interface OrganizationsTableProps {
    organizations: Organization[];
}

export function OrganizationsTable({ organizations }: OrganizationsTableProps) {
    const getStatusBadge = (status: string) => {
        const styles = {
            ACTIVE: "bg-green-100 text-green-800",
            INACTIVE: "bg-gray-100 text-gray-800",
            SUSPENDED: "bg-red-100 text-red-800"
        };

        const icons = {
            ACTIVE: CheckCircle,
            INACTIVE: XCircle,
            SUSPENDED: XCircle
        };

        const Icon = icons[status as keyof typeof icons];

        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100'}`}>
                <Icon className="w-3 h-3 mr-1" />
                {status}
            </span>
        );
    };

    const getPlanBadge = (plan: string) => {
        const styles = {
            FREE: "bg-gray-100 text-gray-800",
            PREMIUM: "bg-purple-100 text-purple-800",
            ENTERPRISE: "bg-yellow-100 text-yellow-800"
        };

        const icons = {
            FREE: Users,
            PREMIUM: Crown,
            ENTERPRISE: Building
        };

        const Icon = icons[plan as keyof typeof icons];

        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[plan as keyof typeof styles] || 'bg-gray-100'}`}>
                <Icon className="w-3 h-3 mr-1" />
                {plan}
            </span>
        );
    };

    const getSubscriptionStatusBadge = (status?: string) => {
        if (!status) return null;

        const styles = {
            ACTIVE: "bg-green-100 text-green-800",
            CANCELLED: "bg-red-100 text-red-800",
            EXPIRED: "bg-gray-100 text-gray-800"
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100'}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Organization
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Owner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Plan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Members
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Subscription
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {organizations.map((organization) => (
                        <tr key={organization.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-12 w-12">
                                        <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                            <Building className="w-6 h-6 text-blue-600" />
                                        </div>
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900">
                                            {organization.name}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {organization.slug}
                                        </div>
                                        {organization.contact.website && (
                                            <div className="flex items-center mt-1">
                                                <Globe className="w-3 h-3 text-gray-400 mr-1" />
                                                <a
                                                    href={organization.contact.website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:text-blue-800"
                                                >
                                                    {organization.contact.website}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {organization.owner.firstName} {organization.owner.lastName}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {organization.owner.email}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                    {getPlanBadge(organization.plan)}
                                    {organization.subscription && (
                                        <div className="text-xs text-gray-500">
                                            ${organization.subscription.amount}/{organization.subscription.currency}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center">
                                    <Users className="w-3 h-3 mr-1" />
                                    <span>{organization.memberCount}/{organization.maxMembers}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                    <div
                                        className="bg-blue-600 h-1.5 rounded-full"
                                        style={{ width: `${(organization.memberCount / organization.maxMembers) * 100}%` }}
                                    ></div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(organization.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                    {getSubscriptionStatusBadge(organization.subscription?.status)}
                                    {organization.subscription?.currentPeriodEnd && (
                                        <div className="text-xs text-gray-500">
                                            Renews: {new Date(organization.subscription.currentPeriodEnd).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {new Date(organization.createdAt).toLocaleDateString()}
                                </div>
                                {organization.lastActivityAt && (
                                    <div className="text-xs text-gray-400 mt-1">
                                        Active: {new Date(organization.lastActivityAt).toLocaleDateString()}
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center space-x-2">
                                    <Link
                                        to={`/admin/organizations/${organization.id}`}
                                        className="text-blue-600 hover:text-blue-900"
                                        title="View Details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Link>
                                    <Link
                                        to={`/admin/organizations/${organization.id}/edit`}
                                        className="text-green-600 hover:text-green-900"
                                        title="Edit Organization"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Link>
                                    <Link
                                        to={`/admin/organizations/${organization.id}/members`}
                                        className="text-purple-600 hover:text-purple-900"
                                        title="Manage Members"
                                    >
                                        <Users className="w-4 h-4" />
                                    </Link>
                                    <Link
                                        to={`/admin/organizations/${organization.id}/settings`}
                                        className="text-gray-600 hover:text-gray-900"
                                        title="Settings"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </Link>
                                    {organization.status === 'ACTIVE' ? (
                                        <button
                                            className="text-yellow-600 hover:text-yellow-900"
                                            title="Suspend Organization"
                                        >
                                            <XCircle className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button
                                            className="text-green-600 hover:text-green-900"
                                            title="Activate Organization"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        className="text-red-600 hover:text-red-900"
                                        title="Delete Organization"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {organizations.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-gray-500">
                        <Building className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No organizations found</p>
                        <p className="text-sm">Try adjusting your filters or create a new organization.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
