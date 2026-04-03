import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { BadRequestException } from '@nestjs/common';

describe('WebhookController - Security Tests', () => {
  let controller: WebhookController;
  let webhookService: jest.Mocked<WebhookService>;

  beforeEach(async () => {
    const mockWebhookService = {
      handleStripeWebhook: jest.fn().mockResolvedValue({ received: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: WebhookService, useValue: mockWebhookService },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    webhookService = module.get(WebhookService) as jest.Mocked<WebhookService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Stripe Webhook Security', () => {
    it('should reject request without stripe-signature header', async () => {
      const mockReq = { rawBody: Buffer.from('test') } as any;

      await expect(
        controller.handleStripeWebhook(undefined as any, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject request without raw body', async () => {
      const mockReq = {} as any;

      await expect(
        controller.handleStripeWebhook('sig_123', mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid webhook request', async () => {
      const mockReq = { rawBody: Buffer.from('test-payload') } as any;

      const result = await controller.handleStripeWebhook('sig_123', mockReq);

      expect(result).toEqual({ received: true });
      expect(webhookService.handleStripeWebhook).toHaveBeenCalledWith(
        Buffer.from('test-payload'),
        'sig_123',
      );
    });

    it('should propagate signature verification errors as 400', async () => {
      const mockReq = { rawBody: Buffer.from('test') } as any;
      (webhookService.handleStripeWebhook as jest.Mock).mockRejectedValue(
        new Error('Invalid signature'),
      );

      await expect(
        controller.handleStripeWebhook('invalid_sig', mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate processing errors as 500', async () => {
      const mockReq = { rawBody: Buffer.from('test') } as any;
      (webhookService.handleStripeWebhook as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.handleStripeWebhook('valid_sig', mockReq),
      ).rejects.toThrow('Database error');
    });
  });

  describe('Webhook Payload Handling', () => {
    it('should handle large payloads', async () => {
      const largePayload = Buffer.from('x'.repeat(100000));
      const mockReq = { rawBody: largePayload } as any;

      await controller.handleStripeWebhook('sig_123', mockReq);

      expect(webhookService.handleStripeWebhook).toHaveBeenCalledWith(
        largePayload,
        'sig_123',
      );
    });

    it('should handle empty payload', async () => {
      const mockReq = { rawBody: Buffer.from('') } as any;

      await controller.handleStripeWebhook('sig_123', mockReq);

      expect(webhookService.handleStripeWebhook).toHaveBeenCalledWith(
        Buffer.from(''),
        'sig_123',
      );
    });

    it('should preserve binary data in payload', async () => {
      const binaryPayload = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      const mockReq = { rawBody: binaryPayload } as any;

      await controller.handleStripeWebhook('sig_123', mockReq);

      expect(webhookService.handleStripeWebhook).toHaveBeenCalledWith(
        binaryPayload,
        'sig_123',
      );
    });
  });

  describe('Webhook Replay Protection', () => {
    it('should handle replayed webhook events', async () => {
      const mockReq = { rawBody: Buffer.from('test') } as any;
      
      // First call succeeds
      await controller.handleStripeWebhook('sig_123', mockReq);
      
      // Second call with same signature (replay)
      (webhookService.handleStripeWebhook as jest.Mock).mockRejectedValue(
        new Error('Duplicate event'),
      );
      
      await expect(
        controller.handleStripeWebhook('sig_123', mockReq),
      ).rejects.toThrow();
    });
  });
});
