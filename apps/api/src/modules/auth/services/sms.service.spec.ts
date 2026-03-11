import { SmsService } from './sms.service';

/**
 * SmsService unit tests.
 *
 * Strategy:
 *  - "dev/disabled" path → create service with no Twilio credentials so
 *    `enabled` is false; calls fall back to console log.
 *  - "enabled" path → create service as above, then use private-field access
 *    to inject a mock Twilio client and flip `enabled` to true, avoiding the
 *    need to actually install/require the real Twilio package.
 */
describe('SmsService', () => {
  const makeConfigService = (overrides: Record<string, string> = {}) => ({
    get: jest.fn((key: string, defaultVal?: string) => overrides[key] ?? defaultVal ?? ''),
  });

  /* ─────────────────────────────────────────────────────────────────
   *  Dev / disabled path (no Twilio credentials set)
   * ───────────────────────────────────────────────────────────────── */
  describe('when Twilio is not configured', () => {
    let service: SmsService;

    beforeEach(() => {
      service = new SmsService(makeConfigService() as any);
    });

    it('should be in disabled mode (enabled = false)', () => {
      expect((service as any).enabled).toBe(false);
    });

    it('sendSms should return { success: true } without calling Twilio', async () => {
      const result = await service.sendSms('+1234567890', 'Test message');
      expect(result).toEqual({ success: true });
    });

    it('sendOtp should return { success: true } in dev fallback mode', async () => {
      const result = await service.sendOtp('+1234567890', '123456');
      expect(result).toEqual({ success: true });
    });
  });

  /* ─────────────────────────────────────────────────────────────────
   *  Enabled path (Twilio credentials present, mock client injected)
   * ───────────────────────────────────────────────────────────────── */
  describe('when Twilio is configured', () => {
    let service: SmsService;
    let mockTwilioMessages: { create: jest.Mock };

    beforeEach(() => {
      // Build service; credentials are present but require('twilio') may not be
      // available so we patch the internal state manually.
      service = new SmsService(
        makeConfigService({
          TWILIO_ACCOUNT_SID: 'ACtest',
          TWILIO_AUTH_TOKEN: 'authtoken',
          TWILIO_FROM_NUMBER: '+10000000000',
        }) as any,
      );

      // Inject a fake Twilio client regardless of require() outcome
      mockTwilioMessages = { create: jest.fn() };
      (service as any).enabled = true;
      (service as any).client = { messages: mockTwilioMessages };
      (service as any).fromNumber = '+10000000000';
    });

    it('should return { success: true, sid } on successful Twilio send', async () => {
      mockTwilioMessages.create.mockResolvedValue({ sid: 'SM_mock_sid_001' });

      const result = await service.sendSms('+9876543210', 'Hello');

      expect(mockTwilioMessages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+9876543210',
          from: '+10000000000',
          body: 'Hello',
        }),
      );
      expect(result).toEqual({ success: true, sid: 'SM_mock_sid_001' });
    });

    it('should return { success: false } when Twilio throws an error', async () => {
      mockTwilioMessages.create.mockRejectedValue(new Error('Twilio error'));

      const result = await service.sendSms('+9876543210', 'Hello');
      expect(result).toEqual({ success: false });
    });

    it('sendOtp should delegate to sendSms with formatted OTP message', async () => {
      mockTwilioMessages.create.mockResolvedValue({ sid: 'SM_otp_sid' });

      const result = await service.sendOtp('+9876543210', '654321');

      expect(result).toEqual({ success: true, sid: 'SM_otp_sid' });
      const callArg = mockTwilioMessages.create.mock.calls[0][0];
      expect(callArg.body).toContain('654321');
    });

    it('sendOtp should return { success: false } when underlying sendSms fails', async () => {
      mockTwilioMessages.create.mockRejectedValue(new Error('Send failed'));

      const result = await service.sendOtp('+9876543210', '654321');
      expect(result).toEqual({ success: false });
    });
  });
});
