# Map Components Documentation

## Overview

This directory contains a complete, production-ready map implementation using **Leaflet** and **OpenStreetMap**. The implementation is 100% free, has no API keys, no usage limits, and is fully extensible.

## Why Leaflet?

- ✅ **100% Free** - No API keys, no billing, unlimited usage
- ✅ **Lightweight** - Only 42KB gzipped
- ✅ **Powerful** - Rich plugin ecosystem
- ✅ **Privacy-Friendly** - No tracking, GDPR compliant
- ✅ **Extensible** - Easy to customize
- ✅ **Production-Ready** - Used by GitHub, Facebook, Flickr

## Components

### BaseMap

Base map component with OpenStreetMap tiles.

```tsx
import { BaseMap } from "~/components/map";

<BaseMap
  center={[37.7749, -122.4194]}
  zoom={12}
  onMapReady={(map) => console.log("Map ready", map)}
  onBoundsChange={(bounds) => console.log("Bounds changed", bounds)}
>
  {/* Add markers, layers, etc. */}
</BaseMap>;
```

### ListingMarker

Individual marker for a single listing with custom price display.

```tsx
import { ListingMarker } from "~/components/map";

<ListingMarker
  listing={{
    id: "1",
    title: "Modern Apartment",
    price: 150,
    currency: "USD",
    location: { lat: 37.7749, lng: -122.4194 },
    imageUrl: "https://...",
    category: "Apartment",
  }}
  isHighlighted={false}
  onClick={(id) => navigate(`/listings/${id}`)}
  onMouseEnter={(id) => setHighlighted(id)}
  onMouseLeave={() => setHighlighted(undefined)}
/>;
```

### MarkerCluster

Efficient marker clustering for large datasets (100s-1000s of listings).

```tsx
import { MarkerCluster } from "~/components/map";

<BaseMap>
  <MarkerCluster
    listings={listings}
    onMarkerClick={(id) => navigate(`/listings/${id}`)}
    highlightedListingId={highlightedId}
  />
</BaseMap>;
```

### ListingsMap

Complete map with clustering, popups, and auto-fitting bounds.

```tsx
import { ListingsMap } from "~/components/map";

<ListingsMap
  listings={listings}
  onListingClick={(id) => navigate(`/listings/${id}`)}
  onBoundsChange={(bounds) => updateSearch(bounds)}
  highlightedListingId={highlightedId}
  fitBoundsOnLoad={true}
  className="h-96 w-full"
/>;
```

### MapViewToggle

Toggle button for switching between list and map views.

```tsx
import { MapViewToggle } from "~/components/map";

<MapViewToggle view={view} onViewChange={setView} />;
```

### MapSearchView

Complete search view with map, toggle, and search controls.

```tsx
import { MapSearchView } from "~/components/map";

<MapSearchView
  listings={listings}
  view={view}
  onViewChange={setView}
  onListingClick={(id) => navigate(`/listings/${id}`)}
  onBoundsChange={(bounds) => updateSearch(bounds)}
  highlightedListingId={highlightedId}
  showSearchThisArea={true}
  onSearchThisArea={() => searchInBounds()}
  className="h-screen"
/>;
```

## Hooks

### useMapSync

Hook for synchronizing map and list views with hover effects.

```tsx
import { useMapSync } from '~/hooks/useMapSync';

const {
  highlightedListingId,
  mapBounds,
  handleListingHover,
  handleBoundsChange,
  isListingInBounds,
} = useMapSync({
  onBoundsChange: (bounds) => updateSearch(bounds),
});

// In list view
<ListingCard
  onMouseEnter={() => handleListingHover(listing.id)}
  onMouseLeave={() => handleListingHover(undefined)}
/>

// In map view
<ListingsMap
  highlightedListingId={highlightedListingId}
  onBoundsChange={handleBoundsChange}
/>
```

## Features

### 1. Marker Clustering

- Automatically clusters markers when zoomed out
- Shows count in cluster bubbles
- Smooth animations when zooming
- Configurable cluster radius

