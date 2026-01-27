import { Link } from "react-router";
import {
    MoreHorizontal,
    Eye,
    Edit,
    Calendar,
    DollarSign,
    User,
    Home,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    MessageSquare,
    CreditCard,
    FileText
} from "lucide-react";

interface Booking {
    id: string;
    status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'DISPUTED' | 'REFUNDED';
    startDate: string;
    endDate: string;
    totalPrice: number;
    currency: string;
    listing: {
        id: string;
        title: string;
        photos: string[];
    };
    renter: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    owner: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    payment: {
        status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
        method: string;
    };
    createdAt: string;
    updatedAt: string;
    specialRequests?: string;
    hasDispute: boolean;
    reviewSubmitted: boolean;
}

interface BookingsTableProps {
    bookings: Booking[];
}

export function BookingsTable({ bookings }: BookingsTableProps) {
    const getStatusBadge = (status: string) => {
        const styles = {
            PENDING: "bg-yellow-100 text-yellow-800",
            CONFIRMED: "bg-green-100 text-green-800",
            CANCELLED: "bg-gray-100 text-gray-800",
            COMPLETED: "bg-blue-100 text-blue-800",
            DISPUTED: "bg-red-100 text-red-800",
            REFUNDED: "bg-red-100 text-red-800"
        };

        const icons = {
            PENDING: Clock,
            CONFIRMED: CheckCircle,
            CANCELLED: XCircle,
            COMPLETED: CheckCircle,
            DISPUTED: AlertTriangle,
            REFUNDED: AlertTriangle
        };

        const Icon = icons[status as keyof typeof icons];

        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100'}`}>
                <Icon className="w-3 h-3 mr-1" />
                {status}
            </span>
        );
    };

    const getPaymentStatusBadge = (status: string) => {
        const styles = {
            PENDING: "bg-yellow-100 text-yellow-800",
            PAID: "bg-green-100 text-green-800",
            FAILED: "bg-red-100 text-red-800",
            REFUNDED: "bg-gray-100 text-gray-800"
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100'}`}>
                {status}
            </span>
        );
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    const calculateDuration = (startDate: string, endDate: string) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return `${diffDays} days`;
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Booking
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Listing
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Renter
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Owner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Dates
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Payment
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {bookings.map((booking) => (
                        <tr key={booking.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                    #{booking.id.slice(0, 8)}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {formatDate(booking.createdAt)}
                                </div>
                                {booking.hasDispute && (
                                    <div className="flex items-center mt-1">
                                        <AlertTriangle className="w-3 h-3 text-red-500 mr-1" />
                                        <span className="text-xs text-red-600">Dispute</span>
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                        {booking.listing.photos.length > 0 ? (
                                            <img
                                                src={booking.listing.photos[0]}
                                                alt={booking.listing.title}
                                                className="h-10 w-10 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center">
                                                <Home className="w-5 h-5 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-3">
                                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                                            {booking.listing.title}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {booking.renter.firstName} {booking.renter.lastName}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {booking.renter.email}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {booking.owner.firstName} {booking.owner.lastName}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {booking.owner.email}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    <div>
                                        <div>{formatDate(booking.startDate)}</div>
                                        <div className="text-xs text-gray-400">
                                            {calculateDuration(booking.startDate, booking.endDate)}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center">
                                    <DollarSign className="w-3 h-3 mr-1" />
                                    <span className="font-medium">
                                        {booking.totalPrice.toLocaleString()} {booking.currency}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(booking.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                    {getPaymentStatusBadge(booking.payment.status)}
                                    <div className="text-xs text-gray-500">
                                        {booking.payment.method}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center space-x-2">
                                    <Link
                                        to={`/admin/bookings/${booking.id}`}
                                        className="text-blue-600 hover:text-blue-900"
                                        title="View Details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Link>
                                    <Link
                                        to={`/admin/bookings/${booking.id}/edit`}
                                        className="text-green-600 hover:text-green-900"
                                        title="Edit Booking"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Link>
                                    {booking.status === 'PENDING' && (
                                        <>
                                            <button
                                                className="text-green-600 hover:text-green-900"
                                                title="Confirm Booking"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                            <button
                                                className="text-red-600 hover:text-red-900"
                                                title="Cancel Booking"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    {!booking.hasDispute && booking.status === 'COMPLETED' && (
                                        <button
                                            className="text-yellow-600 hover:text-yellow-900"
                                            title="Create Dispute"
                                        >
                                            <AlertTriangle className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        className="text-gray-600 hover:text-gray-900"
                                        title="Send Message"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {bookings.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No bookings found</p>
                        <p className="text-sm">Try adjusting your filters or create a new booking.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
