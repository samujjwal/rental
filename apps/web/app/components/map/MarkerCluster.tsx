import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { ListingMarkerData } from './ListingMarker';

export interface MarkerClusterProps {
    listings: ListingMarkerData[];
    onMarkerClick?: (listingId: string) => void;
    highlightedListingId?: string;
}

export function MarkerCluster({
    listings,
    onMarkerClick,
    highlightedListingId,
}: MarkerClusterProps) {
    const map = useMap();
    const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

    useEffect(() => {
        if (!map) return;

        // Create cluster group if it doesn't exist
        if (!clusterGroupRef.current) {
            clusterGroupRef.current = L.markerClusterGroup({
                maxClusterRadius: 80,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                iconCreateFunction: (cluster) => {
                    const count = cluster.getChildCount();
                    let size = 'small';
                    let className = 'marker-cluster-small';

                    if (count > 100) {
                        size = 'large';
                        className = 'marker-cluster-large';
                    } else if (count > 10) {
                        size = 'medium';
                        className = 'marker-cluster-medium';
                    }

                    return L.divIcon({
                        html: `<div class="cluster-inner"><span>${count}</span></div>`,
                        className: `marker-cluster ${className}`,
                        iconSize: L.point(40, 40),
                    });
                },
            });

            map.addLayer(clusterGroupRef.current);
        }

        const clusterGroup = clusterGroupRef.current;

        // Clear existing markers
        clusterGroup.clearLayers();

        // Add markers for each listing
        listings.forEach((listing) => {
            const isHighlighted = listing.id === highlightedListingId;
            const priceText = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: listing.currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(listing.price);

            const icon = L.divIcon({
                className: 'custom-marker-icon',
                html: `
          <div class="relative">
            <div class="flex items-center justify-center px-3 py-1.5 rounded-full shadow-lg transition-all duration-200 ${isHighlighted
                        ? 'bg-blue-600 text-white scale-110 z-50'
                        : 'bg-white text-gray-900 hover:bg-blue-50 border border-gray-300'
                    }">
              <span class="font-semibold text-sm whitespace-nowrap">${priceText}</span>
            </div>
            <div class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent ${isHighlighted ? 'border-t-[8px] border-t-blue-600' : 'border-t-[8px] border-t-white'
                    }"></div>
          </div>
        `,
                iconSize: [60, 40],
                iconAnchor: [30, 40],
                popupAnchor: [0, -40],
            });

            const marker = L.marker([listing.location.lat, listing.location.lng], { icon });

            // Add popup
            const popupContent = `
        <div class="w-64">
          ${listing.imageUrl
                    ? `<img src="${listing.imageUrl}" alt="${listing.title}" class="w-full h-40 object-cover rounded-t-lg mb-2" />`
                    : ''
                }
          <div class="p-2">
            <h3 class="font-semibold text-base mb-1 line-clamp-2">${listing.title}</h3>
            ${listing.category ? `<p class="text-sm text-gray-600 mb-2">${listing.category}</p>` : ''}
            <p class="text-lg font-bold text-blue-600">
              ${new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: listing.currency,
                }).format(listing.price)}
              <span class="text-sm font-normal text-gray-600">/day</span>
            </p>
          </div>
        </div>
      `;

            marker.bindPopup(popupContent);

            // Add click handler
            if (onMarkerClick) {
                marker.on('click', () => onMarkerClick(listing.id));
            }

            clusterGroup.addLayer(marker);
        });

        // Cleanup
        return () => {
            if (clusterGroupRef.current) {
                clusterGroupRef.current.clearLayers();
            }
        };
    }, [map, listings, onMarkerClick, highlightedListingId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (clusterGroupRef.current && map) {
                map.removeLayer(clusterGroupRef.current);
                clusterGroupRef.current = null;
            }
        };
    }, [map]);

    return null;
}
