import { Test, TestingModule } from '@nestjs/testing';
import { PaymentOrchestrationController } from './payment-orchestration.controller';
import { PaymentOrchestrationService } from '../services/payment-orchestration.service';

describe('PaymentOrchestrationController', () => {
  let controller: PaymentOrchestrationController;
   
  let orchestration: Record<string, jest.Mock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentOrchestrationController],
      providers: [
        {
          provide: PaymentOrchestrationService,
          useValue: {
            getRegisteredProviders: jest.fn(),
            getProviderHealth: jest.fn(),
            selectProvider: jest.fn(),
            authorize: jest.fn(),
            capture: jest.fn(),
            refund: jest.fn(),
            payout: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PaymentOrchestrationController);
    orchestration = module.get(PaymentOrchestrationService) as any;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── getProviders ──

  describe('getProviders', () => {
    it('delegates to service', async () => {
      orchestration.getRegisteredProviders.mockResolvedValue([{ name: 'stripe' }] as any);

      const result = await controller.getProviders();

      expect(orchestration.getRegisteredProviders).toHaveBeenCalled();
      expect(result).toEqual([{ name: 'stripe' }]);
    });
  });

  // ── getProviderHealth ──

  describe('getProviderHealth', () => {
    it('delegates to service', async () => {
      orchestration.getProviderHealth.mockResolvedValue({ stripe: 'healthy' } as any);

      const result = await controller.getProviderHealth();

      expect(orchestration.getProviderHealth).toHaveBeenCalled();
      expect(result).toEqual({ stripe: 'healthy' });
    });
  });

  // ── selectProvider ──

  describe('selectProvider', () => {
    it('wraps result in { provider }', async () => {
      orchestration.selectProvider.mockResolvedValue('stripe' as any);

      const result = await controller.selectProvider('NP', 'NPR');

      expect(orchestration.selectProvider).toHaveBeenCalledWith('NP', 'NPR');
      expect(result).toEqual({ provider: 'stripe' });
    });

    it('propagates service error', async () => {
      orchestration.selectProvider.mockRejectedValue(new Error('No provider'));
      await expect(controller.selectProvider('XX', 'XXX')).rejects.toThrow('No provider');
    });
  });

  // ── authorize ──

  describe('authorize', () => {
    it('merges userId into dto', async () => {
      const dto = { amount: 1000, currency: 'NPR' } as any;
      orchestration.authorize.mockResolvedValue({ transactionId: 't1' } as any);

      const result = await controller.authorize('u1', dto);

      expect(orchestration.authorize).toHaveBeenCalledWith({ ...dto, userId: 'u1' });
      expect(result).toEqual({ transactionId: 't1' });
    });
  });

  // ── capture ──

  describe('capture', () => {
    it('delegates dto fields to service', async () => {
      const dto = { transactionId: 't1', amount: 1000, providerName: 'stripe' } as any;
      orchestration.capture.mockResolvedValue({ captured: true } as any);

      const result = await controller.capture(dto);

      expect(orchestration.capture).toHaveBeenCalledWith('t1', 1000, 'stripe');
      expect(result).toEqual({ captured: true });
    });
  });

  // ── refund ──

  describe('refund', () => {
    it('delegates dto fields to service', async () => {
      const dto = { transactionId: 't1', amount: 500, providerName: 'stripe', reason: 'cancel' } as any;
      orchestration.refund.mockResolvedValue({ refunded: true } as any);

      const result = await controller.refund(dto);

      expect(orchestration.refund).toHaveBeenCalledWith('t1', 500, 'stripe', 'cancel');
      expect(result).toEqual({ refunded: true });
    });
  });

  // ── payout ──

  describe('payout', () => {
    it('delegates dto to service', async () => {
      const dto = { hostId: 'h1', amount: 800, currency: 'NPR' } as any;
      orchestration.payout.mockResolvedValue({ payoutId: 'p1' } as any);

      const result = await controller.payout(dto);

      expect(orchestration.payout).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ payoutId: 'p1' });
    });

    it('propagates service error', async () => {
      orchestration.payout.mockRejectedValue(new Error('Insufficient funds'));
      await expect(controller.payout({} as any)).rejects.toThrow('Insufficient funds');
    });
  });
});
