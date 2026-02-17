import type { GeoSuggestion } from '../geo.types';

const clean = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const uniqueJoin = (parts: Array<string | undefined>, separator = ', ') =>
  parts
    .filter((part): part is string => Boolean(part))
    .filter((value, index, arr) =>
      arr.findIndex((entry) => entry.toLowerCase() === value.toLowerCase()) === index,
    )
    .join(separator);

export function isNominatimProvider(baseUrl: string): boolean {
  const normalized = baseUrl.toLowerCase();
  return normalized.includes('nominatim') || normalized.includes('openstreetmap');
}

export function mapNominatimReverse(payload: any): GeoSuggestion | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const lat = Number(payload.lat);
  const lon = Number(payload.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const address = payload.address || {};
  const displayName = clean(payload.display_name);
  const displayParts = displayName ? displayName.split(',').map((part: string) => part.trim()) : [];
  const firstDisplayPart = clean(displayParts[0]);

  const city = clean(
    address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county,
  );
  const subLocality = clean(
    address.neighbourhood ||
      address.suburb ||
      address.quarter ||
      address.residential ||
      address.city_district ||
      address.borough ||
      address.ward ||
      address.hamlet ||
      address.locality ||
      firstDisplayPart ||
      payload.name,
  );
  const locality = city || subLocality;
  const state = clean(address.state || address.region);
  const country = clean(address.country);
  const countryCodeRaw = clean(address.country_code || address.countryCode);
  const countryCode =
    typeof countryCodeRaw === 'string' && countryCodeRaw
      ? countryCodeRaw.toUpperCase()
      : undefined;

  const formattedAddress = displayName || uniqueJoin([subLocality, locality, state, country]) || 'Location';
  const shortLabel = uniqueJoin([subLocality, locality]) || formattedAddress;

  const provider = 'nominatim';
  const placeId = payload.place_id != null ? `${provider}:${String(payload.place_id)}` : undefined;
  const id = placeId || `${provider}:${lat.toFixed(6)}:${lon.toFixed(6)}`;
  const typeValue = clean(payload.type);
  const addressType = clean(payload.addresstype);
  const classType = clean(payload.class);
  const types = [typeValue, addressType, classType].filter(
    (value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index,
  );

  return {
    id,
    provider,
    placeId,
    shortLabel,
    formattedAddress,
    coordinates: { lat, lon },
    address: {
      subLocality,
      locality: city,
      adminAreaLevel1: state,
      adminAreaLevel2: clean(address.county),
      postalCode: clean(address.postcode),
      countryCode,
      country,
    },
    types,
  };
}

export function mapNominatimSearch(payload: any): GeoSuggestion[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => mapNominatimReverse(entry))
    .filter((entry): entry is GeoSuggestion => Boolean(entry));
}
