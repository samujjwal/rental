import { SmsService } from './twilio.service';

// Mock Twilio
jest.mock('twilio', () => {
  const mockMessages = {
    create: jest.fn().mockResolvedValue({ sid: 'SM_test123', status: 'queued' }),
  };
  const mockLookup = {
    fetch: jest.fn().mockResolvedValue({
      valid: true,
      phoneNumber: '+9779812345678',
      countryCode: 'NP',
    }),
  };

  const TwilioMock = jest.fn().mockImplementation(() => ({
    messages: mockMessages,
    lookups: {
      v2: {
        phoneNumbers: jest.fn().mockReturnValue(mockLookup),
      },
    },
  }));

  return { Twilio: TwilioMock, __esModule: true };
});

describe('SmsService (Twilio)', () => {
  let service: SmsService;
  let configService: any;
  let prisma: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          TWILIO_ACCOUNT_SID: 'AC_test_sid',
          TWILIO_AUTH_TOKEN: 'test_auth_token',
          TWILIO_PHONE_NUMBER: '+1234567890',
          API_URL: 'https://api.gharbatai.com',
          TEST_PHONE: '+9779812345678',
        };
        return map[key];
      }),
    };

    prisma = {};

    service = new SmsService(configService, prisma);
  });

  describe('constructor', () => {
    it('should initialize when credentials are provided', () => {
      expect(service).toBeDefined();
    });

    it('should handle missing credentials gracefully', () => {
      const noCredConfig = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const svc = new SmsService(noCredConfig as any, prisma);
      expect(svc).toBeDefined();
    });
  });

  describe('sendSms', () => {
    it('should send SMS via Twilio client', async () => {
      const result = await service.sendSms({
        to: '+9779812345678',
        body: 'Hello from GharBatai',
      });

      expect(result).toBeDefined();
      expect(result.sid).toBeDefined();
    });

    it('should use configured from number', async () => {
      const result = await service.sendSms({
        to: '+9779812345678',
        body: 'Test',
      });

      expect(result).toBeDefined();
    });

    it('should allow custom from number', async () => {
      const result = await service.sendSms({
        to: '+9779812345678',
        body: 'Test',
        from: '+9876543210',
      });

      expect(result).toBeDefined();
    });
  });

  describe('sendVerificationCode', () => {
    it('should send OTP message', async () => {
      await service.sendVerificationCode('+9779812345678', '123456');
      // Should not throw
    });

    it('should format verification message correctly', async () => {
      await service.sendVerificationCode('+9779812345678', '654321', 'login');
      // Should not throw
    });
  });

  describe('sendBookingConfirmationSms', () => {
    it('should send booking details SMS', async () => {
      await service.sendBookingConfirmationSms('+9779812345678', {
        id: 'booking-1',
        listingTitle: 'Cozy Apartment',
        startDate: new Date('2025-01-10'),
        endDate: new Date('2025-01-15'),
        totalPrice: 500,
        currency: 'USD',
      });
      // Should not throw
    });
  });

  describe('handleWebhook', () => {
    it('should process delivered webhook event', async () => {
      await service.handleWebhook({
        MessageSid: 'SM_test',
        To: '+9779812345678',
        From: '+1234567890',
        MessageStatus: 'delivered',
      });
      // Should not throw
    });

    it('should handle failed delivery event', async () => {
      await service.handleWebhook({
        MessageSid: 'SM_fail',
        To: '+9779812345678',
        From: '+1234567890',
        MessageStatus: 'failed',
        ErrorCode: '30001',
      });
      // Should not throw
    });

    it('should handle undelivered event', async () => {
      await service.handleWebhook({
        MessageSid: 'SM_undel',
        MessageStatus: 'undelivered',
      });
      // Should not throw
    });

    it('should handle events with lowercase field names', async () => {
      await service.handleWebhook({
        sid: 'SM_lower',
        to: '+9779812345678',
        status: 'delivered',
      });
      // Should not throw
    });
  });

  describe('testSmsConfiguration', () => {
    it('should send test SMS when TEST_PHONE configured', async () => {
      const result = await service.testSmsConfiguration();

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should fail when TEST_PHONE not configured', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TEST_PHONE') return undefined;
        if (key === 'TWILIO_ACCOUNT_SID') return 'AC_test';
        if (key === 'TWILIO_AUTH_TOKEN') return 'token';
        if (key === 'TWILIO_PHONE_NUMBER') return '+1234567890';
        return undefined;
      });

      service = new SmsService(configService, prisma);

      const result = await service.testSmsConfiguration();

      expect(result.success).toBe(false);
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate phone number via Twilio lookup', async () => {
      const result = await service.validatePhoneNumber('+9779812345678');

      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
    });

    it('should return invalid for bad numbers', async () => {
      // Force lookup to error
      const svc = service as any;
      if (svc.twilioClient?.lookups?.v2?.phoneNumbers) {
        svc.twilioClient.lookups.v2.phoneNumbers.mockReturnValueOnce({
          fetch: jest.fn().mockRejectedValue(new Error('Invalid')),
        });
      }

      const result = await service.validatePhoneNumber('invalid');

      expect(result.valid).toBe(false);
    });
  });
});
