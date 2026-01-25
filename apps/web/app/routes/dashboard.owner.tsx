import type { MetaFunction, LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { useState } from 'react';
import {
  Package,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  MessageCircle,
  AlertCircle,
  Star,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import { requireUserId, getUserToken } from '~/utils/auth.server';
import { apiClient } from '~/lib/api-client';
import type { Listing } from '~/types/listing';
import type { Booking } from '~/types/booking';
import type { Review } from '~/types/review';
import { format } from 'date-fns';

export const meta: MetaFunction = () => {
  return [{ title: 'Owner Dashboard | GharBatai Rentals' }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const token = await getUserToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const [listings, bookings, reviews, earnings] = await Promise.all([
      apiClient.get<Listing[]>(`/listings?ownerId=${userId}`, { headers }),
      apiClient.get<Booking[]>(`/bookings/owner/${userId}`, { headers }),
      apiClient.get<Review[]>(`/reviews/user/${userId}`, { headers }),
      apiClient.get<any>(`/payments/earnings/${userId}`, { headers }),
    ]);

    // Calculate statistics
    const activeListings = listings.filter(l => l.status === 'ACTIVE').length;
    const totalListings = listings.length;
    const pendingBookings = bookings.filter(b =>
      b.state === 'PENDING_OWNER_APPROVAL' || b.state === 'PENDING_PAYMENT'
    ).length;
    const activeBookings = bookings.filter(b =>
      b.state === 'CONFIRMED' || b.state === 'IN_PROGRESS'
    ).length;
    const completedBookings = bookings.filter(b =>
      b.state === 'COMPLETED' || b.state === 'SETTLED'
    ).length;
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    const stats = {
      activeListings,
      totalListings,
      pendingBookings,
      activeBookings,
      completedBookings,
      totalEarnings: earnings.totalAmount || 0,
      pendingEarnings: earnings.pendingAmount || 0,
      averageRating,
      totalReviews: reviews.length,
    };

    // Get recent bookings
    const recentBookings = bookings
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      stats,
      listings: listings.slice(0, 6), // Show top 6 listings
      recentBookings,
      recentReviews: reviews.slice(0, 3),
    };
  } catch (error) {
    console.error('Failed to load owner dashboard:', error);
    throw error;
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  color = 'indigo'
}: {
  icon: any;
  label: string;
  value: string | number;
  trend?: string;
  color?: string;
}) {
  const colorClasses = {
    indigo: 'bg-indigo-100 text-indigo-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    blue: 'bg-blue-100 text-blue-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-full ${colorClasses[color] || colorClasses.indigo}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className="text-sm text-green-600 flex items-center">
            <ArrowUpRight className="w-4 h-4 mr-1" />
            {trend}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const stateColors = {
    PENDING_OWNER_APPROVAL: 'bg-yellow-100 text-yellow-800',
    PENDING_PAYMENT: 'bg-blue-100 text-blue-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  const stateIcons = {
    PENDING_OWNER_APPROVAL: Clock,
    PENDING_PAYMENT: DollarSign,
    CONFIRMED: CheckCircle,
    IN_PROGRESS: Package,
    COMPLETED: CheckCircle,
    CANCELLED: XCircle,
  };

  const StateIcon = stateIcons[booking.state] || Clock;

  return (
    <Link
      to={`/bookings/${booking.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            {booking.listing?.title || 'Listing'}
          </h3>
          <p className="text-sm text-gray-600">
            {booking.renter?.fullName || 'Renter'}
          </p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium flex items-center ${stateColors[booking.state] || 'bg-gray-100 text-gray-800'}`}>
          <StateIcon className="w-3 h-3 mr-1" />
          {booking.state.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center text-gray-600">
          <Calendar className="w-4 h-4 mr-1" />
          {format(new Date(booking.startDate), 'MMM d')} - {format(new Date(booking.endDate), 'MMM d')}
        </div>
        <span className="font-semibold text-indigo-600">
          ${booking.totalAmount.toFixed(2)}
        </span>
      </div>
    </Link>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      to={`/listings/${listing.id}`}
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div className="aspect-video bg-gray-200 relative">
        {listing.images?.[0] ? (
          <img
            src={listing.images[0].url}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-400" />
          </div>
        )}
        <span className={`absolute top-2 right-2 px-2 py-1 text-white text-xs font-semibold rounded ${listing.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-500'
          }`}>
          {listing.status}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{listing.title}</h3>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-indigo-600">
            ${listing.dailyRate}/day
          </span>
          {listing.averageRating > 0 && (
            <div className="flex items-center">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="ml-1 text-sm text-gray-700">{listing.averageRating.toFixed(1)}</span>
              <span className="ml-1 text-sm text-gray-500">({listing.reviewCount})</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function OwnerDashboardRoute() {
  const { stats, listings, recentBookings, recentReviews } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Owner Dashboard</h1>
          <p className="text-gray-600">Manage your listings, bookings, and earnings</p>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Package}
            label="Active Listings"
            value={`${stats.activeListings}/${stats.totalListings}`}
            color="indigo"
          />
          <StatCard
            icon={DollarSign}
            label="Total Earnings"
            value={`$${stats.totalEarnings.toFixed(2)}`}
            trend="+12%"
            color="green"
          />
          <StatCard
            icon={Calendar}
            label="Active Bookings"
            value={stats.activeBookings}
            color="blue"
          />
          <StatCard
            icon={Star}
            label="Average Rating"
            value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}
            color="yellow"
          />
        </div>

        {/* Pending Actions */}
        {stats.pendingBookings > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 mb-1">Action Required</h3>
              <p className="text-sm text-yellow-800">
                You have {stats.pendingBookings} booking{stats.pendingBookings !== 1 ? 's' : ''} waiting for your approval.
              </p>
            </div>
            <Link
              to="/bookings?filter=pending"
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm font-medium"
            >
              Review Now
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent Bookings */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Recent Bookings</h2>
                <Link
                  to="/bookings"
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                >
                  View All
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
              <div className="space-y-3">
                {recentBookings.length > 0 ? (
                  recentBookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No bookings yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* My Listings */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">My Listings</h2>
                <div className="flex gap-3">
                  <Link
                    to="/listings"
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                  >
                    View All
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Link>
                  <Link
                    to="/listings/new"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New Listing
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.length > 0 ? (
                  listings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">No listings yet</p>
                    <Link
                      to="/listings/new"
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create Your First Listing
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Earnings Summary */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Earnings Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">Total Earned</span>
                  <span className="text-xl font-bold text-green-600">
                    ${stats.totalEarnings.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">Pending</span>
                  <span className="text-lg font-semibold text-yellow-600">
                    ${stats.pendingEarnings.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Completed Rentals</span>
                  <span className="font-semibold text-gray-900">
                    {stats.completedBookings}
                  </span>
                </div>
              </div>
              <Link
                to="/payments"
                className="mt-6 w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-center block"
              >
                View Payment History
              </Link>
            </div>

            {/* Recent Reviews */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Reviews</h3>
                <div className="flex items-center">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="ml-1 font-semibold text-gray-900">
                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                {recentReviews.length > 0 ? (
                  recentReviews.map((review) => (
                    <div key={review.id} className="border-b last:border-b-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">
                          {review.reviewer?.fullName}
                        </span>
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="ml-1 text-sm font-semibold">{review.rating}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{review.comment}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <Star className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No reviews yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  to="/listings/new"
                  className="flex items-center w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <Plus className="w-5 h-5 mr-3 text-indigo-600" />
                  Create New Listing
                </Link>
                <Link
                  to="/messages"
                  className="flex items-center w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <MessageCircle className="w-5 h-5 mr-3 text-indigo-600" />
                  View Messages
                </Link>
                <Link
                  to="/settings/profile"
                  className="flex items-center w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <Users className="w-5 h-5 mr-3 text-indigo-600" />
                  Edit Profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
