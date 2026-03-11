import { mapPhotonFeatures } from './photon.adapter';

describe('mapPhotonFeatures', () => {
  const validFeature = {
    properties: {
      name: 'Thamel',
      suburb: 'Thamel',
      city: 'Kathmandu',
      state: 'Bagmati',
      country: 'Nepal',
      countrycode: 'np',
      postcode: '44600',
      county: 'Kathmandu District',
      osm_type: 'node',
      osm_id: 123456,
      type: 'suburb',
    },
    geometry: {
      coordinates: [85.324, 27.7172],
    },
  };

  it('maps valid feature to GeoSuggestion', () => {
    const result = mapPhotonFeatures([validFeature]);
    expect(result).toHaveLength(1);
    const suggestion = result[0];
    expect(suggestion.provider).toBe('photon');
    expect(suggestion.coordinates).toEqual({ lat: 27.7172, lon: 85.324 });
    expect(suggestion.address.locality).toBe('Kathmandu');
    expect(suggestion.address.adminAreaLevel1).toBe('Bagmati');
    expect(suggestion.address.countryCode).toBe('NP');
    expect(suggestion.address.postalCode).toBe('44600');
    expect(suggestion.types).toEqual(['suburb']);
  });

  it('generates id from osm_id and osm_type', () => {
    const result = mapPhotonFeatures([validFeature]);
    expect(result[0].id).toBe('photon:node:123456');
    expect(result[0].placeId).toBe('photon:node:123456');
  });

  it('generates coordinate-based id when osm_id missing', () => {
    const feature = {
      ...validFeature,
      properties: { ...validFeature.properties, osm_id: undefined, osm_type: undefined },
    };
    const result = mapPhotonFeatures([feature]);
    expect(result[0].id).toMatch(/^photon:27\.717200:85\.324000$/);
    expect(result[0].placeId).toBeUndefined();
  });

  it('defaults osm_type to feature when only osm_id present', () => {
    const feature = {
      ...validFeature,
      properties: { ...validFeature.properties, osm_type: undefined },
    };
    const result = mapPhotonFeatures([feature]);
    expect(result[0].placeId).toBe('photon:feature:123456');
  });

  it('filters out features with invalid coordinates', () => {
    const bad1 = { properties: {}, geometry: { coordinates: ['abc', 85] } };
    const bad2 = { properties: {}, geometry: { coordinates: [] } };
    const bad3 = { properties: {}, geometry: null };
    const result = mapPhotonFeatures([bad1, bad2, bad3] as any);
    expect(result).toHaveLength(0);
  });

  it('extracts locality from suburb, then neighborhood, then hamlet', () => {
    const feature1 = {
      ...validFeature,
      properties: { suburb: 'Thamel', neighbourhood: 'Chhetrapati', city: 'Kathmandu' },
    };
    expect(mapPhotonFeatures([feature1])[0].address.subLocality).toBe('Thamel');

    const feature2 = {
      ...validFeature,
      properties: { neighbourhood: 'Chhetrapati', city: 'Kathmandu' },
    };
    expect(mapPhotonFeatures([feature2])[0].address.subLocality).toBe('Chhetrapati');
  });

  it('falls back city to town, village, municipality, county', () => {
    const feature = {
      ...validFeature,
      properties: { town: 'Bhaktapur', country: 'Nepal' },
    };
    const result = mapPhotonFeatures([feature]);
    expect(result[0].address.locality).toBe('Bhaktapur');
  });

  it('handles empty properties gracefully', () => {
    const feature = {
      properties: {},
      geometry: { coordinates: [85.3, 27.7] },
    };
    const result = mapPhotonFeatures([feature]);
    expect(result).toHaveLength(1);
    expect(result[0].formattedAddress).toBeTruthy();
  });

  it('normalises country code to uppercase', () => {
    const result = mapPhotonFeatures([validFeature]);
    expect(result[0].address.countryCode).toBe('NP');
  });

  it('sets countryCode to undefined when missing', () => {
    const feature = {
      ...validFeature,
      properties: { city: 'Kathmandu' },
    };
    const result = mapPhotonFeatures([feature]);
    expect(result[0].address.countryCode).toBeUndefined();
  });

  it('deduplicates formattedAddress parts', () => {
    const feature = {
      ...validFeature,
      properties: { city: 'Kathmandu', suburb: 'Kathmandu' },
    };
    const result = mapPhotonFeatures([feature]);
    // "Kathmandu" should appear only once in formattedAddress
    const count = result[0].formattedAddress.split('Kathmandu').length - 1;
    expect(count).toBe(1);
  });

  it('returns empty types when type property missing', () => {
    const feature = {
      ...validFeature,
      properties: { city: 'Kathmandu' },
    };
    const result = mapPhotonFeatures([feature]);
    expect(result[0].types).toEqual([]);
  });

  it('maps multiple features and filters invalid ones', () => {
    const features = [
      validFeature,
      { properties: {}, geometry: { coordinates: [NaN, NaN] } },
      { ...validFeature, geometry: { coordinates: [86.0, 28.0] } },
    ];
    const result = mapPhotonFeatures(features as any);
    expect(result).toHaveLength(2);
  });
});
