import { Test, TestingModule } from '@nestjs/testing';
import { SecurityTestFramework } from './security-framework';
import { SecurityTestUtils } from './security-test-utils';
import { AuthService } from '../modules/auth/services/auth.service';
import { JwtService } from '@nestjs/jwt';

describe('Authentication Security Tests', () => {
  let framework: SecurityTestFramework;
  let securityUtils: SecurityTestUtils;
  let authService: AuthService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityTestFramework,
        SecurityTestUtils,
        AuthService,
        JwtService,
      ],
    }).compile();

    framework = module.get<SecurityTestFramework>(SecurityTestFramework);
    securityUtils = module.get<SecurityTestUtils>(SecurityTestUtils);
    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('JWT Token Validation', () => {
    test('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'not.a.jwt.token',
        'invalid.jwt',
        'Bearer invalid.jwt',
        'Bearer not.a.jwt.token',
        'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.',
        '..',
        '...',
        '',
        null,
        undefined
      ];

      for (const token of malformedTokens) {
        const response = await framework.testEndpoint({
          method: 'GET',
          path: '/api/users/profile',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        expect(response.status).toBe(401);
        expect(response.body.error).toContain('Invalid token');
      }
    });

    test('should reject expired JWT tokens', async () => {
      const expiredPayload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'user',
        iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        exp: Math.floor(Date.now() / 1000) - 1800 // 30 minutes ago (expired)
      };

      const expiredToken = jwtService.sign(expiredPayload, { expiresIn: '-1h' });

      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': `Bearer ${expiredToken}` }
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Token expired');
    });

    test('should reject JWT tokens with invalid signature', async () => {
      const validPayload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      // Sign with wrong secret
      const tokenWithInvalidSignature = jwtService.sign(validPayload, { secret: 'wrong-secret' });

      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': `Bearer ${tokenWithInvalidSignature}` }
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token signature');
    });

    test('should reject JWT tokens with invalid algorithm', async () => {
      const payload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      // Create token with 'none' algorithm (vulnerable)
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tokenWithNoneAlgorithm = `${header}.${body}.`;

      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': `Bearer ${tokenWithNoneAlgorithm}` }
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token algorithm');
    });

    test('should reject JWT tokens with manipulated claims', async () => {
      const validToken = jwtService.sign({
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'user'
      });

      // Manipulate token by changing role to admin
      const [header, payload, signature] = validToken.split('.');
      const manipulatedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
      manipulatedPayload.role = 'admin';
      const manipulatedPayloadBase64 = Buffer.from(JSON.stringify(manipulatedPayload)).toString('base64url');
      const manipulatedToken = `${header}.${manipulatedPayloadBase64}.${signature}`;

      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/admin/users',
        headers: { 'Authorization': `Bearer ${manipulatedToken}` }
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token signature');
    });

    test('should validate JWT token structure', async () => {
      const invalidStructureTokens = [
        'header.payload', // Missing signature
        'header.payload.signature.extra', // Too many parts
        'header', // Only header
        'payload.signature', // Missing header
        'header.signature' // Missing payload
      ];

      for (const token of invalidStructureTokens) {
        const response = await framework.testEndpoint({
          method: 'GET',
          path: '/api/users/profile',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        expect(response.status).toBe(401);
        expect(response.body.error).toContain('Invalid token format');
      }
    });
  });

  describe('Session Management', () => {
    test('should handle session expiration', async () => {
      // Create session that expires immediately
      const expiredSession = {
        userId: 'test-user-123',
        sessionId: 'session-123',
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      };

      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': `Bearer ${expiredSession.sessionId}` }
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Session expired');
    });

    test('should invalidate session on logout', async () => {
      // Login to get valid session
      const loginResponse = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'test@example.com', password: 'password123' }
      });

      expect(loginResponse.status).toBe(200);
      const token = loginResponse.body.token;

      // Logout
      const logoutResponse = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/logout',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      expect(logoutResponse.status).toBe(200);

      // Try to use token after logout
      const profileResponse = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      expect(profileResponse.status).toBe(401);
      expect(profileResponse.body.error).toContain('Invalid session');
    });

    test('should handle concurrent sessions', async () => {
      // Login from multiple devices
      const session1 = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'test@example.com', password: 'password123' },
        headers: { 'User-Agent': 'Device1' }
      });

      const session2 = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'test@example.com', password: 'password123' },
        headers: { 'User-Agent': 'Device2' }
      });

      expect(session1.status).toBe(200);
      expect(session2.status).toBe(200);

      // Both sessions should be valid
      const profile1 = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': `Bearer ${session1.body.token}` }
      });

      const profile2 = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': `Bearer ${session2.body.token}` }
      });

      expect(profile1.status).toBe(200);
      expect(profile2.status).toBe(200);

      // Logout one session
      await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/logout',
        headers: { 'Authorization': `Bearer ${session1.body.token}` }
      });

      // First session should be invalid, second should still be valid
      const profile1AfterLogout = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': `Bearer ${session1.body.token}` }
      });

      const profile2AfterLogout = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': `Bearer ${session2.body.token}` }
      });

      expect(profile1AfterLogout.status).toBe(401);
      expect(profile2AfterLogout.status).toBe(200);
    });

    test('should handle session fixation', async () => {
      // Attempt to use session ID from URL parameter
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile?sessionId=malicious-session-123',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid session parameter');
    });
  });

  describe('Password Security', () => {
    test('should enforce password strength requirements', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abc123',
        '111111',
        'password123',
        'admin',
        'root',
        'test',
        'user',
        'a',
        '123',
        'pass',
        'pwd',
        '',
        null,
        undefined
      ];

      for (const password of weakPasswords) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/auth/register',
          body: {
            email: 'test@example.com',
            password: password,
            firstName: 'Test',
            lastName: 'User'
          }
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Password does not meet security requirements');
      }
    });

    test('should accept strong passwords', async () => {
      const strongPasswords = [
        'SecureP@ssw0rd123!',
        'MyStr0ng#P@ssword',
        'C0mpl3x!P@ssw0rd',
        'R@nd0m#P@ss123',
        'S3cur3P@ssw0rd!2023'
      ];

      for (const password of strongPasswords) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/auth/register',
          body: {
            email: `test${Math.random()}@example.com`,
            password: password,
            firstName: 'Test',
            lastName: 'User'
          }
        });

        // Should not fail due to password strength (may fail for other reasons like duplicate email)
        expect(response.status).not.toBe(400);
        expect(response.body.error).not.toContain('Password does not meet security requirements');
      }
    });

    test('should hash passwords with proper algorithm', async () => {
      const password = 'TestPassword123!';
      
      // Check that password is hashed (not stored in plain text)
      const hashedPassword = await authService.hashPassword(password);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
      expect(hashedPassword).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt format
    });

    test('should verify password hashes correctly', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await authService.hashPassword(password);
      
      // Correct password should verify
      const isValid = await authService.verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
      
      // Incorrect password should not verify
      const isInvalid = await authService.verifyPassword('WrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });

    test('should prevent password reuse', async () => {
      const user = {
        email: 'test@example.com',
        password: 'OldPassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      // Register user
      await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/register',
        body: user
      });

      // Try to change password to the same one
      const response = await framework.testEndpoint({
        method: 'PUT',
        path: '/api/auth/change-password',
        body: {
          currentPassword: 'OldPassword123!',
          newPassword: 'OldPassword123!'
        },
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot reuse previous password');
    });
  });

  describe('Brute Force Protection', () => {
    test('should block repeated failed login attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/auth/login',
          body: loginData
        });

        if (i < 4) {
          expect(response.status).toBe(401);
          expect(response.body.error).toContain('Invalid credentials');
        } else {
          // After 5 attempts, should be blocked
          expect(response.status).toBe(429);
          expect(response.body.error).toContain('Too many login attempts');
        }
      }
    });

    test('should implement progressive delay for failed attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const startTime = Date.now();

      // Make multiple failed attempts
      for (let i = 0; i < 3; i++) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/auth/login',
          body: loginData
        });

        expect(response.status).toBe(401);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have progressive delay (more than just processing time)
      expect(duration).toBeGreaterThan(1000);
    });

    test('should reset failed attempt counter after successful login', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Make failed attempts
      for (let i = 0; i < 3; i++) {
        await framework.testEndpoint({
          method: 'POST',
          path: '/api/auth/login',
          body: loginData
        });
      }

      // Successful login should reset counter
      const successResponse = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/login',
        body: {
          email: 'test@example.com',
          password: 'correctpassword'
        }
      });

      expect(successResponse.status).toBe(200);

      // Should be able to make more attempts without immediate block
      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/login',
        body: loginData
      });

      expect(response.status).toBe(401);
      expect(response.body.error).not.toContain('Too many login attempts');
    });

    test('should implement IP-based rate limiting', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Make attempts from different IPs
      const ips = ['192.168.1.100', '192.168.1.101', '192.168.1.102'];
      
      for (const ip of ips) {
        for (let i = 0; i < 5; i++) {
          const response = await framework.testEndpoint({
            method: 'POST',
            path: '/api/auth/login',
            body: loginData,
            headers: { 'X-Forwarded-For': ip }
          });

          if (i < 4) {
            expect(response.status).toBe(401);
          } else {
            expect(response.status).toBe(429);
          }
        }
      }
    });
  });

  describe('Multi-Factor Authentication', () => {
    test('should require MFA for sensitive operations', async () => {
      const sensitiveOperations = [
        { method: 'PUT', path: '/api/auth/change-email', body: { newEmail: 'new@example.com' } },
        { method: 'PUT', path: '/api/auth/change-password', body: { newPassword: 'NewPassword123!' } },
        { method: 'DELETE', path: '/api/users/delete-account', body: {} },
        { method: 'POST', path: '/api/payments/transfer', body: { amount: 1000, to: 'user@example.com' } }
      ];

      for (const operation of sensitiveOperations) {
        const response = await framework.testEndpoint({
          ...operation,
          headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('Multi-factor authentication required');
      }
    });

    test('should validate TOTP tokens', async () => {
      const invalidTotpTokens = [
        '123456',
        '000000',
        '999999',
        'abcdef',
        '12345',
        '1234567',
        '',
        null,
        undefined
      ];

      for (const token of invalidTotpTokens) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/auth/verify-totp',
          body: { token: token },
          headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid TOTP token');
      }
    });

    test('should handle backup codes', async () => {
      const backupCodes = [
        '12345678',
        '87654321',
        '11112222',
        '33334444'
      ];

      for (const code of backupCodes) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/auth/verify-backup-code',
          body: { code: code },
          headers: { 'Authorization': 'Bearer test-token' }
        });

        // Should accept valid backup codes (mocked)
        expect([200, 400]).toContain(response.status);
      }
    });

    test('should regenerate backup codes', async () => {
      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/regenerate-backup-codes',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      expect(response.body.backupCodes).toBeDefined();
      expect(Array.isArray(response.body.backupCodes)).toBe(true);
      expect(response.body.backupCodes.length).toBe(10);
      
      // Each backup code should be 8 digits
      response.body.backupCodes.forEach((code: string) => {
        expect(code).toMatch(/^\d{8}$/);
      });
    });
  });

  describe('Account Lockout', () => {
    test('should lock account after excessive failed attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Make excessive failed attempts
      for (let i = 0; i < 10; i++) {
        const response = await framework.testEndpoint({
          method: 'POST',
          path: '/api/auth/login',
          body: loginData
        });

        if (i < 9) {
          expect([401, 429]).toContain(response.status);
        } else {
          // Account should be locked
          expect(response.status).toBe(423);
          expect(response.body.error).toContain('Account locked');
        }
      }
    });

    test('should prevent login to locked accounts', async () => {
      // Try to login to locked account with correct password
      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/login',
        body: {
          email: 'test@example.com',
          password: 'correctpassword'
        }
      });

      expect(response.status).toBe(423);
      expect(response.body.error).toContain('Account locked');
    });

    test('should provide account unlock mechanism', async () => {
      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/unlock-account',
        body: {
          email: 'test@example.com',
          unlockToken: 'valid-unlock-token'
        }
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Account unlocked');
    });

    test('should send unlock email', async () => {
      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/request-unlock',
        body: {
          email: 'test@example.com'
        }
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Unlock email sent');
    });
  });

  describe('Authentication Security Validation', () => {
    test('should log authentication attempts', async () => {
      const loginAttempts = [
        { email: 'test@example.com', password: 'wrongpassword', expected: 'failed' },
        { email: 'test@example.com', password: 'correctpassword', expected: 'success' },
        { email: 'nonexistent@example.com', password: 'wrongpassword', expected: 'failed' }
      ];

      for (const attempt of loginAttempts) {
        await framework.testEndpoint({
          method: 'POST',
          path: '/api/auth/login',
          body: {
            email: attempt.email,
            password: attempt.password
          }
        });
      }

      // Check security logs
      const securityLogs = await framework.getSecurityLogs();
      const authLogs = securityLogs.filter(log => 
        log.type === 'AUTH_ATTEMPT'
      );

      expect(authLogs.length).toBeGreaterThan(0);
      expect(authLogs[0].timestamp).toBeDefined();
      expect(authLogs[0].ipAddress).toBeDefined();
      expect(authLogs[0].userAgent).toBeDefined();
      expect(authLogs[0].result).toBeDefined();
    });

    test('should provide comprehensive authentication security report', async () => {
      const report = await framework.generateAuthSecurityReport();

      expect(report.timestamp).toBeDefined();
      expect(report.testResults).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.vulnerabilities).toBeDefined();
      expect(report.recommendations).toBeDefined();

      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(report.summary.testsPassed).toBe(report.summary.totalTests);
      expect(report.summary.vulnerabilitiesFound).toBe(0);

      expect(report.testResults.jwtValidation).toBeDefined();
      expect(report.testResults.sessionManagement).toBeDefined();
      expect(report.testResults.passwordSecurity).toBeDefined();
      expect(report.testResults.bruteForceProtection).toBeDefined();
      expect(report.testResults.multiFactorAuth).toBeDefined();
      expect(report.testResults.accountLockout).toBeDefined();

      // Should include OWASP compliance
      expect(report.owaspCompliance).toBeDefined();
      expect(report.owaspCompliance.a07_identification).toBeDefined();
      expect(report.owaspCompliance.a07_identification.status).toBe('COMPLIANT');
      expect(report.owaspCompliance.a02_authentication_failures).toBeDefined();
      expect(report.owaspCompliance.a02_authentication_failures.status).toBe('COMPLIANT');
    });
  });

  afterAll(async () => {
    await framework.cleanup();
  });
});
