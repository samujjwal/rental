import { useState } from 'react';
import { Container, Box, Grid, Card, CardContent, CardMedia, Typography, Chip } from '@mui/material';
import { MapSearchView } from '~/components/map/MapSearchView';
import { useMapSync } from '~/hooks/useMapSync';
import type { ListingMarkerData } from '~/components/map';

// Example listing data - replace with real data from your API
const EXAMPLE_LISTINGS: ListingMarkerData[] = [
    {
        id: '1',
        title: 'Modern Downtown Apartment',
        price: 150,
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400',
        location: { lat: 37.7749, lng: -122.4194 },
        category: 'Apartment',
    },
    {
        id: '2',
        title: 'Cozy Studio in Mission District',
        price: 120,
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400',
        location: { lat: 37.7599, lng: -122.4148 },
        category: 'Studio',
    },
    {
        id: '3',
        title: 'Luxury Penthouse with Bay View',
        price: 350,
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400',
        location: { lat: 37.7955, lng: -122.3937 },
        category: 'Penthouse',
    },
    {
        id: '4',
        title: 'Charming Victorian House',
        price: 200,
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?w=400',
        location: { lat: 37.7694, lng: -122.4862 },
        category: 'House',
    },
    {
        id: '5',
        title: 'Sunny Loft in SoMa',
        price: 180,
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=400',
        location: { lat: 37.7767, lng: -122.3997 },
        category: 'Loft',
    },
];

export default function SearchMapExample() {
    const [view, setView] = useState<'list' | 'map'>('map');
    const { highlightedListingId, handleListingHover, handleBoundsChange } = useMapSync();

    const handleListingClick = (listingId: string) => {
        console.log('Listing clicked:', listingId);
        // Navigate to listing detail page
        // navigate(`/listings/${listingId}`);
    };

    const handleSearchThisArea = () => {
        console.log('Search this area clicked');
        // Trigger search with current map bounds
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Search Listings - Map View Example
            </Typography>

            <Box sx={{ height: 'calc(100vh - 200px)', minHeight: '600px', mt: 3 }}>
                <Grid container spacing={2} sx={{ height: '100%' }}>
                    {/* List View - Left Side */}
                    {view === 'list' && (
                        <Grid item xs={12} md={6} sx={{ height: '100%', overflowY: 'auto' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {EXAMPLE_LISTINGS.map((listing) => (
                                    <Card
                                        key={listing.id}
                                        sx={{
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            border: highlightedListingId === listing.id ? '2px solid' : '1px solid',
                                            borderColor: highlightedListingId === listing.id ? 'primary.main' : 'divider',
                                            '&:hover': {
                                                boxShadow: 4,
                                                transform: 'translateY(-2px)',
                                            },
                                        }}
                                        onClick={() => handleListingClick(listing.id)}
                                        onMouseEnter={() => handleListingHover(listing.id)}
                                        onMouseLeave={() => handleListingHover(undefined)}
                                    >
                                        <Grid container>
                                            <Grid item xs={4}>
                                                <CardMedia
                                                    component="img"
                                                    height="160"
                                                    image={listing.imageUrl}
                                                    alt={listing.title}
                                                    sx={{ objectFit: 'cover' }}
                                                />
                                            </Grid>
                                            <Grid item xs={8}>
                                                <CardContent>
                                                    <Typography variant="h6" component="h3" gutterBottom>
                                                        {listing.title}
                                                    </Typography>
                                                    <Chip label={listing.category} size="small" sx={{ mb: 1 }} />
                                                    <Typography variant="h5" color="primary" fontWeight="bold">
                                                        ${listing.price}
                                                        <Typography component="span" variant="body2" color="text.secondary">
                                                            /day
                                                        </Typography>
                                                    </Typography>
                                                </CardContent>
                                            </Grid>
                                        </Grid>
                                    </Card>
                                ))}
                            </Box>
                        </Grid>
                    )}

                    {/* Map View - Right Side or Full Width */}
                    <Grid item xs={12} md={view === 'list' ? 6 : 12} sx={{ height: '100%' }}>
                        <MapSearchView
                            listings={EXAMPLE_LISTINGS}
                            view={view}
                            onViewChange={setView}
                            onListingClick={handleListingClick}
                            onBoundsChange={handleBoundsChange}
                            highlightedListingId={highlightedListingId}
                            showSearchThisArea={true}
                            onSearchThisArea={handleSearchThisArea}
                            className="h-full rounded-lg overflow-hidden shadow-lg"
                        />
                    </Grid>
                </Grid>
            </Box>

            {/* Instructions */}
            <Box sx={{ mt: 4, p: 3, bgcolor: 'grey.100', borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                    Map Features:
                </Typography>
                <ul>
                    <li>Toggle between List and Map views</li>
                    <li>Click markers to view listing details</li>
                    <li>Hover over listings to highlight on map</li>
                    <li>Markers automatically cluster when zoomed out</li>
                    <li>Click "Search this area" to search within visible bounds</li>
                    <li>Drag and zoom the map to explore different areas</li>
                </ul>
            </Box>
        </Container>
    );
}
