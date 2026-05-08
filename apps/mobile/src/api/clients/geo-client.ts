/**
 * Geo Client
 * 
 * Handles all geolocation-related API endpoints:
 * - Autocomplete
 * - Reverse geocoding
 */

import type { GeoSuggestion, GeoAutocompleteOptions } from '~/types';
import { BaseClient } from './base-client';

export class GeoClient extends BaseClient {
  /**
   * Geocoding autocomplete
   */
  async geoAutocomplete(query: string, options: GeoAutocompleteOptions = {}): Promise<{
    results: GeoSuggestion[];
  }> {
    const params = new URLSearchParams({ q: query });
    if (options.limit != null) params.set('limit', String(options.limit));
    if (options.lang) params.set('lang', options.lang);
    if (options.biasLat != null) params.set('lat', String(options.biasLat));
    if (options.biasLon != null) params.set('lon', String(options.biasLon));
    if (options.biasZoom != null) params.set('zoom', String(options.biasZoom));
    if (options.biasScale != null) {
      params.set('location_bias_scale', String(options.biasScale));
    }
    if (options.bbox) params.set('bbox', options.bbox);
    if (options.layer) params.set('layer', options.layer);
    return this.request<{ results: GeoSuggestion[] }>(`/geo/autocomplete?${params}`);
  }

  /**
   * Reverse geocoding
   */
  async geoReverse(lat: number, lon: number, lang?: string): Promise<{
    result: GeoSuggestion | null;
  }> {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
    });
    if (lang) params.set('lang', lang);
    return this.request<{ result: GeoSuggestion | null }>(`/geo/reverse?${params}`);
  }
}
