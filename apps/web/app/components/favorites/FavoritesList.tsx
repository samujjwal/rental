import { useState } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia,
    IconButton,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    CircularProgress,
    Alert,
} from '@mui/material';
import { Trash2, MapPin } from 'lucide-react';
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
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ my: 4 }}>
                Failed to load favorites. Please try again.
            </Alert>
        );
    }

    const favorites = data?.favorites || [];
    const isEmpty = favorites.length === 0;

    return (
        <Box>
            {/* Header */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4" component="h1">
                    My Favorites
                </Typography>
                {showClearAll && !isEmpty && (
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={() => setClearDialogOpen(true)}
                        disabled={isClearing}
                    >
                        Clear All
                    </Button>
                )}
            </Box>

            {/* Filters */}
            {showFilters && !isEmpty && (
                <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Sort By</InputLabel>
                        <Select
                            value={sortBy}
                            label="Sort By"
                            onChange={(e) => setSortBy(e.target.value as any)}
                        >
                            <MenuItem value="createdAt">Date Added</MenuItem>
                            <MenuItem value="price">Price</MenuItem>
                            <MenuItem value="title">Title</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Order</InputLabel>
                        <Select
                            value={sortOrder}
                            label="Order"
                            onChange={(e) => setSortOrder(e.target.value as any)}
                        >
                            <MenuItem value="desc">Descending</MenuItem>
                            <MenuItem value="asc">Ascending</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Category</InputLabel>
                        <Select
                            value={category}
                            label="Category"
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            <MenuItem value="">All Categories</MenuItem>
                            <MenuItem value="apartment">Apartment</MenuItem>
                            <MenuItem value="house">House</MenuItem>
                            <MenuItem value="vehicle">Vehicle</MenuItem>
                            <MenuItem value="equipment">Equipment</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            )}

            {/* Empty State */}
            {isEmpty && (
                <FadeIn>
                    <Card sx={{ textAlign: 'center', py: 8 }}>
                        <CardContent>
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No favorites yet
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                Start adding listings to your favorites to see them here
                            </Typography>
                            <Button variant="contained" component={Link} to="/search">
                                Browse Listings
                            </Button>
                        </CardContent>
                    </Card>
                </FadeIn>
            )}

            {/* Favorites Grid */}
            {!isEmpty && (
                <StaggerList
                    items={favorites}
                    staggerDelay={0.05}
                    renderItem={(favorite) => (
                        <Card
                            sx={{
                                mb: 2,
                                display: 'flex',
                                '&:hover': {
                                    boxShadow: 3,
                                },
                            }}
                        >
                            {/* Image */}
                            <CardMedia
                                component={Link}
                                to={`/listings/${favorite.listingId}`}
                                sx={{
                                    width: 200,
                                    flexShrink: 0,
                                    textDecoration: 'none',
                                }}
                            >
                                <Box
                                    sx={{
                                        width: '100%',
                                        height: '100%',
                                        backgroundImage: `url(${favorite.listing?.images?.[0] || '/placeholder.jpg'})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                />
                            </CardMedia>

                            {/* Content */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <CardContent sx={{ flex: 1 }}>
                                    <Typography
                                        variant="h6"
                                        component={Link}
                                        to={`/listings/${favorite.listingId}`}
                                        sx={{
                                            textDecoration: 'none',
                                            color: 'text.primary',
                                            '&:hover': {
                                                color: 'primary.main',
                                            },
                                        }}
                                    >
                                        {favorite.listing?.title || 'Untitled Listing'}
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        {favorite.listing?.description?.substring(0, 150)}
                                        {(favorite.listing?.description?.length || 0) > 150 && '...'}
                                    </Typography>

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <MapPin size={16} />
                                        <Typography variant="body2" color="text.secondary">
                                            {favorite.listing?.location?.city}, {favorite.listing?.location?.state}
                                        </Typography>
                                    </Box>

                                    <Typography variant="h6" color="primary.main">
                                        ${favorite.listing?.basePrice}/day
                                    </Typography>

                                    <Typography variant="caption" color="text.secondary">
                                        Added {new Date(favorite.createdAt).toLocaleDateString()}
                                    </Typography>
                                </CardContent>

                                {/* Actions */}
                                <Box sx={{ p: 2, pt: 0, display: 'flex', justifyContent: 'flex-end' }}>
                                    <IconButton
                                        onClick={() => handleRemove(favorite.listingId)}
                                        color="error"
                                        size="small"
                                        aria-label="Remove from favorites"
                                    >
                                        <Trash2 size={20} />
                                    </IconButton>
                                </Box>
                            </Box>
                        </Card>
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
        </Box>
    );
}
