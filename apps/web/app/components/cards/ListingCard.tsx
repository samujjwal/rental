import React from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { MapPin, Star, Zap } from 'lucide-react';
import { cn } from '~/lib/utils';
import { formatCurrency } from '~/lib/utils';
import { prefersReducedMotion } from '~/lib/accessibility';
import { Badge } from '~/components/ui/badge';
import { CompactFavoriteButton } from '~/components/favorites';
import { OptimizedImage } from '~/components/ui/OptimizedImage';

export interface ListingCardData {
    id: string;
    title: string;
    description?: string;
    images?: string[];
    pricePerDay: number;
    location?: {
        city?: string;
        state?: string;
    };
    condition?: string;
    rating?: number;
    totalReviews?: number;
    featured?: boolean;
    instantBooking?: boolean;
}

export interface ListingCardProps {
    listing: ListingCardData;
    variant?: 'default' | 'compact' | 'horizontal';
    showFavorite?: boolean;
    priority?: boolean;
    className?: string;
}

/**
 * ListingCard - Enhanced card with hover effects and animations
 * 
 * Features:
 * - Lift and shadow on hover
 * - Image zoom effect
 * - Optimized image loading
 * - Favorite button with optimistic updates
 * - Multiple variants (default, compact, horizontal)
 * - Respects reduced motion preferences
 */
