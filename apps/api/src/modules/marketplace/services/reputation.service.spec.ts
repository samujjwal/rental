import { Test, TestingModule } from '@nestjs/testing';
import { ReputationService } from './reputation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

describe('ReputationService', () => {
  let service: ReputationService;
  let prisma: any;
  let eventEmitter: any;

  const mockUser = {
    id: 'user-1',
    role: 'HOST',
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
    isActive: true,
    listings: [{ id: 'listing-1' }],
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        findMany: jest.fn().mockResolvedValue([{ id: 'user-1' }]),
      },
      review: {
        findMany: jest.fn().mockResolvedValue([
          { rating: 5, content: 'Great host!' }, { rating: 4, content: 'Good stay' }, { rating: 5, content: 'Awesome' }, { rating: 3, content: 'OK' },
        ]),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'b1' }, { id: 'b2' }, { id: 'b3' },
        ]),
        count: jest.fn().mockResolvedValue(0),
      },
      dispute: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      reputationScore: {
        upsert: jest.fn().mockImplementation(({ update }) => Promise.resolve({
          id: 'rs-1',
          userId: 'user-1',
          ...update,
        })),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      moderationAction: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ma-1', ...data })),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReputationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(null) } },
      ],
    }).compile();

    service = module.get<ReputationService>(ReputationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateReputation', () => {
    it('should calculate reputation score for a user', async () => {
      const result = await service.calculateReputation('user-1');
      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1000);
      expect(result.tier).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith('reputation.calculated', expect.any(Object));
    });

    it('should assign correct tier based on score', async () => {
      const result = await service.calculateReputation('user-1');
      const score = result.overallScore;
      if (score >= 900) expect(result.tier).toBe('PLATINUM');
      else if (score >= 750) expect(result.tier).toBe('GOLD');
      else if (score >= 500) expect(result.tier).toBe('SILVER');
      else if (score >= 250) expect(result.tier).toBe('BRONZE');
      else expect(result.tier).toBe('NEW');
    });

    it('should throw for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.calculateReputation('bad-id')).rejects.toThrow();
    });

    it('should penalize for disputes', async () => {
      prisma.dispute.findMany.mockResolvedValue([
        { status: 'RESOLVED' }, { status: 'OPEN' }, { status: 'RESOLVED' },
      ]);
      const withDisputes = await service.calculateReputation('user-1');

      prisma.dispute.findMany.mockResolvedValue([]);
      const withoutDisputes = await service.calculateReputation('user-1');

      expect(withDisputes.overallScore).toBeLessThan(withoutDisputes.overallScore);
    });
  });

  describe('getReputation', () => {
    it('should return existing reputation or calculate new', async () => {
      const result = await service.getReputation('user-1');
      expect(result).toBeDefined();
    });

    it('should return cached reputation if exists', async () => {
      prisma.reputationScore.findUnique.mockResolvedValue({
        userId: 'user-1',
        overallScore: 75,
        tier: 'GOLD',
      });
      const result = await service.getReputation('user-1');
      expect(result.overallScore).toBe(75);
    });
  });

  describe('createModerationAction', () => {
    it('should create a moderation action', async () => {
      const result = await service.createModerationAction({
        targetType: 'LISTING',
        targetId: 'listing-1',
        action: 'SUSPEND',
        reason: 'Policy violation',
        moderatorId: 'admin-1',
      });
      expect(result).toBeDefined();
      expect(prisma.moderationAction.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('moderation.action_created', expect.any(Object));
    });
  });

  describe('checkTierAccess', () => {
    it('should allow access for users meeting tier requirement', async () => {
      prisma.reputationScore.findUnique.mockResolvedValue({
        userId: 'user-1',
        overallScore: 80,
        tier: 'GOLD',
      });
      const result = await service.checkTierAccess('user-1', 'SILVER');
      expect(result).toBe(true);
    });

    it('should deny access for users below tier requirement', async () => {
      prisma.reputationScore.findUnique.mockResolvedValue({
        userId: 'user-1',
        overallScore: 30,
        tier: 'BRONZE',
      });
      const result = await service.checkTierAccess('user-1', 'GOLD');
      expect(result).toBe(false);
    });
  });

  describe('getPendingModerations', () => {
    it('should return pending moderation actions', async () => {
      const result = await service.getPendingModerations();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
