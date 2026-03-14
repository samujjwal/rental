import { Test, TestingModule } from '@nestjs/testing';
import { DisputesController } from './disputes.controller';
import { DisputesService } from '../services/disputes.service';
import { DisputeEscalationService } from '../services/dispute-escalation.service';

describe('DisputesController', () => {
  let controller: DisputesController;
  let service: jest.Mocked<DisputesService>;

  const mockDispute = { id: 'd1', status: 'OPEN', bookingId: 'b1' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputesController],
      providers: [
        {
          provide: DisputesService,
          useValue: {
            createDispute: jest.fn(),
            getUserDisputes: jest.fn(),
            getAllDisputes: jest.fn(),
            getDisputeStats: jest.fn(),
            getDispute: jest.fn(),
            addResponse: jest.fn(),
            updateDispute: jest.fn(),
            closeDispute: jest.fn(),
          },
        },
        {
          provide: DisputeEscalationService,
          useValue: {
            escalateDispute: jest.fn(),
            getEscalationHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(DisputesController);
    service = module.get(DisputesService) as jest.Mocked<DisputesService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── createDispute ──
  describe('createDispute', () => {
    it('delegates to service with userId and dto', async () => {
      service.createDispute.mockResolvedValue(mockDispute as any);
      const dto = { bookingId: 'b1', reason: 'Damaged item' } as any;
      const result = await controller.createDispute('u1', dto);
      expect(service.createDispute).toHaveBeenCalledWith('u1', {
        ...dto,
        type: 'Damaged item',
        amount: undefined,
        title: 'Damaged item',
        evidence: undefined,
      });
      expect(result).toMatchObject({ id: 'd1', status: 'OPEN', bookingId: 'b1' });
    });
  });

  // ── getUserDisputes ──
  describe('getUserDisputes', () => {
    it('parses pagination and status', async () => {
      service.getUserDisputes.mockResolvedValue([] as any);
      await controller.getUserDisputes('u1', 'OPEN' as any, 1, 10);
      expect(service.getUserDisputes).toHaveBeenCalledWith('u1', {
        status: 'OPEN',
        page: 1,
        limit: 10,
      });
    });

    it('passes undefined for optional params', async () => {
      service.getUserDisputes.mockResolvedValue([] as any);
      await controller.getUserDisputes('u1', undefined, undefined, undefined);
      expect(service.getUserDisputes).toHaveBeenCalledWith('u1', {
        status: undefined,
        page: undefined,
        limit: undefined,
      });
    });
  });

  // ── getAllDisputes (admin) ──
  describe('getAllDisputes', () => {
    it('passes reason and pagination', async () => {
      service.getAllDisputes.mockResolvedValue([] as any);
      await controller.getAllDisputes('admin1', 'OPEN' as any, 'DAMAGE', 1, 20);
      expect(service.getAllDisputes).toHaveBeenCalledWith('admin1', {
        status: 'OPEN',
        reason: 'DAMAGE',
        page: 1,
        limit: 20,
      });
    });
  });

  // ── getStats (admin) ──
  describe('getStats', () => {
    it('delegates to getDisputeStats', async () => {
      const stats = { total: 10, open: 3 };
      service.getDisputeStats.mockResolvedValue(stats as any);
      expect(await controller.getStats('admin1')).toBe(stats);
    });
  });

  // ── getDispute ──
  describe('getDispute', () => {
    it('passes disputeId and userId', async () => {
      service.getDispute.mockResolvedValue(mockDispute as any);
      await controller.getDispute('d1', 'u1');
      expect(service.getDispute).toHaveBeenCalledWith('d1', 'u1');
    });
  });

  // ── addResponse ──
  describe('addResponse', () => {
    it('passes disputeId, userId, and dto', async () => {
      const dto = { message: 'My response' } as any;
      service.addResponse.mockResolvedValue({} as any);
      await controller.addResponse('d1', 'u1', dto);
      expect(service.addResponse).toHaveBeenCalledWith('d1', 'u1', dto);
    });
  });

  // ── updateDispute (admin) ──
  describe('updateDispute', () => {
    it('passes disputeId, userId, and dto', async () => {
      const dto = { status: 'RESOLVED' } as any;
      service.updateDispute.mockResolvedValue(mockDispute as any);
      await controller.updateDispute('d1', 'admin1', dto);
      expect(service.updateDispute).toHaveBeenCalledWith('d1', 'admin1', dto);
    });
  });

  // ── closeDispute ──
  describe('closeDispute', () => {
    it('passes reason from dto', async () => {
      service.closeDispute.mockResolvedValue(mockDispute as any);
      await controller.closeDispute('d1', 'u1', { reason: 'Resolved amicably' } as any);
      expect(service.closeDispute).toHaveBeenCalledWith('d1', 'u1', 'Resolved amicably');
    });
  });
});
