import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityController } from './availability.controller';
import { AvailabilityGraphService } from '../services/availability-graph.service';

describe('AvailabilityController', () => {
  let controller: AvailabilityController;
  let service: jest.Mocked<AvailabilityGraphService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [
        {
          provide: AvailabilityGraphService,
          useValue: {
            checkRealTimeAvailability: jest.fn(),
            bulkCheckAvailability: jest.fn(),
            getCalendarHeatmap: jest.fn(),
            reserveSlot: jest.fn(),
            getOccupancyStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AvailabilityController);
    service = module.get(AvailabilityGraphService) as jest.Mocked<AvailabilityGraphService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── checkAvailability ──

  describe('checkAvailability', () => {
    it('delegates to service with correct date conversion', async () => {
      const dto = { listingId: 'l1', startDate: '2026-04-01', endDate: '2026-04-05' };
      service.checkRealTimeAvailability.mockResolvedValue({ available: true } as any);

      const result = await controller.checkAvailability(dto as any);

      expect(service.checkRealTimeAvailability).toHaveBeenCalledWith(
        'l1',
        new Date('2026-04-01'),
        new Date('2026-04-05'),
      );
      expect(result).toEqual({ available: true });
    });

    it('propagates service error', async () => {
      service.checkRealTimeAvailability.mockRejectedValue(new Error('Listing not found'));
      await expect(controller.checkAvailability({ listingId: 'bad' } as any)).rejects.toThrow('Listing not found');
    });
  });

  // ── bulkCheck ──

  describe('bulkCheck', () => {
    it('converts Map result to plain object', async () => {
      const dto = { listingIds: ['l1', 'l2'], startDate: '2026-04-01', endDate: '2026-04-05' };
      const mapResult = new Map([
        ['l1', { available: true }],
        ['l2', { available: false }],
      ]);
      service.bulkCheckAvailability.mockResolvedValue(mapResult as any);

      const result = await controller.bulkCheck(dto as any);

      expect(service.bulkCheckAvailability).toHaveBeenCalledWith(
        ['l1', 'l2'],
        new Date('2026-04-01'),
        new Date('2026-04-05'),
      );
      expect(result).toEqual({ l1: { available: true }, l2: { available: false } });
    });

    it('propagates service error', async () => {
      service.bulkCheckAvailability.mockRejectedValue(new Error('Too many listings'));
      await expect(controller.bulkCheck({ listingIds: [] } as any)).rejects.toThrow('Too many listings');
    });
  });

  // ── getCalendarHeatmap ──

  describe('getCalendarHeatmap', () => {
    it('delegates query params to service', async () => {
      const query = { listingId: 'l1', year: 2026, month: 4 };
      service.getCalendarHeatmap.mockResolvedValue([{ day: 1, booked: true }] as any);

      const result = await controller.getCalendarHeatmap(query as any);

      expect(service.getCalendarHeatmap).toHaveBeenCalledWith('l1', 2026, 4);
      expect(result).toEqual([{ day: 1, booked: true }]);
    });
  });

  // ── reserveSlot ──

  describe('reserveSlot', () => {
    it('spreads dto and adds userId with date conversion', async () => {
      const dto = { listingId: 'l1', startDate: '2026-04-01', endDate: '2026-04-03' };
      service.reserveSlot.mockResolvedValue({ lockKey: 'lock-1' } as any);

      const result = await controller.reserveSlot('u1', dto as any);

      expect(service.reserveSlot).toHaveBeenCalledWith({
        ...dto,
        userId: 'u1',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-03'),
      });
      expect(result).toEqual({ lockKey: 'lock-1' });
    });

    it('propagates conflict error', async () => {
      service.reserveSlot.mockRejectedValue(new Error('Slot already booked'));
      await expect(controller.reserveSlot('u1', {} as any)).rejects.toThrow('Slot already booked');
    });
  });

  // ── getOccupancy ──

  describe('getOccupancy', () => {
    it('delegates to service with default days', async () => {
      service.getOccupancyStats.mockResolvedValue({ occupancyRate: 0.75 } as any);

      const result = await controller.getOccupancy('l1');

      expect(service.getOccupancyStats).toHaveBeenCalledWith('l1', 90);
      expect(result).toEqual({ occupancyRate: 0.75 });
    });

    it('passes custom days param', async () => {
      service.getOccupancyStats.mockResolvedValue({ occupancyRate: 0.5 } as any);

      const result = await controller.getOccupancy('l1', 30);

      expect(service.getOccupancyStats).toHaveBeenCalledWith('l1', 30);
      expect(result).toEqual({ occupancyRate: 0.5 });
    });
  });
});
