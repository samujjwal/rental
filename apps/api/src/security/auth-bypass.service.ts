import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthBypassService {
  private bypassTokens: Set<string> = new Set();
  private tokenPayloads: Map<string, any> = new Map();
  private enabled = true;

  async enable(): Promise<void> {
    this.enabled = true;
  }

  async disable(): Promise<void> {
    this.enabled = false;
  }

  async isEnabled(): Promise<boolean> {
    return this.enabled;
  }

  async generateBypassToken(): Promise<string> {
    const token = `bypass_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.bypassTokens.add(token);
    return token;
  }

  async validateBypassToken(token: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }
    return this.bypassTokens.has(token);
  }

  async revokeBypassToken(token: string): Promise<void> {
    this.bypassTokens.delete(token);
  }

  async clearAllBypassTokens(): Promise<void> {
    this.bypassTokens.clear();
  }

  async generateTestToken(payload: any): Promise<string> {
    const role = payload?.role || 'user';
    const expiresIn = payload?.expiresIn !== undefined ? `exp${payload.expiresIn}` : '';
    const userId = payload?.userId || 'test-user';
    const token = `test_token_${role}_${expiresIn}_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.bypassTokens.add(token);
    this.tokenPayloads.set(token, payload || {});
    return token;
  }

  async validateTestToken(token: string): Promise<any> {
    if (!this.enabled) {
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
  }
}
