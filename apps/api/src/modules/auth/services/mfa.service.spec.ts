import { MfaService } from './mfa.service';

// Mock external modules
jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/Rental%20Portal:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Rental+Portal'),
  verifySync: jest.fn(),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgo='),
}));

import * as otplib from 'otplib';
import * as QRCode from 'qrcode';

describe('MfaService', () => {
  let service: MfaService;
  let cache: any;

  beforeEach(() => {
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    service = new MfaService(cache);
    jest.clearAllMocks();
  });

  describe('generateSecret', () => {
    it('should generate a secret and QR code', async () => {
      const result = await service.generateSecret('test@example.com');

      expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(result.qrCode).toContain('data:image/png;base64');
      expect(otplib.generateSecret).toHaveBeenCalled();
      expect(otplib.generateURI).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: 'JBSWY3DPEHPK3PXP',
          issuer: 'GharBatai Rentals',
          label: 'test@example.com',
        }),
      );
      expect(QRCode.toDataURL).toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should return true for a valid token', async () => {
      (otplib.verifySync as jest.Mock).mockReturnValue({ valid: true });
      cache.get.mockResolvedValue(null);

      const result = await service.verifyToken('JBSWY3DPEHPK3PXP', '123456');

      expect(result).toBe(true);
      expect(cache.set).toHaveBeenCalled(); // Usage recorded
    });

    it('should return false when token is replayed', async () => {
      (otplib.verifySync as jest.Mock).mockReturnValue({ valid: true });
      cache.get.mockResolvedValue(true); // Already used

      const result = await service.verifyToken('JBSWY3DPEHPK3PXP', '123456');

      expect(result).toBe(false);
      expect(cache.set).not.toHaveBeenCalled(); // Not recorded again
    });

    it('should return false for an invalid token', async () => {
      (otplib.verifySync as jest.Mock).mockReturnValue({ valid: false });

      const result = await service.verifyToken('JBSWY3DPEHPK3PXP', '000000');

      expect(result).toBe(false);
    });

    it('should return false when verification throws', async () => {
      (otplib.verifySync as jest.Mock).mockImplementation(() => {
        throw new Error('invalid');
      });

      const result = await service.verifyToken('BAD_SECRET', '123456');

      expect(result).toBe(false);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 codes by default', () => {
      const codes = service.generateBackupCodes();

      expect(codes).toHaveLength(10);
      codes.forEach((code) => {
        expect(typeof code).toBe('string');
        expect(code).toBe(code.toUpperCase());
      });
    });

    it('should generate a custom number of codes', () => {
      const codes = service.generateBackupCodes(5);

      expect(codes).toHaveLength(5);
    });

    it('should generate unique codes', () => {
      const codes = service.generateBackupCodes(100);
      const unique = new Set(codes);

      // With 100 codes, statistically they should be unique
      // Allow a tiny collision chance — at least 95 should be unique
      expect(unique.size).toBeGreaterThanOrEqual(95);
    });
  });
});

