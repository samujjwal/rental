import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutOrchestratorService } from './checkout-orchestrator.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FraudIntelligenceService } from './fraud-intelligence.service';
import { AvailabilityGraphService } from './availability-graph.service';
import { PaymentOrchestrationService } from './payment-orchestration.service';
import { TaxPolicyEngineService } from './tax-policy-engine.service';
import { CountryPolicyPackService } from './country-policy-pack.service';
import { ConfigService } from '@nestjs/config';

describe('CheckoutOrchestratorService', () => {
  let service: CheckoutOrchestratorService;
  let prisma: any;
  let cache: any;
  let eventEmitter: any;
  let fraudService: any;
  let availabilityService: any;
  let paymentService: any;
  let taxService: any;
  let policyService: any;

  const tomorrow = new Date(Date.now() + 86400000);
  const nextWeek = new Date(Date.now() + 7 * 86400000);

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue({
          id: '12345678-1234-1234-1234-123456789012',
          basePrice: 3000,
          serviceFeePercent: 10,
          ownerId: 'owner-1',
        }),
      },
      booking: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'booking-1', ...data }),
        ),
      },
      ledgerEntry: {
        create: jest.fn().mockResolvedValue({ id: 'le-1' }),
      },
      bookingStateHistory: {
        create: jest.fn().mockResolvedValue({ id: 'bsh-1' }),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      setNx: jest.fn().mockResolvedValue(true),
    };

    eventEmitter = { emit: jest.fn() };

    fraudService = {
      analyzeRisk: jest.fn().mockResolvedValue({
        riskScore: 15,
        decision: 'ALLOW',
        overallRisk: 15,
        signals: [],
      }),
    };

    availabilityService = {
      checkRealTimeAvailability: jest.fn().mockResolvedValue({
        available: true,
        blockedDates: [],
        confirmedBookings: 0,
        pricePerNight: 3000,
        hasActiveLock: false,
      }),
    };

    paymentService = {
      authorize: jest.fn().mockResolvedValue({
        transactionId: 'tx-123',
        status: 'authorized',
        provider: 'esewa',
      }),
      refund: jest.fn().mockResolvedValue({ status: 'refunded' }),
    };

    taxService = {
      calculateTax: jest.fn().mockResolvedValue({
        subtotal: 21000,
        totalTax: 2730,
        total: 23730,
        taxes: [{ name: 'VAT', rate: 0.13, amount: 2730 }],
      }),
    };

    policyService = {
      validateBooking: jest.fn().mockResolvedValue({
        valid: true,
        violations: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutOrchestratorService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: FraudIntelligenceService, useValue: fraudService },
        { provide: AvailabilityGraphService, useValue: availabilityService },
        { provide: PaymentOrchestrationService, useValue: paymentService },
        { provide: TaxPolicyEngineService, useValue: taxService },
        { provide: CountryPolicyPackService, useValue: policyService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test') } },
      ],
    }).compile();

    service = module.get<CheckoutOrchestratorService>(CheckoutOrchestratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkout - happy path', () => {
    it('should execute full saga and return booking', async () => {
      const result = await service.checkout({
        userId: 'user-1',
        listingId: '12345678-1234-1234-1234-123456789012',
        startDate: tomorrow,
        endDate: nextWeek,
        guestCount: 2,
        paymentMethod: 'esewa',
        country: 'NP',
        currency: 'NPR',
      });

      expect(result).toBeDefined();
      expect(result.bookingId).toBe('booking-1');
      expect(result.paymentTransactionId).toBe('tx-123');
      expect(policyService.validateBooking).toHaveBeenCalled();
      expect(fraudService.analyzeRisk).toHaveBeenCalled();
      expect(cache.setNx).toHaveBeenCalled();
      expect(availabilityService.checkRealTimeAvailability).toHaveBeenCalled();
      expect(taxService.calculateTax).toHaveBeenCalled();
      expect(paymentService.authorize).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('booking.created', expect.any(Object));
    });
  });

  describe('checkout - policy violation', () => {
    it('should abort if policy validation fails', async () => {
      policyService.validateBooking.mockResolvedValue({
        valid: false,
        violations: ['Exceeds max booking days'],
      });

      await expect(
        service.checkout({
          userId: 'user-1',
          listingId: '12345678-1234-1234-1234-123456789012',
          startDate: tomorrow,
          endDate: nextWeek,
          guestCount: 2,
          paymentMethod: 'esewa',
          country: 'NP',
          currency: 'NPR',
        }),
      ).rejects.toThrow();

      expect(paymentService.authorize).not.toHaveBeenCalled();
    });
  });

  describe('checkout - fraud block', () => {
    it('should abort if fraud assessment blocks', async () => {
      fraudService.analyzeRisk.mockResolvedValue({
        riskScore: 90,
        decision: 'BLOCK',
        overallRisk: 90,
        signals: ['high_risk_device'],
      });

      await expect(
        service.checkout({
          userId: 'user-1',
          listingId: '12345678-1234-1234-1234-123456789012',
          startDate: tomorrow,
          endDate: nextWeek,
          guestCount: 2,
          paymentMethod: 'esewa',
          country: 'NP',
          currency: 'NPR',
        }),
      ).rejects.toThrow();
    });
  });

  describe('checkout - slot conflict', () => {
    it('should abort if availability check fails', async () => {
      availabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: false,
        blockedDates: [tomorrow],
        confirmedBookings: 1,
        pricePerNight: 3000,
        hasActiveLock: true,
      });

      await expect(
        service.checkout({
          userId: 'user-1',
          listingId: '12345678-1234-1234-1234-123456789012',
          startDate: tomorrow,
          endDate: nextWeek,
          guestCount: 2,
          paymentMethod: 'esewa',
          country: 'NP',
          currency: 'NPR',
        }),
      ).rejects.toThrow();
    });
  });

  describe('refreshLock', () => {
    it('should refresh a lock key', async () => {
      cache.exists = jest.fn().mockResolvedValue(true);
      const result = await service.refreshLock('lock:key:123');
      expect(result).toBe(true);
      expect(cache.set).toHaveBeenCalled();
    });
  });

  describe('releaseLock', () => {
    it('should delete a lock key with prefix', async () => {
      await service.releaseLock('lock:key:123');
      expect(cache.del).toHaveBeenCalledWith(expect.stringContaining('lock:key:123'));
    });
  });
});
