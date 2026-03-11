import { Test, TestingModule } from '@nestjs/testing';
import { ReputationController } from './reputation.controller';
import { ReputationService } from '../services/reputation.service';

describe('ReputationController', () => {
  let controller: ReputationController;
  let service: jest.Mocked<ReputationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReputationController],
      providers: [
        {
          provide: ReputationService,
          useValue: {
            calculateReputation: jest.fn(),
            getReputation: jest.fn(),
            checkTierAccess: jest.fn(),
            createModerationAction: jest.fn(),
            resolveModerationAction: jest.fn(),
            getPendingModerations: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ReputationController);
    service = module.get(ReputationService) as jest.Mocked<ReputationService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── calculate ──

  describe('calculate', () => {
    it('delegates userId to service', async () => {
      service.calculateReputation.mockResolvedValue({ score: 85 } as any);

      const result = await controller.calculate('u1');

      expect(service.calculateReputation).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ score: 85 });
    });

    it('propagates service error', async () => {
      service.calculateReputation.mockRejectedValue(new Error('User not found'));
      await expect(controller.calculate('bad')).rejects.toThrow('User not found');
    });
  });

  // ── getReputation ──

  describe('getReputation', () => {
    it('returns reputation for userId', async () => {
      service.getReputation.mockResolvedValue({ score: 90, tier: 'GOLD' } as any);

      const result = await controller.getReputation('u1');

      expect(service.getReputation).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ score: 90, tier: 'GOLD' });
    });
  });

  // ── checkTierAccess ──

  describe('checkTierAccess', () => {
    it('returns allowed wrapper from service boolean', async () => {
      service.checkTierAccess.mockResolvedValue(true as any);

      const result = await controller.checkTierAccess('u1', 'GOLD');

      expect(service.checkTierAccess).toHaveBeenCalledWith('u1', 'GOLD');
      expect(result).toEqual({ allowed: true });
    });

    it('returns not allowed when tier insufficient', async () => {
      service.checkTierAccess.mockResolvedValue(false as any);

      const result = await controller.checkTierAccess('u1', 'PLATINUM');

      expect(result).toEqual({ allowed: false });
    });
  });

  // ── createModeration ──

  describe('createModeration', () => {
    it('spreads dto and adds moderatorId', async () => {
      const dto = { targetUserId: 'u2', actionType: 'WARNING', reason: 'Spam' };
      service.createModerationAction.mockResolvedValue({ id: 'm1' } as any);

      const result = await controller.createModeration('admin1', dto as any);

      expect(service.createModerationAction).toHaveBeenCalledWith({
        ...dto,
        moderatorId: 'admin1',
      });
      expect(result).toEqual({ id: 'm1' });
    });

    it('propagates service error', async () => {
      service.createModerationAction.mockRejectedValue(new Error('Invalid action'));
      await expect(controller.createModeration('admin1', {} as any)).rejects.toThrow('Invalid action');
    });
  });

  // ── resolveModeration ──

  describe('resolveModeration', () => {
    it('delegates actionId, resolution, and resolvedBy', async () => {
      const dto = { resolution: 'Resolved after review' };
      service.resolveModerationAction.mockResolvedValue({ id: 'm1', resolved: true } as any);

      const result = await controller.resolveModeration('m1', 'admin1', dto as any);

      expect(service.resolveModerationAction).toHaveBeenCalledWith('m1', 'Resolved after review', 'admin1');
      expect(result).toEqual({ id: 'm1', resolved: true });
    });
  });

  // ── getPendingModerations ──

  describe('getPendingModerations', () => {
    it('uses default limit of 50 when not provided', async () => {
      service.getPendingModerations.mockResolvedValue([{ id: 'm1' }] as any);

      const result = await controller.getPendingModerations();

      expect(service.getPendingModerations).toHaveBeenCalledWith(50);
      expect(result).toEqual([{ id: 'm1' }]);
    });

    it('passes custom limit', async () => {
      service.getPendingModerations.mockResolvedValue([] as any);

      const result = await controller.getPendingModerations(10);

      expect(service.getPendingModerations).toHaveBeenCalledWith(10);
      expect(result).toEqual([]);
    });
  });
});
