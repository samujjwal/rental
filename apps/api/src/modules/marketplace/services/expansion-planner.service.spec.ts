import { Test, TestingModule } from '@nestjs/testing';
import { ExpansionPlannerService } from './expansion-planner.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ExpansionPlannerService', () => {
  let service: ExpansionPlannerService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      marketOpportunity: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'mo-1', ...create })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      expansionSimulation: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'es-1', ...data })),
      },
      countryPolicyPack: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      countryConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      taxPolicy: {
        count: jest.fn().mockResolvedValue(0),
      },
      paymentProvider: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpansionPlannerService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ExpansionPlannerService>(ExpansionPlannerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateMarket', () => {
    it('should evaluate Nepal market', async () => {
      const result = await service.evaluateMarket('NP');
      expect(result).toBeDefined();
      expect(result.country).toBe('NP');
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should evaluate India market', async () => {
      const result = await service.evaluateMarket('IN');
      expect(result).toBeDefined();
      expect(result.country).toBe('IN');
    });

    it('should return default scores for unknown countries', async () => {
      const result = await service.evaluateMarket('XX');
      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('simulateExpansion', () => {
    it('should create an expansion simulation', async () => {
      const result = await service.simulateExpansion('NP');
      expect(result).toBeDefined();
      expect(prisma.expansionSimulation.create).toHaveBeenCalled();
    });
  });

  describe('getRankedOpportunities', () => {
    it('should return opportunities sorted by score', async () => {
      prisma.marketOpportunity.findMany.mockResolvedValue([
        { country: 'NP', overallScore: 80 },
        { country: 'IN', overallScore: 70 },
      ]);
      const result = await service.getRankedOpportunities();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
