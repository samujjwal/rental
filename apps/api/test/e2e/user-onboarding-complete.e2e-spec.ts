import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * COMPLETE USER ONBOARDING E2E TESTS
 * 
 * These tests validate the end-to-end user onboarding workflow:
 * 1. Registration → Email Verification → Profile Completion
 * 2. Phone Verification → KYC Submission → KYC Approval
 * 3. Preferences Setup → Notification Configuration
 * 4. Organization Creation/Joining
 * 5. Payment Method Setup → Payout Configuration
 * 6. Security Settings → MFA Setup → Session Management
 * 
 * These tests use real API endpoints and validate the complete user journey from signup to fully onboarded user.
 */
describe('User Onboarding - Complete E2E Tests', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let organizationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Registration Flow', () => {
    it('should register new user with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'newuser-onboard@example.com',
          username: 'newuser-onboard',
          password: 'SecurePassword123!',
          firstName: 'Alex',
          lastName: 'Johnson',
        })
        .expect(201);

      const { user, token } = response.body;
      userId = user.id;
      accessToken = token;

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('newuser-onboard@example.com');
      expect(user.username).toBe('newuser-onboard@example.com');
      expect(user.firstName).toBe('Alex');
      expect(user.lastName).toBe('Johnson');
      expect(user.role).toBe('CUSTOMER');
      expect(user.status).toBe('ACTIVE');
      expect(user.emailVerified).toBe(false);
      expect(user.phoneVerified).toBe(false);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should reject registration with duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'newuser-onboard@example.com',
          username: 'different-user',
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(409); // Conflict
    });

    it('should reject registration with weak password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'weakpass@example.com',
          username: 'weakpass',
          password: '123', // Weak password
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);
    });

    it('should reject registration with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          username: 'invalid',
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);
    });
  });

  describe('Email Verification Flow', () => {
    it('should send email verification', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/send-verification-email')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should verify email with valid token', async () => {
      // In real scenario, this token would come from email
      const verificationToken = 'valid-verification-token';
      
      const response = await request(app.getHttpServer())
        .post('/api/auth/verify-email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          token: verificationToken,
        })
        .expect(200);

      expect(response.body.emailVerified).toBe(true);
    });

    it('should reject email verification with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/verify-email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          token: 'invalid-token',
        })
        .expect(400);
    });

    it('should verify email status after verification', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.emailVerified).toBe(true);
    });
  });

  describe('Profile Completion Flow', () => {
    it('should update basic profile information', async () => {
      await request(app.getHttpServer())
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Alexander',
          lastName: 'Johnson',
          phone: '+9779800000002',
          bio: 'Frequent traveler exploring Nepal and beyond',
          dateOfBirth: '1990-05-15',
          gender: 'MALE',
        })
        .expect(200);
    });

    it('should update address information', async () => {
      await request(app.getHttpServer())
        .put('/api/users/address')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          addressLine1: '123 Lazimpat',
          addressLine2: 'Apartment 4B',
          city: 'Kathmandu',
          state: 'Bagmati',
          postalCode: '44600',
          country: 'Nepal',
        })
        .expect(200);
    });

    it('should upload profile photo', async () => {
      await request(app.getHttpServer())
        .post('/api/users/profile-photo')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('photo', Buffer.from('profile-photo-data'), 'profile.jpg')
        .expect(200);
    });

    it('should verify profile photo was uploaded', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.profilePhotoUrl).toBeDefined();
      expect(response.body.profilePhotoUrl).toContain('http');
    });
  });

  describe('Phone Verification Flow', () => {
    it('should send phone verification code', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/send-phone-verification')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phone: '+9779800000002',
        })
        .expect(200);
    });

    it('should verify phone with valid code', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/verify-phone')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phone: '+9779800000002',
          code: '123456', // In real scenario, this would come from SMS
        })
        .expect(200);

      expect(response.body.phoneVerified).toBe(true);
    });

    it('should reject phone verification with invalid code', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/verify-phone')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phone: '+9779800000002',
          code: '000000',
        })
        .expect(400);
    });

    it('should verify phone status after verification', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.phoneVerified).toBe(true);
    });
  });

  describe('Preferences Setup Flow', () => {
    it('should update language and currency preferences', async () => {
      await request(app.getHttpServer())
        .put('/api/users/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          preferredLanguage: 'en',
          preferredCurrency: 'USD',
          timezone: 'Asia/Kathmandu',
        })
        .expect(200);
    });

    it('should configure notification preferences', async () => {
      await request(app.getHttpServer())
        .put('/api/users/notification-preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          emailNotifications: {
            bookingUpdates: true,
            promotional: false,
            securityAlerts: true,
          },
          pushNotifications: {
            bookingUpdates: true,
            messages: true,
            promotional: false,
          },
          smsNotifications: {
            bookingUpdates: false,
            securityAlerts: true,
          },
        })
        .expect(200);
    });

    it('should verify preferences were saved', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.preferredLanguage).toBe('en');
      expect(response.body.preferredCurrency).toBe('USD');
      expect(response.body.timezone).toBe('Asia/Kathmandu');
    });
  });

  describe('KYC Submission Flow', () => {
    let kycSubmissionId: string;

    it('should initiate KYC verification', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/kyc/submit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          documentType: 'PASSPORT',
          documentNumber: 'AB1234567',
          documentCountry: 'US',
          documentExpiryDate: '2030-12-31',
        })
        .expect(201);

      kycSubmissionId = response.body.id;
      expect(kycSubmissionId).toBeDefined();
    });

    it('should upload document images', async () => {
      await request(app.getHttpServer())
        .post(`/api/kyc/${kycSubmissionId}/documents`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('front', Buffer.from('passport-front'), 'passport-front.jpg')
        .attach('back', Buffer.from('passport-back'), 'passport-back.jpg')
        .attach('selfie', Buffer.from('selfie-photo'), 'selfie.jpg')
        .expect(200);
    });

    it('should submit additional KYC information', async () => {
      await request(app.getHttpServer())
        .patch(`/api/kyc/${kycSubmissionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Alexander',
          lastName: 'Johnson',
          dateOfBirth: '1990-05-15',
          address: {
            street: '123 Lazimpat',
            city: 'Kathmandu',
            state: 'Bagmati',
            postalCode: '44600',
            country: 'Nepal',
          },
        })
        .expect(200);
    });

    it('should verify KYC submission status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/kyc/${kycSubmissionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('PENDING_REVIEW');
    });

    it('should approve KYC (admin action)', async () => {
      // Login as admin
      const adminResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        })
        .expect(200);

      const adminToken = adminResponse.body.token;

      await request(app.getHttpServer())
        .post(`/api/admin/kyc/${kycSubmissionId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Documents verified successfully',
        })
        .expect(200);
    });

    it('should verify KYC approved status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/kyc/${kycSubmissionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('APPROVED');
    });

    it('should verify user KYC status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.kycVerified).toBe(true);
    });
  });

  describe('Organization Management Flow', () => {
    it('should create new organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Nepal Adventure Tours',
          description: 'Premium tour operator specializing in adventure travel',
          type: 'TOUR_OPERATOR',
          businessLicense: 'BL-2024-12345',
          taxId: 'TAX-2024-67890',
          address: {
            addressLine1: '456 Thamel',
            city: 'Kathmandu',
            state: 'Bagmati',
            postalCode: '44600',
            country: 'Nepal',
          },
        })
        .expect(201);

      organizationId = response.body.id;
      expect(organizationId).toBeDefined();
      expect(response.body.name).toBe('Nepal Adventure Tours');
    });

    it('should upload organization logo', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/logo`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('logo', Buffer.from('org-logo-data'), 'logo.png')
        .expect(200);
    });

    it('should add organization members', async () => {
      // First register another user
      const memberResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'org-member@example.com',
          username: 'org-member',
          password: 'SecurePassword123!',
          firstName: 'Team',
          lastName: 'Member',
        })
        .expect(201);

      const memberUserId = memberResponse.body.user.id;

      // Add to organization
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          userId: memberUserId,
          role: 'MEMBER',
        })
        .expect(201);
    });

    it('should verify organization membership', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThanOrEqual(2); // Owner + member
    });

    it('should set organization policies', async () => {
      await request(app.getHttpServer())
        .put(`/api/organizations/${organizationId}/policies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bookingApprovalRequired: true,
          minimumRatingRequired: 4,
          cancellationPolicy: 'STRICT',
          paymentTerms: 'NET_30',
        })
        .expect(200);
    });
  });

  describe('Payment Setup Flow', () => {
    it('should setup Stripe Connect account', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments/connect-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: 'newuser-onboard@example.com',
          country: 'NP',
          businessType: 'INDIVIDUAL',
        })
        .expect(201);

      expect(response.body.accountId).toBeDefined();
      expect(response.body.accountId).toMatch(/^acct_/);
    });

    it('should add payment method', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/payment-methods')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentMethodId: 'pm_card_visa',
          isDefault: true,
        })
        .expect(201);
    });

    it('should retrieve payment methods', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payments/payment-methods')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should configure payout settings', async () => {
      await request(app.getHttpServer())
        .put('/api/payments/payout-settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          payoutSchedule: 'WEEKLY',
          payoutDay: 'FRIDAY',
          minimumPayoutAmount: 10000,
          currency: 'USD',
        })
        .expect(200);
    });
  });

  describe('Security Settings Flow', () => {
    it('should enable MFA', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.secret).toBeDefined();
      expect(response.body.qrCode).toBeDefined();
    });

    it('should verify and confirm MFA', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          code: '123456', // In real scenario, this would be from authenticator app
        })
        .expect(200);

      expect(response.body.mfaEnabled).toBe(true);
    });

    it('should verify MFA is enabled', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.mfaEnabled).toBe(true);
    });

    it('should change password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'SecurePassword123!',
          newPassword: 'EvenMoreSecure456!',
        })
        .expect(200);
    });

    it('should login with new password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'newuser-onboard@example.com',
          password: 'EvenMoreSecure456!',
        })
        .expect(200);

      expect(response.body.token).toBeDefined();
      accessToken = response.body.token; // Update token
    });

    it('should generate backup codes', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/mfa/backup-codes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.backupCodes).toBeDefined();
      expect(response.body.backupCodes.length).toBe(10);
    });

    it('should setup trusted devices', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/trusted-device')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          deviceName: 'MacBook Pro',
          deviceFingerprint: 'test-fingerprint',
        })
        .expect(200);
    });
  });

  describe('Session Management Flow', () => {
    it('should refresh access token', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'newuser-onboard@example.com',
          password: 'EvenMoreSecure456!',
        })
        .expect(200);

      refreshToken = loginResponse.body.refreshToken;
      accessToken = loginResponse.body.token;

      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200);

      expect(response.body.token).toBeDefined();
      accessToken = response.body.token;
    });

    it('should logout from current session', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should verify token is invalid after logout', async () => {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });

    it('should login again after logout', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'newuser-onboard@example.com',
          password: 'EvenMoreSecure456!',
        })
        .expect(200);

      accessToken = response.body.token;
      refreshToken = response.body.refreshToken;
    });

    it('should logout from all sessions', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('OAuth Integration Flow', () => {
    it('should link Google account', async () => {
      // Re-login first
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'newuser-onboard@example.com',
          password: 'EvenMoreSecure456!',
        })
        .expect(200);

      accessToken = loginResponse.body.token;

      await request(app.getHttpServer())
        .post('/api/auth/oauth/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          provider: 'google',
          providerId: 'google_user_id_123',
          email: 'newuser-onboard@gmail.com',
        })
        .expect(200);
    });

    it('should link Apple account', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/oauth/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          provider: 'apple',
          providerId: 'apple_user_id_123',
          email: 'newuser-onboard@icloud.com',
        })
        .expect(200);
    });

    it('should retrieve linked OAuth accounts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/oauth/linked')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Data Export Flow', () => {
    it('should request data export', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/data-export')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          format: 'JSON',
          include: ['profile', 'bookings', 'payments', 'reviews'],
        })
        .expect(202); // Accepted

      expect(response.body.exportId).toBeDefined();
    });

    it('should retrieve export status', async () => {
      const exportResponse = await request(app.getHttpServer())
        .post('/api/users/data-export')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          format: 'JSON',
          include: ['profile', 'bookings', 'payments', 'reviews'],
        })
        .expect(202);

      const exportId = exportResponse.body.exportId;

      const response = await request(app.getHttpServer())
        .get(`/api/users/data-export/${exportId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBeDefined();
    });
  });

  describe('Account Deletion Flow', () => {
    let deletionToken: string;

    it('should request account deletion', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/request-deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          reason: 'No longer using the service',
        })
        .expect(200);

      deletionToken = response.body.deletionToken;
      expect(deletionToken).toBeDefined();
    });

    it('should confirm account deletion with token', async () => {
      await request(app.getHttpServer())
        .post('/api/users/confirm-deletion')
        .send({
          deletionToken,
        })
        .expect(200);
    });

    it('should verify account is deleted', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'newuser-onboard@example.com',
          password: 'EvenMoreSecure456!',
        })
        .expect(401); // Unauthorized - account deleted
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should reject profile update with invalid phone format', async () => {
      // Create a new user for this test
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'edgecase-user@example.com',
          username: 'edgecase-user',
          password: 'SecurePassword123!',
          firstName: 'Edge',
          lastName: 'Case',
        })
        .expect(201);

      const edgeToken = registerResponse.body.token;

      await request(app.getHttpServer())
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${edgeToken}`)
        .send({
          phone: 'invalid-phone-format',
        })
        .expect(400);
    });

    it('should reject KYC submission with expired document', async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'kyc-edgecase@example.com',
          username: 'kyc-edgecase',
          password: 'SecurePassword123!',
          firstName: 'KYC',
          lastName: 'Edge',
        })
        .expect(201);

      const kycToken = registerResponse.body.token;

      await request(app.getHttpServer())
        .post('/api/kyc/submit')
        .set('Authorization', `Bearer ${kycToken}`)
        .send({
          documentType: 'PASSPORT',
          documentNumber: 'EXPIRED123',
          documentCountry: 'US',
          documentExpiryDate: '2020-01-01', // Expired date
        })
        .expect(400);
    });

    it('should prevent MFA bypass attempts', async () => {
      // Create user with MFA enabled
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'mfa-user@example.com',
          username: 'mfa-user',
          password: 'SecurePassword123!',
          firstName: 'MFA',
          lastName: 'User',
        })
        .expect(201);

      const mfaToken = registerResponse.body.token;

      // Enable MFA
      await request(app.getHttpServer())
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${mfaToken}`)
        .expect(200);

      // Verify MFA
      await request(app.getHttpServer())
        .post('/api/auth/mfa/verify')
        .set('Authorization', `Bearer ${mfaToken}`)
        .send({
          code: '123456',
        })
        .expect(200);

      // Try to login without MFA code
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'mfa-user@example.com',
          password: 'SecurePassword123!',
        })
        .expect(401); // Should require MFA
    });

    it('should rate limit password reset attempts', async () => {
      // Create user
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'ratelimit@example.com',
          username: 'ratelimit',
          password: 'SecurePassword123!',
          firstName: 'Rate',
          lastName: 'Limit',
        })
        .expect(201);

      // Attempt multiple password reset requests
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/request-password-reset')
          .send({
            email: 'ratelimit@example.com',
          });
      }

      // Should be rate limited
      await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({
          email: 'ratelimit@example.com',
        })
        .expect(429); // Too Many Requests
    });
  });
});
