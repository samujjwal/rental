import { useState } from 'react';
import { Trash2, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { useFavorites, useRemoveFavorite, useClearAllFavorites } from '~/hooks/useFavorites';
import { Link } from 'react-router';
import { FadeIn, StaggerList } from '~/components/animations';
import { ConfirmDialog } from '~/components/ui/ConfirmDialog';

export interface FavoritesListProps {
    showFilters?: boolean;
    showClearAll?: boolean;
}

/**
 * FavoritesList Component
 * Displays user's favorite listings with filtering and sorting
 */
export function FavoritesList({
    showFilters = true,
    showClearAll = true,
}: FavoritesListProps) {
    const [sortBy, setSortBy] = useState<'createdAt' | 'price' | 'title'>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [category, setCategory] = useState<string>('');
    const [clearDialogOpen, setClearDialogOpen] = useState(false);

    const { data, isLoading, error } = useFavorites({
        sortBy,
        sortOrder,
        category: category || undefined,
    });

    const { mutate: removeFavorite } = useRemoveFavorite();
    const { mutate: clearAll, isPending: isClearing } = useClearAllFavorites();

    const handleRemove = (listingId: string) => {
        removeFavorite({ listingId });
    };

    const handleClearAll = () => {
        clearAll();
        setClearDialogOpen(false);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 size={32} className="animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="my-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                <AlertCircle size={20} />
                Failed to load favorites. Please try again.
            </div>
        );
    }

    const favorites = data?.favorites || [];
    const isEmpty = favorites.length === 0;

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">My Favorites</h1>
                {showClearAll && !isEmpty && (
                    <button
                        type="button"
                        onClick={() => setClearDialogOpen(true)}
                        disabled={isClearing}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                        Clear All
                    </button>
                )}
            </div>

            {/* Filters */}
            {showFilters && !isEmpty && (
                <div className="mb-6 flex flex-wrap gap-3">
                    <div className="min-w-[150px]">
                        <label htmlFor="sortBy" className="mb-1 block text-xs font-medium text-gray-500">Sort By</label>
                        <select
                            id="sortBy"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'price' | 'title')}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="createdAt">Date Added</option>
                            <option value="price">Price</option>
                            <option value="title">Title</option>
                        </select>
                    </div>

                    <div className="min-w-[120px]">
                        <label htmlFor="sortOrder" className="mb-1 block text-xs font-medium text-gray-500">Order</label>
                        <select
                            id="sortOrder"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="desc">Descending</option>
                            <option value="asc">Ascending</option>
                        </select>
                    </div>

                    <div className="min-w-[150px]">
                        <label htmlFor="category" className="mb-1 block text-xs font-medium text-gray-500">Category</label>
                        <select
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="">All Categories</option>
                            <option value="apartment">Apartment</option>
                            <option value="house">House</option>
                            <option value="vehicle">Vehicle</option>
                            <option value="equipment">Equipment</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {isEmpty && (
                <FadeIn>
                    <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
                        <h3 className="mb-2 text-lg font-semibold text-gray-500">
                            No favorites yet
                        </h3>
                        <p className="mb-6 text-sm text-gray-400">
                            Start adding listings to your favorites to see them here
                        </p>
                        <Link
                            to="/search"
                            className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                        >
                            Browse Listings
                        </Link>
                    </div>
                </FadeIn>
            )}

            {/* Favorites Grid */}
            {!isEmpty && (
                <StaggerList
                    items={favorites}
                    staggerDelay={0.05}
                    renderItem={(favorite) => (
                        <div className="mb-3 flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                            {/* Image */}
                            <Link
                                to={`/listings/${favorite.listingId}`}
                                className="w-48 flex-shrink-0"
                            >
                                <div
                                    className="h-full w-full bg-cover bg-center"
                                    style={{
                                        backgroundImage: `url(${favorite.listing?.images?.[0] || '/placeholder.jpg'})`,
                                    }}
                                />
                            </Link>

                            {/* Content */}
                            <div className="flex flex-1 flex-col">
                                <div className="flex-1 p-4">
                                    <Link
                                        to={`/listings/${favorite.listingId}`}
                                        className="text-base font-semibold text-gray-900 no-underline hover:text-blue-600"
                                    >
                                        {favorite.listing?.title || 'Untitled Listing'}
                                    </Link>

                                    <p className="mb-2 mt-1 text-sm text-gray-500">
                                        {favorite.listing?.description?.substring(0, 150)}
                                        {(favorite.listing?.description?.length || 0) > 150 && '...'}
                                    </p>

                                    <div className="mb-2 flex items-center gap-1 text-sm text-gray-500">
                                        <MapPin size={16} />
                                        {favorite.listing?.location?.city}, {favorite.listing?.location?.state}
                                    </div>

                                    <p className="text-base font-semibold text-blue-600">
                                        ${favorite.listing?.basePrice}/day
                                    </p>

                                    <p className="mt-1 text-xs text-gray-400">
                                        Added {new Date(favorite.createdAt).toLocaleDateString()}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end px-4 pb-3">
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(favorite.listingId)}
                                        className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                                        aria-label="Remove from favorites"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                />
            )}

            {/* Clear All Confirmation Dialog */}
            <ConfirmDialog
                open={clearDialogOpen}
                onClose={() => setClearDialogOpen(false)}
                onConfirm={handleClearAll}
                title="Clear All Favorites?"
                message="This will remove all listings from your favorites. This action cannot be undone."
                confirmText="Clear All"
                confirmColor="error"
                isLoading={isClearing}
            />
        </div>
    );
}
