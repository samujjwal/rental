import { Marker, Popup } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import type { LatLngExpression } from 'leaflet';

export interface ListingMarkerData {
    id: string;
    title: string;
    price: number;
    currency: string;
    imageUrl?: string;
    location: {
        lat: number;
        lng: number;
    };
    category?: string;
}

export interface ListingMarkerProps {
    listing: ListingMarkerData;
    isHighlighted?: boolean;
    onClick?: (listingId: string) => void;
    onMouseEnter?: (listingId: string) => void;
    onMouseLeave?: (listingId: string) => void;
}

function createCustomIcon(price: number, currency: string, isHighlighted: boolean) {
    const priceText = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(price);

    return new DivIcon({
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
}

export function ListingMarker({
    listing,
    isHighlighted = false,
    onClick,
    onMouseEnter,
    onMouseLeave,
}: ListingMarkerProps) {
    const position: LatLngExpression = [listing.location.lat, listing.location.lng];
    const icon = createCustomIcon(listing.price, listing.currency, isHighlighted);

    return (
        <Marker
            position={position}
            icon={icon}
            eventHandlers={{
                click: () => onClick?.(listing.id),
                mouseover: () => onMouseEnter?.(listing.id),
                mouseout: () => onMouseLeave?.(listing.id),
            }}
        >
            <Popup>
                <div className="w-64">
                    {listing.imageUrl && (
                        <img
                            src={listing.imageUrl}
                            alt={listing.title}
                            className="w-full h-40 object-cover rounded-t-lg mb-2"
                        />
                    )}
                    <div className="p-2">
                        <h3 className="font-semibold text-base mb-1 line-clamp-2">{listing.title}</h3>
                        {listing.category && (
                            <p className="text-sm text-gray-600 mb-2">{listing.category}</p>
                        )}
                        <p className="text-lg font-bold text-blue-600">
                            {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: listing.currency,
                            }).format(listing.price)}
                            <span className="text-sm font-normal text-gray-600">/day</span>
                        </p>
                    </div>
                </div>
            </Popup>
        </Marker>
    );
}
