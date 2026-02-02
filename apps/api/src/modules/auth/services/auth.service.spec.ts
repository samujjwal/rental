jest.mock('otplib');
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService, RegisterDto, LoginDto } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EmailService } from '@/common/email/email.service';
import { UserRole, UserStatus } from '@rental-portal/database';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let passwordService: jest.Mocked<PasswordService>;
  let tokenService: jest.Mocked<TokenService>;
  let mfaService: jest.Mocked<MfaService>;
  let cacheService: jest.Mocked<CacheService>;
  let emailService: jest.Mocked<EmailService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'test@example.com',
    password: 'password123',
    passwordHash: 'hashedPassword123',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    emailVerified: false,
    phoneVerified: false,
    mfaEnabled: false,
    mfaSecret: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    averageRating: null,
    totalReviews: 0,
    responseRate: null,
    responseTime: null,
    bio: null,
    profilePhotoUrl: null,
    dateOfBirth: null,
    stripeCustomerId: null,
    stripeConnectId: null,
    stripeChargesEnabled: null,
    stripePayoutsEnabled: null,
    stripeOnboardingComplete: null,
    lastLoginAt: null,
    lastLoginIp: null,
    emailVerificationToken: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    idVerificationStatus: null,
    idVerificationUrl: null,
    governmentIdNumber: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    deletedAt: null,
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      session: {
        create: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const mockPasswordService = {
      hash: jest.fn(),
      verify: jest.fn(),
    };

    const mockTokenService = {
      generateTokens: jest.fn(),
      createSession: jest.fn(),
      verifyRefreshToken: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllSessions: jest.fn(),
    };

    const mockMfaService = {
      generateSecret: jest.fn(),
      verifyToken: jest.fn(),
      generateQRCode: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockEmailService = {
      sendEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      sendVerificationEmail: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-value'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: MfaService, useValue: mockMfaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    passwordService = module.get(PasswordService);
    tokenService = module.get(TokenService);
    mfaService = module.get(MfaService);
    cacheService = module.get(CacheService);
    emailService = module.get(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '+1234567890',
    };

    it('should successfully register a new user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedPassword');
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });
      (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(registerDto.email.toLowerCase());
      expect(passwordService.hash).toHaveBeenCalledWith(registerDto.password);
    });

    it('should throw ConflictException if email already exists', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should convert email to lowercase', async () => {
      const dtoWithUppercase = {
        ...registerDto,
        email: 'USER@EXAMPLE.COM',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedPassword');
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: 'user@example.com',
      });
      (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);

      await service.register(dtoWithUppercase);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });

    it('should set default role as CUSTOMER', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedPassword');
      (prismaService.user.create as jest.Mock).mockResolvedValue(mockUser);
      (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);

      await service.register(registerDto);

      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: UserRole.CUSTOMER,
            status: UserStatus.ACTIVE,
          }),
        }),
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should successfully login with valid credentials', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.login(loginDto, '127.0.0.1', 'Mozilla/5.0');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBe(mockTokens.accessToken);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for suspended user', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(suspendedUser);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should require MFA code when MFA is enabled', async () => {
      const mfaUser = { ...mockUser, mfaEnabled: true, mfaSecret: 'secret123' };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mfaUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(BadRequestException);
    });

    it('should validate MFA code when provided', async () => {
      const mfaUser = { ...mockUser, mfaEnabled: true, mfaSecret: 'secret123' };
      const loginWithMfa: LoginDto = { ...loginDto, mfaCode: '123456' };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mfaUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (mfaService.verifyToken as jest.Mock).mockReturnValue(true);
      (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mfaUser);

      const result = await service.login(loginWithMfa);

      expect(mfaService.verifyToken).toHaveBeenCalledWith('secret123', '123456');
      expect(result).toHaveProperty('accessToken');
    });

    it('should throw UnauthorizedException for invalid MFA code', async () => {
      const mfaUser = { ...mockUser, mfaEnabled: true, mfaSecret: 'secret123' };
      const loginWithMfa: LoginDto = { ...loginDto, mfaCode: 'invalid' };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mfaUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (mfaService.verifyToken as jest.Mock).mockReturnValue(false);

      await expect(service.login(loginWithMfa)).rejects.toThrow(UnauthorizedException);
    });

    it('should update lastLoginAt and lastLoginIp on successful login', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      await service.login(loginDto, '192.168.1.1', 'Test Agent');

      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
            lastLoginIp: '192.168.1.1',
          }),
        }),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle registration with optional fields', async () => {
      const minimalDto: RegisterDto = {
        email: 'minimal@example.com',
        password: 'Password123!',
        firstName: 'Jane',
        lastName: 'Doe',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedPassword');
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: minimalDto.email,
        phoneNumber: null,
        dateOfBirth: null,
      });
      (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);

      const result = await service.register(minimalDto);

      expect(result.user).toBeDefined();
    });

    it('should handle concurrent login attempts', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const loginDto: LoginDto = { email: 'test@example.com', password: 'password123' };
      
      const results = await Promise.all([
        service.login(loginDto),
        service.login(loginDto),
        service.login(loginDto),
      ]);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('accessToken');
      });
    });

    it('should sanitize user data by removing sensitive fields', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.login({ email: 'test@example.com', password: 'password123' });

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('mfaSecret');
    });
  });

  describe('user status handling', () => {
    const loginDto: LoginDto = { email: 'test@example.com', password: 'password123' };

    it('should reject DELETED users', async () => {
      const deletedUser = { ...mockUser, status: UserStatus.DELETED };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(deletedUser);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject PENDING_VERIFICATION users', async () => {
      const pendingUser = { ...mockUser, status: UserStatus.PENDING_VERIFICATION };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(pendingUser);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should allow ACTIVE users', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
    });
  });
});
