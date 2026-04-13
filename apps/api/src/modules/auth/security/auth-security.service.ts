/**
 * Auth Security Service
 * 
 * Provides enhanced authentication with MFA, RBAC, and session management
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export interface MFACode {
  code: string;
  expiresAt: Date;
  attempts: number;
}

export interface UserSession {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  mfaVerified: boolean;
}

export interface Role {
  name: string;
  permissions: string[];
  inherits?: string[];
}

export interface RBACUser {
  userId: string;
  roles: string[];
  permissions: string[];
}

export interface SecurityPolicy {
  mfaRequired: boolean;
  passwordMinLength: number;
  passwordComplexity: 'low' | 'medium' | 'high';
  maxLoginAttempts: number;
  lockoutDuration: number;
  sessionTimeout: number;
}

@Injectable()
export class AuthSecurityService {
  private readonly logger = new Logger(AuthSecurityService.name);
  private mfaCodes = new Map<string, MFACode>();
  private sessions = new Map<string, UserSession>();
  private roles = new Map<string, Role>();
  private userRoles = new Map<string, string[]>();
  private failedLogins = new Map<string, { count: number; lastAttempt: Date }>();
  private lockedAccounts = new Map<string, Date>();

  private defaultPolicy: SecurityPolicy = {
    mfaRequired: false,
    passwordMinLength: 8,
    passwordComplexity: 'medium',
    maxLoginAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  };

  constructor() {
    // Initialize default roles
    this.registerRole({
      name: 'USER',
      permissions: ['read:own', 'write:own'],
    });

    this.registerRole({
      name: 'ADMIN',
      permissions: ['read:all', 'write:all', 'delete:all', 'manage:users'],
      inherits: ['USER'],
    });

    this.registerRole({
      name: 'ANALYST',
      permissions: ['read:all', 'read:analytics'],
    });

    this.registerRole({
      name: 'SUPPORT',
      permissions: ['read:all', 'write:support', 'manage:tickets'],
    });
  }

  // MFA Methods
  generateMFACode(userId: string): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    this.mfaCodes.set(userId, {
      code: this.hashCode(code),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      attempts: 0,
    });

    this.logger.log(`Generated MFA code for user: ${userId}`);
    return code;
  }

  verifyMFACode(userId: string, code: string): boolean {
    const mfaCode = this.mfaCodes.get(userId);

    if (!mfaCode) {
      return false;
    }

    if (new Date() > mfaCode.expiresAt) {
      this.mfaCodes.delete(userId);
      return false;
    }

    mfaCode.attempts++;

    if (mfaCode.attempts > 3) {
      this.mfaCodes.delete(userId);
      return false;
    }

    const hashedInput = this.hashCode(code);
    const isValid = hashedInput === mfaCode.code;

    if (isValid) {
      this.mfaCodes.delete(userId);
    }

    return isValid;
  }

  // Session Management
  createSession(
    userId: string,
    ipAddress: string,
    userAgent: string,
    mfaVerified: boolean = false,
  ): UserSession {
    const session: UserSession = {
      id: this.generateSessionId(),
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.defaultPolicy.sessionTimeout),
      lastActivity: new Date(),
      ipAddress,
      userAgent,
      mfaVerified,
    };

    this.sessions.set(session.id, session);
    this.logger.log(`Created session for user: ${userId}`);

    return session;
  }

  validateSession(sessionId: string): UserSession | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    session.lastActivity = new Date();
    return session;
  }

  invalidateSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.logger.log(`Invalidated session: ${sessionId}`);
  }

  invalidateAllUserSessions(userId: string): void {
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(id);
      }
    }
    this.logger.log(`Invalidated all sessions for user: ${userId}`);
  }

  getUserSessions(userId: string): UserSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  // RBAC Methods
  registerRole(role: Role): void {
    this.roles.set(role.name, role);
    this.logger.log(`Registered role: ${role.name}`);
  }

  assignRole(userId: string, roleName: string): void {
    if (!this.roles.has(roleName)) {
      throw new Error(`Role ${roleName} does not exist`);
    }

    const userRoleList = this.userRoles.get(userId) || [];
    if (!userRoleList.includes(roleName)) {
      userRoleList.push(roleName);
      this.userRoles.set(userId, userRoleList);
    }

    this.logger.log(`Assigned role ${roleName} to user: ${userId}`);
  }

  removeRole(userId: string, roleName: string): void {
    const userRoleList = this.userRoles.get(userId) || [];
    const index = userRoleList.indexOf(roleName);
    if (index > -1) {
      userRoleList.splice(index, 1);
      this.userRoles.set(userId, userRoleList);
    }
  }

  getUserRoles(userId: string): string[] {
    return this.userRoles.get(userId) || [];
  }

  getUserPermissions(userId: string): string[] {
    const userRoles = this.getUserRoles(userId);
    const permissions = new Set<string>();

    const addRolePermissions = (roleName: string) => {
      const role = this.roles.get(roleName);
      if (!role) return;

      role.permissions.forEach((p) => permissions.add(p));

      // Process inherited roles
      if (role.inherits) {
        role.inherits.forEach((inheritedRole) => {
          addRolePermissions(inheritedRole);
        });
      }
    };

    userRoles.forEach((roleName) => addRolePermissions(roleName));

    return Array.from(permissions);
  }

  hasPermission(userId: string, permission: string): boolean {
    const permissions = this.getUserPermissions(userId);
    return permissions.includes(permission) || permissions.includes('admin');
  }

  hasRole(userId: string, roleName: string): boolean {
    const roles = this.getUserRoles(userId);
    return roles.includes(roleName);
  }

  // Account Lockout Methods
  recordFailedLogin(userId: string): boolean {
    const now = new Date();
    const failed = this.failedLogins.get(userId) || { count: 0, lastAttempt: now };

    failed.count++;
    failed.lastAttempt = now;
    this.failedLogins.set(userId, failed);

    if (failed.count >= this.defaultPolicy.maxLoginAttempts) {
      this.lockAccount(userId);
      return false;
    }

    return true;
  }

  resetFailedLogins(userId: string): void {
    this.failedLogins.delete(userId);
  }

  lockAccount(userId: string): void {
    const unlockTime = new Date(Date.now() + this.defaultPolicy.lockoutDuration);
    this.lockedAccounts.set(userId, unlockTime);
    this.logger.warn(`Account locked for user: ${userId} until ${unlockTime}`);
  }

  isAccountLocked(userId: string): boolean {
    const unlockTime = this.lockedAccounts.get(userId);
    if (!unlockTime) return false;

    if (new Date() >= unlockTime) {
      this.lockedAccounts.delete(userId);
      this.failedLogins.delete(userId);
      return false;
    }

    return true;
  }

  getLockoutTime(userId: string): Date | undefined {
    return this.lockedAccounts.get(userId);
  }

  // Password Validation
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.defaultPolicy.passwordMinLength) {
      errors.push(`Password must be at least ${this.defaultPolicy.passwordMinLength} characters`);
    }

    if (this.defaultPolicy.passwordComplexity === 'medium') {
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
      }
    }

    if (this.defaultPolicy.passwordComplexity === 'high') {
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Security Headers
  getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'",
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };
  }

  // Security Audit
  auditAccess(
    userId: string,
    resource: string,
    action: string,
    allowed: boolean,
    context?: Record<string, any>,
  ): void {
    this.logger.log(
      `Access audit: user=${userId}, resource=${resource}, action=${action}, allowed=${allowed}`,
    );
    // In production, this would write to an audit log
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }
}
