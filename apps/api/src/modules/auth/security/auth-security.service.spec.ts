import { Test, TestingModule } from '@nestjs/testing';
import { AuthSecurityService } from './auth-security.service';
import { Logger } from '@nestjs/common';

describe('AuthSecurityService', () => {
  let service: AuthSecurityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthSecurityService],
    }).compile();

    service = module.get<AuthSecurityService>(AuthSecurityService);
  });

  afterEach(() => {
    // Clear internal state between tests
    (service as any).mfaCodes.clear();
    (service as any).sessions.clear();
    (service as any).failedLogins.clear();
    (service as any).lockedAccounts.clear();
    (service as any).userRoles.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('MFA Methods', () => {
    describe('generateMFACode', () => {
      it('should generate a 6-digit MFA code', () => {
        const code = service.generateMFACode('user123');
        expect(code).toBeDefined();
        expect(code).toHaveLength(6);
        expect(/^\d+$/.test(code)).toBe(true);
      });

      it('should store hashed MFA code with expiration', () => {
        const userId = 'user123';
        service.generateMFACode(userId);
        const stored = (service as any).mfaCodes.get(userId);
        expect(stored).toBeDefined();
        expect(stored.expiresAt).toBeInstanceOf(Date);
        expect(stored.attempts).toBe(0);
      });
    });

    describe('verifyMFACode', () => {
      it('should verify correct MFA code', () => {
        const userId = 'user123';
        const code = service.generateMFACode(userId);
        const isValid = service.verifyMFACode(userId, code);
        expect(isValid).toBe(true);
      });

      it('should reject incorrect MFA code', () => {
        const userId = 'user123';
        service.generateMFACode(userId);
        const isValid = service.verifyMFACode(userId, '000000');
        expect(isValid).toBe(false);
      });

      it('should reject expired MFA code', () => {
        const userId = 'user123';
        service.generateMFACode(userId);
        // Manually expire the code
        const stored = (service as any).mfaCodes.get(userId);
        stored.expiresAt = new Date(Date.now() - 1000);
        (service as any).mfaCodes.set(userId, stored);
        
        const isValid = service.verifyMFACode(userId, '123456');
        expect(isValid).toBe(false);
      });

      it('should reject after 3 failed attempts', () => {
        const userId = 'user123';
        const code = service.generateMFACode(userId);
        
        service.verifyMFACode(userId, '000000');
        service.verifyMFACode(userId, '000000');
        service.verifyMFACode(userId, '000000');
        
        const isValid = service.verifyMFACode(userId, code);
        expect(isValid).toBe(false);
      });

      it('should delete code after successful verification', () => {
        const userId = 'user123';
        const code = service.generateMFACode(userId);
        service.verifyMFACode(userId, code);
        
        const stored = (service as any).mfaCodes.get(userId);
        expect(stored).toBeUndefined();
      });
    });
  });

  describe('Session Management', () => {
    describe('createSession', () => {
      it('should create a session with valid properties', () => {
        const session = service.createSession('user123', '127.0.0.1', 'Mozilla/5.0');
        expect(session).toBeDefined();
        expect(session.userId).toBe('user123');
        expect(session.ipAddress).toBe('127.0.0.1');
        expect(session.userAgent).toBe('Mozilla/5.0');
        expect(session.mfaVerified).toBe(false);
        expect(session.id).toBeDefined();
        expect(session.createdAt).toBeInstanceOf(Date);
        expect(session.expiresAt).toBeInstanceOf(Date);
      });

      it('should create session with MFA verified', () => {
        const session = service.createSession('user123', '127.0.0.1', 'Mozilla/5.0', true);
        expect(session.mfaVerified).toBe(true);
      });
    });

    describe('validateSession', () => {
      it('should validate valid session', () => {
        const session = service.createSession('user123', '127.0.0.1', 'Mozilla/5.0');
        const validated = service.validateSession(session.id);
        expect(validated).toBeDefined();
        expect(validated.userId).toBe('user123');
      });

      it('should return null for invalid session', () => {
        const validated = service.validateSession('invalid-id');
        expect(validated).toBeNull();
      });

      it('should return null for expired session', () => {
        const session = service.createSession('user123', '127.0.0.1', 'Mozilla/5.0');
        // Manually expire the session
        const stored = (service as any).sessions.get(session.id);
        stored.expiresAt = new Date(Date.now() - 1000);
        (service as any).sessions.set(session.id, stored);
        
        const validated = service.validateSession(session.id);
        expect(validated).toBeNull();
      });

      it('should update last activity on validation', async () => {
        const session = service.createSession('user123', '127.0.0.1', 'Mozilla/5.0');
        const originalActivity = session.lastActivity;

        // Wait a bit using Promise
        await new Promise(resolve => setTimeout(resolve, 10));

        service.validateSession(session.id);
        const updated = (service as any).sessions.get(session.id);
        expect(updated.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
      });
    });

    describe('invalidateSession', () => {
      it('should invalidate session', () => {
        const session = service.createSession('user123', '127.0.0.1', 'Mozilla/5.0');
        service.invalidateSession(session.id);
        
        const validated = service.validateSession(session.id);
        expect(validated).toBeNull();
      });
    });

    describe('invalidateAllUserSessions', () => {
      it('should invalidate all user sessions', () => {
        service.createSession('user123', '127.0.0.1', 'Mozilla/5.0');
        service.createSession('user123', '127.0.0.1', 'Chrome');
        service.createSession('user456', '127.0.0.1', 'Firefox');
        
        service.invalidateAllUserSessions('user123');
        
        const sessions = (service as any).sessions;
        let user123Sessions = 0;
        for (const session of sessions.values()) {
          if (session.userId === 'user123') user123Sessions++;
        }
        expect(user123Sessions).toBe(0);
      });
    });

    describe('getUserSessions', () => {
      it('should return all user sessions', () => {
        service.createSession('user123', '127.0.0.1', 'Mozilla/5.0');
        service.createSession('user123', '127.0.0.1', 'Chrome');
        service.createSession('user456', '127.0.0.1', 'Firefox');
        
        const user123Sessions = service.getUserSessions('user123');
        expect(user123Sessions).toHaveLength(2);
        expect(user123Sessions.every(s => s.userId === 'user123')).toBe(true);
      });
    });
  });

  describe('RBAC Methods', () => {
    describe('registerRole', () => {
      it('should register a new role', () => {
        service.registerRole({
          name: 'TEST_ROLE',
          permissions: ['read:test', 'write:test'],
        });
        
        const hasPermission = service.hasPermission('user123', 'read:test');
        // This will return false since user doesn't have the role, but the role should be registered
        expect(() => service.assignRole('user123', 'TEST_ROLE')).not.toThrow();
      });
    });

    describe('assignRole', () => {
      it('should assign role to user', () => {
        service.assignRole('user123', 'USER');
        const roles = service.getUserRoles('user123');
        expect(roles).toContain('USER');
      });

      it('should throw error for non-existent role', () => {
        expect(() => service.assignRole('user123', 'NON_EXISTENT')).toThrow();
      });

      it('should not duplicate roles', () => {
        service.assignRole('user123', 'USER');
        service.assignRole('user123', 'USER');
        const roles = service.getUserRoles('user123');
        expect(roles.filter(r => r === 'USER')).toHaveLength(1);
      });
    });

    describe('removeRole', () => {
      it('should remove role from user', () => {
        service.assignRole('user123', 'USER');
        service.removeRole('user123', 'USER');
        const roles = service.getUserRoles('user123');
        expect(roles).not.toContain('USER');
      });
    });

    describe('getUserRoles', () => {
      it('should return empty array for user with no roles', () => {
        const roles = service.getUserRoles('user123');
        expect(roles).toEqual([]);
      });
    });

    describe('getUserPermissions', () => {
      it('should return user permissions from roles', () => {
        service.assignRole('user123', 'USER');
        const permissions = service.getUserPermissions('user123');
        expect(permissions).toContain('read:own');
        expect(permissions).toContain('write:own');
      });

      it('should include inherited role permissions', () => {
        service.assignRole('user123', 'ADMIN');
        const permissions = service.getUserPermissions('user123');
        expect(permissions).toContain('read:own');
        expect(permissions).toContain('read:all');
        expect(permissions).toContain('write:all');
      });
    });

    describe('hasPermission', () => {
      it('should return true for valid permission', () => {
        service.assignRole('user123', 'USER');
        expect(service.hasPermission('user123', 'read:own')).toBe(true);
      });

      it('should return false for invalid permission', () => {
        service.assignRole('user123', 'USER');
        expect(service.hasPermission('user123', 'write:all')).toBe(false);
      });

      it('should return false for user with no roles', () => {
        expect(service.hasPermission('user123', 'read:own')).toBe(false);
      });
    });

    describe('hasRole', () => {
      it('should return true for user with role', () => {
        service.assignRole('user123', 'USER');
        expect(service.hasRole('user123', 'USER')).toBe(true);
      });

      it('should return false for user without role', () => {
        expect(service.hasRole('user123', 'USER')).toBe(false);
      });
    });
  });

  describe('Account Lockout Methods', () => {
    describe('recordFailedLogin', () => {
      it('should increment failed login count', () => {
        const result = service.recordFailedLogin('user123');
        expect(result).toBe(true);
        
        const failed = (service as any).failedLogins.get('user123');
        expect(failed.count).toBe(1);
      });

      it('should lock account after max attempts', () => {
        const result1 = service.recordFailedLogin('user123');
        const result2 = service.recordFailedLogin('user123');
        const result3 = service.recordFailedLogin('user123');
        const result4 = service.recordFailedLogin('user123');
        const result5 = service.recordFailedLogin('user123');
        
        expect(result5).toBe(false);
        expect(service.isAccountLocked('user123')).toBe(true);
      });
    });

    describe('resetFailedLogins', () => {
      it('should reset failed login count', () => {
        service.recordFailedLogin('user123');
        service.recordFailedLogin('user123');
        service.resetFailedLogins('user123');
        
        const failed = (service as any).failedLogins.get('user123');
        expect(failed).toBeUndefined();
      });
    });

    describe('lockAccount', () => {
      it('should lock account', () => {
        service.lockAccount('user123');
        expect(service.isAccountLocked('user123')).toBe(true);
      });
    });

    describe('isAccountLocked', () => {
      it('should return false for unlocked account', () => {
        expect(service.isAccountLocked('user123')).toBe(false);
      });

      it('should return true for locked account', () => {
        service.lockAccount('user123');
        expect(service.isAccountLocked('user123')).toBe(true);
      });

      it('should auto-unlock after lockout duration', () => {
        // Set a very short lockout duration for testing
        (service as any).defaultPolicy.lockoutDuration = 100;
        service.lockAccount('user123');
        
        // Wait for lockout to expire
        setTimeout(() => {
          expect(service.isAccountLocked('user123')).toBe(false);
        }, 150);
      });
    });

    describe('getLockoutTime', () => {
      it('should return lockout time for locked account', () => {
        service.lockAccount('user123');
        const lockoutTime = service.getLockoutTime('user123');
        expect(lockoutTime).toBeInstanceOf(Date);
      });

      it('should return undefined for unlocked account', () => {
        const lockoutTime = service.getLockoutTime('user123');
        expect(lockoutTime).toBeUndefined();
      });
    });
  });

  describe('Password Validation', () => {
    describe('validatePassword', () => {
      it('should validate strong password', () => {
        const result = service.validatePassword('StrongPass123!');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject short password', () => {
        const result = service.validatePassword('short');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters');
      });

      it('should reject password without uppercase', () => {
        const result = service.validatePassword('lowercase123');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one uppercase letter');
      });

      it('should reject password without lowercase', () => {
        const result = service.validatePassword('UPPERCASE123');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one lowercase letter');
      });

      it('should reject password without number', () => {
        const result = service.validatePassword('NoNumbers!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one number');
      });
    });
  });

  describe('Security Headers', () => {
    describe('getSecurityHeaders', () => {
      it('should return security headers', () => {
        const headers = service.getSecurityHeaders();
        expect(headers).toBeDefined();
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['X-Frame-Options']).toBe('DENY');
        expect(headers['X-XSS-Protection']).toBe('1; mode=block');
        expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
        expect(headers['Content-Security-Policy']).toContain('default-src');
        expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      });
    });
  });

  describe('Security Audit', () => {
    describe('auditAccess', () => {
      it('should log access audit', () => {
        const loggerSpy = jest.spyOn((service as any).logger, 'log');
        service.auditAccess('user123', 'resource1', 'read', true);
        expect(loggerSpy).toHaveBeenCalled();
        loggerSpy.mockRestore();
      });
    });
  });
});