### 2. Custom Price Markers

- Shows price directly on marker
- Highlights on hover
- Smooth transitions
- Responsive design

### 3. Rich Popups

- Listing image
- Title and category
- Price per day
- Click to view details

### 4. Map-List Sync

- Hover on list highlights marker
- Hover on marker highlights list item
- Smooth pan to highlighted listing
- Bounds-based filtering

### 5. Search This Area

- Button to search within visible bounds
- Shows count of visible listings
- Updates on map movement

### 6. Performance

- Efficient clustering for 1000+ markers
- Lazy loading of map tiles
- Optimized re-renders
- Smooth animations

## Styling

Map styles are in `app/styles/map.css`:

- Custom marker styles
- Cluster bubble styles
- Popup styles
- Smooth animations

## Integration Example

See `app/routes/search-map-example.tsx` for a complete working example.

### Basic Integration

```tsx
import { useState } from "react";
import { ListingsMap, MapViewToggle } from "~/components/map";
import { useMapSync } from "~/hooks/useMapSync";

export default function SearchPage() {
  const [view, setView] = useState<"list" | "map">("map");
  const { highlightedListingId, handleListingHover, handleBoundsChange } =
    useMapSync();

  // Fetch listings from API
  const { data: listings } = useQuery(["listings"], fetchListings);

  return (
    <div className="h-screen">
      <MapViewToggle view={view} onViewChange={setView} />

      {view === "map" ? (
        <ListingsMap
          listings={listings}
          highlightedListingId={highlightedListingId}
          onBoundsChange={handleBoundsChange}
          onListingClick={(id) => navigate(`/listings/${id}`)}
        />
      ) : (
        <ListingGrid listings={listings} onListingHover={handleListingHover} />
      )}
    </div>
  );
}
```

## Extending

### Custom Tile Providers

Replace OpenStreetMap with other providers:

```tsx
// CartoDB Positron (light theme)
<TileLayer
  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
  attribution='&copy; OpenStreetMap, &copy; CartoDB'
/>

// CartoDB Dark Matter (dark theme)
<TileLayer
  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
  attribution='&copy; OpenStreetMap, &copy; CartoDB'
/>

// Stamen Terrain (topographic)
<TileLayer
  url="https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg"
  attribution='Map tiles by Stamen Design'
/>
```

### Custom Marker Icons

```tsx
import L from "leaflet";

const customIcon = L.divIcon({
  className: "custom-icon",
  html: "<div>Your HTML</div>",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

<Marker position={position} icon={customIcon} />;
```

### Additional Layers

```tsx
import { Circle, Polygon, Polyline } from 'react-leaflet';

// Circle radius
<Circle center={[lat, lng]} radius={1000} />

// Polygon area
<Polygon positions={[[lat1, lng1], [lat2, lng2], ...]} />

// Route line
<Polyline positions={[[lat1, lng1], [lat2, lng2], ...]} />
```

## Performance Tips

1. **Use Clustering** - Always use MarkerCluster for 50+ markers
2. **Lazy Load** - Only render map when visible
3. **Debounce Bounds** - Debounce bounds change events
4. **Optimize Images** - Use optimized thumbnail images in popups
5. **Limit Markers** - Consider pagination for 1000+ listings

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile: ✅ Touch gestures supported

## Accessibility

- Keyboard navigation supported
- Screen reader friendly
- ARIA labels on controls
- Focus management

## License

- Leaflet: BSD-2-Clause
- OpenStreetMap: ODbL
- react-leaflet: MIT
- This implementation: MIT

## Support

For issues or questions:

1. Check Leaflet docs: https://leafletjs.com/
2. Check react-leaflet docs: https://react-leaflet.js.org/
3. Check OpenStreetMap: https://www.openstreetmap.org/

## Future Enhancements

Potential additions:

- [ ] Heatmap layer for density visualization
- [ ] Drawing tools for custom area search
- [ ] Geocoding integration (Nominatim API)
- [ ] Route planning between listings
- [ ] Saved search areas
- [ ] Custom map themes
