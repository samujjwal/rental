import { AdminNotificationsController } from './admin-notifications.controller';

describe('AdminNotificationsController', () => {
  let controller: AdminNotificationsController;
  let emailService: any;
  let smsService: any;
  let configService: any;

  beforeEach(() => {
    emailService = {
      sendEmail: jest.fn().mockResolvedValue({ messageId: 'msg-1', status: 'sent' }),
      testEmailConfiguration: jest.fn().mockResolvedValue({ success: true, message: 'OK' }),
    };

    smsService = {
      sendSms: jest.fn().mockResolvedValue({ success: true }),
      validatePhoneNumber: jest.fn().mockReturnValue(true),
      testSmsConfiguration: jest.fn().mockResolvedValue({ success: true }),
      handleWebhook: jest.fn().mockResolvedValue({ status: 'processed' }),
    };

    configService = {
      get: jest.fn().mockReturnValue('test-value'),
    };

    controller = new AdminNotificationsController(emailService, smsService, configService);
  });

  describe('sendEmail', () => {
    it('should send email via service', async () => {
      const emailData = {
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      };

      const result = await controller.sendEmail(emailData);

      expect(result).toBeDefined();
      expect(emailService.sendEmail).toHaveBeenCalledWith(emailData);
    });
  });

  describe('testEmail', () => {
    it('should test email configuration', async () => {
      const result = await controller.testEmail();

      expect(result.success).toBe(true);
      expect(emailService.testEmailConfiguration).toHaveBeenCalled();
    });
  });

  describe('sendSms', () => {
    it('should send SMS via service', async () => {
      const smsData = { to: '+9779812345678', body: 'Test message' };

      const result = await controller.sendSms(smsData);

      expect(result).toBeDefined();
      expect(smsService.sendSms).toHaveBeenCalled();
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate phone number', async () => {
      const result = await controller.validatePhoneNumber({ phone: '+9779812345678' });

      expect(result).toBeDefined();
    });
  });

  describe('testSms', () => {
    it('should test SMS configuration', async () => {
      const result = await controller.testSms();

      expect(result).toBeDefined();
    });
  });

  describe('handleWebhook', () => {
    it('should process SMS webhook event', async () => {
      // Return null for TWILIO_AUTH_TOKEN so signature validation is skipped
      configService.get.mockReturnValue(null);
      const mockReq = { headers: {} } as any;
      const eventData = {
        MessageSid: 'SM_test',
        MessageStatus: 'delivered',
        To: '+9779812345678',
      };

      const result = await controller.handleWebhook(mockReq, eventData);

      expect(result).toEqual({ status: 'processed' });
      expect(smsService.handleWebhook).toHaveBeenCalledWith(eventData);
    });
  });
});
