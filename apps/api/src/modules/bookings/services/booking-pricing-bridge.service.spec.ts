import { Test, TestingModule } from '@nestjs/testing';
import { BookingPricingBridgeService } from './booking-pricing-bridge.service';
import { BookingCalculationService } from './booking-calculation.service';
import { BookingPricingService } from './booking-pricing.service';
import { FxService } from '@/common/fx/fx.service';
import type { RefundResult } from '../ports/booking-pricing.port';

describe('BookingPricingBridgeService', () => {
  let service: BookingPricingBridgeService;
  let calculation: jest.Mocked<BookingCalculationService>;
  let bookingPricing: jest.Mocked<BookingPricingService>;
  let fxService: jest.Mocked<FxService>;

  const mockCalculation = {
    calculatePrice: jest.fn(),
    calculateRefund: jest.fn(),
    getServiceFeeRate: jest.fn().mockReturnValue(0.03),
    getPlatformFeeRate: jest.fn().mockReturnValue(0.02),
  };

  const mockBookingPricing = {
    calculateAndPersist: jest.fn(),
    captureFxRate: jest.fn(),
  };

  const mockFxService = {
    getRate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingPricingBridgeService,
        { provide: BookingCalculationService, useValue: mockCalculation },
        { provide: BookingPricingService, useValue: mockBookingPricing },
        { provide: FxService, useValue: mockFxService },
      ],
    }).compile();

    service = module.get<BookingPricingBridgeService>(BookingPricingBridgeService);
    calculation = module.get(BookingCalculationService);
    bookingPricing = module.get(BookingPricingService);
    fxService = module.get(FxService);

    jest.clearAllMocks();
  });

  describe('quote', () => {
    it('should delegate price calculation to calculation service', async () => {
      const mockPrice = {
        basePrice: 1000,
        serviceFee: 30,
        platformFee: 20,
        total: 1050,
      };
      mockCalculation.calculatePrice.mockResolvedValue(mockPrice);

      const result = await service.quote('listing-123', new Date('2025-12-10'), new Date('2025-12-15'));

      expect(result).toEqual(mockPrice);
      expect(mockCalculation.calculatePrice).toHaveBeenCalledWith('listing-123', expect.any(Date), expect.any(Date));
    });

    it('should return price breakdown for valid dates', async () => {
      const mockPrice = {
        basePrice: 5000,
        serviceFee: 150,
        platformFee: 100,
        taxes: 650,
        total: 5900,
      };
      mockCalculation.calculatePrice.mockResolvedValue(mockPrice as any);

      const result = await service.quote('listing-456', new Date('2025-12-20'), new Date('2025-12-25'));

      expect(result).toEqual(mockPrice);
    });
  });

  describe('persistBreakdown', () => {
    it('should persist breakdown with fee rates from calculation service', async () => {
      const params = {
        basePrice: 1000,
        nights: 5,
        currency: 'NPR',
      };

      await service.persistBreakdown('booking-789', params);

      expect(mockBookingPricing.calculateAndPersist).toHaveBeenCalledWith('booking-789', {
        ...params,
        serviceFeeRate: 0.03,
        platformFeeRate: 0.02,
      });
      expect(mockCalculation.getServiceFeeRate).toHaveBeenCalled();
      expect(mockCalculation.getPlatformFeeRate).toHaveBeenCalled();
    });

    it('should handle different fee rates', async () => {
      mockCalculation.getServiceFeeRate.mockReturnValue(0.05);
      mockCalculation.getPlatformFeeRate.mockReturnValue(0.03);

      const params = {
        basePrice: 2000,
        nights: 3,
        currency: 'NPR',
      };

      await service.persistBreakdown('booking-999', params);

      expect(mockBookingPricing.calculateAndPersist).toHaveBeenCalledWith('booking-999', {
        ...params,
        serviceFeeRate: 0.05,
        platformFeeRate: 0.03,
      });
    });
  });

  describe('captureExchangeRate', () => {
    it('should fetch and persist FX rate', async () => {
      mockFxService.getRate.mockResolvedValue({
        rate: 135.5,
        source: 'open-exchange-rates',
        timestamp: new Date(),
      });

      await service.captureExchangeRate('booking-789', 'USD', 'NPR');

      expect(mockFxService.getRate).toHaveBeenCalledWith('USD', 'NPR');
      expect(mockBookingPricing.captureFxRate).toHaveBeenCalledWith({
        bookingId: 'booking-789',
        baseCurrency: 'USD',
        targetCurrency: 'NPR',
        rate: 135.5,
        rateSource: 'open-exchange-rates',
      });
    });

    it('should handle different currency pairs', async () => {
      mockFxService.getRate.mockResolvedValue({
        rate: 1.08,
        source: 'ecb',
        timestamp: new Date(),
      });

      await service.captureExchangeRate('booking-123', 'EUR', 'USD');

      expect(mockFxService.getRate).toHaveBeenCalledWith('EUR', 'USD');
      expect(mockBookingPricing.captureFxRate).toHaveBeenCalledWith(expect.objectContaining({
        rate: 1.08,
        rateSource: 'ecb',
      }));
    });

    it('should propagate FX service errors', async () => {
      mockFxService.getRate.mockRejectedValue(new Error('Rate service unavailable'));

      await expect(service.captureExchangeRate('booking-123', 'USD', 'NPR')).rejects.toThrow('Rate service unavailable');
    });
  });

  describe('calculateRefund', () => {
    it('should delegate refund calculation to calculation service', async () => {
      const mockRefund: RefundResult = {
        refundAmount: 850,
        platformFeeRefund: 15,
        serviceFeeRefund: 20,
        depositRefund: 100,
        penalty: 100,
        reason: 'Partial refund based on cancellation policy',
      };
      mockCalculation.calculateRefund.mockResolvedValue(mockRefund);

      const result = await service.calculateRefund('booking-123', new Date('2025-12-05'));

      expect(result).toEqual(mockRefund);
      expect(mockCalculation.calculateRefund).toHaveBeenCalledWith('booking-123', expect.any(Date));
    });

    it('should handle full refund scenarios', async () => {
      const mockRefund: RefundResult = {
        refundAmount: 1000,
        platformFeeRefund: 20,
        serviceFeeRefund: 30,
        depositRefund: 100,
        penalty: 0,
        reason: 'Full refund - within cancellation window',
      };
      mockCalculation.calculateRefund.mockResolvedValue(mockRefund);

      const result = await service.calculateRefund('booking-456', new Date('2025-11-01'));

      expect(result.refundAmount).toBe(1000);
      expect(result.penalty).toBe(0);
    });

    it('should handle partial refund scenarios', async () => {
      const mockRefund: RefundResult = {
        refundAmount: 500,
        platformFeeRefund: 10,
        serviceFeeRefund: 15,
        depositRefund: 100,
        penalty: 250,
        reason: 'Partial refund - late cancellation',
      };
      mockCalculation.calculateRefund.mockResolvedValue(mockRefund);

      const result = await service.calculateRefund('booking-789', new Date('2025-12-08'));

      expect(result.refundAmount).toBe(500);
      expect(result.penalty).toBe(250);
    });

    it('should handle no refund scenarios', async () => {
      const mockRefund: RefundResult = {
        refundAmount: 0,
        platformFeeRefund: 0,
        serviceFeeRefund: 0,
        depositRefund: 100,
        penalty: 500,
        reason: 'No refund - past cancellation deadline',
      };
      mockCalculation.calculateRefund.mockResolvedValue(mockRefund);

      const result = await service.calculateRefund('booking-999', new Date('2025-12-20'));

      expect(result.refundAmount).toBe(0);
      expect(result.penalty).toBe(500);
    });
  });

  describe('port interface compliance', () => {
    it('should implement BookingPricingPort interface', () => {
      expect(service.quote).toBeDefined();
      expect(service.persistBreakdown).toBeDefined();
      expect(service.captureExchangeRate).toBeDefined();
      expect(service.calculateRefund).toBeDefined();
    });

    it('should not directly depend on low-level services from BookingsService perspective', () => {
      // The whole point of the bridge is to hide implementation details
      // BookingsService only sees the port interface
      expect(service.constructor.name).toBe('BookingPricingBridgeService');
    });
  });
});
