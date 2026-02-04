import { useState, useCallback, useMemo } from 'react';
import type { LatLngBoundsExpression } from 'leaflet';
import { ListingsMap } from './ListingsMap';
import { MapViewToggle } from './MapViewToggle';
import type { ListingMarkerData } from './ListingMarker';
import { Box, Button, Chip } from '@mui/material';
import { RefreshCw } from 'lucide-react';

export interface MapSearchViewProps {
    listings: ListingMarkerData[];
    view: 'list' | 'map';
    onViewChange: (view: 'list' | 'map') => void;
    onListingClick?: (listingId: string) => void;
    onBoundsChange?: (bounds: LatLngBoundsExpression) => void;
    highlightedListingId?: string;
    onHighlightChange?: (listingId: string | undefined) => void;
    className?: string;
    showSearchThisArea?: boolean;
    onSearchThisArea?: () => void;
}

export function MapSearchView({
    listings,
    view,
    onViewChange,
    onListingClick,
    onBoundsChange,
    highlightedListingId,
    onHighlightChange,
    className = '',
    showSearchThisArea = false,
    onSearchThisArea,
}: MapSearchViewProps) {
    const [currentBounds, setCurrentBounds] = useState<LatLngBoundsExpression | undefined>();

    const handleBoundsChange = useCallback(
        (bounds: LatLngBoundsExpression) => {
            setCurrentBounds(bounds);
            onBoundsChange?.(bounds);
        },
        [onBoundsChange]
    );

    const handleSearchThisArea = useCallback(() => {
        if (currentBounds && onSearchThisArea) {
            onSearchThisArea();
        }
    }, [currentBounds, onSearchThisArea]);

    const visibleListingsCount = useMemo(() => {
        if (!currentBounds || !Array.isArray(currentBounds)) return listings.length;

        const [[south, west], [north, east]] = currentBounds as [[number, number], [number, number]];

        return listings.filter((listing) => {
            const { lat, lng } = listing.location;
            return lat >= south && lat <= north && lng >= west && lng <= east;
        }).length;
    }, [listings, currentBounds]);

    return (
        <div className={`relative ${className}`}>
            {/* View Toggle - Top Left */}
            <div className="absolute top-4 left-4 z-[1000]">
                <MapViewToggle view={view} onViewChange={onViewChange} />
            </div>

            {/* Search This Area Button - Top Center */}
            {view === 'map' && showSearchThisArea && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
                    <Button
                        variant="contained"
                        leftIcon={<RefreshCw size={18} />}
                        onClick={handleSearchThisArea}
                        sx={{
                            backgroundColor: 'white',
                            color: 'text.primary',
                            boxShadow: 2,
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': {
                                backgroundColor: 'grey.100',
                            },
                        }}
                    >
                        Search this area
                    </Button>
                </div>
            )}

            {/* Listing Count - Top Right */}
            {view === 'map' && (
                <div className="absolute top-4 right-4 z-[1000]">
                    <Chip
                        label={`${visibleListingsCount} ${visibleListingsCount === 1 ? 'listing' : 'listings'}`}
                        sx={{
                            backgroundColor: 'white',
                            fontWeight: 600,
                            boxShadow: 2,
                        }}
                    />
                </div>
            )}

            {/* Map View */}
            {view === 'map' && (
                <ListingsMap
                    listings={listings}
                    onListingClick={onListingClick}
                    onBoundsChange={handleBoundsChange}
                    highlightedListingId={highlightedListingId}
                    className="h-full w-full"
                />
            )}

            {/* List View - Rendered by parent component */}
            {view === 'list' && (
                <div className="h-full w-full overflow-auto">
                    {/* Parent component should render list view here */}
                </div>
            )}
        </div>
    );
}
