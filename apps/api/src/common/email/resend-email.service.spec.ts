import { ResendEmailService, SendEmailOptions } from './resend-email.service';
import { ConfigService } from '@nestjs/config';

/* ── mocks ── */

const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...args: any[]) => mockSend(...args) },
  })),
}));

function makeService(overrides: Record<string, string> = {}) {
  const config: Record<string, string> = {
    RESEND_API_KEY: 're_test_123',
    EMAIL_FROM: 'info@gharbatai.np',
    ...overrides,
  };
  const configService = { get: jest.fn((key: string) => config[key]) } as unknown as ConfigService;
  return new ResendEmailService(configService);
}

describe('ResendEmailService', () => {
  beforeEach(() => jest.clearAllMocks());

  /* ── sendEmail ── */

  describe('sendEmail', () => {
    it('sends email successfully and returns id', async () => {
      mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
      const svc = makeService();
      const result = await svc.sendEmail({
        to: 'a@b.np',
        subject: 'Hi',
        html: '<p>Hello</p>',
      });
      expect(result).toEqual({ id: 'email-1' });
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'info@gharbatai.np',
          to: ['a@b.np'],
          subject: 'Hi',
          html: '<p>Hello</p>',
        }),
      );
    });

    it('accepts array of recipients', async () => {
      mockSend.mockResolvedValue({ data: { id: 'email-2' }, error: null });
      const svc = makeService();
      await svc.sendEmail({ to: ['a@b.np', 'c@d.np'], subject: 'Test', html: '' });
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: ['a@b.np', 'c@d.np'] }));
    });

    it('normalises cc and bcc into arrays', async () => {
      mockSend.mockResolvedValue({ data: { id: 'e3' }, error: null });
      const svc = makeService();
      await svc.sendEmail({ to: 'a@b.np', subject: 's', html: '', cc: 'cc@b.np', bcc: 'bcc@b.np' });
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ cc: ['cc@b.np'], bcc: ['bcc@b.np'] }),
      );
    });

    it('returns null when Resend returns an error', async () => {
      mockSend.mockResolvedValue({ data: null, error: { message: 'rate limited' } });
      const svc = makeService();
      const result = await svc.sendEmail({ to: 'x@y.np', subject: 's', html: '' });
      expect(result).toBeNull();
    });

    it('returns null when send throws', async () => {
      mockSend.mockRejectedValue(new Error('network error'));
      const svc = makeService();
      const result = await svc.sendEmail({ to: 'x@y.np', subject: 's', html: '' });
      expect(result).toBeNull();
    });

    it('uses default from when EMAIL_FROM is not set', async () => {
      mockSend.mockResolvedValue({ data: { id: 'e4' }, error: null });
      const svc = makeService({ EMAIL_FROM: '' });
      await svc.sendEmail({ to: 'a@b.np', subject: 's', html: '' });
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ from: 'noreply@resend.dev' }));
    });
  });

  /* ── sendVerificationEmail ── */

  describe('sendVerificationEmail', () => {
    it('returns true on success', async () => {
      mockSend.mockResolvedValue({ data: { id: 'v1' }, error: null });
      const svc = makeService();
      const result = await svc.sendVerificationEmail('u@x.np', 'https://app/verify?t=abc');
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Verify Your Email Address',
          to: ['u@x.np'],
        }),
      );
    });

    it('returns false when underlying send fails', async () => {
      mockSend.mockResolvedValue({ data: null, error: { message: 'err' } });
      const svc = makeService();
      expect(await svc.sendVerificationEmail('u@x.np', 'url')).toBe(false);
    });
  });

  /* ── sendPasswordResetEmail ── */

  describe('sendPasswordResetEmail', () => {
    it('returns true on success and includes reset URL', async () => {
      mockSend.mockResolvedValue({ data: { id: 'r1' }, error: null });
      const svc = makeService();
      const result = await svc.sendPasswordResetEmail('u@x.np', 'https://app/reset?t=xyz');
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Reset Your Password',
          html: expect.stringContaining('https://app/reset?t=xyz'),
        }),
      );
    });

    it('returns false on failure', async () => {
      mockSend.mockRejectedValue(new Error('timeout'));
      const svc = makeService();
      expect(await svc.sendPasswordResetEmail('u@x.np', 'url')).toBe(false);
    });
  });

  /* ── sendBookingNotification ── */

  describe('sendBookingNotification', () => {
    const details = {
      bookingId: 'bk-1',
      itemName: '2BR Flat',
      startDate: '2025-01-01',
      endDate: '2025-01-15',
      totalPrice: 45000,
    };

    it('returns true and formats amount with formatCurrency', async () => {
      mockSend.mockResolvedValue({ data: { id: 'b1' }, error: null });
      const svc = makeService();
      const result = await svc.sendBookingNotification('u@x.np', details);
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Booking Confirmation - 2BR Flat',
          html: expect.stringContaining('NPR'),
        }),
      );
    });

    it('returns false on failure', async () => {
      mockSend.mockResolvedValue({ data: null, error: { message: 'bad' } });
      const svc = makeService();
      expect(await svc.sendBookingNotification('u@x.np', details)).toBe(false);
    });
  });
});
