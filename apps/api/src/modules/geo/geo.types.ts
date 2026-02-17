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

export type GeoBias = {
  lat?: number;
  lon?: number;
  zoom?: number;
  locationBiasScale?: number;
  bbox?: string;
  layer?: string;
};
