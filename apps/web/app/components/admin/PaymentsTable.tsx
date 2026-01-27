import { Link } from "react-router";
import {
    MoreHorizontal,
    Eye,
    Edit,
    CreditCard,
    DollarSign,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    RefreshCw,
    Calendar,
    User,
    FileText,
    ExternalLink
} from "lucide-react";

interface Payment {
    id: string;
    status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
    amount: number;
    currency: string;
    method: 'STRIPE' | 'PAYPAL' | 'BANK_TRANSFER' | 'CREDIT_CARD';
    booking: {
        id: string;
        title: string;
    };
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    transactionId?: string;
    stripePaymentIntentId?: string;
    failureReason?: string;
    refundAmount?: number;
    createdAt: string;
    processedAt?: string;
    dueDate?: string;
    metadata?: Record<string, any>;
}

interface PaymentsTableProps {
    payments: Payment[];
}

export function PaymentsTable({ payments }: PaymentsTableProps) {
    const getStatusBadge = (status: string) => {
        const styles = {
            PENDING: "bg-yellow-100 text-yellow-800",
            PAID: "bg-green-100 text-green-800",
            FAILED: "bg-red-100 text-red-800",
            REFUNDED: "bg-gray-100 text-gray-800",
            PARTIALLY_REFUNDED: "bg-orange-100 text-orange-800"
        };

        const icons = {
            PENDING: Clock,
            PAID: CheckCircle,
            FAILED: XCircle,
            REFUNDED: RefreshCw,
            PARTIALLY_REFUNDED: RefreshCw
        };

        const Icon = icons[status as keyof typeof icons];

        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100'}`}>
                <Icon className="w-3 h-3 mr-1" />
                {status.replace('_', ' ')}
            </span>
        );
    };

    const getMethodBadge = (method: string) => {
        const styles = {
            STRIPE: "bg-purple-100 text-purple-800",
            PAYPAL: "bg-blue-100 text-blue-800",
            BANK_TRANSFER: "bg-green-100 text-green-800",
            CREDIT_CARD: "bg-gray-100 text-gray-800"
        };

        return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${styles[method as keyof typeof styles] || 'bg-gray-100'}`}>
                {method.replace('_', ' ')}
            </span>
        );
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Payment
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Booking
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Method
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                    #{payment.id.slice(0, 8)}
                                </div>
                                {payment.transactionId && (
                                    <div className="text-sm text-gray-500">
                                        TX: {payment.transactionId.slice(0, 12)}...
                                    </div>
                                )}
                                {payment.stripePaymentIntentId && (
                                    <div className="text-sm text-gray-500">
                                        PI: {payment.stripePaymentIntentId.slice(0, 12)}...
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {payment.booking.title}
                                </div>
                                <div className="text-sm text-gray-500">
                                    #{payment.booking.id.slice(0, 8)}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {payment.user.firstName} {payment.user.lastName}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {payment.user.email}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center">
                                    <DollarSign className="w-3 h-3 mr-1" />
                                    <span className="font-medium">
                                        {payment.amount.toLocaleString()} {payment.currency}
                                    </span>
                                </div>
                                {payment.refundAmount && payment.refundAmount > 0 && (
                                    <div className="text-xs text-orange-600 mt-1">
                                        Refunded: ${payment.refundAmount.toLocaleString()}
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {getMethodBadge(payment.method)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                    {getStatusBadge(payment.status)}
                                    {payment.failureReason && (
                                        <div className="text-xs text-red-600 max-w-xs truncate" title={payment.failureReason}>
                                            {payment.failureReason}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    <div>
                                        <div>{formatDate(payment.createdAt)}</div>
                                        {payment.processedAt && (
                                            <div className="text-xs text-green-600">
                                                Processed: {formatDate(payment.processedAt)}
                                            </div>
                                        )}
                                        {payment.dueDate && payment.status === 'PENDING' && (
                                            <div className="text-xs text-yellow-600">
                                                Due: {formatDate(payment.dueDate)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center space-x-2">
                                    <Link
                                        to={`/admin/payments/${payment.id}`}
                                        className="text-blue-600 hover:text-blue-900"
                                        title="View Details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Link>
                                    {payment.status === 'PENDING' && (
                                        <button
                                            className="text-green-600 hover:text-green-900"
                                            title="Process Payment"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                        </button>
                                    )}
                                    {payment.status === 'FAILED' && (
                                        <button
                                            className="text-yellow-600 hover:text-yellow-900"
                                            title="Retry Payment"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    )}
                                    {payment.status === 'PAID' && !payment.refundAmount && (
                                        <button
                                            className="text-orange-600 hover:text-orange-900"
                                            title="Process Refund"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    )}
                                    {payment.stripePaymentIntentId && (
                                        <button
                                            className="text-gray-600 hover:text-gray-900"
                                            title="View in Stripe"
                                            onClick={() => window.open(`https://dashboard.stripe.com/payments/${payment.stripePaymentIntentId}`, '_blank')}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        className="text-gray-600 hover:text-gray-900"
                                        title="Send Receipt"
                                    >
                                        <FileText className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {payments.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-gray-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No payments found</p>
                        <p className="text-sm">Try adjusting your filters or check back later.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
