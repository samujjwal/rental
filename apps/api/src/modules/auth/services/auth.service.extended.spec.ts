/**
 * P2: Auth Service — Expanded Unit Coverage
 *
 * Supplements the existing auth.service.spec.ts with tests for methods
 * that have no unit coverage:
 *   - requestPasswordReset / resetPassword / changePassword
 *   - enableMfa / verifyAndEnableMfa / disableMfa
 *   - sendVerificationEmail / verifyEmail
 *   - sendPhoneVerification / verifyPhone
 *   - logout / logoutAll
 *   - tryBackupCode (indirect via login)
 */
jest.mock('otplib');
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EmailService } from '@/common/email/email.service';
import { UserRole, UserStatus } from '@rental-portal/database';
import { FieldEncryptionService } from '@/common/encryption/field-encryption.service';
import { SmsService } from './sms.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bull';

describe('AuthService — Extended Coverage', () => {
  let service: AuthService;
  let prisma: any;
  let passwordService: any;
  let tokenService: any;
  let mfaService: any;
  let cacheService: any;
  let emailService: any;

  const baseUser = {
    id: 'user-ext-1',
    email: 'ext@example.com',
    username: 'ext@example.com',
    passwordHash: 'hashed-pass',
    firstName: 'Extended',
    lastName: 'Test',
    phone: '+9779800000000',
    role: UserRole.CUSTOMER ?? 'USER',
    status: UserStatus.ACTIVE ?? 'ACTIVE',
    emailVerified: true,
    phoneVerified: false,
    mfaEnabled: false,
    mfaSecret: null,
    mfaBackupCodes: [],
    loginAttempts: 0,
    lockedUntil: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerificationToken: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    passwordService = {
      hash: jest.fn().mockResolvedValue('new-hashed'),
      verify: jest.fn().mockResolvedValue(true),
      validateStrength: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    };

    tokenService = {
      generateTokens: jest.fn().mockResolvedValue({
        accessToken: 'new-at',
        refreshToken: 'new-rt',
      }),
      generatePasswordResetToken: jest.fn().mockResolvedValue('reset-token-123'),
      createSession: jest.fn(),
      verifyRefreshToken: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllSessions: jest.fn(),
    };

    mfaService = {
      generateSecret: jest.fn().mockResolvedValue({
        secret: 'MFASECRET',
        qrCode: 'data:image/png;base64,...',
      }),
      verifyToken: jest.fn(),
      generateBackupCodes: jest.fn().mockReturnValue(
        Array.from({ length: 10 }, (_, i) => `backup-${i}`),
      ),
    };

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn().mockResolvedValue(undefined),
    };

    emailService = {
      sendEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      sendVerificationEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwordService },
        { provide: TokenService, useValue: tokenService },
        { provide: MfaService, useValue: mfaService },
        { provide: CacheService, useValue: cacheService },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test') } },
        {
          provide: FieldEncryptionService,
          useValue: {
            encrypt: jest.fn((v: string) => (v ? `enc:${v}` : null)),
            decrypt: jest.fn((v: string) => (v ? v.replace(/^enc:/, '') : null)),
            isEncrypted: jest.fn((v: string) => typeof v === 'string' && v.startsWith('enc:')),
          },
        },
        { provide: SmsService, useValue: { sendOtp: jest.fn().mockResolvedValue(undefined) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: getQueueToken('emails'), useValue: { add: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Password Reset ──────────────────────────────────────

  describe('requestPasswordReset', () => {
    it('should generate reset token and send email for existing user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.user.update.mockResolvedValue({ ...baseUser });

      await service.requestPasswordReset(baseUser.email);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseUser.id },
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          }),
        }),
      );
    });

    it('should not throw for non-existent email (prevents enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      // Should complete without throwing
      await expect(
        service.requestPasswordReset('nobody@example.com'),
      ).resolves.not.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      prisma.user.findFirst
        ? prisma.user.findFirst.mockResolvedValue({
            ...baseUser,
            passwordResetToken: 'valid-token',
            passwordResetExpires: futureDate,
          })
        : prisma.user.findUnique.mockResolvedValue({
            ...baseUser,
            passwordResetToken: 'valid-token',
            passwordResetExpires: futureDate,
          });

      prisma.user.update.mockResolvedValue({ ...baseUser });

      await service.resetPassword('valid-token', 'NewStrongPass123!');

      expect(passwordService.hash).toHaveBeenCalledWith('NewStrongPass123!');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      // Service queries DB with passwordResetExpires > now, so expired token returns null
      prisma.user.findFirst
        ? prisma.user.findFirst.mockResolvedValue(null)
        : prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('expired-token', 'NewPass123!'),
      ).rejects.toThrow();
    });
  });

  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      passwordService.verify.mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({ ...baseUser });

      await service.changePassword(baseUser.id, 'OldPass!123', 'NewPass!456');

      expect(passwordService.verify).toHaveBeenCalledWith('OldPass!123', baseUser.passwordHash);
      expect(passwordService.hash).toHaveBeenCalledWith('NewPass!456');
    });

    it('should reject when current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.changePassword(baseUser.id, 'WrongPass', 'NewPass!456'),
      ).rejects.toThrow();
    });
  });

  // ─── MFA ─────────────────────────────────────────────────

  describe('enableMfa', () => {
    it('should generate secret and QR code', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, mfaEnabled: false });
      prisma.user.update.mockResolvedValue({ ...baseUser });

      const result = await service.enableMfa(baseUser.id);

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCode');
      expect(mfaService.generateSecret).toHaveBeenCalledWith(baseUser.email);
    });

    it('should reject if MFA is already enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, mfaEnabled: true });

      await expect(service.enableMfa(baseUser.id)).rejects.toThrow();
    });

    it('should reject for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.enableMfa('ghost-user')).rejects.toThrow();
    });
  });

  describe('verifyAndEnableMfa', () => {
    it('should enable MFA and return backup codes on valid TOTP', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        mfaSecret: 'enc:MFASECRET',
        mfaEnabled: false,
      });
      mfaService.verifyToken.mockReturnValue(true);
      prisma.user.update.mockResolvedValue({ ...baseUser, mfaEnabled: true });

      const result = await service.verifyAndEnableMfa(baseUser.id, '123456');

      expect(result).toHaveProperty('backupCodes');
      expect(result.backupCodes).toHaveLength(10);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mfaEnabled: true,
            mfaBackupCodes: expect.any(Array),
          }),
        }),
      );
    });

    it('should reject invalid TOTP code', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        mfaSecret: 'enc:MFASECRET',
      });
      mfaService.verifyToken.mockReturnValue(false);

      await expect(
        service.verifyAndEnableMfa(baseUser.id, '000000'),
      ).rejects.toThrow();
    });

    it('should reject if MFA setup not initiated (no secret)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        mfaSecret: null,
      });

      await expect(
        service.verifyAndEnableMfa(baseUser.id, '123456'),
      ).rejects.toThrow();
    });
  });

  describe('disableMfa', () => {
    it('should disable MFA with correct password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        mfaEnabled: true,
        mfaSecret: 'enc:secret',
      });
      passwordService.verify.mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({ ...baseUser, mfaEnabled: false });

      await service.disableMfa(baseUser.id, 'CorrectPass!123');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mfaEnabled: false,
            mfaSecret: null,
          }),
        }),
      );
    });

    it('should reject with wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        mfaEnabled: true,
      });
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.disableMfa(baseUser.id, 'WrongPass'),
      ).rejects.toThrow();
    });
  });

  // ─── Email Verification ──────────────────────────────────

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const tokenHash = require('crypto').createHash('sha256').update('verify-token').digest('hex');
      // Service checks cache first — must return truthy value
      cacheService.get.mockResolvedValue('valid');
      prisma.user.findFirst
        ? prisma.user.findFirst.mockResolvedValue({
            ...baseUser,
            emailVerified: false,
            emailVerificationToken: tokenHash,
          })
        : prisma.user.findUnique.mockResolvedValue({
            ...baseUser,
            emailVerified: false,
            emailVerificationToken: tokenHash,
          });

      prisma.user.update.mockResolvedValue({
        ...baseUser,
        emailVerified: true,
      });

      const result = await service.verifyEmail('verify-token');
      expect(result).toHaveProperty('message');
    });

    it('should reject invalid verification token', async () => {
      prisma.user.findFirst
        ? prisma.user.findFirst.mockResolvedValue(null)
        : prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow();
    });
  });

  // ─── Phone Verification ──────────────────────────────────

  describe('verifyPhone', () => {
    it('should verify phone with correct code', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        phone: '+9779800000000',
        phoneVerified: false,
      });
      cacheService.get.mockResolvedValue('123456');
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        phoneVerified: true,
      });

      const result = await service.verifyPhone(baseUser.id, '123456');
      expect(result).toHaveProperty('message');
    });

    it('should reject incorrect verification code', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        phone: '+9779800000000',
      });
      cacheService.get.mockResolvedValue('123456');

      await expect(
        service.verifyPhone(baseUser.id, '999999'),
      ).rejects.toThrow();
    });
  });

  // ─── Logout ──────────────────────────────────────────────

  describe('logout', () => {
    it('should delete session and invalidate cache', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout(baseUser.id, 'some-refresh-token');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: baseUser.id,
            refreshToken: 'some-refresh-token',
          },
        }),
      );
      expect(cacheService.del).toHaveBeenCalledWith(`user:${baseUser.id}`);
    });
  });

  describe('logoutAll', () => {
    it('should delete all sessions for user', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 3 });

      await service.logoutAll(baseUser.id);

      expect(prisma.session.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: baseUser.id },
        }),
      );
    });
  });

  // ─── Login with backup code (tryBackupCode) ─────────────

  describe('login with backup code fallback', () => {
    it('should accept valid backup code when MFA TOTP fails', async () => {
      const hashedBackup = 'hashed-backup-0';
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        mfaEnabled: true,
        mfaSecret: 'enc:MFASECRET',
        mfaBackupCodes: [hashedBackup, 'hashed-backup-1'],
        loginAttempts: 0,
      });
      passwordService.verify
        .mockResolvedValueOnce(true)   // password check
        .mockResolvedValueOnce(true);  // backup code check

      mfaService.verifyToken.mockReturnValue(false); // TOTP fails

      tokenService.generateTokens.mockResolvedValue({
        accessToken: 'at-backup',
        refreshToken: 'rt-backup',
      });
      prisma.user.update.mockResolvedValue({ ...baseUser });

      const result = await service.login({
        email: baseUser.email,
        password: 'password',
        mfaCode: 'backup-0',
      });

      expect(result).toHaveProperty('accessToken');
    });
  });
});
