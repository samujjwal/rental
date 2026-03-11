import { ConfigService } from '@nestjs/config';
import { FieldEncryptionService } from './field-encryption.service';

describe('FieldEncryptionService', () => {
  let service: FieldEncryptionService;
  let configService: jest.Mocked<ConfigService>;

  // Valid 64-hex-char key (32 random bytes)
  const TEST_KEY = 'a'.repeat(64);

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as any;
  });

  function createService(hexKey?: string): FieldEncryptionService {
    configService.get.mockReturnValue(hexKey);
    const svc = new FieldEncryptionService(configService);
    svc.onModuleInit();
    return svc;
  }

  describe('onModuleInit', () => {
    it('should initialise with a valid 64-hex key', () => {
      expect(() => createService(TEST_KEY)).not.toThrow();
    });

    it('should throw in production when key is not set', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        expect(() => createService(undefined)).toThrow('FIELD_ENCRYPTION_KEY must be set');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('should use fallback dev key when not in production', () => {
      expect(() => createService(undefined)).not.toThrow();
    });

    it('should throw when key length is wrong', () => {
      expect(() => createService('abcdef')).toThrow('exactly 64 hex characters');
    });
  });

  describe('encrypt / decrypt', () => {
    beforeEach(() => {
      service = createService(TEST_KEY);
    });

    it('should round-trip encrypt then decrypt', () => {
      const plaintext = 'my-secret-mfa-code-123';
      const ciphertext = service.encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
      expect(service.decrypt(ciphertext)).toBe(plaintext);
    });

    it('should produce different ciphertext for the same plaintext (random IV)', () => {
      const plaintext = 'same-value';
      const a = service.encrypt(plaintext);
      const b = service.encrypt(plaintext);
      expect(a).not.toBe(b);
    });

    it('should return null for null/undefined inputs', () => {
      expect(service.encrypt(null as any)).toBeNull();
      expect(service.encrypt(undefined as any)).toBeNull();
      expect(service.decrypt(null as any)).toBeNull();
      expect(service.decrypt(undefined as any)).toBeNull();
    });

    it('should handle empty string', () => {
      const encrypted = service.encrypt('');
      expect(service.decrypt(encrypted)).toBe('');
    });

    it('should handle unicode text', () => {
      const unicode = 'नेपाली भाषा 🇳🇵';
      const encrypted = service.encrypt(unicode);
      expect(service.decrypt(encrypted)).toBe(unicode);
    });

    it('ciphertext should have v<N>:iv:tag:data format', () => {
      const ciphertext = service.encrypt('hello');
      const parts = ciphertext.split(':');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toMatch(/^v\d+$/); // version prefix
      // IV = 12 bytes = 24 hex chars, auth tag = 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(24);
      expect(parts[2]).toHaveLength(32);
      expect(parts[3].length).toBeGreaterThan(0);
    });
  });

  describe('decrypt legacy plaintext', () => {
    beforeEach(() => {
      service = createService(TEST_KEY);
    });

    it('should return legacy plaintext as-is if not in iv:tag:data format', () => {
      const legacy = 'some-old-plaintext-value';
      expect(service.decrypt(legacy)).toBe(legacy);
    });
  });

  describe('isEncrypted', () => {
    beforeEach(() => {
      service = createService(TEST_KEY);
    });

    it('should return true for encrypted values', () => {
      const encrypted = service.encrypt('test');
      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain values', () => {
      expect(service.isEncrypted('plain-text')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(service.isEncrypted(null)).toBe(false);
      expect(service.isEncrypted(undefined)).toBe(false);
    });
  });

  describe('tamper detection', () => {
    beforeEach(() => {
      service = createService(TEST_KEY);
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = service.encrypt('sensitive');
      const parts = encrypted.split(':');
      // Flip a byte in the ciphertext
      const tampered = `${parts[0]}:${parts[1]}:ff${parts[2].slice(2)}`;
      expect(() => service.decrypt(tampered)).toThrow();
    });
  });
});
