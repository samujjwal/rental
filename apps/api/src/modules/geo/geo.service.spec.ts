import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeoService } from './geo.service';
import { CacheService } from '@/common/cache/cache.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeoService', () => {
  let service: GeoService;
  let cacheService: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string | undefined> = {
                'geo.providerUrl': 'https://photon.komoot.io',
                'geo.fallbackUrl': undefined,
                'geo.userAgent': 'TestApp',
                'geo.defaultLimit': '5',
              };
              return map[key];
            }),
          },
        },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<GeoService>(GeoService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('autocomplete', () => {
    it('should return empty array for empty query', async () => {
      const result = await service.autocomplete('');
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace query', async () => {
      const result = await service.autocomplete('   ');
      expect(result).toEqual([]);
    });

    it('should return cached results when available', async () => {
      const cached = [{ id: '1', shortLabel: 'Portland' }];
      cacheService.get.mockResolvedValue(cached);

      const result = await service.autocomplete('Portland');

      expect(result).toEqual(cached);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should call provider and map Photon features', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          features: [
            {
              properties: {
                osm_id: 123,
                name: 'Portland',
                city: 'Portland',
                state: 'Oregon',
                country: 'United States',
                countrycode: 'US',
                postcode: '97201',
                osm_type: 'N',
                type: 'city',
              },
              geometry: { coordinates: [-122.68, 45.52] },
            },
          ],
        },
      });

      const result = await service.autocomplete('Portland');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].coordinates).toBeDefined();
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should return empty array on network error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await service.autocomplete('Portland');

      expect(result).toEqual([]);
    });
  });

  describe('reverse', () => {
    it('should return null for non-finite lat', async () => {
      const result = await service.reverse(NaN, 45.0);
      expect(result).toBeNull();
    });

    it('should return null for non-finite lon', async () => {
      const result = await service.reverse(45.0, Infinity);
      expect(result).toBeNull();
    });

    it('should return cached result when available', async () => {
      const cached = { id: 'cached', shortLabel: '45.52, -122.68' };
      cacheService.get.mockResolvedValue(cached);

      const result = await service.reverse(45.52, -122.68);

      expect(result).toEqual(cached);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should return coordinate fallback when provider returns empty', async () => {
      mockedAxios.get.mockResolvedValue({ data: { features: [] } });

      const result = await service.reverse(45.52, -122.68);

      expect(result).toBeDefined();
      expect(result!.provider).toBe('fallback');
      expect(result!.coordinates.lat).toBe(45.52);
      expect(result!.coordinates.lon).toBe(-122.68);
      expect(result!.formattedAddress).toContain('GPS');
    });

    it('should return coordinate fallback on network error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('timeout'));

      const result = await service.reverse(45.52, -122.68);

      expect(result).toBeDefined();
      expect(result!.provider).toBe('fallback');
    });

    it('should return mapped result from valid Photon response', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          features: [
            {
              properties: {
                osm_id: 456,
                name: 'SE Hawthorne',
                city: 'Portland',
                state: 'Oregon',
                country: 'United States',
                countrycode: 'US',
                postcode: '97214',
                osm_type: 'W',
                type: 'street',
              },
              geometry: { coordinates: [-122.63, 45.51] },
            },
          ],
        },
      });

      const result = await service.reverse(45.51, -122.63);

      expect(result).toBeDefined();
      expect(result!.coordinates.lat).toBe(45.51);
      expect(cacheService.set).toHaveBeenCalled();
    });
  });
});
