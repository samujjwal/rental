import {
  isNominatimProvider,
  mapNominatimReverse,
  mapNominatimSearch,
} from './nominatim.adapter';

describe('isNominatimProvider', () => {
  it('returns true for nominatim URL', () => {
    expect(isNominatimProvider('https://nominatim.openstreetmap.org')).toBe(true);
  });

  it('returns true for openstreetmap URL', () => {
    expect(isNominatimProvider('https://tiles.openstreetmap.org/search')).toBe(true);
  });

  it('returns false for other URLs', () => {
    expect(isNominatimProvider('https://api.mapbox.com')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isNominatimProvider('https://NOMINATIM.example.com')).toBe(true);
  });
});

describe('mapNominatimReverse', () => {
  const validPayload = {
    lat: '27.7172',
    lon: '85.3240',
    display_name: 'Thamel, Kathmandu, Bagmati, Nepal',
    place_id: 12345,
    type: 'suburb',
    addresstype: 'suburb',
    class: 'place',
    address: {
      neighbourhood: 'Thamel',
      city: 'Kathmandu',
      state: 'Bagmati',
      country: 'Nepal',
      country_code: 'np',
      postcode: '44600',
      county: 'Kathmandu District',
    },
  };

  it('maps valid payload to GeoSuggestion', () => {
    const result = mapNominatimReverse(validPayload);
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('nominatim');
    expect(result!.coordinates).toEqual({ lat: 27.7172, lon: 85.324 });
    expect(result!.address.locality).toBe('Kathmandu');
    expect(result!.address.adminAreaLevel1).toBe('Bagmati');
    expect(result!.address.countryCode).toBe('NP');
    expect(result!.address.postalCode).toBe('44600');
    expect(result!.id).toBe('nominatim:12345');
  });

  it('returns null for null/undefined input', () => {
    expect(mapNominatimReverse(null)).toBeNull();
    expect(mapNominatimReverse(undefined)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(mapNominatimReverse('string')).toBeNull();
  });

  it('returns null when lat/lon are invalid', () => {
    expect(mapNominatimReverse({ lat: 'abc', lon: '85' })).toBeNull();
    expect(mapNominatimReverse({ lat: '27', lon: NaN })).toBeNull();
  });

  it('falls back to town when city not present', () => {
    const payload = { ...validPayload, address: { town: 'Pokhara', country: 'Nepal', country_code: 'np' } };
    const result = mapNominatimReverse(payload);
    expect(result!.address.locality).toBe('Pokhara');
  });

  it('constructs id from coordinates when place_id is missing', () => {
    const payload = { ...validPayload, place_id: undefined };
    const result = mapNominatimReverse(payload);
    expect(result!.id).toMatch(/^nominatim:27\.717200:85\.324000$/);
  });

  it('deduplicates types array', () => {
    const payload = { ...validPayload, type: 'suburb', addresstype: 'suburb', class: 'place' };
    const result = mapNominatimReverse(payload);
    expect(result!.types).toEqual(['suburb', 'place']); // suburb listed once, not twice
  });

  it('handles empty address object', () => {
    const payload = { lat: '27.7', lon: '85.3', address: {} };
    const result = mapNominatimReverse(payload);
    expect(result).not.toBeNull();
    expect(result!.formattedAddress).toBe('Location');
  });
});

describe('mapNominatimSearch', () => {
  it('maps array of results', () => {
    const payload = [
      { lat: '27.7', lon: '85.3', display_name: 'Kathmandu', address: { city: 'Kathmandu' } },
      { lat: '28.2', lon: '83.9', display_name: 'Pokhara', address: { city: 'Pokhara' } },
    ];
    const result = mapNominatimSearch(payload);
    expect(result).toHaveLength(2);
    expect(result[0].address.locality).toBe('Kathmandu');
    expect(result[1].address.locality).toBe('Pokhara');
  });

  it('filters out invalid entries', () => {
    const payload = [
      { lat: '27.7', lon: '85.3', address: { city: 'Kathmandu' } },
      null,
      { lat: 'bad', lon: 'bad' },
    ];
    const result = mapNominatimSearch(payload);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for non-array input', () => {
    expect(mapNominatimSearch('not array')).toEqual([]);
    expect(mapNominatimSearch(null)).toEqual([]);
  });
});
