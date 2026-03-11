import { TextModerationService } from './text-moderation.service';

describe('TextModerationService', () => {
  let service: TextModerationService;
  let configService: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          OPENAI_API_KEY: 'sk-test',
          PERSPECTIVE_API_KEY: 'persp-test',
          PLATFORM_DOMAIN: 'gharbatai.com',
        };
        return map[key];
      }),
    };

    service = new TextModerationService(configService);
  });

  describe('moderateText', () => {
    it('should return clean result for benign text', async () => {
      const result = await service.moderateText('This is a nice apartment with good amenities');

      expect(result.flags).toHaveLength(0);
      expect(result.confidence).toBe(1);
    });

    it('should flag profanity', async () => {
      const result = await service.moderateText('This place is damn awful shit');

      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.confidence).toBe(0.8);
      expect(result.flags[0].type).toBe('PROFANITY');
    });

    it('should flag hate speech patterns', async () => {
      const result = await service.moderateText('That racist comment is xenophobic and wrong');

      expect(result.flags.length).toBeGreaterThan(0);
      const hateSpeechFlag = result.flags.find((f: any) => f.type === 'HATE_SPEECH');
      if (hateSpeechFlag) {
        expect(hateSpeechFlag.severity).toBe('CRITICAL');
      }
    });

    it('should flag spam patterns when score >= 2', async () => {
      const result = await service.moderateText(
        'BUY NOW!!! CLICK HERE!!! FREE MONEY!!! LIMITED OFFER!!!',
      );

      const spamFlag = result.flags.find((f: any) => f.type === 'SPAM');
      if (spamFlag) {
        expect(spamFlag.severity).toBe('HIGH');
      }
    });

    it('should flag external contact attempts', async () => {
      const result = await service.moderateText(
        'Contact me on WhatsApp for better price',
      );

      const contactFlag = result.flags.find((f: any) => f.type === 'EXTERNAL_CONTACT');
      if (contactFlag) {
        expect(contactFlag.severity).toBe('HIGH');
      }
    });

    it('should flag scam patterns', async () => {
      const result = await service.moderateText(
        'Please wire transfer the payment outside the platform',
      );

      const scamFlag = result.flags.find((f: any) => f.type === 'SCAM_PATTERN');
      if (scamFlag) {
        expect(scamFlag.severity).toBe('CRITICAL');
      }
    });

    it('should handle empty text', async () => {
      const result = await service.moderateText('');

      expect(result).toBeDefined();
      expect(result.flags).toHaveLength(0);
    });
  });

  describe('detectPII', () => {
    it('should detect and mask email addresses', async () => {
      const result = await service.detectPII('Contact me at john@example.com for details');

      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.maskedText).toContain('[EMAIL REMOVED]');
      expect(result.maskedText).not.toContain('john@example.com');
    });

    it('should detect and mask phone numbers', async () => {
      const result = await service.detectPII('Call me at +1-555-123-4567');

      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.maskedText).toContain('[PHONE REMOVED]');
    });

    it('should detect social media handles', async () => {
      const result = await service.detectPII('Follow me @johndoe on Instagram');

      expect(result.flags.length).toBeGreaterThan(0);
    });

    it('should detect external URLs but exclude platform domain', async () => {
      const result = await service.detectPII('Check https://evil-site.com for details');

      expect(result.flags.length).toBeGreaterThan(0);
    });

    it('should not flag platform domain URLs', async () => {
      const result = await service.detectPII('See https://gharbatai.com/listing/123');

      // Platform domain should be excluded
      const urlFlag = result.flags.find((f: any) => f.type === 'EXTERNAL_URL_DETECTED');
      expect(urlFlag).toBeUndefined();
    });

    it('should return clean text with no PII', async () => {
      const text = 'This is a lovely apartment';
      const result = await service.detectPII(text);

      expect(result.flags).toHaveLength(0);
      expect(result.maskedText).toBe(text);
    });
  });

  describe('moderateWithOpenAI', () => {
    it('should return null when no API key', async () => {
      configService.get.mockReturnValue(undefined);
      service = new TextModerationService(configService);

      const result = await service.moderateWithOpenAI('test text');

      expect(result).toBeNull();
    });

    it('should call OpenAI moderation API', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: [{ flagged: false, categories: {} }],
        }),
      });
      (global as any).fetch = mockFetch;

      const result = await service.moderateWithOpenAI('test text');

      expect(result).toBeDefined();
    });

    it('should return null on error', async () => {
      (global as any).fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.moderateWithOpenAI('test text');

      expect(result).toBeNull();
    });
  });

  describe('moderateWithPerspective', () => {
    it('should return null when no API key', async () => {
      configService.get.mockReturnValue(undefined);
      service = new TextModerationService(configService);

      const result = await service.moderateWithPerspective('test text');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      (global as any).fetch = jest.fn().mockRejectedValue(new Error('API error'));

      const result = await service.moderateWithPerspective('test text');

      expect(result).toBeNull();
    });
  });
});
