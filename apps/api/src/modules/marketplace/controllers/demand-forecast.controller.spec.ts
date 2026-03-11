import { Test, TestingModule } from '@nestjs/testing';
import { DemandForecastController } from './demand-forecast.controller';
import { DemandForecastingService } from '../services/demand-forecasting.service';

describe('DemandForecastController', () => {
  let controller: DemandForecastController;
  let service: jest.Mocked<DemandForecastingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DemandForecastController],
      providers: [
        {
          provide: DemandForecastingService,
          useValue: {
            recordSignal: jest.fn(),
            generateForecast: jest.fn(),
            getForecasts: jest.fn(),
            backtestAccuracy: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(DemandForecastController);
    service = module.get(DemandForecastingService) as jest.Mocked<DemandForecastingService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── recordSignal ──

  describe('recordSignal', () => {
    it('spreads dto and converts date string to Date', async () => {
      const dto = { type: 'search', country: 'NP', date: '2026-04-01', value: 10 };
      service.recordSignal.mockResolvedValue({ id: 'sig1' } as any);

      const result = await controller.recordSignal(dto as any);

      expect(service.recordSignal).toHaveBeenCalledWith({
        ...dto,
        date: new Date('2026-04-01'),
      });
      expect(result).toEqual({ id: 'sig1' });
    });

    it('passes undefined date when not provided', async () => {
      const dto = { type: 'search', country: 'NP', value: 5 };
      service.recordSignal.mockResolvedValue({ id: 'sig2' } as any);

      await controller.recordSignal(dto as any);

      expect(service.recordSignal).toHaveBeenCalledWith({
        ...dto,
        date: undefined,
      });
    });

    it('propagates service error', async () => {
      service.recordSignal.mockRejectedValue(new Error('Invalid signal'));
      await expect(controller.recordSignal({} as any)).rejects.toThrow('Invalid signal');
    });
  });

  // ── generateForecast ──

  describe('generateForecast', () => {
    it('delegates all query params to service', async () => {
      const query = { country: 'NP', horizon: 'monthly', region: 'kathmandu', category: 'apartment' };
      service.generateForecast.mockResolvedValue({ forecast: [100, 120] } as any);

      const result = await controller.generateForecast(query as any);

      expect(service.generateForecast).toHaveBeenCalledWith('NP', 'monthly', 'kathmandu', 'apartment');
      expect(result).toEqual({ forecast: [100, 120] });
    });

    it('handles optional region and category', async () => {
      const query = { country: 'IN', horizon: 'weekly' };
      service.generateForecast.mockResolvedValue({ forecast: [] } as any);

      await controller.generateForecast(query as any);

      expect(service.generateForecast).toHaveBeenCalledWith('IN', 'weekly', undefined, undefined);
    });
  });

  // ── getForecasts ──

  describe('getForecasts', () => {
    it('delegates country and optional horizon', async () => {
      service.getForecasts.mockResolvedValue([{ id: 'f1' }] as any);

      const result = await controller.getForecasts('NP', 'monthly');

      expect(service.getForecasts).toHaveBeenCalledWith('NP', 'monthly');
      expect(result).toEqual([{ id: 'f1' }]);
    });

    it('passes undefined horizon when not provided', async () => {
      service.getForecasts.mockResolvedValue([] as any);

      await controller.getForecasts('NP');

      expect(service.getForecasts).toHaveBeenCalledWith('NP', undefined);
    });
  });

  // ── backtestAccuracy ──

  describe('backtestAccuracy', () => {
    it('delegates query params to service', async () => {
      const query = { country: 'NP', days: 90 };
      service.backtestAccuracy.mockResolvedValue({ accuracy: 0.87 } as any);

      const result = await controller.backtestAccuracy(query as any);

      expect(service.backtestAccuracy).toHaveBeenCalledWith('NP', 90);
      expect(result).toEqual({ accuracy: 0.87 });
    });

    it('propagates service error', async () => {
      service.backtestAccuracy.mockRejectedValue(new Error('Insufficient data'));
      await expect(controller.backtestAccuracy({ country: 'NP', days: 7 } as any)).rejects.toThrow(
        'Insufficient data',
      );
    });
  });
});
