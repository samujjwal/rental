import { Test, TestingModule } from '@nestjs/testing';
import { DemandForecastingService } from './demand-forecasting.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('DemandForecastingService', () => {
  let service: DemandForecastingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      demandSignal: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ds-1', ...data })),
        findMany: jest.fn().mockResolvedValue([
          { id: 'ds-1', country: 'NP', signalType: 'SEARCH', signalValue: 100, date: new Date() },
          { id: 'ds-2', country: 'NP', signalType: 'BOOKING', signalValue: 50, date: new Date(Date.now() - 86400000) },
          { id: 'ds-3', country: 'NP', signalType: 'SEARCH', signalValue: 80, date: new Date(Date.now() - 172800000) },
        ]),
      },
      demandForecast: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'df-1', ...create })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      booking: {
        count: jest.fn().mockResolvedValue(90),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemandForecastingService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<DemandForecastingService>(DemandForecastingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordSignal', () => {
    it('should record a demand signal', async () => {
      const result = await service.recordSignal({
        country: 'NP',
        signalType: 'SEARCH',
        signalValue: 100,
      });
      expect(result).toBeDefined();
      expect(prisma.demandSignal.create).toHaveBeenCalled();
    });
  });

  describe('generateForecast', () => {
    it('should generate a demand forecast', async () => {
      const result = await service.generateForecast('NP', '7d');
      expect(result).toBeDefined();
      expect(result.predictedDemand).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(prisma.demandForecast.upsert).toHaveBeenCalled();
    });

    it('should apply seasonal factor', async () => {
      const result = await service.generateForecast('NP', '30d');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('computeSeasonalFactor', () => {
    it('should return high factor for peak season (Oct-Nov)', () => {
      const factor = service.computeSeasonalFactor(10);
      expect(factor).toBeGreaterThan(1.0);
    });

    it('should return low factor for monsoon (Jun-Aug)', () => {
      const factor = service.computeSeasonalFactor(7);
      expect(factor).toBeLessThan(1.0);
    });
  });

  describe('backtestAccuracy', () => {
    it('should return accuracy metrics', async () => {
      prisma.demandForecast.findMany.mockResolvedValue([
        { predictedDemand: 100, actualDemand: 90, forecastDate: new Date() },
        { predictedDemand: 80, actualDemand: 85, forecastDate: new Date() },
      ]);
      const result = await service.backtestAccuracy('NP', 30);
      expect(result).toBeDefined();
      expect(result.mape).toBeGreaterThanOrEqual(0);
    });
  });
});
