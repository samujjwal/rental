import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
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
} from './auth.dto';

describe('Auth DTOs', () => {
  describe('RegisterDto', () => {
    const validData = {
      email: 'john@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
    };

    it('passes with valid data', async () => {
      const dto = plainToInstance(RegisterDto, validData);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all optional fields', async () => {
      const dto = plainToInstance(RegisterDto, {
        ...validData,
        lastName: 'Doe',
        phoneNumber: '+977-984-1234567',
        phone: '+977-984-1234567',
        dateOfBirth: '1990-01-01',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with invalid email', async () => {
      const dto = plainToInstance(RegisterDto, { ...validData, email: 'not-an-email' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('fails with missing email', async () => {
      const dto = plainToInstance(RegisterDto, { password: 'SecurePass123!', firstName: 'John' });
      const errors = await validate(dto);
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
    });

    it('fails with weak password (no uppercase)', async () => {
      const dto = plainToInstance(RegisterDto, { ...validData, password: 'weakpassword1!' });
      const errors = await validate(dto);
      const pwError = errors.find((e) => e.property === 'password');
      expect(pwError).toBeDefined();
    });

    it('fails with weak password (no special char)', async () => {
      const dto = plainToInstance(RegisterDto, { ...validData, password: 'WeakPass123' });
      const errors = await validate(dto);
      const pwError = errors.find((e) => e.property === 'password');
      expect(pwError).toBeDefined();
    });

    it('fails with weak password (no digit)', async () => {
      const dto = plainToInstance(RegisterDto, { ...validData, password: 'WeakPass!!!' });
      const errors = await validate(dto);
      const pwError = errors.find((e) => e.property === 'password');
      expect(pwError).toBeDefined();
    });

    it('fails with short password', async () => {
      const dto = plainToInstance(RegisterDto, { ...validData, password: 'Abc1!' });
      const errors = await validate(dto);
      const pwError = errors.find((e) => e.property === 'password');
      expect(pwError).toBeDefined();
    });

    it('fails with too short firstName', async () => {
      const dto = plainToInstance(RegisterDto, { ...validData, firstName: 'J' });
      const errors = await validate(dto);
      const nameError = errors.find((e) => e.property === 'firstName');
      expect(nameError).toBeDefined();
    });

    it('fails with too long firstName (>50)', async () => {
      const dto = plainToInstance(RegisterDto, { ...validData, firstName: 'A'.repeat(51) });
      const errors = await validate(dto);
      const nameError = errors.find((e) => e.property === 'firstName');
      expect(nameError).toBeDefined();
    });

    it('fails with too short lastName', async () => {
      const dto = plainToInstance(RegisterDto, { ...validData, lastName: 'D' });
      const errors = await validate(dto);
      const nameError = errors.find((e) => e.property === 'lastName');
      expect(nameError).toBeDefined();
    });

    it('fails with invalid dateOfBirth format', async () => {
      const dto = plainToInstance(RegisterDto, { ...validData, dateOfBirth: 'not-a-date' });
      const errors = await validate(dto);
      const dateError = errors.find((e) => e.property === 'dateOfBirth');
      expect(dateError).toBeDefined();
    });
  });

  describe('LoginDto', () => {
    it('passes with valid email and password', async () => {
      const dto = plainToInstance(LoginDto, { email: 'john@example.com', password: 'pass123' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with optional mfaCode', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'john@example.com',
        password: 'pass123',
        mfaCode: '123456',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with invalid email', async () => {
      const dto = plainToInstance(LoginDto, { email: 'bad', password: 'pass123' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('fails with missing password', async () => {
      const dto = plainToInstance(LoginDto, { email: 'john@example.com' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('fails with mfaCode too short', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'a@b.com',
        password: 'p',
        mfaCode: '123',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'mfaCode')).toBe(true);
    });

    it('fails with mfaCode too long', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'a@b.com',
        password: 'p',
        mfaCode: '1234567',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'mfaCode')).toBe(true);
    });
  });

  describe('RefreshTokenDto', () => {
    it('passes with valid refreshToken', async () => {
      const dto = plainToInstance(RefreshTokenDto, { refreshToken: 'some-token-value' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes without refreshToken (optional for cookie-based auth)', async () => {
      const dto = plainToInstance(RefreshTokenDto, {});
      const errors = await validate(dto);
      // refreshToken is optional — cookie-based auth doesn't need it in body
      expect(errors.some((e) => e.property === 'refreshToken')).toBe(false);
    });
  });

  describe('PasswordResetRequestDto', () => {
    it('passes with valid email', async () => {
      const dto = plainToInstance(PasswordResetRequestDto, { email: 'test@test.com' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with invalid email', async () => {
      const dto = plainToInstance(PasswordResetRequestDto, { email: 'invalid' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('PasswordResetDto', () => {
    it('passes with valid token and strong password', async () => {
      const dto = plainToInstance(PasswordResetDto, {
        token: 'reset-token',
        newPassword: 'NewPass123!',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with weak newPassword', async () => {
      const dto = plainToInstance(PasswordResetDto, {
        token: 'reset-token',
        newPassword: 'weak',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
    });
  });

  describe('ChangePasswordDto', () => {
    it('passes with valid current and new passwords', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with weak newPassword', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'old',
        newPassword: 'short',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
    });
  });

  describe('VerifyMfaDto', () => {
    it('passes with 6-char code', async () => {
      const dto = plainToInstance(VerifyMfaDto, { code: '123456' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with short code', async () => {
      const dto = plainToInstance(VerifyMfaDto, { code: '123' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('fails with long code', async () => {
      const dto = plainToInstance(VerifyMfaDto, { code: '1234567' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('DisableMfaDto', () => {
    it('passes with password', async () => {
      const dto = plainToInstance(DisableMfaDto, { password: 'mypassword' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with missing password', async () => {
      const dto = plainToInstance(DisableMfaDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('GoogleLoginDto', () => {
    it('passes with idToken', async () => {
      const dto = plainToInstance(GoogleLoginDto, { idToken: 'google-token-123' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails without idToken', async () => {
      const dto = plainToInstance(GoogleLoginDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('AppleLoginDto', () => {
    it('passes with required fields', async () => {
      const dto = plainToInstance(AppleLoginDto, {
        identityToken: 'apple-id-token',
        authorizationCode: 'auth-code',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with optional names', async () => {
      const dto = plainToInstance(AppleLoginDto, {
        identityToken: 'apple-id-token',
        authorizationCode: 'auth-code',
        firstName: 'John',
        lastName: 'Doe',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails without identityToken', async () => {
      const dto = plainToInstance(AppleLoginDto, { authorizationCode: 'code' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'identityToken')).toBe(true);
    });

    it('fails without authorizationCode', async () => {
      const dto = plainToInstance(AppleLoginDto, { identityToken: 'token' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'authorizationCode')).toBe(true);
    });
  });

  describe('OtpRequestDto', () => {
    it('passes with valid email', async () => {
      const dto = plainToInstance(OtpRequestDto, { email: 'a@b.com' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with invalid email', async () => {
      const dto = plainToInstance(OtpRequestDto, { email: 'nope' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('OtpVerifyDto', () => {
    it('passes with valid email and code', async () => {
      const dto = plainToInstance(OtpVerifyDto, { email: 'a@b.com', code: '123456' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with short code', async () => {
      const dto = plainToInstance(OtpVerifyDto, { email: 'a@b.com', code: '12' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });
  });

  describe('PhoneVerifyDto', () => {
    it('passes with 6-char code', async () => {
      const dto = plainToInstance(PhoneVerifyDto, { code: '654321' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with too short code', async () => {
      const dto = plainToInstance(PhoneVerifyDto, { code: '12' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('fails with too long code', async () => {
      const dto = plainToInstance(PhoneVerifyDto, { code: '12345678' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
