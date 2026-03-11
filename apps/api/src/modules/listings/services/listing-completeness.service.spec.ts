import { ListingCompletenessService } from './listing-completeness.service';

describe('ListingCompletenessService', () => {
  let service: ListingCompletenessService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      listing: {
        findUnique: jest.fn(),
      },
    };
    service = new ListingCompletenessService(prisma);
  });

  it('should return score 0 for non-existent listing', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    const result = await service.getCompleteness('non-existent');

    expect(result.score).toBe(0);
    expect(result.breakdown).toEqual([]);
    expect(result.missingFields).toEqual([]);
  });

  it('should return 100% for a fully complete listing', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      title: 'A great item for rent with a nice title',
      description:
        'This is a really long description that has more than fifty characters so it qualifies as complete.',
      photos: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'],
      basePrice: 100,
      city: 'Kathmandu',
      address: '123 Main St',
      state: 'Bagmati',
      country: 'Nepal',
      categoryId: 'cat-1',
      condition: 'EXCELLENT',
      features: ['portable', 'waterproof'],
      categorySpecificData: { brand: 'Sony' },
      rules: ['no smoking'],
      category: { id: 'cat-1', name: 'Electronics' },
    });

    const result = await service.getCompleteness('listing-1');
    expect(result.score).toBe(100);
    expect(result.missingFields).toEqual([]);
  });

  it('should calculate partial score for an incomplete listing', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-2',
      title: 'Great camera for daily rental',
      description: 'Short desc', // < 50 chars
      photos: ['a.jpg'], // < 3 photos
      basePrice: 50,
      city: 'Pokhara',
      address: null,
      state: null,
      country: null,
      categoryId: 'cat-1',
      condition: null,
      features: null,
      categorySpecificData: null,
      rules: null,
      category: { id: 'cat-1', name: 'Cameras' },
    });

    const result = await service.getCompleteness('listing-2');
    // title(10) + basePrice(10) + city(8) + category(5) = 33 of 100
    expect(result.score).toBe(33);
    expect(result.missingFields).toContain('description');
    expect(result.missingFields).toContain('photos');
    expect(result.missingFields).toContain('photos_bonus');
    expect(result.missingFields).toContain('address');
    expect(result.missingFields).toContain('condition');
    expect(result.missingFields).toContain('features');
    expect(result.missingFields).toContain('categorySpecificData');
    expect(result.missingFields).toContain('rules');
  });

  it('should include breakdown with correct weights', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-3',
      title: 'Short', // < 10 chars → not filled
      description: null,
      photos: null,
      basePrice: null,
      city: null,
      address: null,
      state: null,
      country: null,
      categoryId: null,
      condition: null,
      features: null,
      categorySpecificData: null,
      rules: null,
      category: null,
    });

    const result = await service.getCompleteness('listing-3');

    expect(result.score).toBe(0);

    // Verify total weights sum to 100
    const totalWeight = result.breakdown.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBe(100);

    // Verify all breakdown entries are unfilled
    result.breakdown.forEach((field) => {
      expect(field.filled).toBe(false);
    });
  });

  it('should differentiate between 3 photos and 5+ photos', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-4',
      title: 'Nice camera for rent',
      description: null,
      photos: ['a.jpg', 'b.jpg', 'c.jpg'],
      basePrice: null,
      city: null,
      address: null,
      state: null,
      country: null,
      categoryId: null,
      condition: null,
      features: null,
      categorySpecificData: null,
      rules: null,
      category: null,
    });

    const result = await service.getCompleteness('listing-4');

    const photoField = result.breakdown.find((f) => f.field === 'photos');
    const bonusField = result.breakdown.find(
      (f) => f.field === 'photos_bonus',
    );

    expect(photoField!.filled).toBe(true);
    expect(bonusField!.filled).toBe(false);
  });
});
