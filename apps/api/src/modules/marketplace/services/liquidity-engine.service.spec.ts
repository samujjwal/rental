import { Test, TestingModule } from '@nestjs/testing';
import { LiquidityEngineService } from './liquidity-engine.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

describe('LiquidityEngineService', () => {
  let service: LiquidityEngineService;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      listing: { count: jest.fn().mockResolvedValue(100) },
      booking: { count: jest.fn().mockResolvedValue(40), findMany: jest.fn().mockResolvedValue([]) },
      user: { count: jest.fn().mockResolvedValue(500) },
      searchEvent: { count: jest.fn().mockResolvedValue(200) },
      marketplaceHealthMetric: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'mhm-1', ...create })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      hostActivationCampaign: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'hac-1', ...data })),
      },
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidityEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('NP') } },
      ],
    }).compile();

    service = module.get<LiquidityEngineService>(LiquidityEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateHealthMetrics', () => {
    it('should calculate and persist health metrics for a country', async () => {
      const result = await service.calculateHealthMetrics('NP');
      expect(result).toBeDefined();
      expect(result.supplyCount).toBe(100);
      expect(result.bookingCount).toBe(40);
      expect(prisma.marketplaceHealthMetric.upsert).toHaveBeenCalled();
    });

    it('should calculate liquidity score between 0-100', async () => {
      const result = await service.calculateHealthMetrics('NP');
      expect(result.liquidityScore).toBeGreaterThanOrEqual(0);
      expect(result.liquidityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('computeLiquidityScore', () => {
    it('should return high score for ideal ratio and occupancy', () => {
      const score = service.computeLiquidityScore(4.0, 0.7);
      expect(score).toBeGreaterThan(70);
    });

    it('should return lower score for poor metrics', () => {
      const score = service.computeLiquidityScore(0.1, 0.05);
      expect(score).toBeLessThan(50);
    });
  });

  describe('identifySupplyGaps', () => {
    it('should return regions with low supply', async () => {
      prisma.marketplaceHealthMetric.findMany.mockResolvedValue([
        { country: 'NP', region: 'Kathmandu', liquidityScore: 30 },
      ]);
      const gaps = await service.identifySupplyGaps(50);
      expect(gaps).toHaveLength(1);
    });
  });

  describe('createActivationCampaign', () => {
    it('should create a campaign and emit event', async () => {
      const result = await service.createActivationCampaign({
        name: 'Test Campaign',
        country: 'NP',
        targetSegment: 'new_hosts',
        strategy: 'BONUS',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        budget: 5000,
      });
      expect(result).toBeDefined();
      expect(prisma.hostActivationCampaign.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('marketplace.campaign.created', expect.any(Object));
    });
  });
});
