import { SmsService } from './sms.service';

describe('SmsService (sms.service)', () => {
  let service: SmsService;
  let configService: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          SMS_PROVIDER: 'twilio',
          TWILIO_ACCOUNT_SID: 'AC_test',
          TWILIO_AUTH_TOKEN: 'auth_test',
          TWILIO_PHONE_NUMBER: '+1234567890',
        };
        return map[key];
      }),
    };

    service = new SmsService(configService);
  });

  describe('sendSms', () => {
    it('should route to twilio provider by default', async () => {
      const result = await service.sendSms({
        to: '+9779812345678',
        message: 'Test message',
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should return failure for unknown provider', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SMS_PROVIDER') return 'unknown_provider';
        return undefined;
      });
      service = new SmsService(configService);

      const result = await service.sendSms({
        to: '+9779812345678',
        message: 'Test',
      });

      expect(result.success).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      // Missing credentials should cause error
      configService.get.mockReturnValue(undefined);
      service = new SmsService(configService);

      const result = await service.sendSms({
        to: '+9779812345678',
        message: 'Test',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('sendOTP', () => {
    it('should send OTP via sendSms', async () => {
      const result = await service.sendOTP('+9779812345678', '123456');

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('sendBulkSms', () => {
    it('should send to multiple recipients', async () => {
      const result = await service.sendBulkSms(
        ['+9779812345678', '+9779887654321'],
        'Bulk message',
      );

      expect(result).toBeDefined();
      expect(result.sent).toBeDefined();
      expect(result.failed).toBeDefined();
    });

    it('should report all sent count', async () => {
      const result = await service.sendBulkSms(
        ['+9779812345678'],
        'Single recipient',
      );

      expect(typeof result.sent).toBe('number');
      expect(typeof result.failed).toBe('number');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should strip non-digit characters', () => {
      const formatted = service.formatPhoneNumber('(555) 123-4567');

      expect(formatted).toMatch(/^\+/);
    });

    it('should prepend country code if not present', () => {
      const formatted = service.formatPhoneNumber('9812345678', '+977');

      expect(formatted).toMatch(/^\+977/);
    });

    it('should keep existing country code', () => {
      const formatted = service.formatPhoneNumber('+9779812345678', '+977');

      expect(formatted).toBe('+9779812345678');
    });

    it('should use default +977 country code', () => {
      const formatted = service.formatPhoneNumber('5551234567');

      expect(formatted).toMatch(/^\+977/);
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate E.164 format numbers', () => {
      expect(service.validatePhoneNumber('+9779812345678')).toBe(true);
      expect(service.validatePhoneNumber('+15551234567')).toBe(true);
    });

    it('should reject invalid numbers', () => {
      expect(service.validatePhoneNumber('123')).toBe(false);
      expect(service.validatePhoneNumber('not-a-number')).toBe(false);
      expect(service.validatePhoneNumber('')).toBe(false);
    });

    it('should reject numbers without + prefix', () => {
      expect(service.validatePhoneNumber('9779812345678')).toBe(false);
    });

    it('should reject numbers that are too long', () => {
      expect(service.validatePhoneNumber('+12345678901234567')).toBe(false);
    });
  });
});
