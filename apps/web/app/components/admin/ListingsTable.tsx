import { Link } from "react-router";
import {
    MoreHorizontal,
    Eye,
    Edit,
    Trash2,
    CheckCircle,
    XCircle,
    Clock,
    MapPin,
    Calendar,
    DollarSign,
    Home,
    Star,
    Image,
    AlertTriangle
} from "lucide-react";

interface Listing {
    id: string;
    title: string;
    description: string;
    status: 'ACTIVE' | 'PENDING' | 'DRAFT' | 'REJECTED' | 'SUSPENDED';
    category: {
        id: string;
        name: string;
    };
    owner: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    location: {
        addressLine1: string;
        city: string;
        state: string;
        country: string;
    };
    pricing: {
        basePrice: number;
        currency: string;
    };
    availability: {
        isAvailable: boolean;
    };
    photos: string[];
    averageRating: number;
    totalReviews: number;
    createdAt: string;
    updatedAt: string;
}

interface ListingsTableProps {
    listings: Listing[];
}

export function ListingsTable({ listings }: ListingsTableProps) {
    const getStatusBadge = (status: string) => {
        const styles = {
            ACTIVE: "bg-green-100 text-green-800",
            PENDING: "bg-yellow-100 text-yellow-800",
            DRAFT: "bg-gray-100 text-gray-800",
            REJECTED: "bg-red-100 text-red-800",
            SUSPENDED: "bg-red-100 text-red-800"
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100'}`}>
                {status}
            </span>
        );
    };

    const getAvailabilityBadge = (isAvailable: boolean) => {
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                {isAvailable ? 'Available' : 'Unavailable'}
            </span>
        );
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Listing
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Owner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Pricing
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rating
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
                    {listings.map((listing) => (
                        <tr key={listing.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-12 w-12">
                                        {listing.photos.length > 0 ? (
                                            <img
                                                src={listing.photos[0]}
                                                alt={listing.title}
                                                className="h-12 w-12 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center">
                                                <Home className="w-6 h-6 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                                            {listing.title}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            ID: {listing.id.slice(0, 8)}...
                                        </div>
                                        <div className="flex items-center mt-1">
                                            {getAvailabilityBadge(listing.availability.isAvailable)}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {listing.owner.firstName} {listing.owner.lastName}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {listing.owner.email}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{listing.category.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    <span className="max-w-xs truncate">
                                        {listing.location.city}, {listing.location.state}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center">
                                    <DollarSign className="w-3 h-3 mr-1" />
                                    <span className="font-medium">
                                        {listing.pricing.basePrice.toLocaleString()}/{listing.pricing.currency}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(listing.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center">
                                    <Star className="w-3 h-3 text-yellow-400 mr-1" />
                                    <span>{listing.averageRating.toFixed(1)}</span>
                                    <span className="text-gray-400 ml-1">({listing.totalReviews})</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {new Date(listing.createdAt).toLocaleDateString()}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center space-x-2">
                                    <Link
                                        to={`/admin/listings/${listing.id}`}
                                        className="text-blue-600 hover:text-blue-900"
                                        title="View Details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Link>
                                    <Link
                                        to={`/admin/listings/${listing.id}/edit`}
                                        className="text-green-600 hover:text-green-900"
                                        title="Edit Listing"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Link>
                                    {listing.status === 'PENDING' && (
                                        <>
                                            <button
                                                className="text-green-600 hover:text-green-900"
                                                title="Approve Listing"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                            <button
                                                className="text-red-600 hover:text-red-900"
                                                title="Reject Listing"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    {listing.status === 'ACTIVE' && (
                                        <button
                                            className="text-yellow-600 hover:text-yellow-900"
                                            title="Suspend Listing"
                                        >
                                            <AlertTriangle className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        className="text-red-600 hover:text-red-900"
                                        title="Delete Listing"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {listings.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-gray-500">
                        <Home className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No listings found</p>
                        <p className="text-sm">Try adjusting your filters or create a new listing.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
