import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService, CreateBookingDto } from './bookings.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { AvailabilityService } from '../../listings/services/availability.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { BookingCalculationService } from './booking-calculation.service';
import { FraudDetectionService } from '../../fraud-detection/services/fraud-detection.service';
import { BookingMode, BookingStatus } from '@rental-portal/database';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InsuranceService } from '../../insurance/services/insurance.service';
import { ContentModerationService } from '../../moderation/services/content-moderation.service';
import { PolicyEngineService } from '../../policy-engine/services/policy-engine.service';
import { ContextResolverService } from '../../policy-engine/services/context-resolver.service';
import { BookingPricingService } from './booking-pricing.service';
import { FxService } from '../../../common/fx/fx.service';
import { ComplianceService } from '@/modules/compliance/compliance.service';
import { ConfigService } from '@nestjs/config';

describe('BookingsService', () => {
  let module: TestingModule;
  let service: BookingsService;
  let prisma: PrismaService;
  let cache: CacheService;
  let availability: AvailabilityService;
  let stateMachine: BookingStateMachineService;
  let calculation: BookingCalculationService;

  const mockPrismaService = {
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    listing: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    booking: {
      create: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockCacheService = {
    publish: jest.fn(),
  };

  const mockAvailabilityService = {
    checkAvailability: jest.fn(),
  };

  const mockStateMachine = {
    transition: jest.fn(),
  };

  const mockCalculationService = {
    calculatePrice: jest.fn(),
    calculateRefund: jest.fn(),
  };

  const mockFraudDetectionService = {
    checkBooking: jest.fn().mockResolvedValue({ score: 0.1, riskLevel: 'low', isAllowed: true }),
    checkUserRisk: jest.fn().mockResolvedValue({ allowBooking: true, reason: null }),
    performBookingFraudCheck: jest.fn().mockResolvedValue({
      allowBooking: true,
      riskScore: 5,
      riskLevel: 'LOW',
      flags: [],
      requiresManualReview: false,
    }),
  };

  const mockComplianceService = {
    evaluateCompliance: jest.fn().mockResolvedValue({
      entityId: 'renter-1',
      entityType: 'USER',
      overallCompliant: true,
      checks: [],
      missingChecks: [],
      expiringChecks: [],
    }),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('false'),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: AvailabilityService,
          useValue: mockAvailabilityService,
        },
        {
          provide: BookingStateMachineService,
          useValue: mockStateMachine,
        },
        {
          provide: BookingCalculationService,
          useValue: mockCalculationService,
        },
        {
          provide: FraudDetectionService,
          useValue: mockFraudDetectionService,
        },
        {
          provide: InsuranceService,
          useValue: {
            checkInsuranceRequirement: jest.fn().mockResolvedValue({ required: false }),
            validateInsurance: jest.fn().mockResolvedValue(true),
            hasValidInsurance: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ContentModerationService,
          useValue: {
            moderateText: jest.fn().mockResolvedValue({ isApproved: true, flags: [] }),
            moderateMessage: jest.fn().mockResolvedValue({ status: 'APPROVED', flags: [] }),
          },
        },
        {
          provide: PolicyEngineService,
          useValue: {
            evaluate: jest.fn().mockResolvedValue({ allowed: true, actions: [] }),
            calculateTax: jest.fn().mockResolvedValue({ totalTax: 0, total: 115 }),
            evaluateBookingConstraints: jest.fn().mockResolvedValue({
              isAllowed: true,
              blockedReasons: [],
              minStay: null,
              maxStay: null,
              requiredDocuments: [],
            }),
          },
        },
        {
          provide: ContextResolverService,
          useValue: {
            resolve: jest.fn().mockResolvedValue({ locale: 'en', currency: 'NPR', country: 'NP' }),
          },
        },
        {
          provide: BookingPricingService,
          useValue: {
            createPriceBreakdown: jest.fn().mockResolvedValue({}),
            getPriceBreakdown: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: FxService,
          useValue: {
            getRate: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: ComplianceService,
          useValue: mockComplianceService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
    availability = module.get<AvailabilityService>(AvailabilityService);
    stateMachine = module.get<BookingStateMachineService>(BookingStateMachineService);
    calculation = module.get<BookingCalculationService>(BookingCalculationService);
    // @ts-ignore
    const fraud = module.get<FraudDetectionService>(FraudDetectionService);

    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  describe('create', () => {
    const createDto: CreateBookingDto = {
      listingId: '12345678-1234-1234-1234-123456789012',
      startDate: new Date('2030-01-01T10:00:00.000Z'),
      endDate: new Date('2030-01-02T10:00:00.000Z'),
      guestCount: 2,
    };

    const mockListing = {
      id: '12345678-1234-1234-1234-123456789012',
      status: 'AVAILABLE',
      ownerId: 'owner-1',
      bookingMode: BookingMode.REQUEST,
      currency: 'USD',
    };

    const mockPricing = {
      subtotal: 100,
      platformFee: 10,
      serviceFee: 5,
      depositAmount: 0,
      total: 115,
      ownerEarnings: 90,
      breakdown: {},
    };

    it('should create a booking successfully', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockAvailabilityService.checkAvailability.mockResolvedValue({ isAvailable: true });
      mockCalculationService.calculatePrice.mockResolvedValue(mockPricing);
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        ...createDto,
      });

      const result = await service.create('renter-1', createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.PENDING_OWNER_APPROVAL,
            renterId: 'renter-1',
          }),
        }),
      );
      expect(mockCacheService.publish).toHaveBeenCalledWith('booking:created', expect.any(Object));
    });

    it('should set status to PENDING_PAYMENT for INSTANT_BOOK', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        ...mockListing,
        bookingMode: BookingMode.INSTANT_BOOK,
      });
      mockAvailabilityService.checkAvailability.mockResolvedValue({ isAvailable: true });
      mockCalculationService.calculatePrice.mockResolvedValue(mockPricing);
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      });

      await service.create('renter-1', createDto);

      expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.PENDING_PAYMENT,
          }),
        }),
      );
    });

    it('should throw BadRequest if listing is not ACTIVE', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({ ...mockListing, status: 'DRAFT' });
      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequest if booking own listing', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({
        ...mockListing,
        ownerId: 'renter-1',
      });
      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequest if dates unavailable', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.booking.findMany.mockResolvedValue([{ id: 'existing-booking' }]);
      mockAvailabilityService.checkAvailability.mockResolvedValue({
        isAvailable: false,
        conflicts: [],
      });
      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);
    });

    it('should flag booking when policy engine constraint evaluation fails', async () => {
      const policyEngine = module.get<PolicyEngineService>(PolicyEngineService);
      (policyEngine.evaluateBookingConstraints as jest.Mock).mockRejectedValueOnce(
        new Error('Policy engine unavailable'),
      );
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockAvailabilityService.checkAvailability.mockResolvedValue({ isAvailable: true });
      mockCalculationService.calculatePrice.mockResolvedValue(mockPricing);
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'booking-flagged',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        ...createDto,
      });

      await service.create('renter-1', createDto);

      expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.stringContaining('constraintEvaluationFailed'),
          }),
        }),
      );
    });

    it('should flag booking when tax calculation fails', async () => {
      const policyEngine = module.get<PolicyEngineService>(PolicyEngineService);
      (policyEngine.calculateTax as jest.Mock).mockRejectedValueOnce(
        new Error('Tax service down'),
      );
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockAvailabilityService.checkAvailability.mockResolvedValue({ isAvailable: true });
      mockCalculationService.calculatePrice.mockResolvedValue(mockPricing);
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'booking-tax-flag',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        ...createDto,
      });

      await service.create('renter-1', createDto);

      expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.stringContaining('taxCalculationFailed'),
          }),
        }),
      );
    });

    it('should throw BadRequest when policy engine blocks the booking', async () => {
      const policyEngine = module.get<PolicyEngineService>(PolicyEngineService);
      (policyEngine.evaluateBookingConstraints as jest.Mock).mockResolvedValueOnce({
        isAllowed: false,
        blockedReasons: [{ reason: 'Minimum age not met' }],
        minStay: null,
        maxStay: null,
        requiredDocuments: [],
      });
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockAvailabilityService.checkAvailability.mockResolvedValue({ isAvailable: true });
      mockCalculationService.calculatePrice.mockResolvedValue(mockPricing);

      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequest when stay duration is below minimum', async () => {
      const policyEngine = module.get<PolicyEngineService>(PolicyEngineService);
      (policyEngine.evaluateBookingConstraints as jest.Mock).mockResolvedValueOnce({
        isAllowed: true,
        blockedReasons: [],
        minStay: 3,
        maxStay: null,
        requiredDocuments: [],
      });
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockAvailabilityService.checkAvailability.mockResolvedValue({ isAvailable: true });
      mockCalculationService.calculatePrice.mockResolvedValue(mockPricing);

      // createDto has 1-day stay (Jan 1 to Jan 2), minStay is 3
      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('create — error handling', () => {
    const createDto: CreateBookingDto = {
      listingId: '12345678-1234-1234-1234-123456789012',
      startDate: new Date('2030-01-01T10:00:00.000Z'),
      endDate: new Date('2030-01-02T10:00:00.000Z'),
      guestCount: 2,
    };

    const mockListing = {
      id: '12345678-1234-1234-1234-123456789012',
      status: 'AVAILABLE',
      ownerId: 'owner-1',
      bookingMode: BookingMode.REQUEST,
      currency: 'USD',
    };

    const mockPricing = {
      subtotal: 100,
      platformFee: 10,
      serviceFee: 5,
      depositAmount: 0,
      total: 115,
      ownerEarnings: 90,
      breakdown: {},
    };

    it('should propagate database transaction failure', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockAvailabilityService.checkAvailability.mockResolvedValue({ isAvailable: true });
      mockCalculationService.calculatePrice.mockResolvedValue(mockPricing);
      mockPrismaService.$transaction.mockRejectedValueOnce(
        new Error('Connection lost during transaction'),
      );

      await expect(service.create('renter-1', createDto)).rejects.toThrow(
        'Connection lost during transaction',
      );
    });

    it('should throw when fraud detection blocks user', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockAvailabilityService.checkAvailability.mockResolvedValue({ isAvailable: true });
      mockCalculationService.calculatePrice.mockResolvedValue(mockPricing);
      mockFraudDetectionService.performBookingFraudCheck.mockResolvedValueOnce({
        allowBooking: false,
        riskScore: 90,
        riskLevel: 'HIGH',
        flags: [{ type: 'SUSPICIOUS_ACTIVITY' }],
        requiresManualReview: true,
      });

      await expect(service.create('renter-1', createDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw for invalid date strings', async () => {
      await expect(
        service.create('renter-1', {
          listingId: '12345678-1234-1234-1234-123456789012',
          startDate: 'not-a-date' as any,
          endDate: '2030-01-02' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when end date is before start date', async () => {
      await expect(
        service.create('renter-1', {
          listingId: '12345678-1234-1234-1234-123456789012',
          startDate: new Date('2030-01-05'),
          endDate: new Date('2030-01-01'),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveBooking', () => {
    it('should transition state if owner approves', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        listing: { ownerId: 'owner-1' },
      });

      await service.approveBooking('booking-1', 'owner-1');

      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        'booking-1',
        'OWNER_APPROVE',
        'owner-1',
        'OWNER',
      );
    });

    it('should throw Forbidden if not owner', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        listing: { ownerId: 'owner-1' },
      });

      await expect(service.approveBooking('booking-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('cancelBooking', () => {
    it('should calculate refund and transition state', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        renterId: 'renter-1',
        listing: { ownerId: 'owner-1' },
        status: BookingStatus.CONFIRMED, // Ensure status is valid for cancellation if logic checks it (Service doesn't check status explicitly before transition call, state machine does)
      });
      mockCalculationService.calculateRefund.mockResolvedValue({ amount: 50 });

      await service.cancelBooking('booking-1', 'renter-1', 'Changed mind');

      expect(mockCalculationService.calculateRefund).toHaveBeenCalled();
      expect(mockStateMachine.transition).toHaveBeenCalledWith(
        'booking-1',
        'CANCEL',
        'renter-1',
        'RENTER',
        expect.objectContaining({ reason: 'Changed mind', refund: { amount: 50 } }),
      );
    });
  });

  describe('create — safety-check fail-closed behavior', () => {
    const createDto: CreateBookingDto = {
      listingId: '12345678-1234-1234-1234-123456789012',
      startDate: new Date('2030-01-01T10:00:00.000Z'),
      endDate: new Date('2030-01-02T10:00:00.000Z'),
      guestCount: 2,
    };

    const mockListing = {
      id: '12345678-1234-1234-1234-123456789012',
      status: 'AVAILABLE',
      ownerId: 'owner-1',
      bookingMode: BookingMode.REQUEST,
      currency: 'USD',
      country: 'NP',
      state: null,
      city: null,
      address: '{}',
    };

    const mockPricing = {
      subtotal: 100,
      platformFee: 10,
      serviceFee: 5,
      depositAmount: 0,
      total: 115,
      ownerEarnings: 90,
      breakdown: {},
    };

    beforeEach(() => {
      mockPrismaService.listing.findUnique.mockResolvedValue(mockListing);
      mockAvailabilityService.checkAvailability.mockResolvedValue({ isAvailable: true });
      mockCalculationService.calculatePrice.mockResolvedValue(mockPricing);
      mockConfigService.get.mockReturnValue('false'); // default = fail-closed
    });

    it('should block booking when compliance service throws (fail-closed)', async () => {
      mockComplianceService.evaluateCompliance.mockRejectedValueOnce(
        new Error('Compliance service unavailable'),
      );

      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);

      // Verify booking was NOT created on first call
      expect(mockPrismaService.booking.create).not.toHaveBeenCalled();
    });

    it('should block booking when fraud service throws (fail-closed)', async () => {
      mockFraudDetectionService.performBookingFraudCheck.mockRejectedValueOnce(
        new Error('Fraud service unavailable'),
      );

      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.booking.create).not.toHaveBeenCalled();
    });

    it('should include SAFETY_CHECK_UNAVAILABLE code when critical check fails', async () => {
      mockFraudDetectionService.performBookingFraudCheck.mockRejectedValueOnce(
        new Error('Fraud service down'),
      );

      try {
        await service.create('renter-1', createDto);
        fail('Expected BadRequestException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = error.getResponse();
        expect(response.code).toBe('SAFETY_CHECK_UNAVAILABLE');
        expect(response.check).toBe('fraud');
      }
    });

    it('should block booking when insurance service throws (fail-closed)', async () => {
      const insuranceService = module.get<InsuranceService>(InsuranceService);
      (insuranceService.checkInsuranceRequirement as jest.Mock).mockRejectedValueOnce(
        new Error('Insurance service unavailable'),
      );

      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.booking.create).not.toHaveBeenCalled();
    });

    it('should NOT block booking when moderation service throws (not critical)', async () => {
      const moderationService = module.get<ContentModerationService>(ContentModerationService);
      (moderationService.moderateMessage as jest.Mock).mockRejectedValueOnce(
        new Error('Moderation service down'),
      );
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        ...createDto,
      });

      // moderation is not in CRITICAL_SAFETY_CHECKS, so booking should proceed
      const result = await service.create('renter-1', {
        ...createDto,
        message: 'Hello this is a test message',
      } as any);

      expect(result).toBeDefined();
      expect(mockPrismaService.booking.create).toHaveBeenCalled();
    });

    it('should allow booking in degraded mode when SAFETY_CHECKS_FAIL_OPEN=true', async () => {
      mockConfigService.get.mockReturnValue('true'); // fail-open mode
      mockComplianceService.evaluateCompliance.mockRejectedValueOnce(
        new Error('Compliance service unavailable'),
      );
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'booking-degraded',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        ...createDto,
      });

      // Even critical checks should not block when fail-open is enabled
      const result = await service.create('renter-1', createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.booking.create).toHaveBeenCalled();
    });

    it('should flag safety checks skipped in degraded mode', async () => {
      // Must differentiate keys: STRIPE_TEST_BYPASS=false (so fraud check runs),
      // SAFETY_CHECKS_FAIL_OPEN=true (so failures are flagged, not blocked).
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_TEST_BYPASS') return 'false';
        return 'true'; // SAFETY_CHECKS_FAIL_OPEN and any other key
      });
      mockFraudDetectionService.performBookingFraudCheck.mockRejectedValueOnce(
        new Error('Fraud service unavailable'),
      );
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'booking-flagged',
        status: BookingStatus.PENDING_OWNER_APPROVAL,
        ...createDto,
      });

      await service.create('renter-1', createDto);

      expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.stringContaining('fraud'),
          }),
        }),
      );
    });

    it('should still throw when fraud detection explicitly blocks user', async () => {
      mockFraudDetectionService.performBookingFraudCheck.mockResolvedValueOnce({
        allowBooking: false,
        riskScore: 95,
        riskLevel: 'CRITICAL',
        flags: [{ type: 'velocity', severity: 'CRITICAL', description: 'Too many bookings' }],
        requiresManualReview: true,
      });

      await expect(service.create('renter-1', createDto)).rejects.toThrow(ForbiddenException);
    });

    it('should still throw when compliance explicitly blocks non-compliant renter', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValueOnce({
        entityId: 'renter-1',
        entityType: 'USER',
        overallCompliant: false,
        checks: [],
        missingChecks: ['ID_VERIFICATION', 'ADDRESS_PROOF'],
        expiringChecks: [],
      });

      await expect(service.create('renter-1', createDto)).rejects.toThrow(BadRequestException);
    });
  });
});
