import { OtpService } from './otp.service';
import { BadRequestException, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';

describe('OtpService', () => {
  let service: OtpService;
  let prisma: any;
  let cacheService: any;
  let emailService: any;
  let tokenService: any;
  let mfaService: any;
  let configService: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    emailService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };

    tokenService = {
      generateTokens: jest.fn().mockResolvedValue({
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
      }),
      createSession: jest.fn().mockResolvedValue(undefined),
    };

    configService = {
      get: jest.fn().mockReturnValue('test-value'),
    };

    mfaService = {
      verifyMfaCode: jest.fn().mockResolvedValue(true),
    };

    service = new OtpService(prisma, cacheService, emailService, tokenService, mfaService, configService);
  });

  describe('requestOtp', () => {
    it('should generate and send an OTP', async () => {
      cacheService.get.mockResolvedValue(null);

      const result = await service.requestOtp('Test@Example.com');

      expect(result.message).toContain('OTP sent');
      expect(cacheService.set).toHaveBeenCalledTimes(2); // OTP + rate counter
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Your Login Code',
        expect.stringContaining('Login Code'),
      );
    });

    it('should normalize email to lowercase', async () => {
      cacheService.get.mockResolvedValue(null);

      await service.requestOtp('  USER@EMAIL.COM  ');

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'user@email.com',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should throw 429 when rate limit exceeded', async () => {
      cacheService.get.mockResolvedValue(3); // max is 3

      await expect(service.requestOtp('test@example.com')).rejects.toThrow(HttpException);

      try {
        await service.requestOtp('test@example.com');
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('should increment rate counter on each request', async () => {
      cacheService.get.mockResolvedValue(1);

      await service.requestOtp('test@example.com');

      // Should store rate count = 2
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('otp_rate:'),
        2,
        3600,
      );
    });
  });

  describe('verifyOtp', () => {
    const existingUser = {
      id: 'user-1',
      email: 'test@example.com',
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash: 'hash',
      mfaSecret: null,
      firstName: 'John',
      lastName: 'Doe',
      lastLoginAt: null,
      lastLoginIp: null,
    };

    it('should verify a correct OTP and return tokens', async () => {
      cacheService.get.mockResolvedValue({ code: '123456', attempts: 0 });
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.user.update.mockResolvedValue(existingUser);

      const result = await service.verifyOtp('test@example.com', '123456', '1.2.3.4', 'agent');

      expect(result.accessToken).toBe('access-tok');
      expect(result.refreshToken).toBe('refresh-tok');
      expect(result.isNewUser).toBe(false);
      expect(cacheService.del).toHaveBeenCalled(); // OTP should be deleted
    });

    it('should throw BadRequest when OTP is expired/missing', async () => {
      cacheService.get.mockResolvedValue(null);

      await expect(
        service.verifyOtp('test@example.com', '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw Unauthorized after 3 failed attempts', async () => {
      cacheService.get.mockResolvedValue({ code: '999999', attempts: 3 });

      await expect(
        service.verifyOtp('test@example.com', '123456'),
      ).rejects.toThrow(UnauthorizedException);

      expect(cacheService.del).toHaveBeenCalled();
    });

    it('should increment attempts on wrong code', async () => {
      cacheService.get.mockResolvedValue({ code: '999999', attempts: 0 });

      await expect(
        service.verifyOtp('test@example.com', '123456'),
      ).rejects.toThrow(UnauthorizedException);

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        { code: '999999', attempts: 1 },
        300,
      );
    });

    it('should create a new user if none exists', async () => {
      cacheService.get.mockResolvedValue({ code: '123456', attempts: 0 });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...existingUser,
        id: 'new-user-1',
      });
      prisma.user.update.mockResolvedValue({
        ...existingUser,
        id: 'new-user-1',
      });

      const result = await service.verifyOtp('new@example.com', '123456');

      expect(result.isNewUser).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@example.com',
            emailVerified: true,
          }),
        }),
      );
    });

    it('should throw Unauthorized for suspended accounts', async () => {
      cacheService.get.mockResolvedValue({ code: '123456', attempts: 0 });
      prisma.user.findUnique.mockResolvedValue({
        ...existingUser,
        status: 'SUSPENDED',
      });

      await expect(
        service.verifyOtp('test@example.com', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should mark email as verified if not already', async () => {
      const unverifiedUser = { ...existingUser, emailVerified: false };
      cacheService.get.mockResolvedValue({ code: '123456', attempts: 0 });
      prisma.user.findUnique.mockResolvedValue(unverifiedUser);
      prisma.user.update.mockResolvedValue(unverifiedUser);

      await service.verifyOtp('test@example.com', '123456');

      // Two updates: one for emailVerified, one for lastLoginAt
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ emailVerified: true }),
        }),
      );
    });
  });
});
