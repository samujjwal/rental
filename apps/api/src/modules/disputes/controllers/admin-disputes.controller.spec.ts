import { Test, TestingModule } from '@nestjs/testing';
import { AdminDisputesController } from './admin-disputes.controller';
import { DisputesService } from '../services/disputes.service';
import { UserRole } from '@rental-portal/database';

describe('AdminDisputesController', () => {
  let controller: AdminDisputesController;
  let disputesService: jest.Mocked<Pick<DisputesService, 'assignDispute' | 'resolveDisputeAdmin' | 'rejectDispute'>>;

  const DISPUTE_ID = 'dispute-1';
  const ADMIN_USER_ID = 'admin-1';

  beforeEach(async () => {
    disputesService = {
      assignDispute: jest.fn(),
      resolveDisputeAdmin: jest.fn(),
      rejectDispute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDisputesController],
      providers: [{ provide: DisputesService, useValue: disputesService }],
    })
      // Skip guards in unit tests — guard behaviour is covered by e2e / integration tests
      .overrideGuard(require('@/common/auth').JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(require('@/common/auth').RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminDisputesController>(AdminDisputesController);
  });

  describe('assignDispute', () => {
    it('delegates to disputesService.assignDispute with explicit adminId from body', async () => {
      const resolved = { id: DISPUTE_ID, assignedTo: 'admin-2' };
      disputesService.assignDispute.mockResolvedValue(resolved as any);

      const result = await controller.assignDispute(DISPUTE_ID, ADMIN_USER_ID, { adminId: 'admin-2' });

      expect(disputesService.assignDispute).toHaveBeenCalledWith(DISPUTE_ID, 'admin-2');
      expect(result).toEqual(resolved);
    });

    it('falls back to currentUser id when no explicit adminId is provided', async () => {
      disputesService.assignDispute.mockResolvedValue({ id: DISPUTE_ID } as any);

      await controller.assignDispute(DISPUTE_ID, ADMIN_USER_ID, {});

      expect(disputesService.assignDispute).toHaveBeenCalledWith(DISPUTE_ID, ADMIN_USER_ID);
    });
  });

  describe('resolveDispute', () => {
    it('delegates to disputesService.resolveDisputeAdmin with full body', async () => {
      const body = { decision: 'REFUND', refundAmount: 500, reason: 'Valid claim', notes: 'Approved' };
      const resolved = { id: DISPUTE_ID, status: 'RESOLVED' };
      disputesService.resolveDisputeAdmin.mockResolvedValue(resolved as any);

      const result = await controller.resolveDispute(DISPUTE_ID, ADMIN_USER_ID, body);

      expect(disputesService.resolveDisputeAdmin).toHaveBeenCalledWith(DISPUTE_ID, ADMIN_USER_ID, body);
      expect(result).toEqual(resolved);
    });

    it('passes minimal body (only decision) through without error', async () => {
      disputesService.resolveDisputeAdmin.mockResolvedValue({} as any);

      await controller.resolveDispute(DISPUTE_ID, ADMIN_USER_ID, { decision: 'DISMISS' });

      expect(disputesService.resolveDisputeAdmin).toHaveBeenCalledWith(
        DISPUTE_ID,
        ADMIN_USER_ID,
        { decision: 'DISMISS' },
      );
    });
  });

  describe('rejectDispute', () => {
    it('delegates to disputesService.rejectDispute', async () => {
      const body = { reason: 'Insufficient evidence', notes: 'No photos provided' };
      const resolved = { id: DISPUTE_ID, status: 'REJECTED' };
      disputesService.rejectDispute.mockResolvedValue(resolved as any);

      const result = await controller.rejectDispute(DISPUTE_ID, ADMIN_USER_ID, body);

      expect(disputesService.rejectDispute).toHaveBeenCalledWith(DISPUTE_ID, ADMIN_USER_ID, body);
      expect(result).toEqual(resolved);
    });

    it('works with empty body', async () => {
      disputesService.rejectDispute.mockResolvedValue({} as any);

      await controller.rejectDispute(DISPUTE_ID, ADMIN_USER_ID, {});

      expect(disputesService.rejectDispute).toHaveBeenCalledWith(DISPUTE_ID, ADMIN_USER_ID, {});
    });
  });
});
