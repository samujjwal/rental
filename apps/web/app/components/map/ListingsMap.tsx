import { useState, useCallback, useEffect, useRef } from 'react';
import type { LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import { BaseMap } from './BaseMap';
import { MarkerCluster } from './MarkerCluster';
import type { ListingMarkerData } from './ListingMarker';

export interface ListingsMapProps {
    listings: ListingMarkerData[];
    center?: [number, number];
    zoom?: number;
    className?: string;
    onListingClick?: (listingId: string) => void;
    onBoundsChange?: (bounds: LatLngBoundsExpression) => void;
    highlightedListingId?: string;
    fitBoundsOnLoad?: boolean;
}

export function ListingsMap({
    listings,
    center,
    zoom = 12,
    className,
    onListingClick,
    onBoundsChange,
    highlightedListingId,
    fitBoundsOnLoad = true,
}: ListingsMapProps) {
    const [map, setMap] = useState<LeafletMap | null>(null);
    const hasFittedBounds = useRef(false);
    const lastHighlightedListingId = useRef<string | undefined>(undefined);

    const handleMapReady = useCallback((mapInstance: LeafletMap) => {
        setMap(mapInstance);
    }, []);

    // Fit bounds to show all listings on load (only once)
    useEffect(() => {
        if (!map || !fitBoundsOnLoad || listings.length === 0 || hasFittedBounds.current) return;

        const bounds: [number, number][] = listings.map((listing) => [
            listing.location.lat,
            listing.location.lng,
        ]);

        if (bounds.length > 0) {
            hasFittedBounds.current = true;
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }, [map, listings.length, fitBoundsOnLoad]);

    // Pan to highlighted listing
    useEffect(() => {
        if (!map || !highlightedListingId) {
            lastHighlightedListingId.current = undefined;
            return;
        }

        if (lastHighlightedListingId.current === highlightedListingId) {
            return;
        }

        const listing = listings.find((l) => l.id === highlightedListingId);
        if (listing) {
            lastHighlightedListingId.current = highlightedListingId;
            const currentCenter = map.getCenter();
            const latDiff = Math.abs(currentCenter.lat - listing.location.lat);
            const lngDiff = Math.abs(currentCenter.lng - listing.location.lng);
            if (latDiff < 0.000001 && lngDiff < 0.000001) {
                return;
            }
            map.setView([listing.location.lat, listing.location.lng], map.getZoom(), {
                animate: true,
                duration: 0.5,
            });
        }
    }, [map, highlightedListingId, listings]);

    // Calculate center from listings if not provided
    const calculatedCenter = center || (() => {
        if (listings.length === 0) return [37.7749, -122.4194] as [number, number];

        const avgLat = listings.reduce((sum, l) => sum + l.location.lat, 0) / listings.length;
        const avgLng = listings.reduce((sum, l) => sum + l.location.lng, 0) / listings.length;

        return [avgLat, avgLng] as [number, number];
    })();

    return (
        <div className={className}>
            <BaseMap
                center={calculatedCenter}
                zoom={zoom}
                onMapReady={handleMapReady}
                onBoundsChange={onBoundsChange}
            >
                <MarkerCluster
                    listings={listings}
                    onMarkerClick={onListingClick}
                    highlightedListingId={highlightedListingId}
                />
            </BaseMap>
        </div>
    );
}
