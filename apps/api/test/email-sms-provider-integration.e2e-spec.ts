/**
 * Email and SMS Provider Integration Tests
 *
 * These tests validate our integration with email and SMS providers by mocking
 * the provider behavior while testing our actual code paths.
 *
 * === APPROACH ===
 * - Our code (EmailService, SmsService) is tested without modification
 * - Provider behavior (Resend, Twilio, SNS) is mocked to simulate real scenarios
 * - Tests cover success, failure, retry, and edge cases
 *
 * === MOCKED PROVIDER BEHAVIOR ===
 * - Email: Simulate Resend API responses (success, rate limits, failures)
 * - SMS: Simulate Twilio/SNS API responses (success, rate limits, invalid numbers)
 *
 * === WHY THIS APPROACH ===
 * - Tests our integration logic without requiring actual provider credentials
 * - Validates error handling, retry logic, and fallback mechanisms
 * - Faster and more reliable than hitting real provider APIs
 * - Can simulate edge cases that are hard to trigger with real providers
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { EmailService } from '../src/common/email/email.service';
import { ResendEmailService } from '../src/common/email/resend-email.service';
import { SmsService } from '../src/modules/notifications/services/sms.service';
import { ConfigService } from '@nestjs/config';

describe('Email and SMS Provider Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emailService: EmailService;
  let smsService: SmsService;
  let resendEmailService: jest.Mocked<ResendEmailService>;
  let configService: jest.Mocked<ConfigService>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ResendEmailService)
      .useValue({
        sendEmail: jest.fn().mockResolvedValue({ id: 'email-id-123' }),
      })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string) => {
          const defaults: Record<string, any> = {
            NODE_ENV: 'test',
            EMAIL_ENABLED: true,
            FRONTEND_URL: 'https://gharbatai.np',
            APP_URL: 'http://localhost:3401',
            SMS_PROVIDER: 'twilio',
            TWILIO_ACCOUNT_SID: 'AC_test',
            TWILIO_AUTH_TOKEN: 'auth_test',
            TWILIO_PHONE_NUMBER: '+1234567890',
          };
          return defaults[key];
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    emailService = app.get(EmailService);
    smsService = app.get(SmsService);
    resendEmailService = app.get(ResendEmailService);
    configService = app.get(ConfigService);
  }, 30_000);

  afterAll(async () => {
    if (app) {
      await prisma.$disconnect();
      await app.close();
    }
  });

  describe('Email Provider Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Successful Email Delivery', () => {
      it('should send email through Resend provider', async () => {
        resendEmailService.sendEmail.mockResolvedValue({ id: 'email-123' });

        await emailService.sendEmail('user@test.np', 'Test Subject', '<h1>Test Body</h1>');

        expect(resendEmailService.sendEmail).toHaveBeenCalledWith({
          to: 'user@test.np',
          subject: 'Test Subject',
          html: '<h1>Test Body</h1>',
        });
      });

      it('should send password reset email with correct template', async () => {
        resendEmailService.sendEmail.mockResolvedValue({ id: 'reset-email-123' });

        await emailService.sendPasswordResetEmail('user@test.np', 'reset-token-abc');

        const call = resendEmailService.sendEmail.mock.calls[0][0];
        expect(call.to).toBe('user@test.np');
        expect(call.subject).toBe('Password Reset Request');
        expect(call.html).toContain('https://gharbatai.np/reset-password?token=reset-token-abc');
      });

      it('should send welcome email with user data', async () => {
        resendEmailService.sendEmail.mockResolvedValue({ id: 'welcome-email-123' });

        await emailService.sendWelcomeEmail({ email: 'newuser@test.np', firstName: 'John' });

        const call = resendEmailService.sendEmail.mock.calls[0][0];
        expect(call.to).toBe('newuser@test.np');
        expect(call.subject).toBe('Welcome to GharBatai!');
        expect(call.html).toContain('John');
      });

      it('should send booking confirmation email', async () => {
        resendEmailService.sendEmail.mockResolvedValue({ id: 'booking-email-123' });

        await emailService.sendBookingConfirmationEmail({
          email: 'renter@test.np',
          bookingId: 'booking-123',
          listingTitle: 'Test Listing',
          startDate: '2026-04-01',
          endDate: '2026-04-05',
        });

        const call = resendEmailService.sendEmail.mock.calls[0][0];
        expect(call.to).toBe('renter@test.np');
        expect(call.html).toContain('booking-123');
        expect(call.html).toContain('Test Listing');
      });
    });

    describe('Provider Error Handling', () => {
      it('should handle Resend rate limit errors gracefully', async () => {
        const rateLimitError = new Error('Too many requests');
        rateLimitError['status'] = 429;
        resendEmailService.sendEmail.mockRejectedValue(rateLimitError);

        // Should not throw, should log error instead
        await expect(
          emailService.sendEmail('user@test.np', 'Test', '<p>Body</p>'),
        ).resolves.toBeUndefined();
      });

      it('should handle Resend authentication errors gracefully', async () => {
        const authError = new Error('Invalid API key');
        authError['status'] = 401;
        resendEmailService.sendEmail.mockRejectedValue(authError);

        await expect(
          emailService.sendEmail('user@test.np', 'Test', '<p>Body</p>'),
        ).resolves.toBeUndefined();
      });

      it('should handle Resend server errors gracefully', async () => {
        const serverError = new Error('Internal server error');
        serverError['status'] = 500;
        resendEmailService.sendEmail.mockRejectedValue(serverError);

        await expect(
          emailService.sendEmail('user@test.np', 'Test', '<p>Body</p>'),
        ).resolves.toBeUndefined();
      });

      it('should handle network errors gracefully', async () => {
        resendEmailService.sendEmail.mockRejectedValue(new Error('ECONNREFUSED'));

        await expect(
          emailService.sendEmail('user@test.np', 'Test', '<p>Body</p>'),
        ).resolves.toBeUndefined();
      });
    });

    describe('Email Service Configuration', () => {
      it('should skip sending when email is disabled', async () => {
        configService.get.mockImplementation((key: string) => {
          if (key === 'EMAIL_ENABLED') return false;
          if (key === 'NODE_ENV') return 'test';
          return null;
        });

        // Re-create service with disabled email
        const disabledEmailService = new EmailService(configService, resendEmailService);
        await disabledEmailService.sendEmail('user@test.np', 'Test', '<p>Body</p>');

        expect(resendEmailService.sendEmail).not.toHaveBeenCalled();
      });

      it('should skip sending when recipient is empty', async () => {
        await emailService.sendEmail('', 'Test', '<p>Body</p>');

        expect(resendEmailService.sendEmail).not.toHaveBeenCalled();
      });

      it('should skip sending when recipient is null', async () => {
        await emailService.sendEmail(null as any, 'Test', '<p>Body</p>');

        expect(resendEmailService.sendEmail).not.toHaveBeenCalled();
      });
    });
  });

  describe('SMS Provider Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Successful SMS Delivery', () => {
      it('should send SMS via Twilio provider', async () => {
        // Mock successful Twilio response
        const mockTwilioClient = {
          messages: {
            create: jest.fn().mockResolvedValue({
              sid: 'SM123456789',
              status: 'queued',
            }),
          },
        };

        // Inject mock Twilio client
        (smsService as any).twilioClient = mockTwilioClient;

        const result = await smsService.sendSms('+9779812345678', 'Test message');

        expect(result.success).toBe(true);
        expect(result.sid).toBe('SM123456789');
        expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
          to: '+9779812345678',
          from: '+1234567890',
          body: 'Test message',
        });
      });

      it('should send OTP via SMS', async () => {
        const mockTwilioClient = {
          messages: {
            create: jest.fn().mockResolvedValue({
              sid: 'SM123456789',
              status: 'queued',
            }),
          },
        };

        (smsService as any).twilioClient = mockTwilioClient;

        const result = await (smsService as any).sendOTP('+9779812345678', '123456');

        expect(result.success).toBe(true);
        expect(mockTwilioClient.messages.create).toHaveBeenCalled();
      });

      it('should handle both SMS calling conventions', async () => {
        const mockTwilioClient = {
          messages: {
            create: jest.fn().mockResolvedValue({
              sid: 'SM123456789',
              status: 'queued',
            }),
          },
        };

        (smsService as any).twilioClient = mockTwilioClient;

        // Test object parameter
        await smsService.sendSms({ to: '+9779812345678', message: 'Test' });
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();

        // Test string parameters
        await smsService.sendSms('+9779812345678', 'Test');
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(1);
      });
    });

    describe('SMS Provider Error Handling', () => {
      it('should handle Twilio rate limit errors with retry', async () => {
        const rateLimitError = new Error('Rate limit exceeded');
        rateLimitError['code'] = 20429;
        rateLimitError['status'] = 429;

        const mockTwilioClient = {
          messages: {
            create: jest.fn()
              .mockRejectedValueOnce(rateLimitError)
              .mockResolvedValue({
                sid: 'SM123456789',
                status: 'queued',
              }),
          },
        };

        (smsService as any).twilioClient = mockTwilioClient;

        const result = await smsService.sendSms('+9779812345678', 'Test message');

        expect(result.success).toBe(true);
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2); // Initial + 1 retry
      });

      it('should handle invalid phone number errors without retry', async () => {
        const invalidNumberError = new Error('Invalid phone number');
        invalidNumberError['code'] = 21211;
        invalidNumberError['status'] = 400;

        const mockTwilioClient = {
          messages: {
            create: jest.fn().mockRejectedValue(invalidNumberError),
          },
        };

        (smsService as any).twilioClient = mockTwilioClient;

        const result = await smsService.sendSms('+9779812345678', 'Test message');

        expect(result.success).toBe(false);
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(1); // No retry for non-transient error
      });

      it('should handle authentication errors without retry', async () => {
        const authError = new Error('Invalid credentials');
        authError['code'] = 20003;
        authError['status'] = 401;

        const mockTwilioClient = {
          messages: {
            create: jest.fn().mockRejectedValue(authError),
          },
        };

        (smsService as any).twilioClient = mockTwilioClient;

        const result = await smsService.sendSms('+9779812345678', 'Test message');

        expect(result.success).toBe(false);
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(1);
      });

      it('should handle network errors gracefully', async () => {
        const networkError = new Error('ECONNREFUSED');
        networkError['status'] = 503;

        const mockTwilioClient = {
          messages: {
            create: jest.fn().mockRejectedValue(networkError),
          },
        };

        (smsService as any).twilioClient = mockTwilioClient;

        const result = await smsService.sendSms('+9779812345678', 'Test message');

        expect(result.success).toBe(false);
      });
    });

    describe('SMS Retry Logic', () => {
      it('should retry transient errors up to max retries', async () => {
        const transientError = new Error('Service unavailable');
        transientError['code'] = 20503;
        transientError['status'] = 503;

        const mockTwilioClient = {
          messages: {
            create: jest.fn()
              .mockRejectedValueOnce(transientError)
              .mockRejectedValueOnce(transientError)
              .mockResolvedValue({
                sid: 'SM123456789',
                status: 'queued',
              }),
          },
        };

        (smsService as any).twilioClient = mockTwilioClient;

        const result = await smsService.sendSms('+9779812345678', 'Test message');

        expect(result.success).toBe(true);
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(3); // Initial + 2 retries
      });

      it('should fail after max retries for transient errors', async () => {
        const transientError = new Error('Service unavailable');
        transientError['code'] = 20503;
        transientError['status'] = 503;

        const mockTwilioClient = {
          messages: {
            create: jest.fn().mockRejectedValue(transientError),
          },
        };

        (smsService as any).twilioClient = mockTwilioClient;

        const result = await smsService.sendSms('+9779812345678', 'Test message');

        expect(result.success).toBe(false);
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(3); // Initial + 2 retries
      });
    });

    describe('SMS Provider Fallback', () => {
      it('should handle unknown provider gracefully', async () => {
        configService.get.mockImplementation((key: string) => {
          if (key === 'SMS_PROVIDER') return 'unknown_provider';
          return null;
        });

        const fallbackService = new SmsService(configService);
        const result = await fallbackService.sendSms('+9779812345678', 'Test message');

        expect(result.success).toBe(false);
      });

      it('should handle missing provider configuration', async () => {
        configService.get.mockReturnValue(undefined);

        const noConfigService = new SmsService(configService);
        const result = await noConfigService.sendSms('+9779812345678', 'Test message');

        expect(result.success).toBe(false);
      });
    });
  });

  describe('Combined Email and SMS Workflows', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should send both email and SMS for two-factor authentication', async () => {
      resendEmailService.sendEmail.mockResolvedValue({ id: 'email-123' });

      const mockTwilioClient = {
        messages: {
          create: jest.fn().mockResolvedValue({
            sid: 'SM123456789',
            status: 'queued',
          }),
        },
      };

      (smsService as any).twilioClient = mockTwilioClient;

      // Simulate 2FA: send OTP via email and SMS
      const otp = '123456';
      const userPhone = '+9779812345678';
      const userEmail = 'user@test.np';

      await Promise.all([
        emailService.sendEmail(userEmail, 'Your Verification Code', `<p>Your code is: ${otp}</p>`),
        smsService.sendSms(userPhone, `Your verification code is: ${otp}`),
      ]);

      expect(resendEmailService.sendEmail).toHaveBeenCalledWith({
        to: userEmail,
        subject: 'Your Verification Code',
        html: expect.stringContaining(otp),
      });

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        to: userPhone,
        from: '+1234567890',
        body: expect.stringContaining(otp),
      });
    });

    it('should handle partial failure in multi-channel notification', async () => {
      resendEmailService.sendEmail.mockRejectedValue(new Error('Email failed'));

      const mockTwilioClient = {
        messages: {
          create: jest.fn().mockResolvedValue({
            sid: 'SM123456789',
            status: 'queued',
          }),
        },
      };

      (smsService as any).twilioClient = mockTwilioClient;

      const otp = '123456';
      const userPhone = '+9779812345678';
      const userEmail = 'user@test.np';

      const results = await Promise.allSettled([
        emailService.sendEmail(userEmail, 'Your Verification Code', `<p>Your code is: ${otp}</p>`),
        smsService.sendSms(userPhone, `Your verification code is: ${otp}`),
      ]);

      // Email should fail gracefully (resolves despite error)
      expect(results[0].status).toBe('fulfilled');
      // SMS should succeed
      expect(results[1].status).toBe('fulfilled');
    });
  });
});