export function ListingCard({
    listing,
    variant = 'default',
    showFavorite = true,
    priority = false,
    className,
}: ListingCardProps) {
    const shouldReduceMotion = prefersReducedMotion();

    if (variant === 'horizontal') {
        return <ListingCardHorizontal listing={listing} showFavorite={showFavorite} className={className} />;
    }

    if (variant === 'compact') {
        return <ListingCardCompact listing={listing} showFavorite={showFavorite} className={className} />;
    }

    return (
        <motion.div
            whileHover={shouldReduceMotion ? {} : { y: -8, scale: 1.02 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn('group', className)}
        >
            <Link
                to={`/listings/${listing.id}`}
                className="block bg-card rounded-lg shadow-sm border overflow-hidden transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                {/* Image Container */}
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <motion.div
                        className="w-full h-full"
                        whileHover={shouldReduceMotion ? {} : { scale: 1.1 }}
                        transition={{ duration: 0.4 }}
                    >
                        {listing.images?.[0] ? (
                            <OptimizedImage
                                src={listing.images[0]}
                                alt={listing.title}
                                aspectRatio="4/3"
                                priority={priority}
                                className="w-full h-full"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <span className="text-sm">No image</span>
                            </div>
                        )}
                    </motion.div>

                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                        {listing.featured && (
                            <Badge variant="warning" className="shadow-sm">
                                <Star className="w-3 h-3 mr-1" />
                                Featured
                            </Badge>
                        )}
                        {listing.instantBooking && (
                            <Badge variant="success" className="shadow-sm">
                                <Zap className="w-3 h-3 mr-1" />
                                Instant
                            </Badge>
                        )}
                    </div>

                    {/* Favorite Button */}
                    {showFavorite && (
                        <div className="absolute top-2 right-2">
                            <CompactFavoriteButton listingId={listing.id} />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-4">
                    <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                        {listing.title}
                    </h3>

                    {listing.location && (
                        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="truncate">
                                {listing.location.city}
                                {listing.location.state && `, ${listing.location.state}`}
                            </span>
                        </p>
                    )}

                    <div className="flex items-center justify-between mb-2">
                        {listing.condition && (
                            <span className="text-sm text-muted-foreground capitalize">
                                {listing.condition.replace('-', ' ')}
                            </span>
                        )}
                        {listing.rating !== undefined && listing.rating > 0 && (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                {listing.rating.toFixed(1)}
                                {listing.totalReviews !== undefined && (
                                    <span className="text-xs">({listing.totalReviews})</span>
                                )}
                            </span>
                        )}
                    </div>

                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-foreground">
                            {formatCurrency(listing.pricePerDay)}
                        </span>
                        <span className="text-sm text-muted-foreground">/day</span>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

/**
 * ListingCardHorizontal - Horizontal layout for list views
 */
function ListingCardHorizontal({
    listing,
    showFavorite = true,
    className,
}: Omit<ListingCardProps, 'variant' | 'priority'>) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            whileHover={shouldReduceMotion ? {} : { x: 4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn('group', className)}
        >
            <Link
                to={`/listings/${listing.id}`}
                className="flex bg-card rounded-lg shadow-sm border overflow-hidden transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {/* Image */}
                <div className="w-48 h-36 bg-muted relative shrink-0 overflow-hidden">
                    {listing.images?.[0] ? (
                        <OptimizedImage
                            src={listing.images[0]}
                            alt={listing.title}
                            className="w-full h-full"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <span className="text-xs">No image</span>
                        </div>
                    )}
                    {listing.instantBooking && (
                        <Badge variant="success" className="absolute top-2 left-2 shadow-sm">
                            <Zap className="w-3 h-3 mr-1" />
                            Instant
                        </Badge>
                    )}
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between min-w-0">
                    <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                {listing.title}
                            </h3>
                            {listing.featured && (
                                <Badge variant="warning" className="shrink-0">Featured</Badge>
                            )}
                        </div>

                        {listing.location && (
                            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                                <MapPin className="w-4 h-4 shrink-0" />
                                <span className="truncate">
                                    {listing.location.city}
                                    {listing.location.state && `, ${listing.location.state}`}
                                </span>
                            </p>
                        )}

                        {listing.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {listing.description}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-4">
                            {listing.condition && (
                                <span className="text-sm text-muted-foreground capitalize">
                                    {listing.condition.replace('-', ' ')}
                                </span>
                            )}
                            {listing.rating !== undefined && listing.rating > 0 && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    {listing.rating.toFixed(1)} ({listing.totalReviews})
                                </span>
                            )}
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-foreground">
                                {formatCurrency(listing.pricePerDay)}
                            </span>
                            <span className="text-sm text-muted-foreground">/day</span>
                        </div>
                    </div>
                </div>

                {/* Favorite Button */}
                {showFavorite && (
                    <div className="p-4 flex items-start">
                        <CompactFavoriteButton listingId={listing.id} className="relative" />
                    </div>
                )}
            </Link>
        </motion.div>
    );
}

/**
 * ListingCardCompact - Compact layout for map views and sidebars
 */
function ListingCardCompact({
    listing,
    showFavorite = false,
    className,
}: Omit<ListingCardProps, 'variant' | 'priority'>) {
    const shouldReduceMotion = prefersReducedMotion();

    return (
        <motion.div
            whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn('group', className)}
        >
            <Link
                to={`/listings/${listing.id}`}
                className="flex gap-3 bg-card rounded-lg border p-3 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {/* Thumbnail */}
                <div className="w-20 h-20 bg-muted rounded-lg shrink-0 overflow-hidden">
                    {listing.images?.[0] ? (
                        <OptimizedImage
                            src={listing.images[0]}
                            alt={listing.title}
                            aspectRatio="square"
                            className="w-full h-full"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            No img
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
                        {listing.title}
                    </h3>

                    {listing.location && (
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {listing.location.city}
                        </p>
                    )}

                    {listing.rating !== undefined && listing.rating > 0 && (
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            {listing.rating.toFixed(1)} ({listing.totalReviews})
                        </p>
                    )}

                    <p className="text-sm font-bold text-foreground">
                        {formatCurrency(listing.pricePerDay)}/day
                    </p>
                </div>

                {/* Favorite Button */}
                {showFavorite && (
                    <CompactFavoriteButton listingId={listing.id} className="relative shrink-0" />
                )}
            </Link>
        </motion.div>
    );
}

/**
 * ListingCardGrid - Grid container for listing cards
 */
export interface ListingCardGridProps {
    listings: ListingCardData[];
    variant?: ListingCardProps['variant'];
    columns?: 1 | 2 | 3 | 4;
    showFavorite?: boolean;
    className?: string;
}

export function ListingCardGrid({
    listings,
    variant = 'default',
    columns = 3,
    showFavorite = true,
    className,
}: ListingCardGridProps) {
    const columnClasses = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    };

    if (variant === 'horizontal') {
        return (
            <div className={cn('space-y-4', className)}>
                {listings.map((listing, index) => (
                    <ListingCard
                        key={listing.id}
                        listing={listing}
                        variant="horizontal"
                        showFavorite={showFavorite}
                        priority={index < 3}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className={cn('grid gap-6', columnClasses[columns], className)}>
            {listings.map((listing, index) => (
                <ListingCard
                    key={listing.id}
                    listing={listing}
                    variant={variant}
                    showFavorite={showFavorite}
                    priority={index < 4}
                />
            ))}
        </div>
    );
}

export default ListingCard;
