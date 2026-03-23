import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { OAuthService } from '../services/oauth.service';
import { OtpService } from '../services/otp.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let oauthService: jest.Mocked<OAuthService>;
  let otpService: jest.Mocked<OtpService>;

  const mockReq = { headers: { 'user-agent': 'test-agent' } } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            devLogin: jest.fn(),
            refreshTokens: jest.fn(),
            logout: jest.fn(),
            logoutAll: jest.fn(),
            requestPasswordReset: jest.fn(),
            resetPassword: jest.fn(),
            changePassword: jest.fn(),
            enableMfa: jest.fn(),
            verifyAndEnableMfa: jest.fn(),
            disableMfa: jest.fn(),
            sendVerificationEmail: jest.fn(),
            verifyEmail: jest.fn(),
            sendPhoneVerification: jest.fn(),
            verifyPhone: jest.fn(),
            sanitizeUser: jest.fn().mockImplementation((u: any) => {
              const { passwordHash, mfaSecret, ...rest } = u;
              return rest;
            }),
          },
        },
        {
          provide: OAuthService,
          useValue: {
            verifyGoogleToken: jest.fn(),
            verifyAppleToken: jest.fn(),
            authenticateOAuth: jest.fn(),
          },
        },
        {
          provide: OtpService,
          useValue: {
            requestOtp: jest.fn(),
            verifyOtp: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'development';
              if (key === 'devLogin.enabled') return true;
              if (key === 'devLogin.secret') return 'test-secret';
              if (key === 'devLogin.allowedIps') return '';
              return 'test';
            }),
          },
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService) as jest.Mocked<AuthService>;
    oauthService = module.get(OAuthService) as jest.Mocked<OAuthService>;
    otpService = module.get(OtpService) as jest.Mocked<OtpService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── Register ──────────────────────────────────────────────────

  describe('register', () => {
    const dto = { email: 'test@test.com', password: 'Pass123!@', firstName: 'Sam' };

    it('delegates to authService.register and returns result', async () => {
      const result = { accessToken: 'tok', user: { id: '1' } };
      authService.register.mockResolvedValue(result as any);
      expect(await controller.register(dto as any)).toBe(result);
      expect(authService.register).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      authService.register.mockRejectedValue(new Error('Duplicate'));
      await expect(controller.register(dto as any)).rejects.toThrow('Duplicate');
    });
  });

  // ── Login ─────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'test@test.com', password: 'Pass123!@' };

    it('passes ip and user-agent to service', async () => {
      authService.login.mockResolvedValue({ accessToken: 'tok' } as any);
      await controller.login(dto as any, '127.0.0.1', mockReq);
      expect(authService.login).toHaveBeenCalledWith(dto, '127.0.0.1', 'test-agent');
    });
  });

  // ── Dev Login ─────────────────────────────────────────────────

  describe('devLogin', () => {
    const origEnabled = process.env.DEV_LOGIN_ENABLED;
    const origSecret = process.env.DEV_LOGIN_SECRET;

    beforeEach(() => {
      process.env.DEV_LOGIN_ENABLED = 'true';
      process.env.DEV_LOGIN_SECRET = 'test-secret';
    });

    afterEach(() => {
      if (origEnabled === undefined) delete process.env.DEV_LOGIN_ENABLED;
      else process.env.DEV_LOGIN_ENABLED = origEnabled;
      if (origSecret === undefined) delete process.env.DEV_LOGIN_SECRET;
      else process.env.DEV_LOGIN_SECRET = origSecret;
    });

    it('passes body fields and request context', async () => {
      authService.devLogin.mockResolvedValue({ accessToken: 'tok' } as any);
      await controller.devLogin(
        { email: 'dev@test.com', role: 'ADMIN' as any, secret: 'test-secret' } as any,
        '::1',
        mockReq,
      );
      expect(authService.devLogin).toHaveBeenCalledWith(
        { email: 'dev@test.com', role: 'ADMIN', secret: 'test-secret' },
        '::1',
        'test-agent',
      );
    });
  });

  // ── Refresh Token ─────────────────────────────────────────────

  describe('refreshToken', () => {
    it('delegates to authService.refreshTokens', async () => {
      const result = { accessToken: 'new-tok' };
      authService.refreshTokens.mockResolvedValue(result as any);
      const mockReq = { cookies: {} } as any;
      expect(await controller.refreshToken({ refreshToken: 'rt' } as any, mockReq)).toBe(result);
      expect(authService.refreshTokens).toHaveBeenCalledWith('rt');
    });
  });

  // ── Logout ────────────────────────────────────────────────────

  describe('logout', () => {
    it('calls authService.logout with userId and refresh token', async () => {
      const mockReq = { cookies: {} } as any;
      const mockRes = { clearCookie: jest.fn() } as any;
      await controller.logout('user-1', { refreshToken: 'rt' } as any, mockReq, mockRes);
      expect(authService.logout).toHaveBeenCalledWith('user-1', 'rt');
    });
  });

  describe('logoutAll', () => {
    it('calls authService.logoutAll with userId', async () => {
      await controller.logoutAll('user-1');
      expect(authService.logoutAll).toHaveBeenCalledWith('user-1');
    });
  });

  // ── Get Current User ──────────────────────────────────────────

  describe('getCurrentUser', () => {
    it('strips passwordHash and mfaSecret from user', async () => {
      const user = {
        id: '1',
        email: 'a@b.com',
        firstName: 'Sam',
        passwordHash: 'HASH',
        mfaSecret: 'SECRET',
      } as any;
      const result = await controller.getCurrentUser(user);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('mfaSecret');
      expect(result).toHaveProperty('email', 'a@b.com');
    });
  });

  // ── Password Reset ────────────────────────────────────────────

  describe('requestPasswordReset', () => {
    it('delegates to authService.requestPasswordReset', async () => {
      await controller.requestPasswordReset({ email: 'a@b.com' } as any);
      expect(authService.requestPasswordReset).toHaveBeenCalledWith('a@b.com');
    });
  });

  describe('resetPassword', () => {
    it('delegates to authService.resetPassword', async () => {
      await controller.resetPassword({ token: 'tok', newPassword: 'New1!@ab' } as any);
      expect(authService.resetPassword).toHaveBeenCalledWith('tok', 'New1!@ab');
    });
  });

  // ── Change Password ───────────────────────────────────────────

  describe('changePassword', () => {
    it('passes userId, current and new passwords', async () => {
      await controller.changePassword('user-1', {
        currentPassword: 'Old1!@',
        newPassword: 'New1!@',
      } as any);
      expect(authService.changePassword).toHaveBeenCalledWith('user-1', 'Old1!@', 'New1!@');
    });
  });

  // ── MFA ───────────────────────────────────────────────────────

  describe('enableMfa', () => {
    it('delegates to authService.enableMfa', async () => {
      authService.enableMfa.mockResolvedValue({ secret: 's', qrCode: 'q' } as any);
      const result = await controller.enableMfa('user-1');
      expect(authService.enableMfa).toHaveBeenCalledWith('user-1');
      expect(result).toHaveProperty('secret');
    });
  });

  describe('verifyMfa', () => {
    it('delegates to authService.verifyAndEnableMfa', async () => {
      await controller.verifyMfa('user-1', { code: '123456' } as any);
      expect(authService.verifyAndEnableMfa).toHaveBeenCalledWith('user-1', '123456');
    });
  });

  describe('disableMfa', () => {
    it('delegates to authService.disableMfa', async () => {
      await controller.disableMfa('user-1', { password: 'pass' } as any);
      expect(authService.disableMfa).toHaveBeenCalledWith('user-1', 'pass');
    });
  });

  // ── OAuth ─────────────────────────────────────────────────────

  describe('googleLogin', () => {
    it('verifies token then authenticates', async () => {
      const profile = { email: 'g@g.com', provider: 'google' };
      oauthService.verifyGoogleToken.mockResolvedValue(profile as any);
      oauthService.authenticateOAuth.mockResolvedValue({ accessToken: 'tok' } as any);

      await controller.googleLogin({ idToken: 'gt' } as any, '::1', mockReq);
      expect(oauthService.verifyGoogleToken).toHaveBeenCalledWith('gt');
      expect(oauthService.authenticateOAuth).toHaveBeenCalledWith(profile, '::1', 'test-agent');
    });
  });

  describe('appleLogin', () => {
    it('verifies token and applies optional name fields', async () => {
      const profile = { email: 'a@a.com', provider: 'apple', firstName: undefined, lastName: undefined };
      oauthService.verifyAppleToken.mockResolvedValue(profile as any);
      oauthService.authenticateOAuth.mockResolvedValue({ accessToken: 'tok' } as any);

      await controller.appleLogin(
        { identityToken: 'it', authorizationCode: 'ac', firstName: 'Sam', lastName: 'D' } as any,
        '::1',
        mockReq,
      );
      expect(profile.firstName).toBe('Sam');
      expect(profile.lastName).toBe('D');
      expect(oauthService.authenticateOAuth).toHaveBeenCalled();
    });

    it('does not overwrite name when not provided', async () => {
      const profile = { email: 'a@a.com', firstName: 'Existing' };
      oauthService.verifyAppleToken.mockResolvedValue(profile as any);
      oauthService.authenticateOAuth.mockResolvedValue({} as any);

      await controller.appleLogin(
        { identityToken: 'it', authorizationCode: 'ac' } as any,
        '::1',
        mockReq,
      );
      expect(profile.firstName).toBe('Existing');
    });
  });

  // ── OTP ───────────────────────────────────────────────────────

  describe('requestOtp', () => {
    it('delegates to otpService.requestOtp', async () => {
      otpService.requestOtp.mockResolvedValue({ message: 'sent' } as any);
      await controller.requestOtp({ email: 'a@b.com' } as any);
      expect(otpService.requestOtp).toHaveBeenCalledWith('a@b.com');
    });
  });

  describe('verifyOtp', () => {
    it('passes email, code, ip and user-agent', async () => {
      otpService.verifyOtp.mockResolvedValue({ accessToken: 'tok' } as any);
      await controller.verifyOtp({ email: 'a@b.com', code: '123456' } as any, '::1', mockReq);
      expect(otpService.verifyOtp).toHaveBeenCalledWith(
        'a@b.com',
        '123456',
        '::1',
        'test-agent',
        undefined,
      );
    });
  });

  // ── Verification ──────────────────────────────────────────────

  describe('sendVerificationEmail', () => {
    it('delegates to authService', async () => {
      await controller.sendVerificationEmail('user-1');
      expect(authService.sendVerificationEmail).toHaveBeenCalledWith('user-1');
    });
  });

  describe('verifyEmail', () => {
    it('delegates to authService', async () => {
      authService.verifyEmail.mockResolvedValue({ verified: true } as any);
      await controller.verifyEmail('tok-123');
      expect(authService.verifyEmail).toHaveBeenCalledWith('tok-123');
    });
  });

  describe('sendPhoneVerification', () => {
    it('delegates to authService', async () => {
      authService.sendPhoneVerification.mockResolvedValue({ message: 'sent' } as any);
      await controller.sendPhoneVerification('user-1');
      expect(authService.sendPhoneVerification).toHaveBeenCalledWith('user-1');
    });
  });

  describe('verifyPhone', () => {
    it('delegates to authService', async () => {
      authService.verifyPhone.mockResolvedValue({ verified: true } as any);
      await controller.verifyPhone('user-1', { code: '654321' } as any);
      expect(authService.verifyPhone).toHaveBeenCalledWith('user-1', '654321');
    });
  });
});
