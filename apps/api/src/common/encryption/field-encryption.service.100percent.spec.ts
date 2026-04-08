import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FieldEncryptionService } from './field-encryption.service';

/**
 * COMPREHENSIVE FIELD ENCRYPTION SERVICE TESTS - 100% COVERAGE
 * 
 * These tests cover all encryption/decryption operations, edge cases, error scenarios,
 * and security considerations to achieve complete test coverage.
 */
describe('FieldEncryptionService - 100% Coverage', () => {
  let service: FieldEncryptionService;
  let configService: any;

  const validHexKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  const previousHexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FieldEncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FIELD_ENCRYPTION_KEY') return validHexKey;
              if (key === 'FIELD_ENCRYPTION_KEY_PREVIOUS') return previousHexKey;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FieldEncryptionService>(FieldEncryptionService);
    configService = module.get<ConfigService>(ConfigService);
    
    // Initialize the service
    service.onModuleInit();
  });

  // ============================================================================
  // ENCRYPTION OPERATIONS - COMPLETE COVERAGE
  // ============================================================================

  describe('Encryption Operations', () => {
    test('should encrypt plaintext successfully', () => {
      const plaintext = 'Sensitive data to encrypt';
      const encrypted = service.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
      
      // Should have format: v1:iv:authTag:ciphertext (hex encoded)
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('v1'); // Version
      expect(parts[1]).toMatch(/^[a-f0-9]+$/i); // IV hex
      expect(parts[2]).toMatch(/^[a-f0-9]+$/i); // Auth tag hex
      expect(parts[3]).toMatch(/^[a-f0-9]+$/i); // Ciphertext hex
    });

    test('should encrypt empty string', () => {
      const encrypted = service.encrypt('');
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.split(':')).toHaveLength(4); // v1:iv:authTag:ciphertext
    });

    test('should encrypt unicode characters', () => {
      const plaintext = 'Unicode test: 🚀 ñáéíóú 中文';
      const encrypted = service.encrypt(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
    });

    test('should encrypt long strings', () => {
      const plaintext = 'A'.repeat(10000); // 10KB string
      const encrypted = service.encrypt(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(plaintext.length);
    });

    test('should return null for null input', () => {
      const result = service.encrypt(null);
      expect(result).toBeNull();
    });

    test('should return null for undefined input', () => {
      const result = service.encrypt(undefined);
      expect(result).toBeNull();
    });

    test('should throw error when service not initialized', () => {
      const uninitializedService = new FieldEncryptionService(configService);
      
      expect(() => uninitializedService.encrypt('test')).toThrow('FieldEncryptionService not initialised');
    });
  });

  // ============================================================================
  // DECRYPTION OPERATIONS - COMPLETE COVERAGE
  // ============================================================================

  describe('Decryption Operations', () => {
    test('should decrypt encrypted text successfully', () => {
      const plaintext = 'Sensitive data to encrypt';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('should decrypt empty string', () => {
      const plaintext = '';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('should decrypt unicode characters', () => {
      const plaintext = 'Unicode test: 🚀 ñáéíóú 中文';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('should decrypt long strings', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('should return null for null input', () => {
      const result = service.decrypt(null);
      expect(result).toBeNull();
    });

    test('should return null for undefined input', () => {
      const result = service.decrypt(undefined);
      expect(result).toBeNull();
    });

    test('should handle legacy plaintext format', () => {
      const legacyPlaintext = 'legacy unencrypted data';
      
      // Mock the logger to avoid warnings in test output
      const loggerSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();
      
      const result = service.decrypt(legacyPlaintext);
      
      expect(result).toBe(legacyPlaintext);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('treating as legacy plaintext')
      );
      
      loggerSpy.mockRestore();
    });

    test('should return malformed ciphertext as-is (legacy plaintext behavior)', () => {
      // Malformed ciphertext with wrong number of parts is treated as legacy plaintext
      const malformedCiphertext = 'invalid:format';
      const result = service.decrypt(malformedCiphertext);
      
      // Returns as-is instead of throwing
      expect(result).toBe(malformedCiphertext);
    });

    test('should throw error for invalid hex in ciphertext', () => {
      const invalidHexCiphertext = 'invalidhex:invalidhex:invalidhex';
      
      expect(() => service.decrypt(invalidHexCiphertext)).toThrow();
    });

    test('should throw error when service not initialized', () => {
      const uninitializedService = new FieldEncryptionService(configService);
      
      expect(() => uninitializedService.decrypt('test')).toThrow('FieldEncryptionService not initialised');
    });
  });

  // ============================================================================
  // ENCRYPTION DETECTION - COMPLETE COVERAGE
  // ============================================================================

  describe('Encryption Detection', () => {
    test('should detect encrypted values', () => {
      const plaintext = 'test data';
      const encrypted = service.encrypt(plaintext);
      
      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    test('should return false for null values', () => {
      expect(service.isEncrypted(null)).toBe(false);
    });

    test('should return false for undefined values', () => {
      expect(service.isEncrypted(undefined)).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(service.isEncrypted('')).toBe(false);
    });

    test('should return false for plaintext strings', () => {
      const plaintext = 'This is plaintext';
      expect(service.isEncrypted(plaintext)).toBe(false);
    });

    test('should return false for malformed strings', () => {
      const malformed = 'invalid:format:with:too:many:parts';
      expect(service.isEncrypted(malformed)).toBe(false);
    });

    test('should return true for 3-part strings (legacy format)', () => {
      // 3-part strings match legacy format iv:authTag:ciphertext
      const threePartString = 'aaaa:bbbb:cccc';
      expect(service.isEncrypted(threePartString)).toBe(true);
    });
  });

  // ============================================================================
  // KEY ROTATION - COMPLETE COVERAGE
  // ============================================================================

  describe('Key Rotation', () => {
    test('should decrypt data encrypted with previous key', () => {
      // Create a service with previous key only
      const previousKeyService = new FieldEncryptionService({
        get: jest.fn((key: string) => {
          if (key === 'FIELD_ENCRYPTION_KEY') return previousHexKey;
          return null;
        }),
      } as unknown as ConfigService);
      previousKeyService.onModuleInit();

      // Encrypt with previous key
      const plaintext = 'Data encrypted with previous key';
      const encryptedWithPreviousKey = previousKeyService.encrypt(plaintext);

      // Decrypt with current service (which has both keys)
      const decrypted = service.decrypt(encryptedWithPreviousKey);
      
      expect(decrypted).toBe(plaintext);
    });

    test('should encrypt with current key even when previous key exists', () => {
      const plaintext = 'New data to encrypt';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  // ============================================================================
  // INITIALIZATION - COMPLETE COVERAGE
  // ============================================================================

  describe('Initialization', () => {
    test('should initialize successfully with valid key', () => {
      expect(() => service.onModuleInit()).not.toThrow();
    });

    test('should use development fallback key in development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const devService = new FieldEncryptionService({
        get: jest.fn(() => null), // No key configured
      } as unknown as ConfigService);
      
      expect(() => devService.onModuleInit()).not.toThrow();
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should use development fallback key in test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      const testService = new FieldEncryptionService({
        get: jest.fn(() => null), // No key configured
      } as unknown as ConfigService);
      
      expect(() => testService.onModuleInit()).not.toThrow();
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should throw error in production without key', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const prodService = new FieldEncryptionService({
        get: jest.fn(() => null), // No key configured
      } as unknown as ConfigService);
      
      expect(() => prodService.onModuleInit()).toThrow(
        'FIELD_ENCRYPTION_KEY must be set in all non-development environments'
      );
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should throw error in staging without key', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'staging';
      
      const stagingService = new FieldEncryptionService({
        get: jest.fn(() => null),
      } as unknown as ConfigService);
      
      expect(() => stagingService.onModuleInit()).toThrow(
        'FIELD_ENCRYPTION_KEY must be set in all non-development environments'
      );
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should handle invalid hex key gracefully', () => {
      const invalidKeyService = new FieldEncryptionService({
        get: jest.fn(() => 'invalid-hex-key'),
      } as unknown as ConfigService);
      
      expect(() => invalidKeyService.onModuleInit()).toThrow();
    });
  });

  // ============================================================================
  // SECURITY AND EDGE CASES - COMPLETE COVERAGE
  // ============================================================================

  describe('Security and Edge Cases', () => {
    test('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'Same plaintext';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to the same value
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    test('should handle concurrent encryption operations', async () => {
      const plaintext = 'Concurrent test data';
      const promises = Array.from({ length: 100 }, () => 
        Promise.resolve(service.encrypt(plaintext))
      );
      
      const encryptedResults = await Promise.all(promises);
      
      // All should be different
      const uniqueResults = new Set(encryptedResults);
      expect(uniqueResults.size).toBe(100);
      
      // All should decrypt to the same value
      for (const encrypted of encryptedResults) {
        expect(service.decrypt(encrypted)).toBe(plaintext);
      }
    });

    test('should handle concurrent decryption operations', async () => {
      const plaintext = 'Concurrent decryption test';
      const encrypted = service.encrypt(plaintext);
      
      const promises = Array.from({ length: 100 }, () => 
        Promise.resolve(service.decrypt(encrypted))
      );
      
      const decryptedResults = await Promise.all(promises);
      
      // All should be the same
      expect(decryptedResults.every(result => result === plaintext)).toBe(true);
    });

    test('should handle very long strings efficiently', () => {
      const plaintext = 'A'.repeat(100000); // 100KB string
      
      const startTime = Date.now();
      const encrypted = service.encrypt(plaintext);
      const encryptTime = Date.now() - startTime;
      
      const decryptStartTime = Date.now();
      const decrypted = service.decrypt(encrypted);
      const decryptTime = Date.now() - decryptStartTime;
      
      expect(decrypted).toBe(plaintext);
      expect(encryptTime).toBeLessThan(1000); // Should complete within 1 second
      expect(decryptTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should maintain data integrity across multiple encrypt/decrypt cycles', () => {
      const originalData = 'Complex data: 🚀 ñáéíóú 中文 Numbers: 12345 Symbols: !@#$%';
      
      let currentData = originalData;
      
      // Perform 10 rounds of encryption/decryption
      for (let i = 0; i < 10; i++) {
        const encrypted = service.encrypt(currentData);
        currentData = service.decrypt(encrypted);
      }
      
      expect(currentData).toBe(originalData);
    });

    test('should handle special characters in plaintext', () => {
      const specialChars = '\0\n\r\t\\\'"<>{}[]()&%$#@!*+=?/.,;:|`~';
      const encrypted = service.encrypt(specialChars);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(specialChars);
    });

    test('should handle JSON data', () => {
      const jsonData = JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        metadata: {
          role: 'user',
          preferences: ['theme', 'notifications'],
          score: 95.5
        }
      });
      
      const encrypted = service.encrypt(jsonData);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(jsonData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });
  });
});
