import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  Get,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { i18nNotFound } from '@/common/errors/i18n-exceptions';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from '../services/auth.service';
import { OAuthService } from '../services/oauth.service';
import { OtpService } from '../services/otp.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RefreshTokenCookieInterceptor } from '../interceptors/refresh-token-cookie.interceptor';
import { User, UserRole } from '@rental-portal/database';

import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  ChangePasswordDto,
  VerifyMfaDto,
  DisableMfaDto,
  GoogleLoginDto,
  AppleLoginDto,
  OtpRequestDto,
  OtpVerifyDto,
  PhoneVerifyDto,
  DevLoginDto,
} from '../dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
@UseInterceptors(RefreshTokenCookieInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
    private readonly otpService: OtpService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Ip() ipAddress: string, @Req() req: Request) {
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Development-only login without password (dev only)' })
  @ApiResponse({ status: 200, description: 'Successfully logged in for development' })
  @ApiResponse({ status: 401, description: 'Not available outside development' })
  @ApiResponse({ status: 404, description: 'Endpoint disabled' })
  @Throttle({ default: { limit: 500, ttl: 60000 } })
  async devLogin(
    @Body() body: DevLoginDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    // SECURITY: Multi-layer protection for dev-login
    // 1. Environment check
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
      throw new NotFoundException('Development login not available');
    }
    
    // 2. Feature flag check
    if (process.env.DEV_LOGIN_ENABLED !== 'true') {
      throw new NotFoundException('Development login not enabled');
    }
    
    // 3. IP whitelist check (optional additional security)
    const allowedIps = process.env.DEV_LOGIN_ALLOWED_IPS?.split(',').filter(ip => ip.trim()) || [];
    if (allowedIps.length > 0 && !allowedIps.includes(ipAddress)) {
      throw new NotFoundException('Development login not allowed from this IP');
    }
    
    // 4. Secret key verification
    const devSecret = process.env.DEV_LOGIN_SECRET;
    if (!devSecret || body?.secret !== devSecret) {
      throw new NotFoundException('Invalid development login secret');
    }
    
    const userAgent = req.headers['user-agent'];
    return this.authService.devLogin(
      {
        email: body?.email,
        role: body?.role,
        secret: body?.secret,
      },
      ipAddress,
      userAgent,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refreshToken(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    // Prefer httpOnly cookie over body (web uses cookie, mobile sends body)
    const token =
      req.cookies?.[RefreshTokenCookieInterceptor.COOKIE_NAME] || dto.refreshToken;
    return this.authService.refreshTokens(token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout current session' })
  async logout(
    @CurrentUser('id') userId: string,
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      req.cookies?.[RefreshTokenCookieInterceptor.COOKIE_NAME] || dto.refreshToken;
    await this.authService.logout(userId, token);
    // Clear the refresh token cookie
    res.clearCookie(RefreshTokenCookieInterceptor.COOKIE_NAME, { path: '/api/auth' });
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout all sessions' })
  async logoutAll(@CurrentUser('id') userId: string) {
    await this.authService.logoutAll(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getCurrentUser(@CurrentUser() user: User) {
    return this.authService.sanitizeUser(user);
  }

  @Post('password/reset-request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Request password reset' })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    await this.authService.requestPasswordReset(dto.email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 204, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resetPassword(@Body() dto: PasswordResetDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 204, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid current password' })
  async changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Enable MFA for account' })
  @ApiResponse({ status: 200, description: 'MFA setup initiated' })
  async enableMfa(@CurrentUser('id') userId: string) {
    return this.authService.enableMfa(userId);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify and activate MFA' })
  @ApiResponse({ status: 204, description: 'MFA activated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid verification code' })
  async verifyMfa(@CurrentUser('id') userId: string, @Body() dto: VerifyMfaDto) {
    await this.authService.verifyAndEnableMfa(userId, dto.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiResponse({ status: 204, description: 'MFA disabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  async disableMfa(@CurrentUser('id') userId: string, @Body() dto: DisableMfaDto) {
    await this.authService.disableMfa(userId, dto.password);
  }

  // === OAuth Endpoints (6.1) ===

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with Google' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async googleLogin(@Body() dto: GoogleLoginDto, @Ip() ipAddress: string, @Req() req: Request) {
    const profile = await this.oauthService.verifyGoogleToken(dto.idToken);
    return this.oauthService.authenticateOAuth(profile, ipAddress, req.headers['user-agent']);
  }

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with Apple' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async appleLogin(@Body() dto: AppleLoginDto, @Ip() ipAddress: string, @Req() req: Request) {
    const profile = await this.oauthService.verifyAppleToken(
      dto.identityToken,
      dto.authorizationCode,
    );
    // Apple only sends name on first login
    if (dto.firstName) profile.firstName = dto.firstName;
    if (dto.lastName) profile.lastName = dto.lastName;
    return this.oauthService.authenticateOAuth(profile, ipAddress, req.headers['user-agent']);
  }

  // === OTP Endpoints (6.2) ===

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for passwordless login' })
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  async requestOtp(@Body() dto: OtpRequestDto) {
    return this.otpService.requestOtp(dto.email);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and login' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyOtp(@Body() dto: OtpVerifyDto, @Ip() ipAddress: string, @Req() req: Request) {
    return this.otpService.verifyOtp(dto.email, dto.code, ipAddress, req.headers['user-agent'], dto.mfaCode);
  }

  // === Verification Endpoints (6.3) ===

  @Post('verify-email/send')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send verification email' })
  async sendVerificationEmail(@CurrentUser('id') userId: string) {
    await this.authService.sendVerificationEmail(userId);
  }

  @Get('verify-email/:token')
  @ApiOperation({ summary: 'Verify email with token' })
  async verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('verify-phone/send')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send phone verification OTP' })
  async sendPhoneVerification(@CurrentUser('id') userId: string) {
    return this.authService.sendPhoneVerification(userId);
  }

  @Post('verify-phone/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify phone with OTP code' })
  async verifyPhone(@CurrentUser('id') userId: string, @Body() dto: PhoneVerifyDto) {
    return this.authService.verifyPhone(userId, dto.code);
  }
}
