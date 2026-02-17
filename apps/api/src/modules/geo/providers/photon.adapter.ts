import type { GeoSuggestion } from '../geo.types';

export function mapPhotonFeatures(features: any[]): GeoSuggestion[] {
  return features
    .map((feature) => {
      const props = feature?.properties || {};
      const coords = feature?.geometry?.coordinates;
      const lon = Array.isArray(coords) ? Number(coords[0]) : NaN;
      const lat = Array.isArray(coords) ? Number(coords[1]) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

      const locality =
        props.suburb ||
        props.neighbourhood ||
        props.hamlet ||
        props.locality ||
        props.name;
      const city =
        props.city ||
        props.town ||
        props.village ||
        props.municipality ||
        props.county ||
        locality;
      const state = props.state || props.region;
      const country = props.country;
      const countryCodeRaw = props.countrycode || props.countryCode || '';
      const countryCode =
        typeof countryCodeRaw === 'string' && countryCodeRaw.trim()
          ? countryCodeRaw.trim().toUpperCase()
          : undefined;

      const formattedAddress =
        [locality, city, state, country]
          .filter(Boolean)
          .filter((value, index, arr) => arr.indexOf(value) === index)
          .join(', ') || props.name || 'Location';
      const shortLabel =
        [locality, city]
          .filter(Boolean)
          .filter((value, index, arr) => arr.indexOf(value) === index)
          .join(', ') || city || formattedAddress;

      const provider = 'photon';
      const osmType = typeof props.osm_type === 'string' ? props.osm_type : undefined;
      const osmId =
        typeof props.osm_id === 'number' || typeof props.osm_id === 'string'
          ? String(props.osm_id)
          : undefined;
      const placeId = osmId ? `${provider}:${osmType || 'feature'}:${osmId}` : undefined;
      const id = placeId || `${provider}:${lat.toFixed(6)}:${lon.toFixed(6)}`;
      const typeValue = typeof props.type === 'string' ? props.type : undefined;

      return {
        id,
        provider,
        placeId,
        shortLabel,
        formattedAddress,
        coordinates: { lat, lon },
        address: {
          subLocality: locality,
          locality: city,
          adminAreaLevel1: state,
          adminAreaLevel2: props.county,
          postalCode: props.postcode || props.postalCode,
          countryCode,
          country,
        },
        types: typeValue ? [typeValue] : [],
      } as GeoSuggestion;
    })
    .filter((item): item is GeoSuggestion => Boolean(item));
}
