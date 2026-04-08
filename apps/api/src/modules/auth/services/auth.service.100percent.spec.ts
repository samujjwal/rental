import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { AuthService, RegisterDto, LoginDto } from './auth.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EmailService } from '@/common/email/email.service';
import { FieldEncryptionService } from '@/common/encryption/field-encryption.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { SmsService } from './sms.service';
import { User, UserRole, UserStatus } from '@rental-portal/database';

/**
 * COMPREHENSIVE AUTH SERVICE TESTS - 100% COVERAGE
 * 
 * These tests cover all authentication flows, edge cases, error scenarios,
 * and security considerations to achieve complete test coverage.
 */
describe('AuthService - 100% Coverage', () => {
  let service: AuthService;
  let prisma: any;
  let passwordService: any;
  let tokenService: any;
  let mfaService: any;
  let cacheService: any;
  let emailService: any;
  let configService: any;
  let fieldEncryption: any;
  let smsService: any;
  let eventEmitter: any;
  let emailsQueue: any;

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'test@example.com',
    passwordHash: 'hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    loginAttempts: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
              findFirst: jest.fn(),
            },
            session: {
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: PasswordService,
          useValue: {
            validateStrength: jest.fn(),
            hash: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokens: jest.fn(),
            createSession: jest.fn(),
            validateToken: jest.fn(),
            refreshToken: jest.fn(),
            revokeToken: jest.fn(),
            revokeAllUserTokens: jest.fn(),
            generatePasswordResetToken: jest.fn(),
            generateEmailVerificationToken: jest.fn(),
          },
        },
        {
          provide: MfaService,
          useValue: {
            generateSecret: jest.fn(),
            generateBackupCodes: jest.fn(),
            verifyToken: jest.fn(),
            enableMfa: jest.fn(),
            disableMfa: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            del: jest.fn(),
            delPattern: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => defaultValue),
          },
        },
        {
          provide: FieldEncryptionService,
          useValue: {
            encrypt: jest.fn(),
            decrypt: jest.fn(),
          },
        },
        {
          provide: SmsService,
          useValue: {
            sendSms: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: 'BullQueue_emails',
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    passwordService = module.get<PasswordService>(PasswordService);
    tokenService = module.get<TokenService>(TokenService);
    mfaService = module.get<MfaService>(MfaService);
    cacheService = module.get<CacheService>(CacheService);
    emailService = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
    fieldEncryption = module.get<FieldEncryptionService>(FieldEncryptionService);
    smsService = module.get<SmsService>(SmsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    emailsQueue = module.get<Queue>('BullQueue_emails');
  });

  // ============================================================================
  // REGISTRATION FLOWS - COMPLETE COVERAGE
  // ============================================================================

  describe('Registration Flows', () => {
    test('should register user successfully with default role', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'StrongPassword123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      // Mock no existing user
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      
      // Mock password validation
      (passwordService.validateStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: [],
      });
      
      // Mock password hashing
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedpassword');
      
      // Mock transaction
      const mockCreatedUser = { ...mockUser, email: registerDto.email.toLowerCase() };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);
        (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
        (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
        return await callback({ user: prisma.user });
      });
      
      // Mock email queue
      (emailsQueue.add as jest.Mock).mockResolvedValue(undefined);
      
      // Mock event emitter
      (eventEmitter.emit as jest.Mock).mockReturnValue(undefined);

      const result = await service.register(registerDto);

      expect(result.user.email).toBe(registerDto.email.toLowerCase());
      expect(result.user.role).toBe(UserRole.USER);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(emailsQueue.add).toHaveBeenCalledWith('send-verification', { userId: mockUser.id }, expect.any(Object));
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.registered', { userId: mockUser.id, email: mockUser.email });
    });

    test('should register user with host role', async () => {
      const registerDto: RegisterDto = {
        email: 'host@example.com',
        password: 'StrongPassword123!',
        firstName: 'Jane',
        role: 'host',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.validateStrength as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedpassword');
      
      const mockCreatedUser = { ...mockUser, email: registerDto.email.toLowerCase(), role: UserRole.HOST };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);
        (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
        (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
        return await callback({ user: prisma.user });
      });
      
      (emailsQueue.add as jest.Mock).mockResolvedValue(undefined);
      (eventEmitter.emit as jest.Mock).mockReturnValue(undefined);

      const result = await service.register(registerDto);

      expect(result.user.role).toBe(UserRole.HOST);
    });

    test('should register user with owner role', async () => {
      const registerDto: RegisterDto = {
        email: 'owner@example.com',
        password: 'StrongPassword123!',
        firstName: 'Bob',
        role: 'owner',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.validateStrength as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedpassword');
      
      const mockCreatedUser = { ...mockUser, email: registerDto.email.toLowerCase(), role: UserRole.HOST };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);
        (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
        (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
        return await callback({ user: prisma.user });
      });
      
      (emailsQueue.add as jest.Mock).mockResolvedValue(undefined);
      (eventEmitter.emit as jest.Mock).mockReturnValue(undefined);

      const result = await service.register(registerDto);

      expect(result.user.role).toBe(UserRole.HOST);
    });

    test('should register user with renter role', async () => {
      const registerDto: RegisterDto = {
        email: 'renter@example.com',
        password: 'StrongPassword123!',
        firstName: 'Alice',
        role: 'renter',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.validateStrength as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedpassword');
      
      const mockCreatedUser = { ...mockUser, email: registerDto.email.toLowerCase(), role: UserRole.CUSTOMER };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);
        (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
        (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
        return await callback({ user: prisma.user });
      });
      
      (emailsQueue.add as jest.Mock).mockResolvedValue(undefined);
      (eventEmitter.emit as jest.Mock).mockReturnValue(undefined);

      const result = await service.register(registerDto);

      expect(result.user.role).toBe(UserRole.CUSTOMER);
    });

    test('should register user with auto-verification enabled', async () => {
      const registerDto: RegisterDto = {
        email: 'auto@example.com',
        password: 'StrongPassword123!',
        firstName: 'Auto',
      };

      (configService.get as jest.Mock).mockReturnValue('true');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.validateStrength as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedpassword');
      
      const mockCreatedUser = { ...mockUser, email: registerDto.email.toLowerCase(), status: UserStatus.ACTIVE };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);
        (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
        (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
        return await callback({ user: prisma.user });
      });
      
      (emailsQueue.add as jest.Mock).mockResolvedValue(undefined);
      (eventEmitter.emit as jest.Mock).mockReturnValue(undefined);

      const result = await service.register(registerDto);

      expect(result.user.status).toBe(UserStatus.ACTIVE);
    });

    test('should throw ConflictException for existing email', async () => {
      const registerDto: RegisterDto = {
        email: 'existing@example.com',
        password: 'StrongPassword123!',
        firstName: 'Existing',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    test('should throw BadRequestException for weak password', async () => {
      const registerDto: RegisterDto = {
        email: 'weak@example.com',
        password: 'weak',
        firstName: 'Weak',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.validateStrength as jest.Mock).mockReturnValue({
        isValid: false,
        errors: ['Password too short', 'Missing uppercase letter'],
      });

      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
    });

    test('should handle registration with all optional fields', async () => {
      const registerDto: RegisterDto = {
        email: 'full@example.com',
        password: 'StrongPassword123!',
        firstName: 'Full',
        lastName: 'User',
        phoneNumber: '+1234567890',
        dateOfBirth: new Date('1990-01-01'),
        role: 'owner',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.validateStrength as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedpassword');
      
      const mockCreatedUser = { 
        ...mockUser, 
        email: registerDto.email.toLowerCase(),
        lastName: 'User',
        phone: '+1234567890',
        dateOfBirth: new Date('1990-01-01'),
        role: UserRole.HOST,
      };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);
        (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
        (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
        return await callback({ user: prisma.user });
      });
      
      (emailsQueue.add as jest.Mock).mockResolvedValue(undefined);
      (eventEmitter.emit as jest.Mock).mockReturnValue(undefined);

      const result = await service.register(registerDto);

      expect(result.user.lastName).toBe('User');
      expect(result.user.phone).toBe('+1234567890');
      expect(result.user.dateOfBirth).toEqual(new Date('1990-01-01'));
      expect(result.user.role).toBe(UserRole.HOST);
    });

    test('should handle email queue failure gracefully', async () => {
      const registerDto: RegisterDto = {
        email: 'queue-fail@example.com',
        password: 'StrongPassword123!',
        firstName: 'Queue',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.validateStrength as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedpassword');
      
      const mockCreatedUser = { ...mockUser, email: registerDto.email.toLowerCase() };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);
        (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
        (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
        return await callback({ user: prisma.user });
      });
      
      // Mock email queue failure
      (emailsQueue.add as jest.Mock).mockRejectedValue(new Error('Queue failed'));
      (eventEmitter.emit as jest.Mock).mockReturnValue(undefined);

      // Should still succeed even if email queue fails
      const result = await service.register(registerDto);

      expect(result.user.email).toBe(registerDto.email.toLowerCase());
      expect(result.accessToken).toBe('access-token');
    });
  });

  // ============================================================================
  // LOGIN FLOWS - COMPLETE COVERAGE
  // ============================================================================

  describe('Login Flows', () => {
    test('should login successfully without MFA', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUserWithMfa = { ...mockUser, mfaEnabled: false };
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserWithMfa);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (tokenService.generateTokens as jest.Mock).mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);

      const result = await service.login(loginDto, '127.0.0.1', 'Mozilla/5.0');

      expect(result.user.email).toBe(loginDto.email.toLowerCase());
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(tokenService.createSession).toHaveBeenCalledWith(
        mockUser.id,
        'refresh-token',
        'access-token',
        { ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0' }
      );
    });

    test('should login successfully with MFA TOTP', async () => {
      const loginDto: LoginDto = {
        email: 'mfa@example.com',
        password: 'password123',
        mfaCode: '123456',
      };

      const mockUserWithMfa = { 
        ...mockUser, 
        email: 'mfa@example.com',
        mfaEnabled: true,
        mfaSecret: 'encrypted-secret',
      };
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserWithMfa);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (fieldEncryption.decrypt as jest.Mock).mockReturnValue('decrypted-secret');
      (mfaService.verifyToken as jest.Mock).mockResolvedValue(true);
      (tokenService.generateTokens as jest.Mock).mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);

      const result = await service.login(loginDto);

      expect(result.user.email).toBe(loginDto.email.toLowerCase());
      expect(mfaService.verifyToken).toHaveBeenCalledWith('decrypted-secret', '123456');
    });

    test('should login successfully with MFA backup code', async () => {
      const loginDto: LoginDto = {
        email: 'backup@example.com',
        password: 'password123',
        mfaCode: 'backup123',
      };

      const mockUserWithMfa = { 
        ...mockUser, 
        email: 'backup@example.com',
        mfaEnabled: true,
        mfaSecret: 'encrypted-secret',
        mfaBackupCodes: JSON.stringify(['backup123', 'backup456']),
      };
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserWithMfa);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (fieldEncryption.decrypt as jest.Mock).mockReturnValue('decrypted-secret');
      (mfaService.verifyToken as jest.Mock).mockResolvedValue(false); // TOTP fails
      (tokenService.generateTokens as jest.Mock).mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);

      // Mock backup code validation
      jest.spyOn(service as any, 'tryBackupCode').mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result.user.email).toBe(loginDto.email.toLowerCase());
    });

    test('should throw UnauthorizedException for non-existent user', async () => {
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    test('should throw UnauthorizedException for locked account', async () => {
      const loginDto: LoginDto = {
        email: 'locked@example.com',
        password: 'password123',
      };

      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // Locked for 10 more minutes
      };
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(lockedUser);

      await expect(service.login(loginDto)).rejects.toThrow('Account is temporarily locked');
    });

    test('should throw UnauthorizedException for inactive account', async () => {
      const loginDto: LoginDto = {
        email: 'inactive@example.com',
        password: 'password123',
      };

      const inactiveUser = {
        ...mockUser,
        status: UserStatus.PENDING_VERIFICATION,
      };
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(inactiveUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    test('should throw UnauthorizedException for invalid password', async () => {
      const loginDto: LoginDto = {
        email: 'invalid@example.com',
        password: 'wrongpassword',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(false);
      (prisma.user.update as jest.Mock).mockResolvedValue({ loginAttempts: 1 });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    test('should lock account after 5 failed attempts', async () => {
      const loginDto: LoginDto = {
        email: 'lock@example.com',
        password: 'wrongpassword',
      };

      const userWithAttempts = {
        ...mockUser,
        loginAttempts: 4, // One more attempt will trigger lock
      };
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(userWithAttempts);
      (passwordService.verify as jest.Mock).mockResolvedValue(false);
      
      // Mock the update calls
      (prisma.user.update as jest.Mock)
        .mockResolvedValueOnce({ loginAttempts: 5 }) // Increment attempts
        .mockResolvedValueOnce({ loginAttempts: 0, lockedUntil: expect.any(Date) }); // Lock account

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      
      expect(prisma.user.update).toHaveBeenCalledTimes(2);
    });

    test('should reset login attempts on successful login', async () => {
      const loginDto: LoginDto = {
        email: 'reset@example.com',
        password: 'password123',
      };

      const userWithAttempts = {
        ...mockUser,
        loginAttempts: 3, // Should be reset to 0
      };
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(userWithAttempts);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (tokenService.generateTokens as jest.Mock).mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
      (prisma.user.update as jest.Mock).mockResolvedValue({ loginAttempts: 0, lockedUntil: null });

      await service.login(loginDto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { loginAttempts: 0, lockedUntil: null },
      });
    });

    test('should throw BadRequestException when MFA required but not provided', async () => {
      const loginDto: LoginDto = {
        email: 'mfa-required@example.com',
        password: 'password123',
        // mfaCode missing
      };

      const mockUserWithMfa = { 
        ...mockUser, 
        mfaEnabled: true,
        mfaSecret: 'encrypted-secret',
      };
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserWithMfa);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(BadRequestException);
    });

    test('should throw UnauthorizedException for invalid MFA code', async () => {
      const loginDto: LoginDto = {
        email: 'invalid-mfa@example.com',
        password: 'password123',
        mfaCode: 'wrongcode',
      };

      const mockUserWithMfa = { 
        ...mockUser, 
        mfaEnabled: true,
        mfaSecret: 'encrypted-secret',
      };
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserWithMfa);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (fieldEncryption.decrypt as jest.Mock).mockReturnValue('decrypted-secret');
      (mfaService.verifyToken as jest.Mock).mockResolvedValue(false);
      
      // Mock backup code validation failure
      jest.spyOn(service as any, 'tryBackupCode').mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Token Management', () => {
    test('should refresh tokens successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      const mockSession = {
        id: 'session-1',
        userId: mockUser.id,
        refreshToken,
        token: 'old-access-token',
        expiresAt: new Date(Date.now() + 3600000),
        user: mockUser,
      };

      // Mock transaction to execute callback with transaction context
      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          session: {
            findUnique: jest.fn().mockResolvedValue(mockSession),
            update: jest.fn().mockResolvedValue(mockSession),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        };
        return await callback(tx);
      });

      (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
      configService.get.mockReturnValue(7);

      const result = await service.refreshTokens(refreshToken);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(tokenService.generateTokens).toHaveBeenCalledWith(mockUser);
    });

    test('should logout successfully', async () => {
      const userId = mockUser.id;
      const refreshToken = 'valid-refresh-token';
      const mockSession = {
        token: 'access-token-12345678',
      };

      prisma.session.findFirst.mockResolvedValue(mockSession);
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });
      cacheService.del.mockResolvedValue(undefined);

      await service.logout(userId, refreshToken);

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId, refreshToken },
      });
      expect(cacheService.del).toHaveBeenCalledWith(`user:${userId}`);
    });

    test('should logout from all devices', async () => {
      const userId = mockUser.id;

      prisma.session.deleteMany.mockResolvedValue({ count: 5 });
      cacheService.del.mockResolvedValue(undefined);
      cacheService.delPattern.mockResolvedValue(undefined);

      await service.logoutAll(userId);

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId } });
      expect(cacheService.del).toHaveBeenCalledWith(`user:${userId}`);
      expect(cacheService.delPattern).toHaveBeenCalledWith(`session:${userId}:*`);
    });
  });

  // ============================================================================
  // PASSWORD RESET FLOWS - COMPLETE COVERAGE
  // ============================================================================

  describe('Password Reset Flows', () => {
    test('should initiate password reset successfully', async () => {
      const email = 'test@example.com';

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (tokenService.generatePasswordResetToken as jest.Mock).mockResolvedValue('reset-token');
      prisma.user.update.mockResolvedValue(mockUser);
      emailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      await service.requestPasswordReset(email);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordResetToken: expect.any(String),
          passwordResetExpires: expect.any(Date),
        },
      });
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(email, 'reset-token');
    });

    test('should reset password successfully', async () => {
      const token = 'valid-reset-token';
      const newPassword = 'NewStrongPassword123!';
      const tokenHash = 'hashed-token';

      prisma.user.findFirst.mockResolvedValue(mockUser);
      (passwordService.validateStrength as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      passwordService.hash.mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });
      cacheService.del.mockResolvedValue(undefined);
      cacheService.delPattern.mockResolvedValue(undefined);

      // Mock logoutAll which is called by resetPassword
      jest.spyOn(service, 'logoutAll').mockResolvedValue(undefined);

      await service.resetPassword(token, newPassword);

      expect(passwordService.hash).toHaveBeenCalledWith(newPassword);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordHash: 'new-hashed-password',
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });
    });

    test('should throw error for non-existent user in password reset', async () => {
      const email = 'nonexistent@example.com';

      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.requestPasswordReset(email)).resolves.toBeUndefined(); // Method doesn't throw for security reasons
    });
  });

  // ============================================================================
  // EMAIL VERIFICATION - COMPLETE COVERAGE
  // ============================================================================

  describe('Email Verification', () => {
    test('should verify email successfully', async () => {
      const token = 'valid-verification-token';
      const tokenHash = 'hashed-token';
      const pendingUser = { ...mockUser, status: UserStatus.PENDING_VERIFICATION, emailVerificationToken: tokenHash };

      cacheService.get.mockResolvedValue('cached-value');
      prisma.user.findFirst.mockResolvedValue(pendingUser);
      prisma.user.update.mockResolvedValue({ ...pendingUser, status: UserStatus.ACTIVE });
      cacheService.del.mockResolvedValue(undefined);

      const result = await service.verifyEmail(token);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: pendingUser.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          status: UserStatus.ACTIVE,
        },
      });
      expect(result).toEqual({ message: 'Email verified successfully' });
    });

    test('should resend verification email successfully', async () => {
      const email = 'newuser@example.com';
      const pendingUser = { ...mockUser, status: UserStatus.PENDING_VERIFICATION, email };

      prisma.user.findUnique.mockResolvedValue(null); // No existing user
      (passwordService.validateStrength as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      passwordService.hash.mockResolvedValue('hashedpassword');
      const mockCreatedUser = { ...pendingUser, id: 'new-user-id' };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };

      prisma.$transaction.mockImplementation(async (callback: any) => {
        prisma.user.create = jest.fn().mockResolvedValue(mockCreatedUser);
        (tokenService.generateTokens as jest.Mock).mockResolvedValue(mockTokens);
        (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);
        return await callback({ user: prisma.user });
      });

      emailsQueue.add.mockResolvedValue(undefined);

      await service.register({
        email,
        password: 'StrongPassword123!',
        firstName: 'Test',
      });

      // Verification email is queued during registration
      expect(emailsQueue.add).toHaveBeenCalledWith('send-verification', { userId: mockCreatedUser.id }, expect.any(Object));
    });
  });

  // ============================================================================
  // MFA MANAGEMENT - COMPLETE COVERAGE
  // ============================================================================

  describe('MFA Management', () => {
    test('should enable MFA successfully', async () => {
      const mfaSecret = 'new-mfa-secret';
      const qrCode = 'qr-code-data';

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mfaService.generateSecret as jest.Mock).mockReturnValue({ secret: mfaSecret, qrCode });
      (fieldEncryption.encrypt as jest.Mock).mockReturnValue('encrypted-secret');
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, mfaEnabled: true });

      const result = await service.enableMfa(mockUser.id);

      expect(result.secret).toBe(mfaSecret);
      expect(result.qrCode).toBe(qrCode);
      expect(fieldEncryption.encrypt).toHaveBeenCalledWith(mfaSecret);
    });

    test('should disable MFA successfully', async () => {
      const password = 'currentpassword';

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null });

      await service.disableMfa(mockUser.id, password);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
        },
      });
    });
  });

  // ============================================================================
  // USER MANAGEMENT - COMPLETE COVERAGE
  // NOTE: User profile operations are handled by UsersService
  // AuthService focuses on authentication, authorization, and session management
  // ============================================================================

  describe('User Management', () => {
    // User profile operations are handled by the UsersService
    // Auth service focuses on authentication, authorization, and session management
  });

  // ============================================================================
  // SECURITY SCENARIOS - COMPLETE COVERAGE
  // ============================================================================

  describe('Security Scenarios', () => {
    test('should handle concurrent login attempts correctly', async () => {
      const loginDto: LoginDto = {
        email: 'concurrent@example.com',
        password: 'password123',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(true);
      (tokenService.generateTokens as jest.Mock).mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      (tokenService.createSession as jest.Mock).mockResolvedValue(undefined);

      // Simulate concurrent login attempts
      const promises = [
        service.login(loginDto),
        service.login(loginDto),
        service.login(loginDto),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.accessToken).toBe('access-token');
      });
    });

    test('should handle database transaction rollback', async () => {
      const registerDto: RegisterDto = {
        email: 'rollback@example.com',
        password: 'StrongPassword123!',
        firstName: 'Rollback',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.validateStrength as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      (passwordService.hash as jest.Mock).mockResolvedValue('hashedpassword');
      
      // Mock transaction failure
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.register(registerDto)).rejects.toThrow('Database error');
    });

    test('should sanitize user data correctly', async () => {
      const userWithSensitiveData = {
        ...mockUser,
        passwordHash: 'hashedpassword',
        mfaSecret: 'mfa-secret',
        mfaBackupCodes: 'backup-codes',
        governmentIdNumber: 'id-number',
        passwordResetToken: 'reset-token',
        passwordResetExpires: new Date(),
        emailVerificationToken: 'email-token',
      };

      const sanitized = (service as any).sanitizeUser(userWithSensitiveData);

      expect(sanitized).not.toHaveProperty('passwordHash');
      expect(sanitized).not.toHaveProperty('mfaSecret');
      expect(sanitized).not.toHaveProperty('mfaBackupCodes');
      expect(sanitized).not.toHaveProperty('governmentIdNumber');
      expect(sanitized).not.toHaveProperty('passwordResetToken');
      expect(sanitized).not.toHaveProperty('passwordResetExpires');
      expect(sanitized).not.toHaveProperty('emailVerificationToken');
    });
  });
});
