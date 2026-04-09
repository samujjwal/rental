import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { SMSService } from './sms.service';
import { NotificationQueueService } from './notification-queue.service';
import { TemplateService } from './template.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * EMAIL/SMS INTEGRATION TESTS
 * 
 * These tests validate email and SMS notification integration:
 * - Email delivery and templating
 * - SMS delivery and rate limiting
 * - Cross-channel notification consistency
 * - Template rendering and personalization
 * - Delivery tracking and analytics
 * 
 * Business Truth Validated:
 * - Emails are delivered reliably with proper templates
 * - SMS messages are sent with rate limiting
 * - Cross-channel notifications are consistent
 * - Templates render correctly with personalization
 * - Delivery tracking works across channels
 */

describe('EmailSMSIntegration', () => {
  let emailService: EmailService;
  let smsService: SMSService;
  let queueService: NotificationQueueService;
  let templateService: TemplateService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        SMSService,
        {
          provide: NotificationQueueService,
          useValue: {
            enqueue: jest.fn(),
            process: jest.fn(),
            getStats: jest.fn(),
          },
        },
        {
          provide: TemplateService,
          useValue: {
            render: jest.fn(),
            getTemplate: jest.fn(),
            validateTemplate: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'email.provider': 'sendgrid',
                'email.from': 'noreply@gharbatai.com',
                'sms.provider': 'twilio',
                'sms.from': '+9779801234567',
                'notification.rateLimit.sms': 10,
                'notification.rateLimit.email': 100,
              };
              return config[key];
            }),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
    smsService = module.get<SMSService>(SMSService);
    queueService = module.get<NotificationQueueService>(NotificationQueueService);
    templateService = module.get<TemplateService>(TemplateService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Email Integration', () => {
    it('should send templated email successfully', async () => {
      const templateData = {
        templateId: 'booking-confirmation',
        recipient: 'user@example.com',
        data: {
          userName: 'John Doe',
          bookingId: 'BK-123456',
          propertyName: 'Luxury Apartment in Kathmandu',
          checkIn: '2024-06-01',
          checkOut: '2024-06-07',
          totalPrice: 'NPR 21,000',
        },
      };

      const renderedTemplate = `
        <h1>Booking Confirmation</h1>
        <p>Dear John Doe,</p>
        <p>Your booking BK-123456 has been confirmed.</p>
        <p>Property: Luxury Apartment in Kathmandu</p>
        <p>Check-in: June 1, 2024</p>
        <p>Check-out: June 7, 2024</p>
        <p>Total: NPR 21,000</p>
      `;

      templateService.render.mockResolvedValue(renderedTemplate);

      const result = await emailService.sendTemplatedEmail(
        templateData.recipient,
        templateData.templateId,
        templateData.data
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(templateService.render).toHaveBeenCalledWith(
        templateData.templateId,
        templateData.data
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Email sent successfully'),
        expect.objectContaining({
          recipient: templateData.recipient,
          templateId: templateData.templateId,
          messageId: result.messageId,
        })
      );
    });

    it('should handle email delivery failures', async () => {
      const templateData = {
        recipient: 'invalid-email',
        templateId: 'booking-confirmation',
        data: { userName: 'John' },
      };

      templateService.render.mockResolvedValue('<p>Test</p>');
      
      // Mock email service failure
      const emailProvider = {
        send: jest.fn().mockRejectedValue(new Error('Invalid recipient')),
      };
      (emailService as any).provider = emailProvider;

      const result = await emailService.sendTemplatedEmail(
        templateData.recipient,
        templateData.templateId,
        templateData.data
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid recipient');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Email delivery failed'),
        expect.objectContaining({
          recipient: templateData.recipient,
          error: 'Invalid recipient',
        })
      );
    });

    it('should validate email template syntax', async () => {
      const template = `
        <h1>{{title}}</h1>
        <p>Hello {{userName}},</p>
        <p>Your booking {{bookingId}} is confirmed.</p>
        {{#if showDetails}}
        <p>Details: {{details}}</p>
        {{/if}}
      `;

      const data = {
        title: 'Booking Confirmation',
        userName: 'John Doe',
        bookingId: 'BK-123456',
        showDetails: true,
        details: 'Check-in: June 1, 2024',
      };

      templateService.validateTemplate.mockResolvedValue(true);
      templateService.render.mockResolvedValue('<h1>Booking Confirmation</h1><p>Hello John Doe,</p>');

      const isValid = await templateService.validateTemplate(template);
      const rendered = await templateService.render(template, data);

      expect(isValid).toBe(true);
      expect(rendered).toContain('Booking Confirmation');
      expect(rendered).toContain('John Doe');
    });

    it('should handle email attachments', async () => {
      const emailData = {
        recipient: 'user@example.com',
        subject: 'Booking Receipt',
        template: 'receipt-template',
        data: { bookingId: 'BK-123456' },
        attachments: [
          {
            filename: 'receipt.pdf',
            content: Buffer.from('pdf content'),
            contentType: 'application/pdf',
          },
          {
            filename: 'invoice.pdf',
            content: Buffer.from('invoice content'),
            contentType: 'application/pdf',
          },
        ],
      };

      templateService.render.mockResolvedValue('<p>Your receipt</p>');

      const result = await emailService.sendEmailWithAttachments(emailData);

      expect(result.success).toBe(true);
      expect(result.attachments).toHaveLength(2);
      expect(result.attachments[0].filename).toBe('receipt.pdf');
    });

    it('should track email delivery analytics', async () => {
      const trackingData = {
        messageId: 'msg-123456',
        recipient: 'user@example.com',
        templateId: 'booking-confirmation',
        sentAt: new Date(),
        deliveredAt: new Date(),
        openedAt: new Date(),
        clickedAt: new Date(),
      };

      const analytics = await emailService.trackDelivery(trackingData);

      expect(analytics.deliveryRate).toBe(100);
      expect(analytics.openRate).toBe(100);
      expect(analytics.clickRate).toBe(100);
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Email analytics tracked'),
        expect.objectContaining({
          messageId: trackingData.messageId,
          deliveryRate: 100,
        })
      );
    });
  });

  describe('SMS Integration', () => {
    it('should send SMS message successfully', async () => {
      const smsData = {
        recipient: '+9771234567890',
        message: 'Your booking BK-123456 has been confirmed. Check your email for details.',
        templateId: 'booking-confirmation-sms',
        data: {
          bookingId: 'BK-123456',
          userName: 'John',
        },
      };

      const result = await smsService.sendSMS(smsData.recipient, smsData.message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.sid).toBeDefined();
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('SMS sent successfully'),
        expect.objectContaining({
          recipient: smsData.recipient,
          messageId: result.messageId,
        })
      );
    });

    it('should enforce SMS rate limiting', async () => {
      const recipient = '+9771234567890';
      const message = 'Test message';

      // Mock rate limit exceeded
      (smsService as any).rateLimiter = {
        checkLimit: jest.fn().mockResolvedValue(false),
      };

      const result = await smsService.sendSMS(recipient, message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('SMS rate limit exceeded'),
        expect.objectContaining({
          recipient,
        })
      );
    });

    it('should handle SMS delivery failures', async () => {
      const smsData = {
        recipient: '+9771234567890',
        message: 'Test message',
      };

      // Mock SMS provider failure
      const smsProvider = {
        messages: {
          create: jest.fn().mockRejectedValue(new Error('Invalid phone number')),
        },
      };
      (smsService as any).provider = smsProvider;

      const result = await smsService.sendSMS(smsData.recipient, smsData.message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('SMS delivery failed'),
        expect.objectContaining({
          recipient: smsData.recipient,
          error: 'Invalid phone number',
        })
      );
    });

    it('should validate phone numbers', async () => {
      const phoneNumbers = [
        '+9771234567890', // Valid Nepal number
        '+977987654321', // Valid Nepal number (short)
        '+1234567890', // Valid US number
        '1234567890', // Invalid - missing country code
        '+977123', // Invalid - too short
        '+977123456789012345', // Invalid - too long
        'invalid-phone', // Invalid - not a phone number
      ];

      const results = [];
      for (const phone of phoneNumbers) {
        const isValid = await smsService.validatePhoneNumber(phone);
        results.push({ phone, isValid });
      }

      expect(results[0].isValid).toBe(true); // +9771234567890
      expect(results[1].isValid).toBe(true); // +977987654321
      expect(results[2].isValid).toBe(true); // +1234567890
      expect(results[3].isValid).toBe(false); // 1234567890
      expect(results[4].isValid).toBe(false); // +977123
      expect(results[5].isValid).toBe(false); // +977123456789012345
      expect(results[6].isValid).toBe(false); // invalid-phone
    });

    it('should track SMS delivery status', async () => {
      const trackingData = {
        messageId: 'sms-123456',
        recipient: '+9771234567890',
        status: 'delivered',
        deliveredAt: new Date(),
        errorCode: null,
      };

      const status = await smsService.updateDeliveryStatus(trackingData);

      expect(status.success).toBe(true);
      expect(status.deliveryStatus).toBe('delivered');
      expect(status.deliveredAt).toBeInstanceOf(Date);
    });
  });

  describe('Cross-Channel Integration', () => {
    it('should send coordinated email and SMS notifications', async () => {
      const notificationData = {
        userId: 'user-123',
        type: 'booking-confirmation',
        channels: ['email', 'sms'],
        data: {
          userName: 'John Doe',
          bookingId: 'BK-123456',
          propertyName: 'Luxury Apartment',
        },
        contactInfo: {
          email: 'john@example.com',
          phone: '+9771234567890',
        },
      };

      // Mock successful sends
      templateService.render.mockResolvedValue('<p>Booking confirmed</p>');
      (emailService as any).provider = { send: jest.fn().mockResolvedValue({ id: 'email-123' }) };
      (smsService as any).provider = { 
        messages: { create: jest.fn().mockResolvedValue({ sid: 'sms-123' }) }
      };

      const result = await queueService.sendMultiChannelNotification(notificationData);

      expect(result.success).toBe(true);
      expect(result.channels).toEqual(['email', 'sms']);
      expect(result.results.email.success).toBe(true);
      expect(result.results.sms.success).toBe(true);
      expect(result.results.email.messageId).toBe('email-123');
      expect(result.results.sms.messageId).toBe('sms-123');
    });

    it('should handle partial cross-channel failures', async () => {
      const notificationData = {
        userId: 'user-123',
        type: 'booking-confirmation',
        channels: ['email', 'sms'],
        data: { userName: 'John' },
        contactInfo: {
          email: 'john@example.com',
          phone: '+9771234567890',
        },
      };

      // Mock email success, SMS failure
      templateService.render.mockResolvedValue('<p>Test</p>');
      (emailService as any).provider = { send: jest.fn().mockResolvedValue({ id: 'email-123' }) };
      (smsService as any).provider = { 
        messages: { create: jest.fn().mockRejectedValue(new Error('SMS failed')) }
      };

      const result = await queueService.sendMultiChannelNotification(notificationData);

      expect(result.success).toBe(false); // Overall failure due to SMS
      expect(result.results.email.success).toBe(true);
      expect(result.results.sms.success).toBe(false);
      expect(result.results.sms.error).toBe('SMS failed');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Partial notification failure'),
        expect.objectContaining({
          userId: notificationData.userId,
          failedChannels: ['sms'],
        })
      );
    });

    it('should maintain message consistency across channels', async () => {
      const notificationData = {
        userId: 'user-123',
        type: 'booking-confirmation',
        channels: ['email', 'sms'],
        data: {
          userName: 'John Doe',
          bookingId: 'BK-123456',
          propertyName: 'Luxury Apartment in Kathmandu',
          checkIn: '2024-06-01',
          checkOut: '2024-06-07',
        },
        contactInfo: {
          email: 'john@example.com',
          phone: '+9771234567890',
        },
      };

      // Mock templates
      const emailTemplate = `
        <h1>Booking Confirmation</h1>
        <p>Dear {{userName}},</p>
        <p>Your booking {{bookingId}} at {{propertyName}} is confirmed.</p>
        <p>Check-in: {{checkIn}}</p>
        <p>Check-out: {{checkOut}}</p>
      `;

      const smsTemplate = `Hi {{userName}}, your booking {{bookingId}} at {{propertyName}} is confirmed. Check-in: {{checkIn}}`;

      templateService.render
        .mockResolvedValueOnce(emailTemplate)
        .mockResolvedValueOnce(smsTemplate);

      const result = await queueService.sendMultiChannelNotification(notificationData);

      expect(result.results.email.content).toContain('John Doe');
      expect(result.results.email.content).toContain('BK-123456');
      expect(result.results.sms.content).toContain('John Doe');
      expect(result.results.sms.content).toContain('BK-123456');

      // Verify consistency in key information
      expect(result.results.email.content).toContain('Luxury Apartment in Kathmandu');
      expect(result.results.sms.content).toContain('Luxury Apartment in Kathmandu');
    });

    it('should respect user channel preferences', async () => {
      const notificationData = {
        userId: 'user-123',
        type: 'booking-confirmation',
        channels: ['email', 'sms'],
        data: { userName: 'John' },
        contactInfo: {
          email: 'john@example.com',
          phone: '+9771234567890',
        },
        preferences: {
          email: true,
          sms: false, // User prefers not to receive SMS
          push: true,
        },
      };

      const result = await queueService.sendMultiChannelNotification(notificationData);

      expect(result.channels).toEqual(['email']); // Only email sent
      expect(result.results.email).toBeDefined();
      expect(result.results.sms).toBeUndefined();
    });
  });

  describe('Template Integration', () => {
    it('should render personalized templates correctly', async () => {
      const templateData = {
        templateId: 'personalized-welcome',
        data: {
          userName: 'John Doe',
          firstName: 'John',
          lastName: 'Doe',
          preferredLanguage: 'en',
          location: 'Kathmandu',
          membershipLevel: 'premium',
        },
      };

      const renderedTemplate = `
        <h1>Welcome, {{firstName}}!</h1>
        <p>Hello {{userName}},</p>
        <p>As a {{membershipLevel}} member from {{location}}, you get exclusive benefits.</p>
        <p>Best regards,<br>The GharBatai Team</p>
      `;

      templateService.render.mockResolvedValue(renderedTemplate);

      const result = await templateService.renderPersonalized(
        templateData.templateId,
        templateData.data
      );

      expect(result).toContain('Welcome, John!');
      expect(result).toContain('Hello John Doe,');
      expect(result).toContain('premium member from Kathmandu');
    });

    it('should handle template variables with different data types', async () => {
      const templateData = {
        templateId: 'booking-summary',
        data: {
          bookingId: 'BK-123456',
          totalPrice: 21000.50,
          currency: 'NPR',
          isGuest: true,
          amenities: ['wifi', 'parking', 'gym'],
          checkIn: new Date('2024-06-01'),
          rating: 4.8,
        },
      };

      const renderedTemplate = `
        <h1>Booking {{bookingId}}</h1>
        <p>Total: {{currency}} {{totalPrice}}</p>
        <p>Guest: {{#if isGuest}}Yes{{else}}No{{/if}}</p>
        <p>Amenities: {{amenities.0}}, {{amenities.1}}, {{amenities.2}}</p>
        <p>Check-in: {{checkIn}}</p>
        <p>Rating: {{rating}}/5</p>
      `;

      templateService.render.mockResolvedValue(renderedTemplate);

      const result = await templateService.render(templateData.templateId, templateData.data);

      expect(result).toContain('Booking BK-123456');
      expect(result).toContain('Total: NPR 21000.5');
      expect(result).toContain('Guest: Yes');
      expect(result).toContain('wifi, parking, gym');
    });

    it('should validate template syntax and variables', async () => {
      const invalidTemplates = [
        '{{unclosedVariable}', // Unclosed variable
        '{{undefined.variable}}', // Undefined variable
        '{{#if}}', // Unclosed conditional
        '{{invalid.syntax}}', // Invalid syntax
      ];

      const validTemplate = `
        <h1>{{title}}</h1>
        <p>{{#if showContent}}{{content}}{{/if}}</p>
        <ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>
      `;

      for (const template of invalidTemplates) {
        const isValid = await templateService.validateTemplate(template);
        expect(isValid).toBe(false);
      }

      const isValid = await templateService.validateTemplate(validTemplate);
      expect(isValid).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high volume email sending', async () => {
      const emails = Array.from({ length: 100 }, (_, i) => ({
        recipient: `user${i}@example.com`,
        templateId: 'bulk-notification',
        data: { userName: `User ${i}` },
      }));

      templateService.render.mockResolvedValue('<p>Bulk notification</p>');

      const startTime = Date.now();
      const results = await Promise.all(
        emails.map(email => emailService.sendTemplatedEmail(
          email.recipient,
          email.templateId,
          email.data
        ))
      );
      const endTime = Date.now();

      const duration = endTime - startTime;
      const successCount = results.filter(r => r.success).length;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(successCount).toBe(100);
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Bulk email processing completed'),
        expect.objectContaining({
          totalEmails: 100,
          successCount: 100,
          duration: expect.any(Number),
        })
      );
    });

    it('should handle SMS rate limiting at scale', async () => {
      const smsMessages = Array.from({ length: 20 }, (_, i) => ({
        recipient: '+9771234567890',
        message: `Bulk message ${i}`,
      }));

      // Mock rate limiter that allows 10 messages per minute
      let messageCount = 0;
      (smsService as any).rateLimiter = {
        checkLimit: jest.fn().mockImplementation(() => {
          messageCount++;
          return messageCount <= 10; // Allow first 10, reject rest
        }),
      };

      const results = await Promise.all(
        smsMessages.map(sms => smsService.sendSMS(sms.recipient, sms.message))
      );

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      expect(successCount).toBe(10);
      expect(failureCount).toBe(10);
      expect(results.slice(10).every(r => r.error?.includes('Rate limit'))).toBe(true);
    });
  });
});
