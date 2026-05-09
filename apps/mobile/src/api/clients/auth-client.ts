/**
 * Auth Client
 * 
 * Handles all authentication-related API endpoints:
 * - Login, register, logout
 * - Password reset
 * - OAuth (Google, Apple)
 * - OTP verification
 * - Email/phone verification
 * - KYC/identity verification
 */

import type { AuthResponse, LoginPayload, RegisterPayload } from '~/types';
import { BaseClient } from './base-client';

export class AuthClient extends BaseClient {
  /**
   * Login with email and password
   */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Register a new user
   */
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Request password reset email
   */
  async requestPasswordReset(email: string): Promise<void> {
    return this.request<void>('/auth/password/reset-request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    return this.request<void>('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  /**
   * Logout with refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    return this.request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  /**
   * Login with Google OAuth
   */
  async googleLogin(idToken: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  }

  /**
   * Login with Apple OAuth
   */
  async appleLogin(
    identityToken: string,
    authorizationCode: string,
    firstName?: string,
    lastName?: string,
  ): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identityToken, authorizationCode, firstName, lastName }),
    });
  }

  /**
   * Request OTP for email-based login
   */
  async requestOtp(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * Verify OTP and authenticate
   */
  async verifyOtp(email: string, code: string, mfaCode?: string): Promise<AuthResponse> {
    const payload: any = { email, code };
    if (mfaCode) {
      payload.mfaCode = mfaCode;
    }
    return this.request<AuthResponse>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(): Promise<void> {
    return this.request<void>('/auth/verify-email/send', {
      method: 'POST',
    });
  }

  /**
   * Send phone verification code
   */
  async sendPhoneVerification(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/verify-phone/send', {
      method: 'POST',
    });
  }

  /**
   * Verify phone number with code
   */
  async verifyPhone(code: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/verify-phone/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  /**
   * Upload identity document for KYC
   */
  async uploadIdentityDocument(data: {
    documentType: string;
    documentUrl: string;
    expiresAt?: string;
  }): Promise<any> {
    return this.request<any>('/kyc/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get user's identity documents
   */
  async getIdentityDocuments(): Promise<any[]> {
    return this.request<any[]>('/kyc/documents');
  }
}
