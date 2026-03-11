import { PasswordService } from './password.service';
import { ConfigService } from '@nestjs/config';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue(10),
    } as unknown as ConfigService;
    service = new PasswordService(configService);
  });

  describe('hash', () => {
    it('should hash a password', async () => {
      const hash = await service.hash('TestPassword123!');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('TestPassword123!');
      expect(hash.startsWith('$2b$')).toBe(true);
    });
  });

  describe('verify', () => {
    it('should return true for a correct password', async () => {
      const hash = await service.hash('CorrectPassword1!');
      const result = await service.verify('CorrectPassword1!', hash);
      expect(result).toBe(true);
    });

    it('should return false for an incorrect password', async () => {
      const hash = await service.hash('CorrectPassword1!');
      const result = await service.verify('WrongPassword1!', hash);
      expect(result).toBe(false);
    });
  });

  describe('validateStrength', () => {
    it('should accept a strong password', () => {
      const result = service.validateStrength('StrongPass1!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject a password shorter than 8 characters', () => {
      const result = service.validateStrength('Ab1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 8 characters long',
      );
    });

    it('should reject a password without lowercase letters', () => {
      const result = service.validateStrength('ABCDEFGH1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter',
      );
    });

    it('should reject a password without uppercase letters', () => {
      const result = service.validateStrength('abcdefgh1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter',
      );
    });

    it('should reject a password without numbers', () => {
      const result = service.validateStrength('Abcdefgh!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number',
      );
    });

    it('should reject a password without special characters', () => {
      const result = service.validateStrength('Abcdefgh1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character',
      );
    });

    it('should return multiple errors for a very weak password', () => {
      const result = service.validateStrength('abc');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });
});
