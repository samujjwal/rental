import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceService } from './compliance.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventsService } from '@/common/events/events.service';
import { CacheService } from '@/common/cache/cache.service';
import { PolicyEngineService } from '../policy-engine/services/policy-engine.service';

describe('ComplianceService', () => {
  let service: ComplianceService;
  let prisma: any;
  let events: any;
  let cache: any;
  let policyEngine: any;

  beforeEach(async () => {
    prisma = {
      complianceRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    events = {
      emitComplianceCheck: jest.fn(),
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    policyEngine = {
      evaluate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: events },
        { provide: CacheService, useValue: cache },
        { provide: PolicyEngineService, useValue: policyEngine },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRequiredChecks', () => {
    it('should return requirements from policy engine REQUIRE_DOCUMENT actions', async () => {
      policyEngine.evaluate.mockResolvedValue({
        matched: true,
        fallbackUsed: false,
        actions: [
          {
            type: 'REQUIRE_DOCUMENT',
            params: { documentType: 'IDENTITY_VERIFICATION', label: 'ID Required', validityDays: 365, blockOnFailure: true },
          },
          {
            type: 'REQUIRE_DOCUMENT',
            params: { documentType: 'TAX_REGISTRATION', label: 'Tax ID', validityDays: 365 },
          },
        ],
        appliedRules: [],
        eliminatedRules: [],
      });

      const requirements = await service.getRequiredChecks(
        {
          locale: 'en', country: 'DE', state: null, city: null, timezone: 'UTC',
          currency: 'EUR', userId: 'user-1', userRole: 'USER', userCountry: 'DE',
          listingId: null, listingCategory: null, listingCountry: 'DE',
          listingState: null, listingCity: null, bookingValue: null,
          bookingDuration: null, bookingCurrency: null, startDate: null,
          endDate: null, guestCount: null, hostPresent: null,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString().split('T')[0],
          ipCountry: null, platform: 'web',
        } as any,
        'USER',
      );

      expect(requirements).toHaveLength(2);
      expect(requirements[0].checkType).toBe('IDENTITY_VERIFICATION');
      expect(requirements[1].checkType).toBe('TAX_REGISTRATION');
    });

    it('should return default requirements when no policies match', async () => {
      policyEngine.evaluate.mockResolvedValue({
        matched: false,
        fallbackUsed: true,
        actions: [],
        appliedRules: [],
        eliminatedRules: [],
      });

      const requirements = await service.getRequiredChecks(
        {
          locale: 'en', country: 'XX', state: null, city: null, timezone: 'UTC',
          currency: 'USD', userId: null, userRole: 'USER', userCountry: null,
          listingId: null, listingCategory: null, listingCountry: null,
          listingState: null, listingCity: null, bookingValue: null,
          bookingDuration: null, bookingCurrency: null, startDate: null,
          endDate: null, guestCount: null, hostPresent: null,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString().split('T')[0],
          ipCountry: null, platform: 'web',
        } as any,
        'USER',
      );

      expect(requirements).toHaveLength(2);
      expect(requirements.map((r) => r.checkType)).toContain('IDENTITY_VERIFICATION');
      expect(requirements.map((r) => r.checkType)).toContain('AGE_VERIFICATION');
    });
  });

  describe('evaluateCompliance', () => {
    it('should create PENDING records for missing checks', async () => {
      policyEngine.evaluate.mockResolvedValue({
        matched: true,
        fallbackUsed: false,
        actions: [
          {
            type: 'REQUIRE_DOCUMENT',
            params: { documentType: 'IDENTITY_VERIFICATION', label: 'ID check' },
          },
        ],
        appliedRules: [],
        eliminatedRules: [],
      });
      prisma.complianceRecord.findMany.mockResolvedValue([]);
      prisma.complianceRecord.create.mockResolvedValue({
        id: 'cr-1',
        entityId: 'user-1',
        entityType: 'USER',
        checkType: 'IDENTITY_VERIFICATION',
        status: 'PENDING',
        expiresAt: null,
        result: {},
      });

      const result = await service.evaluateCompliance('user-1', 'USER', 'DE');

      expect(result.overallCompliant).toBe(false);
      expect(result.missingChecks).toContain('IDENTITY_VERIFICATION');
      expect(prisma.complianceRecord.create).toHaveBeenCalled();
      expect(events.emitComplianceCheck).toHaveBeenCalled();
    });

    it('should recognize passed checks as compliant', async () => {
      policyEngine.evaluate.mockResolvedValue({
        matched: true,
        fallbackUsed: false,
        actions: [
          {
            type: 'REQUIRE_DOCUMENT',
            params: { documentType: 'IDENTITY_VERIFICATION', label: 'ID check' },
          },
        ],
        appliedRules: [],
        eliminatedRules: [],
      });
      prisma.complianceRecord.findMany.mockResolvedValue([
        {
          id: 'cr-1',
          entityId: 'user-1',
          entityType: 'USER',
          checkType: 'IDENTITY_VERIFICATION',
          status: 'PASSED',
          expiresAt: null,
          result: {},
        },
      ]);

      const result = await service.evaluateCompliance('user-1', 'USER', 'DE');

      expect(result.overallCompliant).toBe(true);
      expect(result.missingChecks).toHaveLength(0);
    });

    it('should detect expired checks', async () => {
      policyEngine.evaluate.mockResolvedValue({
        matched: true,
        fallbackUsed: false,
        actions: [
          {
            type: 'REQUIRE_DOCUMENT',
            params: { documentType: 'TAX_REGISTRATION', label: 'Tax ID', validityDays: 365 },
          },
        ],
        appliedRules: [],
        eliminatedRules: [],
      });
      prisma.complianceRecord.findMany.mockResolvedValue([
        {
          id: 'cr-2',
          entityId: 'user-1',
          entityType: 'USER',
          checkType: 'TAX_REGISTRATION',
          status: 'PASSED',
          expiresAt: new Date('2020-01-01'), // Expired
          result: {},
        },
      ]);
      prisma.complianceRecord.update.mockResolvedValue({});

      const result = await service.evaluateCompliance('user-1', 'USER', 'DE');

      expect(result.overallCompliant).toBe(false);
      expect(result.missingChecks).toContain('TAX_REGISTRATION');
    });
  });

  describe('updateCheckStatus', () => {
    it('should update compliance check status', async () => {
      prisma.complianceRecord.findFirst.mockResolvedValue({
        id: 'cr-1',
        entityId: 'user-1',
        entityType: 'USER',
        checkType: 'IDENTITY_VERIFICATION',
        status: 'PENDING',
        expiresAt: null,
        result: {},
        country: 'DE',
      });
      prisma.complianceRecord.update.mockResolvedValue({
        id: 'cr-1',
        status: 'PASSED',
        expiresAt: null,
        result: { verifiedBy: 'admin' },
        country: 'DE',
      });

      const result = await service.updateCheckStatus(
        'user-1', 'USER', 'IDENTITY_VERIFICATION', 'PASSED',
        { verifiedBy: 'admin' },
      );

      expect(result.status).toBe('PASSED');
      expect(result.isCompliant).toBe(true);
      expect(events.emitComplianceCheck).toHaveBeenCalled();
    });

    it('should throw if record not found', async () => {
      prisma.complianceRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCheckStatus('user-1', 'USER', 'IDENTITY_VERIFICATION', 'PASSED'),
      ).rejects.toThrow();
    });
  });

  describe('findExpiringRecords', () => {
    it('should find records expiring within N days', async () => {
      prisma.complianceRecord.findMany.mockResolvedValue([
        { id: 'cr-1', expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
      ]);

      const results = await service.findExpiringRecords(30);
      expect(results).toHaveLength(1);
    });
  });
});
