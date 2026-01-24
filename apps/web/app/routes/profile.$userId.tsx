import type { MetaFunction, LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link, redirect } from 'react-router';
import { useState } from 'react';
import {
  User,
  MapPin,
  Calendar,
  Mail,
  Phone,
  Star,
  Package,
  MessageCircle,
  Shield,
  Clock,
  Award,
  TrendingUp,
} from 'lucide-react';
import { usersApi } from '~/lib/api/users';
import { listingsApi } from '~/lib/api/listings';
import { reviewsApi } from '~/lib/api/reviews';
import type { User as UserType } from '~/types/user';
import type { Listing } from '~/types/listing';
import type { Review } from '~/types/review';
import { format } from 'date-fns';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [{ title: `${data?.user?.fullName || 'User'} Profile | GharBatai Rentals` }];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const userId = params.userId;
  if (!userId) {
    throw redirect('/');
  }

  try {
    const [user, listings, reviews] = await Promise.all([
      usersApi.getUserById(userId),
      listingsApi.getListingsByOwnerId(userId),
      reviewsApi.getReviewsForUser(userId),
    ]);

    // Calculate statistics
    const totalListings = listings.length;
    const activeListings = listings.filter(l => l.status === 'ACTIVE').length;
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
    const totalReviews = reviews.length;

    return { 
      user, 
      listings,
      reviews,
      stats: {
        totalListings,
        activeListings,
        averageRating,
        totalReviews,
      }
    };
  } catch (error) {
    console.error('Failed to load user profile:', error);
    throw redirect('/');
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
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-full bg-${color}-100`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="w-6 h-6 text-gray-600" />
          </div>
          <div className="ml-3">
            <p className="font-medium text-gray-900">{review.reviewer?.fullName}</p>
            <p className="text-sm text-gray-600">
              {format(new Date(review.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <Star className="w-5 h-5 text-yellow-400 fill-current" />
          <span className="ml-1 font-semibold text-gray-900">{review.rating}</span>
        </div>
      </div>
      <p className="text-gray-700">{review.comment}</p>
      {review.listing && (
        <Link
          to={`/listings/${review.listing.id}`}
          className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
        >
          <Package className="w-4 h-4 mr-1" />
          {review.listing.title}
        </Link>
      )}
    </div>
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
        {listing.status === 'ACTIVE' && (
          <span className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded">
            Available
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{listing.title}</h3>
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{listing.description}</p>
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

export default function ProfileRoute() {
  const { user, listings, reviews, stats } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<'listings' | 'reviews'>('listings');

  const memberSince = format(new Date(user.createdAt), 'MMMM yyyy');
  const responseRate = user.responseRate || 0;
  const responseTime = user.responseTime || 'N/A';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-3xl font-bold flex-shrink-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                user.fullName.charAt(0).toUpperCase()
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{user.fullName}</h1>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-1" />
                      {user.email}
                    </div>
                    {user.phoneNumber && (
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-1" />
                        {user.phoneNumber}
                      </div>
                    )}
                    {user.location && (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {user.location}
                      </div>
                    )}
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      Member since {memberSince}
                    </div>
                  </div>
                </div>

                {/* Verification Badge */}
                {user.emailVerified && (
                  <div className="flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    <Shield className="w-4 h-4 mr-1" />
                    Verified
                  </div>
                )}
              </div>

              {user.bio && (
                <p className="mt-4 text-gray-700">{user.bio}</p>
              )}
            </div>

            {/* Contact Button */}
            <Link
              to={`/messages?user=${user.id}`}
              className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center whitespace-nowrap"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Contact
            </Link>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Package}
            label="Active Listings"
            value={stats.activeListings}
            color="indigo"
          />
          <StatCard
            icon={Star}
            label="Average Rating"
            value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}
            color="yellow"
          />
          <StatCard
            icon={MessageCircle}
            label="Response Rate"
            value={`${responseRate}%`}
            color="green"
          />
          <StatCard
            icon={Clock}
            label="Response Time"
            value={responseTime}
            color="blue"
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('listings')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'listings'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Listings ({stats.totalListings})
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'reviews'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Reviews ({stats.totalReviews})
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'listings' && (
              <div>
                {listings.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listings.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No listings available</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                {reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No reviews yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
