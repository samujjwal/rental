import { useState, useCallback } from "react";
import type { LatLngBoundsExpression } from "leaflet";

export interface UseMapSyncOptions {
  onBoundsChange?: (bounds: LatLngBoundsExpression) => void;
}

export function useMapSync(options: UseMapSyncOptions = {}) {
  const [highlightedListingId, setHighlightedListingId] = useState<
    string | undefined
  >();
  const [mapBounds, setMapBounds] = useState<
    LatLngBoundsExpression | undefined
  >();

  const handleListingHover = useCallback((listingId: string | undefined) => {
    setHighlightedListingId(listingId);
  }, []);

  const handleBoundsChange = useCallback(
    (bounds: LatLngBoundsExpression) => {
      setMapBounds(bounds);
      options.onBoundsChange?.(bounds);
    },
    [options]
  );

  const isListingInBounds = useCallback(
    (lat: number, lng: number): boolean => {
      if (!mapBounds || !Array.isArray(mapBounds)) return true;

      const [[south, west], [north, east]] = mapBounds as [
        [number, number],
        [number, number],
      ];
      return lat >= south && lat <= north && lng >= west && lng <= east;
    },
    [mapBounds]
  );

  return {
    highlightedListingId,
    mapBounds,
    handleListingHover,
    handleBoundsChange,
    isListingInBounds,
  };
}
