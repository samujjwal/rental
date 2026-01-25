import type { MetaFunction, LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { useState } from 'react';
import {
  Package,
  Calendar,
  Heart,
  MessageCircle,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Search,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { requireUserId, getUserToken } from '~/utils/auth.server';
import { apiClient } from '~/lib/api-client';
import type { Booking } from '~/types/booking';
import type { Listing } from '~/types/listing';
import type { Review } from '~/types/review';
import { format } from 'date-fns';

export const meta: MetaFunction = () => {
  return [{ title: 'Renter Dashboard | GharBatai Rentals' }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const token = await getUserToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const [bookings, favorites, reviews, recommendations] = await Promise.all([
      apiClient.get<Booking[]>(`/bookings/renter/${userId}`, { headers }),
      apiClient.get<Listing[]>(`/listings/favorites?userId=${userId}`, { headers }),
      apiClient.get<Review[]>(`/reviews/reviewer/${userId}`, { headers }),
      apiClient.get<Listing[]>(`/listings/recommendations?userId=${userId}`, { headers }),
    ]);

    // Calculate statistics
    const upcomingBookings = bookings.filter(b =>
      b.state === 'CONFIRMED' && new Date(b.startDate) > new Date()
    ).length;
    const activeBookings = bookings.filter(b =>
      b.state === 'IN_PROGRESS'
    ).length;
    const completedBookings = bookings.filter(b =>
      b.state === 'COMPLETED' || b.state === 'SETTLED'
    ).length;
    const totalSpent = bookings
      .filter(b => b.state === 'COMPLETED' || b.state === 'SETTLED')
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const stats = {
      upcomingBookings,
      activeBookings,
      completedBookings,
      totalSpent,
      favoriteCount: favorites.length,
      reviewCount: reviews.length,
    };

    // Get recent bookings
    const recentBookings = bookings
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      stats,
      recentBookings,
      favorites: favorites.slice(0, 3),
      recommendations: recommendations.slice(0, 4),
      pendingReviews: bookings.filter(b =>
        b.state === 'COMPLETED' && !b.hasReview
      ).slice(0, 3),
    };
  } catch (error) {
    console.error('Failed to load renter dashboard:', error);
    throw error;
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = 'indigo'
}: {
  icon: any;
  label: string;
  value: string | number;
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
  const isUpcoming = new Date(booking.startDate) > new Date();
  const isActive = booking.state === 'IN_PROGRESS';

  return (
    <Link
      to={`/bookings/${booking.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex gap-4">
        {/* Image */}
        <div className="w-20 h-20 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
          {booking.listing?.images?.[0] ? (
            <img
              src={booking.listing.images[0].url}
              alt={booking.listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-gray-900 line-clamp-1">
              {booking.listing?.title || 'Listing'}
            </h3>
            <span className={`px-2 py-1 rounded text-xs font-medium flex items-center whitespace-nowrap ml-2 ${stateColors[booking.state] || 'bg-gray-100 text-gray-800'}`}>
              <StateIcon className="w-3 h-3 mr-1" />
              {booking.state.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              {format(new Date(booking.startDate), 'MMM d')} - {format(new Date(booking.endDate), 'MMM d, yyyy')}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-2" />
              {booking.listing?.location || 'Location'}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="font-semibold text-indigo-600">
              ${booking.totalAmount.toFixed(2)}
            </span>
            {isActive && (
              <span className="text-xs text-indigo-600 font-medium">Active Now</span>
            )}
            {isUpcoming && booking.state === 'CONFIRMED' && (
              <span className="text-xs text-green-600 font-medium">Upcoming</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ListingCard({ listing, showFavorite = false }: { listing: Listing; showFavorite?: boolean }) {
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
        {showFavorite && (
          <div className="absolute top-2 right-2 p-2 bg-white rounded-full">
            <Heart className="w-5 h-5 text-red-500 fill-current" />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{listing.title}</h3>
        <p className="text-sm text-gray-600 mb-2 flex items-center">
          <MapPin className="w-4 h-4 mr-1" />
          {listing.location}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-indigo-600">
            ${listing.dailyRate}/day
          </span>
          {listing.averageRating > 0 && (
            <div className="flex items-center">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="ml-1 text-sm text-gray-700">{listing.averageRating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function RenterDashboardRoute() {
  const { stats, recentBookings, favorites, recommendations, pendingReviews } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Renter Dashboard</h1>
          <p className="text-gray-600">Track your bookings and discover new items</p>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Calendar}
            label="Upcoming Bookings"
            value={stats.upcomingBookings}
            color="blue"
          />
          <StatCard
            icon={Package}
            label="Active Rentals"
            value={stats.activeBookings}
            color="indigo"
          />
          <StatCard
            icon={CheckCircle}
            label="Completed Bookings"
            value={stats.completedBookings}
            color="green"
          />
          <StatCard
            icon={Heart}
            label="Favorites"
            value={stats.favoriteCount}
            color="red"
          />
        </div>

        {/* Pending Reviews Alert */}
        {pendingReviews.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 flex items-start">
            <Star className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">Leave a Review</h3>
              <p className="text-sm text-blue-800">
                You have {pendingReviews.length} completed rental{pendingReviews.length !== 1 ? 's' : ''} waiting for your review.
              </p>
            </div>
            <Link
              to="/bookings?filter=completed"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Write Reviews
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* My Bookings */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">My Bookings</h2>
                <Link
                  to="/bookings"
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  View All →
                </Link>
              </div>
              <div className="space-y-3">
                {recentBookings.length > 0 ? (
                  recentBookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">No bookings yet</p>
                    <Link
                      to="/search"
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      <Search className="w-5 h-5 mr-2" />
                      Start Browsing
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Recommended for You */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-indigo-600" />
                  Recommended for You
                </h2>
                <Link
                  to="/search"
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Explore More →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.length > 0 ? (
                  recommendations.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No recommendations available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Spending Summary */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">Total Spent</span>
                  <span className="text-xl font-bold text-indigo-600">
                    ${stats.totalSpent.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">Completed Rentals</span>
                  <span className="font-semibold text-gray-900">
                    {stats.completedBookings}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Bookings</span>
                  <span className="font-semibold text-gray-900">
                    {stats.activeBookings}
                  </span>
                </div>
              </div>
            </div>

            {/* My Favorites */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">My Favorites</h3>
                <Link
                  to="/favorites"
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  View All →
                </Link>
              </div>
              <div className="space-y-3">
                {favorites.length > 0 ? (
                  favorites.map((listing) => (
                    <Link
                      key={listing.id}
                      to={`/listings/${listing.id}`}
                      className="flex gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
                        {listing.images?.[0] ? (
                          <img
                            src={listing.images[0].url}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 line-clamp-1 text-sm">
                          {listing.title}
                        </h4>
                        <p className="text-sm text-gray-600">${listing.dailyRate}/day</p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <Heart className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No favorites yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  to="/search"
                  className="flex items-center w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <Search className="w-5 h-5 mr-3 text-indigo-600" />
                  Browse Listings
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
                  <Package className="w-5 h-5 mr-3 text-indigo-600" />
                  My Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
