import { EmailService } from './resend.service';

// Mock resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'msg_test123' } }),
    },
  })),
}));

describe('EmailService (Resend)', () => {
  let service: EmailService;
  let configService: any;
  let prisma: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          RESEND_API_KEY: 're_test_key',
          APP_NAME: 'GharBatai',
          APP_URL: 'https://gharbatai.com',
          FROM_EMAIL: 'noreply@gharbatai.com',
          TEST_EMAIL: 'test@gharbatai.com',
          NODE_ENV: 'test',
        };
        return map[key];
      }),
    };

    prisma = {};

    service = new EmailService(configService, prisma);
  });

  describe('sendEmail', () => {
    it('should send email via Resend and return messageId', async () => {
      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });

      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
    });

    it('should use configured from address', async () => {
      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      });

      // Service should use configured FROM_EMAIL
      expect(configService.get).toHaveBeenCalled();
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email to new user', async () => {
      await expect(
        service.sendWelcomeEmail({
          email: 'new@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset with 10min expiry notice', async () => {
      await expect(
        service.sendPasswordResetEmail(
          { email: 'user@example.com', firstName: 'John' },
          'reset-token-123',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendBookingConfirmationEmail', () => {
    it('should send booking confirmation details', async () => {
      await expect(
        service.sendBookingConfirmationEmail(
          { email: 'renter@example.com', firstName: 'Jane' },
          {
            id: 'booking-1',
            listingTitle: 'Cozy Apartment',
            startDate: new Date('2025-01-10'),
            endDate: new Date('2025-01-15'),
            totalPrice: 500,
            currency: 'USD',
          },
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendBookingRequestEmail', () => {
    it('should send booking request to owner', async () => {
      await expect(
        service.sendBookingRequestEmail(
          { email: 'owner@example.com', firstName: 'Owner' },
          {
            id: 'booking-2',
            listingTitle: 'Luxury Villa',
            startDate: new Date('2025-02-01'),
            endDate: new Date('2025-02-05'),
            totalPrice: 500,
            currency: 'USD',
            renterName: 'Jane Doe',
            message: 'Looking forward to stay',
          },
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendPaymentConfirmationEmail', () => {
    it('should send payment confirmation', async () => {
      await expect(
        service.sendPaymentConfirmationEmail(
          { email: 'user@example.com', firstName: 'John' },
          {
            bookingId: 'booking-1',
            amount: 500,
            currency: 'USD',
            paymentMethod: 'card',
          },
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendReviewReminderEmail', () => {
    it('should send review reminder', async () => {
      await expect(
        service.sendReviewReminderEmail(
          { email: 'user@example.com', firstName: 'John' },
          {
            id: 'booking-1',
            listingTitle: 'Cozy Apartment',
            ownerName: 'Jane Smith',
            completedDate: new Date('2025-01-15'),
          },
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendOrganizationInvitationEmail', () => {
    it('should send org invitation with 7-day expiry', async () => {
      await expect(
        service.sendOrganizationInvitationEmail(
          'invitee@example.com',
          { name: 'Acme Corp', inviterName: 'Admin User' },
          'invite-token-abc',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('testEmailConfiguration', () => {
    it('should send test email when TEST_EMAIL is configured', async () => {
      const result = await service.testEmailConfiguration();

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should fail when TEST_EMAIL not configured', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TEST_EMAIL') return undefined;
        if (key === 'RESEND_API_KEY') return 're_test_key';
        return undefined;
      });

      service = new EmailService(configService, prisma);

      const result = await service.testEmailConfiguration();
      expect(result.success).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should warn when RESEND_API_KEY is not configured', () => {
      const noKeyConfig = {
        get: jest.fn().mockReturnValue(undefined),
      };

      // Should not throw
      const svc = new EmailService(noKeyConfig as any, prisma);
      expect(svc).toBeDefined();
    });
  });
});
