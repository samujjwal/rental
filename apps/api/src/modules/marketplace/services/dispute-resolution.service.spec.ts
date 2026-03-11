import { Test, TestingModule } from '@nestjs/testing';
import { DisputeResolutionService } from './dispute-resolution.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentOrchestrationService } from './payment-orchestration.service';

describe('DisputeResolutionService', () => {
  let service: DisputeResolutionService;
  let prisma: any;
  let eventEmitter: any;

  const mockDispute = {
    id: 'dispute-1',
    bookingId: 'booking-1',
    initiatorId: 'user-1',
    defendantId: 'user-2',
    title: 'Room was not as shown',
    type: 'CONDITION_MISMATCH',
    description: 'Room was not as shown',
    status: 'OPEN',
    amount: 5000,
    resolvedAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      dispute: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'dispute-1', ...data })),
        findUnique: jest.fn().mockResolvedValue(mockDispute),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockDispute, ...data })),
        findMany: jest.fn().mockResolvedValue([{ ...mockDispute, timelineEvents: [{ event: 'DISPUTE_FILED' }] }]),
      },
      disputeTimelineEvent: {
        create: jest.fn().mockResolvedValue({ id: 'tle-1' }),
      },
      disputeEvidence: {
        create: jest.fn().mockResolvedValue({ id: 'ev-1' }),
      },
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeResolutionService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: PaymentOrchestrationService, useValue: { freezeEscrow: jest.fn().mockResolvedValue({}), refund: jest.fn().mockResolvedValue({ status: 'refunded', refundId: 'ref-1' }) } },
      ],
    }).compile();

    service = module.get<DisputeResolutionService>(DisputeResolutionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fileDispute', () => {
    it('should file a new dispute', async () => {
      const result = await service.fileDispute({
        bookingId: 'booking-1',
        claimantId: 'user-1',
        respondentId: 'user-2',
        category: 'CONDITION_MISMATCH',
        description: 'Room not as shown',
        amount: 5000,
      });
      expect(result).toBeDefined();
      expect(result.status).toBe('FILED');
      expect(eventEmitter.emit).toHaveBeenCalledWith('dispute.filed', expect.any(Object));
    });
  });

  describe('submitEvidence', () => {
    it('should submit evidence for a dispute', async () => {
      const result = await service.submitEvidence('dispute-1', 'user-1', {
        type: 'PHOTO',
        description: 'Photo of damaged room',
        urls: ['https://example.com/photo.jpg'],
      });
      expect(result).toBeDefined();
      expect(prisma.dispute.update).toHaveBeenCalled();
    });

    it('should throw for non-existent dispute', async () => {
      prisma.dispute.findUnique.mockResolvedValue(null);
      await expect(
        service.submitEvidence('bad-id', 'user-1', { type: 'TEXT', description: 'Test' }),
      ).rejects.toThrow();
    });
  });

  describe('analyzeDispute', () => {
    it('should analyze property misrepresentation dispute', async () => {
      const result = await service.analyzeDispute('dispute-1');
      expect(result.recommendation).toBe('PARTIAL_REFUND');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.suggestedCompensation).toBe(2500); // 50% of 5000
    });

    it('should analyze safety issue with full refund', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        type: 'RULES_VIOLATION',
        amount: 10000,
      });
      const result = await service.analyzeDispute('dispute-1');
      expect(result.recommendation).toBe('FULL_REFUND');
      expect(result.suggestedCompensation).toBe(10000);
    });

    it('should recommend mediation for unknown categories', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        type: 'OTHER',
        amount: 3000,
      });
      const result = await service.analyzeDispute('dispute-1');
      expect(result.recommendation).toBe('MEDIATION');
    });
  });

  describe('startMediation', () => {
    it('should transition dispute to mediation', async () => {
      const result = await service.startMediation('dispute-1', 'mediator-1');
      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedTo: 'mediator-1',
          }),
        }),
      );
    });
  });

  describe('resolve', () => {
    it('should resolve a dispute', async () => {
      const result = await service.resolve('dispute-1', {
        resolution: 'Partial refund issued',
        compensationAmount: 2500,
        resolvedBy: 'admin-1',
      });
      expect(result.status).toBe('RESOLVED');
      expect(eventEmitter.emit).toHaveBeenCalledWith('dispute.resolved', expect.any(Object));
    });
  });

  describe('getDisputesWithSla', () => {
    it('should return disputes with SLA info', async () => {
      const result = await service.getDisputesWithSla('OPEN');
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].sla).toBeDefined();
      expect(result[0].sla.stage).toBeDefined();
    });
  });
});
