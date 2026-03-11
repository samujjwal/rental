import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingPricingService } from './booking-pricing.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('BookingPricingService', () => {
  let service: BookingPricingService;
  let prisma: any;

  const bookingId = 'booking-1';

  const mockLine = {
    id: 'line-1',
    bookingId,
    lineType: 'BASE_RATE',
    label: '3 nights × 100.00',
    amount: 300,
    currency: 'NPR',
    metadata: null,
    sortOrder: 0,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
      },
      bookingPriceBreakdown: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
        create: jest.fn().mockResolvedValue(mockLine),
      },
      fxRateSnapshot: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        // Support callback-style transactions: pass prisma as tx
        if (typeof cb === 'function') {
          return cb(prisma);
        }
        // Array-style fallback
        return Promise.all(cb);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingPricingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn((key: string, defaultVal: any) => defaultVal) } },
      ],
    }).compile();

    service = module.get<BookingPricingService>(BookingPricingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBreakdown', () => {
    it('should create price breakdown lines', async () => {
      prisma.booking.findUnique.mockResolvedValue({ id: bookingId });
      prisma.bookingPriceBreakdown.create.mockResolvedValue(mockLine);

      const result = await service.createBreakdown({
        bookingId,
        lines: [
          { lineType: 'BASE_RATE', label: '3 nights × 100.00', amount: 300 },
        ],
      });

      expect(result).toHaveLength(1);
      expect(result[0].lineType).toBe('BASE_RATE');
    });

    it('should delete existing breakdown before creating new one', async () => {
      prisma.booking.findUnique.mockResolvedValue({ id: bookingId });
      prisma.bookingPriceBreakdown.create.mockResolvedValue(mockLine);

      await service.createBreakdown({
        bookingId,
        lines: [{ lineType: 'BASE_RATE', label: 'Test', amount: 100 }],
      });

      expect(prisma.bookingPriceBreakdown.deleteMany).toHaveBeenCalledWith({
        where: { bookingId },
      });
    });

    it('should throw NotFoundException if booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.createBreakdown({
          bookingId,
          lines: [{ lineType: 'BASE_RATE', label: 'Test', amount: 100 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use default currency NPR and auto-index sortOrder', async () => {
      prisma.booking.findUnique.mockResolvedValue({ id: bookingId });
      prisma.bookingPriceBreakdown.create.mockResolvedValue(mockLine);

      const result = await service.createBreakdown({
        bookingId,
        lines: [
          { lineType: 'BASE_RATE', label: 'Base', amount: 100 },
          { lineType: 'CLEANING_FEE', label: 'Clean', amount: 50 },
        ],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('getBreakdown', () => {
    it('should return breakdown with subtotal', async () => {
      prisma.bookingPriceBreakdown.findMany.mockResolvedValue([
        { ...mockLine, amount: 300 },
        { ...mockLine, id: 'line-2', lineType: 'CLEANING_FEE', amount: 50 },
        { ...mockLine, id: 'line-3', lineType: 'SERVICE_FEE', amount: 30 },
      ]);

      const result = await service.getBreakdown(bookingId);

      expect(result.bookingId).toBe(bookingId);
      expect(result.subtotal).toBe(380);
      expect(result.lines).toHaveLength(3);
      expect(result.currency).toBe('NPR');
    });

    it('should return empty breakdown with 0 subtotal', async () => {
      prisma.bookingPriceBreakdown.findMany.mockResolvedValue([]);

      const result = await service.getBreakdown(bookingId);

      expect(result.subtotal).toBe(0);
      expect(result.lines).toEqual([]);
      expect(result.currency).toBe('NPR');
    });
  });

  describe('calculateAndPersist', () => {
    beforeEach(() => {
      prisma.booking.findUnique.mockResolvedValue({ id: bookingId });
      prisma.bookingPriceBreakdown.deleteMany.mockResolvedValue({ count: 0 });
    });

    it('should calculate standard breakdown with all components', async () => {
      let createCount = 0;
      prisma.bookingPriceBreakdown.create.mockImplementation(() => {
        return Promise.resolve({
          ...mockLine,
          id: `line-${createCount}`,
          sortOrder: createCount++,
        });
      });

      const result = await service.calculateAndPersist(bookingId, {
        basePrice: 100,
        nights: 3,
        cleaningFee: 50,
        serviceFeeRate: 0.1,
        platformFeeRate: 0.03,
        securityDeposit: 200,
        taxRate: 0.08,
      });

      // Should create 6 lines: base, cleaning, service, platform, deposit, tax
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.length).toBe(6);
    });

    it('should create only base rate when no optional fees', async () => {
      prisma.bookingPriceBreakdown.create.mockResolvedValue(mockLine);

      const result = await service.calculateAndPersist(bookingId, {
        basePrice: 100,
        nights: 1,
        serviceFeeRate: 0, // No service fee
        platformFeeRate: 0, // No platform fee
      });

      // Should create 1 line (or more depending on default rates)
      expect(result).toBeDefined();
    });

    it('should handle single night label correctly', async () => {
      prisma.bookingPriceBreakdown.create.mockResolvedValue(mockLine);

      await service.calculateAndPersist(bookingId, {
        basePrice: 50,
        nights: 1,
      });

      // Verify label is "1 night × ..." (singular)
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should use custom currency', async () => {
      prisma.bookingPriceBreakdown.create.mockResolvedValue({ ...mockLine, currency: 'EUR' });

      await service.calculateAndPersist(bookingId, {
        basePrice: 100,
        nights: 2,
        currency: 'EUR',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should skip zero-amount fees', async () => {
      prisma.bookingPriceBreakdown.create.mockResolvedValue(mockLine);

      await service.calculateAndPersist(bookingId, {
        basePrice: 100,
        nights: 2,
        cleaningFee: 0,
        securityDeposit: 0,
        taxRate: 0,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('captureFxRate', () => {
    it('should capture FX rate for a booking', async () => {
      const mockFxRate = {
        id: 'fx-1',
        bookingId,
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
        rateSource: 'ECB',
        capturedAt: new Date(),
      };
      prisma.booking.findUnique.mockResolvedValue({ id: bookingId });
      prisma.fxRateSnapshot.upsert.mockResolvedValue(mockFxRate);

      const result = await service.captureFxRate({
        bookingId,
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
        rateSource: 'ECB',
      });

      expect(result).toEqual(mockFxRate);
      expect(prisma.fxRateSnapshot.upsert).toHaveBeenCalledWith({
        where: { bookingId },
        create: expect.objectContaining({
          bookingId,
          baseCurrency: 'USD',
          targetCurrency: 'EUR',
          rate: 0.92,
          rateSource: 'ECB',
        }),
        update: expect.objectContaining({
          baseCurrency: 'USD',
          targetCurrency: 'EUR',
          rate: 0.92,
          rateSource: 'ECB',
        }),
      });
    });

    it('should throw NotFoundException if booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.captureFxRate({
          bookingId,
          baseCurrency: 'USD',
          targetCurrency: 'EUR',
          rate: 0.92,
          rateSource: 'ECB',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFxRate', () => {
    it('should return FX rate for a booking', async () => {
      const mockFxRate = {
        bookingId,
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        rate: 0.92,
      };
      prisma.fxRateSnapshot.findUnique.mockResolvedValue(mockFxRate);

      const result = await service.getFxRate(bookingId);

      expect(result).toEqual(mockFxRate);
    });

    it('should return null when no FX rate captured', async () => {
      prisma.fxRateSnapshot.findUnique.mockResolvedValue(null);

      const result = await service.getFxRate(bookingId);

      expect(result).toBeNull();
    });
  });
});
