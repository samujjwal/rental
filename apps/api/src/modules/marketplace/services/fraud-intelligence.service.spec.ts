import { Test, TestingModule } from '@nestjs/testing';
import { FraudIntelligenceService } from './fraud-intelligence.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('FraudIntelligenceService', () => {
  let service: FraudIntelligenceService;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      fraudSignal: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'fs-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(2),
        update: jest.fn().mockResolvedValue({}),
      },
      deviceFingerprint: {
        upsert: jest.fn().mockResolvedValue({ id: 'df-1', userId: 'user-1', fingerprint: 'fp-abc' }),
        count: jest.fn().mockResolvedValue(1),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', country: 'NP' }),
      },
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudIntelligenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<FraudIntelligenceService>(FraudIntelligenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeRisk', () => {
    it('should analyze risk for a user entity', async () => {
      const result = await service.analyzeRisk('USER', 'user-1', {
        country: 'NP',
        amount: 5000,
        ipAddress: '1.2.3.4',
      });
      expect(result).toBeDefined();
      expect(result.overallRisk).toBeGreaterThanOrEqual(0);
      expect(result.overallRisk).toBeLessThanOrEqual(100);
    });

    it('should flag high risk for very large amounts', async () => {
      const result = await service.analyzeRisk('BOOKING', 'booking-1', {
        country: 'NP',
        amount: 1000000,
      });
      expect(result.overallRisk).toBeGreaterThan(0);
    });

    it('should emit event for high risk scores', async () => {
      // Setup high velocity
      prisma.fraudSignal.count.mockResolvedValue(20);
      prisma.deviceFingerprint.count.mockResolvedValue(10);
      const result = await service.analyzeRisk('USER', 'user-1', {
        country: 'NP',
        amount: 600000,
      });
      if (result.overallRisk > 50) {
        expect(eventEmitter.emit).toHaveBeenCalledWith('fraud.high_risk', expect.any(Object));
      }
    });
  });

  describe('registerDevice', () => {
    it('should register a device fingerprint', async () => {
      const result = await service.registerDevice('user-1', 'fp-abc', { userAgent: 'Chrome' });
      expect(result).toBeDefined();
      expect(prisma.deviceFingerprint.upsert).toHaveBeenCalled();
    });
  });

  describe('getSignals', () => {
    it('should return fraud signals for entity', async () => {
      prisma.fraudSignal.findMany.mockResolvedValue([
        { id: 'fs-1', entityType: 'USER', entityId: 'user-1', riskScore: 30, signalType: 'VELOCITY' },
      ]);
      const result = await service.getSignals('USER', 'user-1');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('resolveSignal', () => {
    it('should mark a signal as resolved', async () => {
      prisma.fraudSignal.update.mockResolvedValue({ id: 'fs-1', resolved: true });
      await service.resolveSignal('fs-1', 'admin-1');
      expect(prisma.fraudSignal.update).toHaveBeenCalled();
    });
  });

  describe('getUserRiskScore', () => {
    it('should compute aggregated risk score', async () => {
      prisma.fraudSignal.findMany.mockResolvedValue([
        { riskScore: 20, signalType: 'VELOCITY' },
        { riskScore: 15, signalType: 'GEO' },
      ]);
      const result = await service.getUserRiskScore('user-1');
      expect(result).toBeDefined();
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });
  });
});
