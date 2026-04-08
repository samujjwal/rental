import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BookingPricingService } from './booking-pricing.service';

/**
 * SIMPLIFIED: Booking Pricing Logic Tests
 *
 * These tests validate the pricing calculation logic with proper
 * method signatures matching the actual service interface.
 */
describe('Booking Pricing Service - Simplified', () => {
  let service: BookingPricingService;
  let prisma: jest.Mocked<PrismaService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingPricingService,
        {
          provide: PrismaService,
          useValue: {
            booking: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            bookingPriceBreakdown: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
            },
            fxRateSnapshot: {
              findUnique: jest.fn(),
              create: jest.fn(),
              upsert: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingPricingService>(BookingPricingService);
    prisma = module.get(PrismaService);
    config = module.get(ConfigService);
  });

  describe('createBreakdown', () => {
    it('should create price breakdown for a booking', async () => {
      const bookingId = 'booking-1';
      const breakdownDto = {
        bookingId,
        lines: [
          {
            lineType: 'BASE_PRICE',
            label: 'Base Price',
            amount: 100000,
            currency: 'NPR',
            sortOrder: 1,
          },
          {
            lineType: 'SERVICE_FEE',
            label: 'Service Fee',
            amount: 10000,
            currency: 'NPR',
            sortOrder: 2,
          },
        ],
      };

      // Mock booking exists
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });

      // Mock transaction
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma);
      });

      // Mock delete and create operations
      (prisma.bookingPriceBreakdown.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.bookingPriceBreakdown.create as jest.Mock).mockResolvedValue({});

      const result = await service.createBreakdown(breakdownDto);

      expect(prisma.booking.findUnique).toHaveBeenCalledWith({
        where: { id: bookingId },
        select: { id: true },
      });
      expect(prisma.bookingPriceBreakdown.deleteMany).toHaveBeenCalledWith({
        where: { bookingId },
      });
      expect(prisma.bookingPriceBreakdown.create).toHaveBeenCalled();
    });

    it('should throw error if booking does not exist', async () => {
      const bookingId = 'non-existent-booking';
      const breakdownDto = {
        bookingId,
        lines: [
          {
            lineType: 'BASE_PRICE',
            label: 'Base Price',
            amount: 100000,
            currency: 'NPR',
            sortOrder: 1,
          },
        ],
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createBreakdown(breakdownDto)).rejects.toThrow();
    });
  });

  describe('getBreakdown', () => {
    it('should return price breakdown for a booking', async () => {
      const bookingId = 'booking-1';
      const mockBreakdown = [
        {
          id: 'line-1',
          lineType: 'BASE_PRICE',
          label: 'Base Price',
          amount: 100000,
          currency: 'NPR',
          sortOrder: 1,
        },
        {
          id: 'line-2',
          lineType: 'SERVICE_FEE',
          label: 'Service Fee',
          amount: 10000,
          currency: 'NPR',
          sortOrder: 2,
        },
      ];

      (prisma.bookingPriceBreakdown.findMany as jest.Mock).mockResolvedValue(mockBreakdown);

      const result = await service.getBreakdown(bookingId);

      expect(prisma.bookingPriceBreakdown.findMany).toHaveBeenCalledWith({
        where: { bookingId },
        orderBy: { sortOrder: 'asc' },
      });
      expect(result).toEqual({
        bookingId,
        lines: mockBreakdown,
        subtotal: 110000,
        currency: 'NPR',
      });
    });
  });

  describe('calculateAndPersist', () => {
    it('should calculate and persist standard price breakdown', async () => {
      const bookingId = 'booking-1';
      const params = {
        basePrice: 100000,
        nights: 3,
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-07-18'),
        guestCount: 2,
        currency: 'NPR',
      };

      // Mock booking exists
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });

      // Mock transaction
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma);
      });

      // Mock operations
      (prisma.bookingPriceBreakdown.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.bookingPriceBreakdown.create as jest.Mock).mockResolvedValue({});

      const result = await service.calculateAndPersist(bookingId, params);

      expect(prisma.booking.findUnique).toHaveBeenCalledWith({
        where: { id: bookingId },
        select: { id: true },
      });
      expect(prisma.bookingPriceBreakdown.deleteMany).toHaveBeenCalled();
      expect(prisma.bookingPriceBreakdown.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should calculate pricing with different parameters', async () => {
      const bookingId = 'booking-2';
      const params = {
        basePrice: 150000,
        nights: 4,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        guestCount: 4,
        currency: 'USD',
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma);
      });
      (prisma.bookingPriceBreakdown.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.bookingPriceBreakdown.create as jest.Mock).mockResolvedValue({});

      const result = await service.calculateAndPersist(bookingId, params);

      expect(result).toBeDefined();
      expect(prisma.bookingPriceBreakdown.create).toHaveBeenCalled();
    });
  });

  describe('captureFxRate', () => {
    it('should capture FX rate for a booking', async () => {
      const fxDto = {
        bookingId: 'booking-1',
        baseCurrency: 'NPR',
        targetCurrency: 'USD',
        rate: 0.0083,
        rateSource: 'STRIPE',
      };

      // Mock booking exists
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: fxDto.bookingId });

      // Mock FX rate upsert
      (prisma.fxRateSnapshot.upsert as jest.Mock).mockResolvedValue({
        id: 'fx-1',
        ...fxDto,
        createdAt: new Date(),
      });

      const result = await service.captureFxRate(fxDto);

      expect(prisma.booking.findUnique).toHaveBeenCalledWith({
        where: { id: fxDto.bookingId },
        select: { id: true },
      });
      expect(prisma.fxRateSnapshot.upsert).toHaveBeenCalledWith({
        where: { bookingId: fxDto.bookingId },
        create: expect.objectContaining({
          bookingId: fxDto.bookingId,
          baseCurrency: fxDto.baseCurrency,
          targetCurrency: fxDto.targetCurrency,
          rate: fxDto.rate,
          rateSource: fxDto.rateSource,
        }),
        update: expect.objectContaining({
          baseCurrency: fxDto.baseCurrency,
          targetCurrency: fxDto.targetCurrency,
          rate: fxDto.rate,
          rateSource: fxDto.rateSource,
          capturedAt: expect.any(Date),
        }),
      });
      expect(result).toBeDefined();
    });

    it('should handle FX rate capture for existing booking', async () => {
      const fxDto = {
        bookingId: 'booking-existing',
        baseCurrency: 'EUR',
        targetCurrency: 'USD',
        rate: 1.08,
        rateSource: 'ECB',
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: fxDto.bookingId });
      (prisma.fxRateSnapshot.upsert as jest.Mock).mockResolvedValue({
        id: 'fx-2',
        ...fxDto,
        createdAt: new Date(),
      });

      const result = await service.captureFxRate(fxDto);

      expect(result).toBeDefined();
      expect(prisma.fxRateSnapshot.upsert).toHaveBeenCalled();
    });
  });

  describe('getFxRate', () => {
    it('should return FX rate for a booking', async () => {
      const bookingId = 'booking-1';
      const mockFxRate = {
        id: 'fx-1',
        bookingId,
        baseCurrency: 'NPR',
        targetCurrency: 'USD',
        rate: 0.0083,
        rateSource: 'STRIPE',
        createdAt: new Date(),
      };

      (prisma.fxRateSnapshot.findUnique as jest.Mock).mockResolvedValue(mockFxRate);

      const result = await service.getFxRate(bookingId);

      expect(prisma.fxRateSnapshot.findUnique).toHaveBeenCalledWith({
        where: { bookingId },
      });
      expect(result).toEqual(mockFxRate);
    });

    it('should return null if no FX rate exists', async () => {
      const bookingId = 'booking-no-fx';

      (prisma.fxRateSnapshot.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getFxRate(bookingId);

      expect(prisma.fxRateSnapshot.findUnique).toHaveBeenCalledWith({
        where: { bookingId },
      });
      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const bookingId = 'booking-error';
      const breakdownDto = {
        bookingId,
        lines: [
          {
            lineType: 'BASE_PRICE',
            label: 'Base Price',
            amount: 100000,
            currency: 'NPR',
            sortOrder: 1,
          },
        ],
      };

      (prisma.booking.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.createBreakdown(breakdownDto)).rejects.toThrow('Database error');
    });

    it('should handle transaction rollback on errors', async () => {
      const bookingId = 'booking-rollback';
      const params = {
        basePrice: 100000,
        nights: 3,
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-07-18'),
        guestCount: 2,
        currency: 'NPR',
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      await expect(service.calculateAndPersist(bookingId, params)).rejects.toThrow(
        'Transaction failed',
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty breakdown lines', async () => {
      const bookingId = 'booking-empty';
      const breakdownDto = {
        bookingId,
        lines: [],
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma);
      });
      (prisma.bookingPriceBreakdown.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.bookingPriceBreakdown.createMany as jest.Mock).mockResolvedValue(undefined);

      const result = await service.createBreakdown(breakdownDto);

      expect(result).toBeDefined();
      // For empty lines, create should not be called
      expect(prisma.bookingPriceBreakdown.create).not.toHaveBeenCalled();
    });

    it('should handle zero base price', async () => {
      const bookingId = 'booking-zero';
      const params = {
        basePrice: 0,
        nights: 3,
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-07-18'),
        guestCount: 2,
        currency: 'NPR',
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma);
      });
      (prisma.bookingPriceBreakdown.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.bookingPriceBreakdown.createMany as jest.Mock).mockResolvedValue(undefined);

      const result = await service.calculateAndPersist(bookingId, params);

      expect(result).toBeDefined();
    });

    it('should handle very large amounts', async () => {
      const bookingId = 'booking-large';
      const params = {
        basePrice: 10000000, // 10 million
        nights: 3,
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-07-18'),
        guestCount: 2,
        currency: 'NPR',
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma);
      });
      (prisma.bookingPriceBreakdown.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.bookingPriceBreakdown.createMany as jest.Mock).mockResolvedValue(undefined);

      const result = await service.calculateAndPersist(bookingId, params);

      expect(result).toBeDefined();
    });
  });
});
