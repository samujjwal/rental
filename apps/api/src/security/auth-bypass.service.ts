import { Injectable, Logger } from '@nestjs/common';

/**
 * Auth Bypass Service
 * 
 * This service provides test-only authentication bypass functionality.
 * It is STRICTLY FOR DEVELOPMENT AND TESTING ONLY and must never be enabled in production.
 * 
 * Security Hardening:
 * - Bypass is disabled by default in production
 * - Environment guards prevent enabling in production
 * - All operations log security events
 * - Token generation is rate-limited in concept (tokens expire)
 * 
 * CRITICAL: This service must never be enabled in production environments.
 * Any attempt to enable bypass in production will throw an error and log a security event.
 */
@Injectable()
export class AuthBypassService {
  private readonly logger = new Logger(AuthBypassService.name);
  private bypassTokens: Set<string> = new Set();
  private tokenPayloads: Map<string, any> = new Map();
  private enabled = false; // Disabled by default for security

  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly isTestEnv = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e';

  async enable(): Promise<void> {
    if (this.isProduction) {
      this.logger.error('SECURITY VIOLATION: Attempt to enable auth bypass in production');
      throw new Error('Auth bypass cannot be enabled in production environment');
    }

    this.enabled = true;
    this.logger.warn('Auth bypass enabled - DEVELOPMENT/TEST MODE ONLY');
  }

  async disable(): Promise<void> {
    this.enabled = false;
    this.logger.log('Auth bypass disabled');
  }

  async isEnabled(): Promise<boolean> {
    // In production, always return false regardless of internal state
    if (this.isProduction) {
      return false;
    }
    return this.enabled;
  }

  async generateBypassToken(): Promise<string> {
    if (this.isProduction) {
      this.logger.error('SECURITY VIOLATION: Attempt to generate bypass token in production');
      throw new Error('Bypass tokens cannot be generated in production environment');
    }

    if (!this.enabled) {
      throw new Error('Auth bypass is not enabled');
    }

    const token = `bypass_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.bypassTokens.add(token);
    this.logger.log(`Bypass token generated: ${token.substring(0, 20)}...`);
    return token;
  }

  async validateBypassToken(token: string): Promise<boolean> {
    // In production, always reject bypass tokens
    if (this.isProduction) {
      this.logger.error(`SECURITY VIOLATION: Bypass token validation attempted in production: ${token.substring(0, 20)}...`);
      return false;
    }

    if (!this.enabled) {
      return false;
    }
    return this.bypassTokens.has(token);
  }

  async revokeBypassToken(token: string): Promise<void> {
    this.bypassTokens.delete(token);
    this.logger.log(`Bypass token revoked: ${token.substring(0, 20)}...`);
  }

  async clearAllBypassTokens(): Promise<void> {
    const count = this.bypassTokens.size;
    this.bypassTokens.clear();
    this.tokenPayloads.clear();
    this.logger.log(`Cleared ${count} bypass tokens`);
  }

  async generateTestToken(payload: any): Promise<string> {
    if (this.isProduction) {
      this.logger.error('SECURITY VIOLATION: Attempt to generate test token in production');
      throw new Error('Test tokens cannot be generated in production environment');
    }

    if (!this.enabled && !this.isTestEnv) {
      throw new Error('Auth bypass is not enabled');
    }

    const role = payload?.role || 'user';
    const expiresIn = payload?.expiresIn !== undefined ? `exp${payload.expiresIn}` : '';
    const userId = payload?.userId || 'test-user';
    const token = `test_token_${role}_${expiresIn}_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.bypassTokens.add(token);
    this.tokenPayloads.set(token, payload || {});
    this.logger.log(`Test token generated for user ${userId}, role ${role}`);
    return token;
  }

  async validateTestToken(token: string): Promise<any> {
    // In production, always reject test tokens
    if (this.isProduction) {
      this.logger.error(`SECURITY VIOLATION: Test token validation attempted in production: ${token.substring(0, 20)}...`);
      return { isValid: false, error: 'Test tokens not allowed in production' };
    }

    if (!this.enabled && !this.isTestEnv) {
      return { isValid: false, error: 'Auth bypass not enabled' };
    }

    if (!this.bypassTokens.has(token)) {
      return { isValid: false, error: 'Token revoked' };
    }

    // Check for expired tokens (tokens with negative expiresIn)
    const expMatch = token.match(/exp(-?\d+)/);
    if (expMatch) {
      const expiresIn = parseInt(expMatch[1], 10);
      if (expiresIn < 0) {
        return { isValid: false, error: 'Token expired' };
      }
    }

    // Extract userId from token
    const userIdMatch = token.match(/test_token_\w+_exp?\w*_([^_]+)_/);
    const userId = userIdMatch ? userIdMatch[1] : 'test-user';

    // Extract role from token
    const role = token.includes('admin') ? 'admin' : token.includes('owner') ? 'owner' : 'user';

    // Get permissions from stored payload
    const payload = this.tokenPayloads.get(token) || {};
    const permissions = payload.permissions || [];

    return {
      userId: payload.userId || userId,
      role,
      permissions,
      isValid: true
    };
  }

  async revokeTestToken(token: string): Promise<void> {
    this.bypassTokens.delete(token);
    this.tokenPayloads.delete(token);
    this.logger.log(`Test token revoked: ${token.substring(0, 20)}...`);
  }

  /**
   * Get security status for monitoring
   * Returns information about whether bypass is enabled and environment
   */
  async getSecurityStatus(): Promise<{ enabled: boolean; environment: string; productionSafe: boolean }> {
    return {
      enabled: this.enabled,
      environment: process.env.NODE_ENV || 'unknown',
      productionSafe: !this.isProduction,
    };
  }
}
