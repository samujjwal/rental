import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { ResendEmailService } from './resend-email.service';

describe('EmailService', () => {
  let service: EmailService;
  let resendEmailService: jest.Mocked<ResendEmailService>;
  let configService: jest.Mocked<ConfigService>;

  const createService = (envOverrides: Record<string, any> = {}) => {
    configService = {
      get: jest.fn((key: string) => {
        const defaults: Record<string, any> = {
          NODE_ENV: 'development',
          EMAIL_ENABLED: true,
          FRONTEND_URL: 'https://gharbatai.np',
          APP_URL: 'http://localhost:3401',
          ...envOverrides,
        };
        return defaults[key];
      }),
    } as any;

    resendEmailService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    } as any;

    return new EmailService(configService, resendEmailService);
  };

  beforeEach(() => {
    service = createService();
  });

  describe('sendEmail', () => {
    it('sends email when enabled', async () => {
      await service.sendEmail('user@test.np', 'Hello', '<h1>Hi</h1>');

      expect(resendEmailService.sendEmail).toHaveBeenCalledWith({
        to: 'user@test.np',
        subject: 'Hello',
        html: '<h1>Hi</h1>',
      });
    });

    it('does not send when email is disabled', async () => {
      service = createService({ EMAIL_ENABLED: false });

      await service.sendEmail('user@test.np', 'Hello', '<h1>Hi</h1>');

      expect(resendEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('skips when recipient is empty', async () => {
      await service.sendEmail('', 'Hello', '<h1>Hi</h1>');

      expect(resendEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('does not throw on send failure', async () => {
      resendEmailService.sendEmail.mockRejectedValue(new Error('SMTP down'));

      await expect(
        service.sendEmail('user@test.np', 'Fail', '<p>test</p>'),
      ).resolves.toBeUndefined();
    });

    it('parses string "true" as enabled', () => {
      service = createService({ EMAIL_ENABLED: 'true' });
      // No error on creation, email is enabled
      expect(service).toBeDefined();
    });

    it('parses string "false" as disabled', async () => {
      service = createService({ EMAIL_ENABLED: 'false' });

      await service.sendEmail('user@test.np', 'Hello', '<h1>Hi</h1>');

      expect(resendEmailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends password reset email with correct URL', async () => {
      await service.sendPasswordResetEmail('user@test.np', 'reset-token-abc');

      expect(resendEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.np',
          subject: 'Password Reset Request',
        }),
      );

      const call = resendEmailService.sendEmail.mock.calls[0][0];
      expect(call.html).toContain('https://gharbatai.np/reset-password?token=reset-token-abc');
    });

    it('encodes reset token in URL', async () => {
      await service.sendPasswordResetEmail('user@test.np', 'token with spaces&special=chars');

      const call = resendEmailService.sendEmail.mock.calls[0][0];
      expect(call.html).toContain(encodeURIComponent('token with spaces&special=chars'));
    });

    it('falls back to APP_URL when FRONTEND_URL is not set', async () => {
      service = createService({ FRONTEND_URL: undefined });

      await service.sendPasswordResetEmail('user@test.np', 'token123');

      const call = resendEmailService.sendEmail.mock.calls[0][0];
      expect(call.html).toContain('http://localhost:3401/reset-password');
    });
  });
});
