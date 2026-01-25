import { Test, TestingModule } from '@nestjs/testing';
import { BookingCalculationService } from './booking-calculation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PricingMode, DepositType } from '@rental-portal/database';

const mockPrismaService = {
  listing: {
    findUnique: jest.fn(),
  },
  booking: {
    findUnique: jest.fn(),
  },
};

describe('BookingCalculationService', () => {
  let service: BookingCalculationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCalculationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BookingCalculationService>(BookingCalculationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculatePrice', () => {
    const listingId = 'listing-1';
    const startDate = new Date('2023-01-01T10:00:00Z');
    const endDate = new Date('2023-01-02T10:00:00Z'); // 24 hours

    it('should calculate price for DAILY pricing', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        dailyPrice: 100,
        requiresDeposit: false,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const result = await service.calculatePrice(listingId, startDate, endDate);

      expect(result.subtotal).toBe(100);
      expect(result.total).toBeGreaterThan(100); // Includes fees
    });

    it('should calculate deposit if required', async () => {
      const listing = {
        id: listingId,
        pricingMode: PricingMode.PER_DAY,
        basePrice: 100,
        requiresDeposit: true,
        depositType: DepositType.FIXED_AMOUNT,
        depositAmount: 50,
      };

      mockPrismaService.listing.findUnique.mockResolvedValue(listing);

      const result = await service.calculatePrice(listingId, startDate, endDate);

      expect(result.depositAmount).toBe(50);
    });
  });
});
