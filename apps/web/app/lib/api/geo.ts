import { api } from "~/lib/api-client";

export type GeoSuggestion = {
  id: string;
  provider: string;
  placeId?: string;
  shortLabel: string;
  formattedAddress: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  address: {
    subLocality?: string;
    locality?: string;
    adminAreaLevel1?: string;
    adminAreaLevel2?: string;
    postalCode?: string;
    countryCode?: string;
    country?: string;
  };
  types: string[];
  confidence?: number;
  accuracyMeters?: number;
};

export type GeoAutocompleteOptions = {
  limit?: number;
  lang?: string;
  biasLat?: number;
  biasLon?: number;
  biasZoom?: number;
  biasScale?: number;
  bbox?: string;
  layer?: string;
};

export const geoApi = {
  async autocomplete(query: string, options: GeoAutocompleteOptions = {}) {
    const params = new URLSearchParams({ q: query });
    if (options.limit != null) params.set("limit", String(options.limit));
    if (options.lang) params.set("lang", options.lang);
    if (options.biasLat != null) params.set("lat", String(options.biasLat));
    if (options.biasLon != null) params.set("lon", String(options.biasLon));
    if (options.biasZoom != null) params.set("zoom", String(options.biasZoom));
    if (options.biasScale != null) {
      params.set("location_bias_scale", String(options.biasScale));
    }
    if (options.bbox) params.set("bbox", options.bbox);
    if (options.layer) params.set("layer", options.layer);
    return api.get<{ results: GeoSuggestion[] }>(
      `/geo/autocomplete?${params.toString()}`
    );
  },

  async reverse(lat: number, lon: number, lang?: string) {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
    });
    if (lang) params.set("lang", lang);
    return api.get<{ result: GeoSuggestion | null }>(
      `/geo/reverse?${params.toString()}`
    );
  },
};
