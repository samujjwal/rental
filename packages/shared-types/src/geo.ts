// ============================================================================
// Geo / Location Types
// ============================================================================

export interface GeoCoordinates {
  lat: number;
  lon: number;
}

export interface GeoAddress {
  subLocality?: string;
  locality?: string;
  adminAreaLevel1?: string;
  adminAreaLevel2?: string;
  postalCode?: string;
  countryCode?: string;
  country?: string;
}

export interface GeoSuggestion {
  id: string;
  provider: string;
  placeId?: string;
  shortLabel: string;
  formattedAddress: string;
  coordinates: GeoCoordinates;
  address: GeoAddress;
  types: string[];
  confidence?: number;
  accuracyMeters?: number;
}

export interface GeoAutocompleteOptions {
  limit?: number;
  lang?: string;
  biasLat?: number;
  biasLon?: number;
  biasZoom?: number;
  biasScale?: number;
  bbox?: string;
  layer?: string;
}
