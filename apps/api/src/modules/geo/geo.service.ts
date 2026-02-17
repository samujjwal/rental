import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CacheService } from '@/common/cache/cache.service';
import type { GeoSuggestion, GeoBias } from './geo.types';
import { mapPhotonFeatures } from './providers/photon.adapter';
import {
  isNominatimProvider,
  mapNominatimReverse,
  mapNominatimSearch,
} from './providers/nominatim.adapter';

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly baseUrl: string;
  private readonly fallbackUrl?: string;
  private readonly userAgent: string;
  private readonly defaultLimit: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.baseUrl =
      this.configService.get('geo.providerUrl') || 'https://photon.komoot.io';
    this.fallbackUrl = this.configService.get('geo.fallbackUrl');
    this.userAgent =
      this.configService.get('geo.userAgent') ||
      'GharBatai Rentals (support@gharbatai.com)';
    this.defaultLimit = Number(this.configService.get('geo.defaultLimit') || 8);
  }

  async autocomplete(
    query: string,
    limit?: number,
    lang?: string,
    bias?: GeoBias,
  ): Promise<GeoSuggestion[]> {
    const cleanedQuery = query.trim();
    if (!cleanedQuery) return [];

    const size = limit || this.defaultLimit;
    const biasKey = bias ? JSON.stringify(bias) : 'none';
    const cacheKey = `geo:autocomplete:${lang || 'default'}:${size}:${biasKey}:${cleanedQuery.toLowerCase()}`;
    const cached = await this.cacheService.get<GeoSuggestion[]>(cacheKey);
    if (cached) return cached;

    try {
      let results = await this.tryAutocompleteProvider(
        this.baseUrl,
        cleanedQuery,
        size,
        lang,
        bias,
      );
      if (results.length === 0 && bias?.layer) {
        results = await this.tryAutocompleteProvider(
          this.baseUrl,
          cleanedQuery,
          size,
          lang,
          this.withoutLayer(bias),
        );
      }
      if (results.length === 0 && this.fallbackUrl && this.fallbackUrl !== this.baseUrl) {
        results = await this.tryAutocompleteProvider(
          this.fallbackUrl,
          cleanedQuery,
          size,
          lang,
          bias,
        );
        if (results.length === 0 && bias?.layer) {
          results = await this.tryAutocompleteProvider(
            this.fallbackUrl,
            cleanedQuery,
            size,
            lang,
            this.withoutLayer(bias),
          );
        }
      }
      await this.cacheService.set(cacheKey, results, results.length > 0 ? 86400 : 120);
      return results;
    } catch (error) {
      if (this.fallbackUrl) {
        try {
          const results = await this.tryAutocompleteProvider(
            this.fallbackUrl,
            cleanedQuery,
            size,
            lang,
            bias,
          );
          await this.cacheService.set(cacheKey, results, results.length > 0 ? 86400 : 120);
          return results;
        } catch (fallbackError) {
          this.logger.error('Geo autocomplete failed (fallback)', fallbackError);
          return [];
        }
      }

      this.logger.error('Geo autocomplete failed', error);
      return [];
    }
  }

  async reverse(lat: number, lon: number, lang?: string): Promise<GeoSuggestion | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const cacheKey = `geo:reverse:${lang || 'default'}:${lat.toFixed(5)}:${lon.toFixed(5)}`;
    const cached = await this.cacheService.get<GeoSuggestion>(cacheKey);
    if (cached) return cached;

    try {
      let match = await this.tryReverseProvider(this.baseUrl, lat, lon, lang);
      if (match) {
        await this.cacheService.set(cacheKey, match, 86400);
        return match;
      }

      // Retry without language constraint if provider returned no features.
      if (lang) {
        match = await this.tryReverseProvider(this.baseUrl, lat, lon);
        if (match) {
          await this.cacheService.set(cacheKey, match, 86400);
          return match;
        }
      }

      // Try fallback provider even on empty results (not only request errors).
      if (this.fallbackUrl && this.fallbackUrl !== this.baseUrl) {
        match = await this.tryReverseProvider(this.fallbackUrl, lat, lon, lang);
        if (!match && lang) {
          match = await this.tryReverseProvider(this.fallbackUrl, lat, lon);
        }
        if (match) {
          await this.cacheService.set(cacheKey, match, 86400);
          return match;
        }
      }

      const fallback = this.buildCoordinateFallback(lat, lon);
      await this.cacheService.set(cacheKey, fallback, 3600);
      this.logger.error(
        `Geo reverse returned empty from all providers. Using coordinate fallback (lat=${lat.toFixed(5)}, lon=${lon.toFixed(5)})`,
      );
      return fallback;
    } catch (error) {
      if (this.fallbackUrl) {
        try {
          const match = await this.tryReverseProvider(this.fallbackUrl, lat, lon, lang);
          if (match) {
            await this.cacheService.set(cacheKey, match, 86400);
            return match;
          }
          const fallback = this.buildCoordinateFallback(lat, lon);
          await this.cacheService.set(cacheKey, fallback, 3600);
          this.logger.error(
            `Geo reverse fallback provider empty after error path. Using coordinate fallback (lat=${lat.toFixed(5)}, lon=${lon.toFixed(5)})`,
          );
          return fallback;
        } catch (fallbackError) {
          this.logger.error('Geo reverse failed (fallback)', fallbackError);
          const fallback = this.buildCoordinateFallback(lat, lon);
          await this.cacheService.set(cacheKey, fallback, 3600);
          return fallback;
        }
      }

      this.logger.error('Geo reverse failed', error);
      const fallback = this.buildCoordinateFallback(lat, lon);
      await this.cacheService.set(cacheKey, fallback, 3600);
      return fallback;
    }
  }

  private async tryReverseProvider(
    baseUrl: string,
    lat: number,
    lon: number,
    lang?: string,
  ): Promise<GeoSuggestion | null> {
    const response = await this.requestReverse(baseUrl, lat, lon, lang);
    const features = Array.isArray(response.data?.features)
      ? response.data.features
      : [];
    const results = mapPhotonFeatures(features);
    if (results[0]) {
      return results[0];
    }

    const nominatimMatch = mapNominatimReverse(response.data);
    if (nominatimMatch) {
      return nominatimMatch;
    }

    this.logger.warn(
      `Geo reverse empty result from provider: ${baseUrl} (lat=${lat.toFixed(5)}, lon=${lon.toFixed(5)})`,
    );
    return null;
  }

  private async tryAutocompleteProvider(
    baseUrl: string,
    query: string,
    limit: number,
    lang?: string,
    bias?: GeoBias,
  ): Promise<GeoSuggestion[]> {
    const response = await this.requestAutocomplete(baseUrl, query, limit, lang, bias);
    const features = Array.isArray(response.data?.features)
      ? response.data.features
      : [];
    const featureResults = mapPhotonFeatures(features);
    if (featureResults.length > 0) {
      return featureResults;
    }
    const nominatimResults = mapNominatimSearch(response.data);
    if (nominatimResults.length > 0) {
      return nominatimResults;
    }
    return [];
  }

  private async requestAutocomplete(
    baseUrl: string,
    query: string,
    limit: number,
    lang?: string,
    bias?: GeoBias,
  ) {
    if (isNominatimProvider(baseUrl)) {
      return axios.get(`${baseUrl}/search`, {
        params: {
          q: query,
          limit,
          format: 'jsonv2',
          addressdetails: 1,
          'accept-language': lang || 'en',
        },
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
          'Accept-Language': lang || 'en',
        },
        timeout: 8000,
      });
    }

    return axios.get(`${baseUrl}/api`, {
      params: {
        q: query,
        limit,
        lang,
        lat: bias?.lat,
        lon: bias?.lon,
        zoom: bias?.zoom,
        location_bias_scale: bias?.locationBiasScale,
        bbox: bias?.bbox,
        layer: bias?.layer,
      },
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
        'Accept-Language': lang || 'en',
      },
      timeout: 8000,
    });
  }

  private async requestReverse(baseUrl: string, lat: number, lon: number, lang?: string) {
    if (isNominatimProvider(baseUrl)) {
      return axios.get(`${baseUrl}/reverse`, {
        params: {
          lat,
          lon,
          format: 'jsonv2',
          addressdetails: 1,
          'accept-language': lang || 'en',
        },
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
          'Accept-Language': lang || 'en',
        },
        timeout: 8000,
      });
    }
    return axios.get(`${baseUrl}/reverse`, {
      params: {
        lat,
        lon,
        lang,
        format: 'geojson',
        addressdetails: 1,
      },
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
        'Accept-Language': lang || 'en',
      },
      timeout: 8000,
    });
  }

  private buildCoordinateFallback(lat: number, lon: number): GeoSuggestion {
    const latLabel = lat.toFixed(5);
    const lonLabel = lon.toFixed(5);
    const shortLabel = `${latLabel}, ${lonLabel}`;
    const formattedAddress = `GPS (${latLabel}, ${lonLabel})`;
    return {
      id: `fallback:${lat.toFixed(5)}:${lon.toFixed(5)}`,
      provider: 'fallback',
      placeId: undefined,
      shortLabel,
      formattedAddress,
      coordinates: { lat, lon },
      address: {
        subLocality: undefined,
        locality: shortLabel,
        adminAreaLevel1: undefined,
        adminAreaLevel2: undefined,
        postalCode: undefined,
        countryCode: undefined,
        country: undefined,
      },
      types: ['coordinate'],
    };
  }

  private withoutLayer(bias?: GeoBias): GeoBias | undefined {
    if (!bias) return undefined;
    const { layer: _layer, ...rest } = bias;
    return rest;
  }
}
