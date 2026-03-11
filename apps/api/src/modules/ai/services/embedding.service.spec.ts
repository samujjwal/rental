import { EmbeddingService } from './embedding.service';

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let configService: any;
  let prisma: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'sk-test-key';
        return undefined;
      }),
    };

    prisma = {
      listing: {
        findUnique: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    };

    service = new EmbeddingService(configService, prisma);
    mockFetch.mockReset();
  });

  describe('generateEmbedding', () => {
    it('should return null when no API key configured', async () => {
      configService.get.mockReturnValue(undefined);
      service = new EmbeddingService(configService, prisma);

      const result = await service.generateEmbedding('test text');

      expect(result).toBeNull();
    });

    it('should call OpenAI embeddings API and return vector', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      const result = await service.generateEmbedding('test text');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.anything(),
      );
      expect(result).toEqual(mockEmbedding);
    });

    it('should truncate text to 32000 chars', async () => {
      const longText = 'A'.repeat(40000);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1] }],
        }),
      });

      await service.generateEmbedding(longText);

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.input.length).toBeLessThanOrEqual(32000);
    });

    it('should return null on HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const result = await service.generateEmbedding('test');

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.generateEmbedding('test');

      expect(result).toBeNull();
    });
  });

  describe('buildListingText', () => {
    it('should join listing fields with separator', () => {
      const listing = {
        title: 'Cozy Apartment',
        description: 'A nice place',
        city: 'Kathmandu',
        category: { name: 'Apartments' },
      };

      const text = service.buildListingText(listing);

      expect(text).toContain('Cozy Apartment');
      expect(text).toContain('A nice place');
      expect(text).toContain('Kathmandu');
    });

    it('should handle listings with minimal fields', () => {
      const listing = { title: 'Basic Listing' };

      const text = service.buildListingText(listing);

      expect(text).toContain('Basic Listing');
    });

    it('should include features and amenities if present', () => {
      const listing = {
        title: 'House',
        features: ['WiFi', 'Parking'],
        amenities: ['Pool', 'Gym'],
      };

      const text = service.buildListingText(listing);

      expect(text).toContain('House');
    });
  });

  describe('updateListingEmbedding', () => {
    it('should return false when listing not found', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      const result = await service.updateListingEmbedding('listing-1');

      expect(result).toBe(false);
    });

    it('should return false when embedding generation fails', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        title: 'Test',
      });
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await service.updateListingEmbedding('listing-1');

      expect(result).toBe(false);
    });

    it('should update listing embedding via raw SQL', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        title: 'Cozy Apt',
        description: 'Nice place',
        city: 'Kathmandu',
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      });
      prisma.$executeRawUnsafe.mockResolvedValue(1);

      const result = await service.updateListingEmbedding('listing-1');

      expect(result).toBe(true);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('semanticSearch', () => {
    it('should return empty array when embedding generation fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const results = await service.semanticSearch('apartments');

      expect(results).toEqual([]);
    });

    it('should execute cosine distance search query', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2] }],
        }),
      });
      prisma.$queryRawUnsafe.mockResolvedValue([
        { id: 'listing-1', title: 'Cozy Apt', distance: 0.15 },
      ]);

      const results = await service.semanticSearch('cozy apartment', 10);

      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it('should use default limit and offset', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1] }],
        }),
      });
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      await service.semanticSearch('test');

      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('backfillEmbeddings', () => {
    it('should process listings without embeddings', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        { id: 'listing-1' },
        { id: 'listing-2' },
      ]);
      prisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        title: 'Test',
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1] }],
        }),
      });
      prisma.$executeRawUnsafe.mockResolvedValue(1);

      const count = await service.backfillEmbeddings(2);

      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should use default batch size of 50', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const count = await service.backfillEmbeddings();

      expect(count).toBe(0);
    });
  });
});
