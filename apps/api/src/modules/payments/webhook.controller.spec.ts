import { WebhookController } from './webhook.controller';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: any;

  beforeEach(() => {
    webhookService = {
      handleStripeWebhook: jest.fn().mockResolvedValue({ received: true }),
    };

    controller = new WebhookController(webhookService);
  });

  describe('handleStripeWebhook', () => {
    it('should process stripe webhook and return received', async () => {
      const mockReq = {
        rawBody: Buffer.from('stripe-body'),
      } as any;

      const result = await controller.handleStripeWebhook('sig_test', mockReq);

      expect(result).toEqual({ received: true });
      expect(webhookService.handleStripeWebhook).toHaveBeenCalledWith(
        mockReq.rawBody,
        'sig_test',
      );
    });

    it('should throw when rawBody is missing', async () => {
      const mockReq = {} as any;

      await expect(controller.handleStripeWebhook('sig_test', mockReq)).rejects.toThrow(
        'Missing request body',
      );
    });
  });
});
