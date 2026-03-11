import { Test, TestingModule } from '@nestjs/testing';
import { DisputeResolutionController } from './dispute-resolution.controller';
import { DisputeResolutionService } from '../services/dispute-resolution.service';

describe('DisputeResolutionController', () => {
  let controller: DisputeResolutionController;
  let disputes: jest.Mocked<DisputeResolutionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputeResolutionController],
      providers: [
        {
          provide: DisputeResolutionService,
          useValue: {
            fileDispute: jest.fn(),
            submitEvidence: jest.fn(),
            analyzeDispute: jest.fn(),
            startMediation: jest.fn(),
            resolve: jest.fn(),
            getDisputesWithSla: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(DisputeResolutionController);
    disputes = module.get(DisputeResolutionService) as jest.Mocked<DisputeResolutionService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── fileDispute ──

  describe('fileDispute', () => {
    it('delegates to service with claimantId merged', async () => {
      const dto = { bookingId: 'b1', reason: 'damage' } as any;
      disputes.fileDispute.mockResolvedValue({ id: 'd1' } as any);

      const result = await controller.fileDispute('u1', dto);

      expect(disputes.fileDispute).toHaveBeenCalledWith({ ...dto, claimantId: 'u1' });
      expect(result).toEqual({ id: 'd1' });
    });

    it('propagates service error', async () => {
      disputes.fileDispute.mockRejectedValue(new Error('Booking not found'));
      await expect(controller.fileDispute('u1', {} as any)).rejects.toThrow('Booking not found');
    });
  });

  // ── submitEvidence ──

  describe('submitEvidence', () => {
    it('delegates to service', async () => {
      const dto = { type: 'photo', url: 'https://img.test/1.jpg' } as any;
      disputes.submitEvidence.mockResolvedValue({ ok: true } as any);

      const result = await controller.submitEvidence('d1', 'u1', dto);

      expect(disputes.submitEvidence).toHaveBeenCalledWith('d1', 'u1', dto);
      expect(result).toEqual({ ok: true });
    });
  });

  // ── analyzeDispute ──

  describe('analyzeDispute', () => {
    it('delegates to service', async () => {
      disputes.analyzeDispute.mockResolvedValue({ recommendation: 'refund' } as any);

      const result = await controller.analyzeDispute('d1');

      expect(disputes.analyzeDispute).toHaveBeenCalledWith('d1');
      expect(result).toEqual({ recommendation: 'refund' });
    });
  });

  // ── startMediation ──

  describe('startMediation', () => {
    it('delegates to service', async () => {
      disputes.startMediation.mockResolvedValue({ status: 'mediation' } as any);

      const result = await controller.startMediation('d1', 'admin1');

      expect(disputes.startMediation).toHaveBeenCalledWith('d1', 'admin1');
      expect(result).toEqual({ status: 'mediation' });
    });
  });

  // ── resolve ──

  describe('resolve', () => {
    it('merges resolvedBy into dto', async () => {
      const dto = { outcome: 'full_refund', amount: 100 } as any;
      disputes.resolve.mockResolvedValue({ resolved: true } as any);

      const result = await controller.resolve('d1', 'admin1', dto);

      expect(disputes.resolve).toHaveBeenCalledWith('d1', { ...dto, resolvedBy: 'admin1' });
      expect(result).toEqual({ resolved: true });
    });
  });

  // ── getWithSla ──

  describe('getWithSla', () => {
    it('delegates with defaults', async () => {
      disputes.getDisputesWithSla.mockResolvedValue([{ id: 'd1' }] as any);

      const result = await controller.getWithSla();

      expect(disputes.getDisputesWithSla).toHaveBeenCalledWith(undefined, 50);
      expect(result).toEqual([{ id: 'd1' }]);
    });

    it('passes explicit params', async () => {
      disputes.getDisputesWithSla.mockResolvedValue([] as any);

      await controller.getWithSla('open', 10);

      expect(disputes.getDisputesWithSla).toHaveBeenCalledWith('open', 10);
    });

    it('propagates service error', async () => {
      disputes.getDisputesWithSla.mockRejectedValue(new Error('DB error'));
      await expect(controller.getWithSla()).rejects.toThrow('DB error');
    });
  });
});
