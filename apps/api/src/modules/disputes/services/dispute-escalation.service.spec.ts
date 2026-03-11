import { Test, TestingModule } from '@nestjs/testing';
import { DisputeEscalationService, EscalationLevel } from './dispute-escalation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventsService } from '@/common/events/events.service';
import { CacheService } from '@/common/cache/cache.service';
import { BadRequestException } from '@nestjs/common';

describe('DisputeEscalationService', () => {
  let service: DisputeEscalationService;
  let prisma: any;
  let events: any;
  let cache: any;

  const mockDispute = {
    id: 'dispute-1',
    bookingId: 'booking-1',
    status: 'OPEN',
    escalations: [],
  };

  const mockEscalation = {
    id: 'esc-1',
    disputeId: 'dispute-1',
    fromLevel: 'PEER',
    toLevel: 'PEER',
    reason: 'Initial',
    deadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
    resolvedAt: null,
    metadata: {},
    dispute: { id: 'dispute-1', status: 'OPEN' },
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((callback) => callback(prisma)),
      dispute: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      disputeEscalation: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    events = {
      emitDisputeEscalated: jest.fn(),
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeEscalationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: events },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<DisputeEscalationService>(DisputeEscalationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('escalateDispute', () => {
    it('should escalate from PEER to SUPPORT', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        escalations: [{ toLevel: 'PEER', createdAt: new Date() }],
      });
      prisma.disputeEscalation.create.mockResolvedValue({
        id: 'esc-2',
        disputeId: 'dispute-1',
        fromLevel: 'PEER',
        toLevel: 'SUPPORT',
      });
      prisma.dispute.update.mockResolvedValue({});

      const result = await service.escalateDispute('dispute-1', 'No resolution from peer');

      expect(result.level).toBe('SUPPORT');
      expect(result.previousLevel).toBe('PEER');
      expect(events.emitDisputeEscalated).toHaveBeenCalledWith(
        expect.objectContaining({ toLevel: 'SUPPORT', fromLevel: 'PEER' }),
      );
    });

    it('should escalate from no escalation to SUPPORT (default PEER → SUPPORT)', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        escalations: [],
      });
      prisma.disputeEscalation.create.mockResolvedValue({
        id: 'esc-1',
        disputeId: 'dispute-1',
        fromLevel: 'PEER',
        toLevel: 'SUPPORT',
      });
      prisma.dispute.update.mockResolvedValue({});

      const result = await service.escalateDispute('dispute-1', 'Unresolved');

      expect(result.level).toBe('SUPPORT');
      expect(result.previousLevel).toBe('PEER');
    });

    it('should assign mediator when escalating to MEDIATOR level', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        escalations: [{ toLevel: 'SUPPORT', createdAt: new Date() }],
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      prisma.disputeEscalation.create.mockResolvedValue({
        id: 'esc-3',
        disputeId: 'dispute-1',
        fromLevel: 'SUPPORT',
        toLevel: 'MEDIATOR',
      });
      prisma.dispute.update.mockResolvedValue({});

      const result = await service.escalateDispute('dispute-1', 'Needs mediation');

      expect(result.level).toBe('MEDIATOR');
      expect(result.assignedTo).toBe('admin-1');
    });

    it('should throw if dispute not found', async () => {
      prisma.dispute.findUnique.mockResolvedValue(null);

      await expect(
        service.escalateDispute('bad-id', 'reason'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if already at EXECUTIVE level', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        escalations: [{ toLevel: 'EXECUTIVE', createdAt: new Date() }],
      });

      await expect(
        service.escalateDispute('dispute-1', 'reason'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('processAutoEscalations', () => {
    it('should auto-escalate overdue disputes', async () => {
      prisma.disputeEscalation.findMany.mockResolvedValue([{...mockEscalation, toLevel: 'PEER'}]);
      prisma.disputeEscalation.update.mockResolvedValue({});
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        escalations: [{ toLevel: 'PEER', createdAt: new Date() }],
      });
      prisma.disputeEscalation.create.mockResolvedValue({
        id: 'esc-auto',
        disputeId: 'dispute-1',
        fromLevel: 'PEER',
        toLevel: 'SUPPORT',
      });
      prisma.dispute.update.mockResolvedValue({});

      const count = await service.processAutoEscalations();
      expect(count).toBe(1);
    });

    it('should skip resolved disputes', async () => {
      prisma.disputeEscalation.findMany.mockResolvedValue([
        { ...mockEscalation, dispute: { id: 'dispute-1', status: 'RESOLVED' } },
      ]);
      prisma.disputeEscalation.update.mockResolvedValue({});

      const count = await service.processAutoEscalations();
      expect(count).toBe(0);
    });
  });

  describe('getCurrentLevel', () => {
    it('should return latest escalation level', async () => {
      prisma.disputeEscalation.findFirst.mockResolvedValue({ toLevel: 'MEDIATOR' });

      const level = await service.getCurrentLevel('dispute-1');
      expect(level).toBe('MEDIATOR');
    });

    it('should return PEER if no escalations exist', async () => {
      prisma.disputeEscalation.findFirst.mockResolvedValue(null);

      const level = await service.getCurrentLevel('dispute-1');
      expect(level).toBe('PEER');
    });
  });

  describe('resolveEscalation', () => {
    it('should mark escalation as resolved', async () => {
      prisma.disputeEscalation.findFirst.mockResolvedValue(mockEscalation);
      prisma.disputeEscalation.update.mockResolvedValue({});

      await service.resolveEscalation('dispute-1', 'Resolved by mediator', 'admin-1');

      expect(prisma.disputeEscalation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'esc-1' },
          data: expect.objectContaining({ resolvedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
