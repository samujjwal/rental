import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutController } from './checkout.controller';
import { CheckoutOrchestratorService } from '../services/checkout-orchestrator.service';

describe('CheckoutController', () => {
  let controller: CheckoutController;
  let service: jest.Mocked<CheckoutOrchestratorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutController],
      providers: [
        {
          provide: CheckoutOrchestratorService,
          useValue: {
            checkout: jest.fn(),
            refreshLock: jest.fn(),
            releaseLock: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CheckoutController);
    service = module.get(CheckoutOrchestratorService) as jest.Mocked<CheckoutOrchestratorService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── executeCheckout ──

  describe('executeCheckout', () => {
    it('delegates to checkout service with correct params', async () => {
      const dto = {
        listingId: 'l1',
        startDate: '2026-04-01',
        endDate: '2026-04-05',
        guestCount: 2,
        paymentMethod: 'card',
        country: 'NP',
        currency: 'NPR',
        metadata: { note: 'test' },
      };
      service.checkout.mockResolvedValue({ bookingId: 'b1', status: 'confirmed' } as any);

      const result = await controller.executeCheckout('u1', dto as any);

      expect(service.checkout).toHaveBeenCalledWith({
        userId: 'u1',
        listingId: 'l1',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-05'),
        guestCount: 2,
        paymentMethod: 'card',
        country: 'NP',
        currency: 'NPR',
        metadata: { note: 'test' },
      });
      expect(result).toEqual({ bookingId: 'b1', status: 'confirmed' });
    });

    it('propagates service error', async () => {
      service.checkout.mockRejectedValue(new Error('Policy violation'));
      await expect(controller.executeCheckout('u1', {} as any)).rejects.toThrow('Policy violation');
    });
  });

  // ── refreshLock ──

  describe('refreshLock', () => {
    it('delegates to checkout.refreshLock', async () => {
      service.refreshLock.mockResolvedValue({ extended: true } as any);
      const result = await controller.refreshLock({ lockKey: 'lock-abc' } as any);
      expect(service.refreshLock).toHaveBeenCalledWith('lock-abc');
      expect(result).toEqual({ extended: true });
    });

    it('propagates service error', async () => {
      service.refreshLock.mockRejectedValue(new Error('Lock expired'));
      await expect(controller.refreshLock({ lockKey: 'lock-abc' } as any)).rejects.toThrow('Lock expired');
    });
  });

  // ── releaseLock ──

  describe('releaseLock', () => {
    it('delegates to checkout.releaseLock', async () => {
      service.releaseLock.mockResolvedValue(undefined as any);
      await controller.releaseLock('lock-abc');
      expect(service.releaseLock).toHaveBeenCalledWith('lock-abc');
    });

    it('propagates service error', async () => {
      service.releaseLock.mockRejectedValue(new Error('Lock not found'));
      await expect(controller.releaseLock('lock-abc')).rejects.toThrow('Lock not found');
    });
  });
});
