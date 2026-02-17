import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { useDebounce } from "~/hooks/use-debounce";
import { geoApi, type GeoSuggestion } from "~/lib/api/geo";
import { Keys } from "~/lib/accessibility";

type LocationAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: GeoSuggestion) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  maxResults?: number;
  bias?: {
    lat?: number;
    lon?: number;
  };
  biasZoom?: number;
  biasScale?: number;
  layer?: string;
};

export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Location",
  className,
  inputClassName,
  maxResults = 6,
  bias,
  biasZoom,
  biasScale,
  layer,
}: LocationAutocompleteProps) {
  const [results, setResults] = useState<GeoSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [deviceBias, setDeviceBias] = useState<{ lat: number; lon: number } | null>(null);
  const [hasTriedDeviceBias, setHasTriedDeviceBias] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedValue = useDebounce(value, 300);
  const effectiveBias = bias || deviceBias || undefined;

  const toRad = (value: number) => (value * Math.PI) / 180;
  const haversineDistanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const rankSuggestions = useCallback(
    (items: GeoSuggestion[], rawQuery: string) => {
      const query = rawQuery.trim().toLowerCase();
      const segments = query
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      const countrySeg = segments.length > 0 ? segments[segments.length - 1] : "";
      const stateSeg = segments.length > 1 ? segments[segments.length - 2] : "";
      const citySeg = segments.length > 2 ? segments[0] : segments[0] || "";

      const biasLat =
        typeof effectiveBias?.lat === "number" ? effectiveBias.lat : undefined;
      const biasLon =
        typeof effectiveBias?.lon === "number" ? effectiveBias.lon : undefined;

      return [...items].sort((a, b) => {
        const score = (item: GeoSuggestion) => {
          let value = 0;
          const short = (item.shortLabel || "").toLowerCase();
          const formatted = (item.formattedAddress || "").toLowerCase();
          const locality = (item.address?.locality || "").toLowerCase();
          const admin1 = (item.address?.adminAreaLevel1 || "").toLowerCase();
          const country = (item.address?.country || "").toLowerCase();

          if (query.length > 0) {
            if (short.startsWith(query)) value += 80;
            if (formatted.startsWith(query)) value += 60;
            if (short.includes(query)) value += 30;
            if (formatted.includes(query)) value += 20;
          }

          if (citySeg && locality.includes(citySeg)) value += 25;
          if (stateSeg && admin1.includes(stateSeg)) value += 20;
          if (countrySeg && country.includes(countrySeg)) value += 20;

          if (
            typeof biasLat === "number" &&
            typeof biasLon === "number" &&
            typeof item.coordinates?.lat === "number" &&
            typeof item.coordinates?.lon === "number"
          ) {
            const distanceKm = haversineDistanceKm(
              biasLat,
              biasLon,
              item.coordinates.lat,
              item.coordinates.lon
            );
            value += Math.max(0, 30 - Math.min(distanceKm, 30));
          }

          return value;
        };

        return score(b) - score(a);
      });
    },
    [effectiveBias]
  );

  const fetchResults = useCallback(async () => {
    const trimmed = debouncedValue.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      let response = await geoApi.autocomplete(trimmed, {
        limit: maxResults,
        lang: navigator.language,
        biasLat: effectiveBias?.lat,
        biasLon: effectiveBias?.lon,
        biasZoom,
        biasScale,
        layer,
      });
      // Some providers can be overly strict with layer filters.
      // Retry without layer to keep valid locations discoverable.
      if ((response.results?.length || 0) === 0 && layer) {
        response = await geoApi.autocomplete(trimmed, {
          limit: maxResults,
          lang: navigator.language,
          biasLat: effectiveBias?.lat,
          biasLon: effectiveBias?.lon,
          biasZoom,
          biasScale,
        });
      }
      setResults(rankSuggestions(response.results || [], trimmed));
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error("Location autocomplete failed:", error);
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [
    debouncedValue,
    maxResults,
    effectiveBias?.lat,
    effectiveBias?.lon,
    biasZoom,
    biasScale,
    layer,
    rankSuggestions,
  ]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    if (bias || hasTriedDeviceBias || typeof navigator === "undefined") {
      return;
    }
    if (!navigator.geolocation) {
      setHasTriedDeviceBias(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        if (
          Number.isFinite(lat) &&
          Number.isFinite(lon) &&
          lat >= -90 &&
          lat <= 90 &&
          lon >= -180 &&
          lon <= 180
        ) {
          setDeviceBias({ lat, lon });
        }
        setHasTriedDeviceBias(true);
      },
      () => setHasTriedDeviceBias(true),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 300000 }
    );
  }, [bias, hasTriedDeviceBias]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (suggestion: GeoSuggestion) => {
    onChange(suggestion.shortLabel || suggestion.formattedAddress);
    onSelect?.(suggestion);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (event.key === Keys.ENTER) {
        setIsOpen(false);
      }
      return;
    }

    switch (event.key) {
      case Keys.ARROW_DOWN:
        event.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case Keys.ARROW_UP:
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case Keys.ENTER:
        event.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case Keys.ESCAPE:
        event.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        name="location"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full rounded-xl border-0 bg-muted/50 pl-12 pr-28 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-ring",
          inputClassName
        )}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="location-results"
        aria-autocomplete="list"
      />
      {isLoading && (
        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
      )}

      {isOpen && results.length > 0 && (
        <div
          id="location-results"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg shadow-xl border z-50 overflow-hidden"
        >
          {results.map((result, index) => (
            <button
              key={`${result.id}-${index}`}
              type="button"
              onClick={() => handleSelect(result)}
              className={cn(
                "w-full text-left px-4 py-2 text-sm transition-colors hover:bg-accent",
                selectedIndex === index && "bg-accent"
              )}
              role="option"
              aria-selected={selectedIndex === index}
            >
              <div className="font-medium text-foreground">
                {result.shortLabel || result.formattedAddress}
              </div>
              {(result.address?.locality ||
                result.address?.adminAreaLevel1 ||
                result.address?.country) && (
                <div className="text-xs text-muted-foreground">
                  {[
                    result.address?.locality,
                    result.address?.adminAreaLevel1,
                    result.address?.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
