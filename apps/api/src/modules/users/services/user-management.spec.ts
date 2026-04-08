import { Test, TestingModule } from '@nestjs/testing';
import { UserManagementService } from './user-management.service';
import { UserRepository } from '../repositories/user.repository';
import { EmailService } from '../../notifications/services/email.service';
import { SMSService } from '../../notifications/services/sms.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * USER MANAGEMENT TESTS
 * 
 * These tests validate user management functionality:
 * - User creation and registration
 * - User profile management
 * - User authentication and authorization
 * - User role management
 * - User account settings
 * - User data privacy and GDPR
 * - User activity tracking
 * - User account lifecycle
 * 
 * Business Truth Validated:
 * - Users are created with proper validation
 * - User profiles are managed securely
 * - Authentication flows work correctly
 * - Role-based access control is enforced
 * - User privacy is protected
 * - Account lifecycle is managed properly
 */

describe('UserManagementService', () => {
  let userManagementService: UserManagementService;
  let userRepository: UserRepository;
  let emailService: EmailService;
  let smsService: SMSService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserManagementService,
        {
          provide: UserRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findActiveUsers: jest.fn(),
            findUsersByRole: jest.fn(),
            updateUserLastLogin: jest.fn(),
            updateUserPassword: jest.fn(),
            createPasswordResetToken: jest.fn(),
            findByPasswordResetToken: jest.fn(),
            invalidateAllSessions: jest.fn(),
            getUserActivityLog: jest.fn(),
            logUserActivity: jest.fn(),
            softDelete: jest.fn(),
            restoreUser: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendWelcomeEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
            sendVerificationEmail: jest.fn(),
            sendAccountDeletionEmail: jest.fn(),
            sendRoleChangeNotification: jest.fn(),
          },
        },
        {
          provide: SMSService,
          useValue: {
            sendVerificationSMS: jest.fn(),
            sendPasswordResetSMS: jest.fn(),
            sendAccountAlertSMS: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    userManagementService = module.get<UserManagementService>(UserManagementService);
    userRepository = module.get<UserRepository>(UserRepository);
    emailService = module.get<EmailService>(EmailService);
    smsService = module.get<SMSService>(SMSService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('User Creation and Registration', () => {
    it('should create a new user with valid data', async () => {
      // Arrange
      const userData = {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'SecurePassword123!',
        phone: '+9771234567890',
        role: 'renter',
      };

      const hashedPassword = 'hashedPassword123';
      const createdUser = {
        id: 'user-123',
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        role: userData.role,
        password: hashedPassword,
        isActive: true,
        isEmailVerified: false,
        isPhoneVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(createdUser);
      emailService.sendWelcomeEmail.mockResolvedValue({ messageId: 'email-123' });

      // Act
      const result = await userManagementService.createUser(userData);

      // Assert
      expect(result.id).toBe('user-123');
      expect(result.email).toBe(userData.email);
      expect(result.role).toBe(userData.role);
      expect(result.isActive).toBe(true);
      expect(result.isEmailVerified).toBe(false);
      expect(userRepository.create).toHaveBeenCalledWith({
        ...userData,
        password: expect.any(String), // Hashed password
        isActive: true,
        isEmailVerified: false,
        isPhoneVerified: false,
      });
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(userData.email, userData.firstName);
    });

    it('should reject user creation with duplicate email', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'SecurePassword123!',
        role: 'renter',
      };

      const existingUser = {
        id: 'existing-user',
        email: userData.email,
        isActive: true,
      };

      userRepository.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(userManagementService.createUser(userData)).rejects.toThrow('Email already exists');
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it('should validate user data during creation', async () => {
      // Arrange
      const invalidUserData = {
        email: 'invalid-email', // Invalid email format
        firstName: '', // Empty first name
        lastName: 'Doe',
        password: '123', // Weak password
        role: 'invalid-role', // Invalid role
      };

      userRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(userManagementService.createUser(invalidUserData)).rejects.toThrow('Invalid user data');
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('should handle user registration with email verification', async () => {
      // Arrange
      const registrationData = {
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        password: 'SecurePassword123!',
        phone: '+9779876543210',
        acceptTerms: true,
        acceptPrivacy: true,
      };

      const verificationToken = 'verification-token-123';
      const createdUser = {
        id: 'user-456',
        email: registrationData.email,
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        isActive: false, // Inactive until email verification
        isEmailVerified: false,
        emailVerificationToken: verificationToken,
      };

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(createdUser);
      emailService.sendVerificationEmail.mockResolvedValue({ messageId: 'verify-123' });

      // Act
      const result = await userManagementService.registerUser(registrationData);

      // Assert
      expect(result.isActive).toBe(false);
      expect(result.isEmailVerified).toBe(false);
      expect(result.emailVerificationToken).toBe(verificationToken);
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        registrationData.email,
        verificationToken,
        registrationData.firstName
      );
    });

    it('should verify user email', async () => {
      // Arrange
      const verificationToken = 'verify-token-123';
      const userWithToken = {
        id: 'user-789',
        email: 'user@example.com',
        isActive: false,
        isEmailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      };

      const verifiedUser = {
        ...userWithToken,
        isActive: true,
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      };

      userRepository.findByEmailVerificationToken.mockResolvedValue(userWithToken);
      userRepository.update.mockResolvedValue(verifiedUser);

      // Act
      const result = await userManagementService.verifyEmail(verificationToken);

      // Assert
      expect(result.isActive).toBe(true);
      expect(result.isEmailVerified).toBe(true);
      expect(result.emailVerificationToken).toBeNull();
      expect(userRepository.update).toHaveBeenCalledWith('user-789', {
        isActive: true,
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });
    });

    it('should reject expired email verification tokens', async () => {
      // Arrange
      const expiredToken = 'expired-token-123';
      const userWithExpiredToken = {
        id: 'user-expired',
        email: 'expired@example.com',
        isActive: false,
        isEmailVerified: false,
        emailVerificationToken: expiredToken,
        emailVerificationExpires: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired 24 hours ago
      };

      userRepository.findByEmailVerificationToken.mockResolvedValue(userWithExpiredToken);

      // Act & Assert
      await expect(userManagementService.verifyEmail(expiredToken)).rejects.toThrow('Verification token expired');
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('User Profile Management', () => {
    it('should update user profile information', async () => {
      // Arrange
      const userId = 'user-123';
      const profileUpdate = {
        firstName: 'Updated',
        lastName: 'Name',
        phone: '+9771234567890',
        bio: 'Updated bio information',
        location: 'Kathmandu, Nepal',
        preferences: {
          language: 'en',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
        },
      };

      const existingUser = {
        id: userId,
        email: 'user@example.com',
        firstName: 'Original',
        lastName: 'Name',
        phone: '+9779876543210',
      };

      const updatedUser = {
        ...existingUser,
        ...profileUpdate,
        updatedAt: new Date(),
      };

      userRepository.findById.mockResolvedValue(existingUser);
      userRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userManagementService.updateProfile(userId, profileUpdate);

      // Assert
      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
      expect(result.phone).toBe('+9771234567890');
      expect(result.bio).toBe('Updated bio information');
      expect(result.location).toBe('Kathmandu, Nepal');
      expect(result.preferences).toEqual(profileUpdate.preferences);
      expect(userRepository.update).toHaveBeenCalledWith(userId, profileUpdate);
    });

    it('should validate profile update data', async () => {
      // Arrange
      const userId = 'user-123';
      const invalidUpdate = {
        firstName: '', // Empty first name
        phone: 'invalid-phone', // Invalid phone format
        preferences: {
          language: 'invalid-lang', // Invalid language code
        },
      };

      userRepository.findById.mockResolvedValue({ id: userId });

      // Act & Assert
      await expect(userManagementService.updateProfile(userId, invalidUpdate)).rejects.toThrow('Invalid profile data');
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('should upload and update user profile picture', async () => {
      // Arrange
      const userId = 'user-123';
      const profilePicture = {
        filename: 'profile.jpg',
        mimeType: 'image/jpeg',
        size: 1024000, // 1MB
        url: 'https://cdn.example.com/profiles/user-123.jpg',
      };

      const existingUser = {
        id: userId,
        email: 'user@example.com',
        profilePicture: null,
      };

      const updatedUser = {
        ...existingUser,
        profilePicture,
      };

      userRepository.findById.mockResolvedValue(existingUser);
      userRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userManagementService.updateProfilePicture(userId, profilePicture);

      // Assert
      expect(result.profilePicture).toEqual(profilePicture);
      expect(userRepository.update).toHaveBeenCalledWith(userId, { profilePicture });
    });

    it('should validate profile picture upload', async () => {
      // Arrange
      const userId = 'user-123';
      const invalidPicture = {
        filename: 'profile.exe', // Invalid file type
        mimeType: 'application/octet-stream',
        size: 52428800, // 50MB - too large
        url: 'https://cdn.example.com/profiles/user-123.exe',
      };

      userRepository.findById.mockResolvedValue({ id: userId });

      // Act & Assert
      await expect(userManagementService.updateProfilePicture(userId, invalidPicture)).rejects.toThrow('Invalid profile picture');
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('User Authentication and Authorization', () => {
    it('should authenticate user with valid credentials', async () => {
      // Arrange
      const loginData = {
        email: 'user@example.com',
        password: 'CorrectPassword123!',
      };

      const user = {
        id: 'user-123',
        email: loginData.email,
        password: 'hashedCorrectPassword123',
        isActive: true,
        isEmailVerified: true,
        failedLoginAttempts: 0,
        lastLoginAt: null,
      };

      userRepository.findByEmail.mockResolvedValue(user);
      userRepository.updateUserLastLogin.mockResolvedValue({ ...user, lastLoginAt: new Date() });

      // Mock password verification
      jest.spyOn(userManagementService as any, 'verifyPassword').mockResolvedValue(true);

      // Act
      const result = await userManagementService.authenticateUser(loginData.email, loginData.password);

      // Assert
      expect(result.id).toBe('user-123');
      expect(result.email).toBe(loginData.email);
      expect(result.isActive).toBe(true);
      expect(userRepository.updateUserLastLogin).toHaveBeenCalledWith('user-123');
      expect(userRepository.logUserActivity).toHaveBeenCalledWith('user-123', 'login_success');
    });

    it('should reject authentication with invalid credentials', async () => {
      // Arrange
      const loginData = {
        email: 'user@example.com',
        password: 'WrongPassword123!',
      };

      const user = {
        id: 'user-123',
        email: loginData.email,
        password: 'hashedCorrectPassword123',
        isActive: true,
        failedLoginAttempts: 0,
      };

      userRepository.findByEmail.mockResolvedValue(user);
      jest.spyOn(userManagementService as any, 'verifyPassword').mockResolvedValue(false);

      // Act & Assert
      await expect(userManagementService.authenticateUser(loginData.email, loginData.password)).rejects.toThrow('Invalid credentials');
      expect(userRepository.update).toHaveBeenCalledWith('user-123', {
        failedLoginAttempts: 1,
        lastFailedLoginAt: expect.any(Date),
      });
      expect(userRepository.logUserActivity).toHaveBeenCalledWith('user-123', 'login_failed');
    });

    it('should handle account lockout after multiple failed attempts', async () => {
      // Arrange
      const loginData = {
        email: 'user@example.com',
        password: 'WrongPassword123!',
      };

      const lockedUser = {
        id: 'user-123',
        email: loginData.email,
        password: 'hashedCorrectPassword123',
        isActive: true,
        failedLoginAttempts: 5, // Already at limit
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // Locked for 15 minutes
      };

      userRepository.findByEmail.mockResolvedValue(lockedUser);

      // Act & Assert
      await expect(userManagementService.authenticateUser(loginData.email, loginData.password)).rejects.toThrow('Account locked');
      expect(userRepository.logUserActivity).toHaveBeenCalledWith('user-123', 'login_blocked');
    });

    it('should check user permissions for resources', async () => {
      // Arrange
      const userId = 'user-123';
      const resource = 'booking';
      const action = 'read';
      const resourceId = 'booking-456';

      const user = {
        id: userId,
        role: 'renter',
        permissions: ['booking:read:own', 'booking:create'],
      };

      userRepository.findById.mockResolvedValue(user);

      // Act
      const result = await userManagementService.checkPermission(userId, resource, action, resourceId);

      // Assert
      expect(result).toBe(true); // User can read their own bookings
    });

    it('should deny unauthorized access', async () => {
      // Arrange
      const userId = 'user-123';
      const resource = 'admin';
      const action = 'delete';
      const resourceId = 'user-456';

      const user = {
        id: userId,
        role: 'renter',
        permissions: ['booking:read:own', 'booking:create'],
      };

      userRepository.findById.mockResolvedValue(user);

      // Act
      const result = await userManagementService.checkPermission(userId, resource, action, resourceId);

      // Assert
      expect(result).toBe(false); // Renter cannot delete users
    });
  });

  describe('User Role Management', () => {
    it('should assign role to user', async () => {
      // Arrange
      const userId = 'user-123';
      const newRole = 'owner';
      const assignedBy = 'admin-456';

      const user = {
        id: userId,
        email: 'user@example.com',
        role: 'renter',
      };

      const updatedUser = {
        ...user,
        role: newRole,
        roleAssignedAt: new Date(),
        roleAssignedBy: assignedBy,
      };

      userRepository.findById.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(updatedUser);
      emailService.sendRoleChangeNotification.mockResolvedValue({ messageId: 'role-123' });

      // Act
      const result = await userManagementService.assignRole(userId, newRole, assignedBy);

      // Assert
      expect(result.role).toBe(newRole);
      expect(result.roleAssignedBy).toBe(assignedBy);
      expect(result.roleAssignedAt).toBeInstanceOf(Date);
      expect(emailService.sendRoleChangeNotification).toHaveBeenCalledWith(
        user.email,
        'renter',
        'owner'
      );
      expect(userRepository.logUserActivity).toHaveBeenCalledWith(userId, 'role_changed', {
        oldRole: 'renter',
        newRole: 'owner',
        assignedBy,
      });
    });

    it('should validate role assignment', async () => {
      // Arrange
      const userId = 'user-123';
      const invalidRole = 'super-admin';
      const assignedBy = 'admin-456';

      const user = {
        id: userId,
        role: 'renter',
      };

      userRepository.findById.mockResolvedValue(user);

      // Act & Assert
      await expect(userManagementService.assignRole(userId, invalidRole, assignedBy)).rejects.toThrow('Invalid role');
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('should get users by role', async () => {
      // Arrange
      const role = 'owner';
      const usersByRole = [
        {
          id: 'owner-1',
          email: 'owner1@example.com',
          role: 'owner',
          isActive: true,
        },
        {
          id: 'owner-2',
          email: 'owner2@example.com',
          role: 'owner',
          isActive: true,
        },
      ];

      userRepository.findUsersByRole.mockResolvedValue(usersByRole);

      // Act
      const result = await userManagementService.getUsersByRole(role);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('owner');
      expect(result[1].role).toBe('owner');
      expect(userRepository.findUsersByRole).toHaveBeenCalledWith(role);
    });
  });

  describe('User Account Settings', () => {
    it('should update user password', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'CurrentPassword123!';
      const newPassword = 'NewPassword456!';

      const user = {
        id: userId,
        email: 'user@example.com',
        password: 'hashedCurrentPassword123',
      };

      userRepository.findById.mockResolvedValue(user);
      jest.spyOn(userManagementService as any, 'verifyPassword').mockResolvedValue(true);
      userRepository.updateUserPassword.mockResolvedValue({ ...user, password: 'hashedNewPassword456' });

      // Act
      const result = await userManagementService.updatePassword(userId, currentPassword, newPassword);

      // Assert
      expect(result).toBe(true);
      expect(userRepository.updateUserPassword).toHaveBeenCalledWith(userId, expect.any(String));
      expect(userRepository.logUserActivity).toHaveBeenCalledWith(userId, 'password_changed');
    });

    it('should reject password update with wrong current password', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'WrongPassword123!';
      const newPassword = 'NewPassword456!';

      const user = {
        id: userId,
        password: 'hashedCurrentPassword123',
      };

      userRepository.findById.mockResolvedValue(user);
      jest.spyOn(userManagementService as any, 'verifyPassword').mockResolvedValue(false);

      // Act & Assert
      await expect(userManagementService.updatePassword(userId, currentPassword, newPassword)).rejects.toThrow('Current password is incorrect');
      expect(userRepository.updateUserPassword).not.toHaveBeenCalled();
    });

    it('should enable two-factor authentication', async () => {
      // Arrange
      const userId = 'user-123';
      const secret = '2FA-secret-123';
      const backupCodes = ['code1', 'code2', 'code3'];

      const user = {
        id: userId,
        email: 'user@example.com',
        twoFactorEnabled: false,
      };

      const updatedUser = {
        ...user,
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorBackupCodes: backupCodes,
      };

      userRepository.findById.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(updatedUser);
      smsService.sendVerificationSMS.mockResolvedValue({ messageId: 'sms-123' });

      // Act
      const result = await userManagementService.enableTwoFactor(userId, secret, backupCodes);

      // Assert
      expect(result.twoFactorEnabled).toBe(true);
      expect(result.twoFactorSecret).toBe(secret);
      expect(result.twoFactorBackupCodes).toBe(backupCodes);
      expect(userRepository.logUserActivity).toHaveBeenCalledWith(userId, '2fa_enabled');
    });

    it('should disable two-factor authentication', async () => {
      // Arrange
      const userId = 'user-123';
      const password = 'CurrentPassword123!';

      const user = {
        id: userId,
        email: 'user@example.com',
        password: 'hashedCurrentPassword123',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret-123',
      };

      const updatedUser = {
        ...user,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      };

      userRepository.findById.mockResolvedValue(user);
      jest.spyOn(userManagementService as any, 'verifyPassword').mockResolvedValue(true);
      userRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userManagementService.disableTwoFactor(userId, password);

      // Assert
      expect(result.twoFactorEnabled).toBe(false);
      expect(result.twoFactorSecret).toBeNull();
      expect(result.twoFactorBackupCodes).toBeNull();
      expect(userRepository.logUserActivity).toHaveBeenCalledWith(userId, '2fa_disabled');
    });

    it('should update notification preferences', async () => {
      // Arrange
      const userId = 'user-123';
      const preferences = {
        email: {
          bookingConfirmations: true,
          paymentReminders: true,
          marketingEmails: false,
          securityAlerts: true,
        },
        sms: {
          bookingConfirmations: false,
          paymentReminders: true,
          securityAlerts: true,
        },
        push: {
          bookingUpdates: true,
          messages: true,
          promotions: false,
        },
      };

      const user = {
        id: userId,
        email: 'user@example.com',
        notificationPreferences: {},
      };

      const updatedUser = {
        ...user,
        notificationPreferences: preferences,
      };

      userRepository.findById.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userManagementService.updateNotificationPreferences(userId, preferences);

      // Assert
      expect(result.notificationPreferences).toEqual(preferences);
      expect(userRepository.update).toHaveBeenCalledWith(userId, { notificationPreferences: preferences });
    });
  });

  describe('User Data Privacy and GDPR', () => {
    it('should export user data (GDPR right to data portability)', async () => {
      // Arrange
      const userId = 'user-123';
      const userData = {
        id: userId,
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+9771234567890',
        createdAt: new Date('2023-01-01'),
        bookings: [
          { id: 'booking-1', status: 'completed', createdAt: new Date('2023-02-01') },
          { id: 'booking-2', status: 'active', createdAt: new Date('2023-03-01') },
        ],
        payments: [
          { id: 'payment-1', amount: 10000, status: 'completed' },
        ],
        reviews: [
          { id: 'review-1', rating: 5, comment: 'Great experience!' },
        ],
      };

      userRepository.findById.mockResolvedValue(userData);

      // Act
      const result = await userManagementService.exportUserData(userId);

      // Assert
      expect(result.user.id).toBe(userId);
      expect(result.user.email).toBe('user@example.com');
      expect(result.bookings).toHaveLength(2);
      expect(result.payments).toHaveLength(1);
      expect(result.reviews).toHaveLength(1);
      expect(result.exportedAt).toBeInstanceOf(Date);
      expect(userRepository.logUserActivity).toHaveBeenCalledWith(userId, 'data_exported');
    });

    it('should handle user account deletion request (GDPR right to erasure)', async () => {
      // Arrange
      const userId = 'user-123';
      const deletionReason = 'User requested account deletion';
      const requestedBy = 'user-123'; // User themselves

      const user = {
        id: userId,
        email: 'user@example.com',
        isActive: true,
        deletionRequested: false,
      };

      const updatedUser = {
        ...user,
        deletionRequested: true,
        deletionRequestedAt: new Date(),
        deletionReason,
        deletionRequestedBy: requestedBy,
        scheduledForDeletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      };

      userRepository.findById.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(updatedUser);
      emailService.sendAccountDeletionEmail.mockResolvedValue({ messageId: 'delete-123' });

      // Act
      const result = await userManagementService.requestAccountDeletion(userId, deletionReason, requestedBy);

      // Assert
      expect(result.deletionRequested).toBe(true);
      expect(result.deletionReason).toBe(deletionReason);
      expect(result.deletionRequestedBy).toBe(requestedBy);
      expect(result.scheduledForDeletion).toBeInstanceOf(Date);
      expect(emailService.sendAccountDeletionEmail).toHaveBeenCalledWith(user.email);
      expect(userRepository.logUserActivity).toHaveBeenCalledWith(userId, 'deletion_requested', {
        reason: deletionReason,
        requestedBy,
      });
    });

    it('should permanently delete user account', async () => {
      // Arrange
      const userId = 'user-123';
      const deletedBy = 'admin-456';

      const user = {
        id: userId,
        email: 'user@example.com',
        deletionRequested: true,
        scheduledForDeletion: new Date(Date.now() - 24 * 60 * 60 * 1000), // Scheduled for yesterday
      };

      userRepository.findById.mockResolvedValue(user);
      userRepository.softDelete.mockResolvedValue(true);
      userRepository.invalidateAllSessions.mockResolvedValue(true);

      // Act
      const result = await userManagementService.permanentlyDeleteUser(userId, deletedBy);

      // Assert
      expect(result).toBe(true);
      expect(userRepository.softDelete).toHaveBeenCalledWith(userId);
      expect(userRepository.invalidateAllSessions).toHaveBeenCalledWith(userId);
      expect(userRepository.logUserActivity).toHaveBeenCalledWith(userId, 'account_deleted', {
        deletedBy,
      });
    });

    it('should anonymize user data instead of deletion', async () => {
      // Arrange
      const userId = 'user-123';
      const deletedBy = 'admin-456';

      const user = {
        id: userId,
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+9771234567890',
      };

      const anonymizedUser = {
        ...user,
        email: `deleted-user-${userId}@deleted.local`,
        firstName: 'Deleted',
        lastName: 'User',
        phone: '+0000000000000',
        isActive: false,
        deletedAt: new Date(),
        deletedBy,
      };

      userRepository.findById.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(anonymizedUser);
      userRepository.invalidateAllSessions.mockResolvedValue(true);

      // Act
      const result = await userManagementService.anonymizeUser(userId, deletedBy);

      // Assert
      expect(result.email).toMatch(/deleted-user-/);
      expect(result.firstName).toBe('Deleted');
      expect(result.lastName).toBe('User');
      expect(result.isActive).toBe(false);
      expect(userRepository.logUserActivity).toHaveBeenCalledWith(userId, 'data_anonymized', {
        deletedBy,
      });
    });
  });

  describe('User Activity Tracking', () => {
    it('should log user activities', async () => {
      // Arrange
      const userId = 'user-123';
      const activity = 'login_success';
      const metadata = {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        location: 'Kathmandu, Nepal',
      };

      userRepository.logUserActivity.mockResolvedValue({
        id: 'activity-123',
        userId,
        activity,
        metadata,
        timestamp: new Date(),
      });

      // Act
      const result = await userManagementService.logActivity(userId, activity, metadata);

      // Assert
      expect(result.userId).toBe(userId);
      expect(result.activity).toBe(activity);
      expect(result.metadata).toEqual(metadata);
      expect(userRepository.logUserActivity).toHaveBeenCalledWith(userId, activity, metadata);
    });

    it('should get user activity log', async () => {
      // Arrange
      const userId = 'user-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const activityLog = [
        {
          id: 'activity-1',
          userId,
          activity: 'login_success',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          metadata: { ip: '192.168.1.1' },
        },
        {
          id: 'activity-2',
          userId,
          activity: 'profile_updated',
          timestamp: new Date('2024-01-15T10:30:00Z'),
          metadata: { fields: ['firstName', 'lastName'] },
        },
      ];

      userRepository.getUserActivityLog.mockResolvedValue(activityLog);

      // Act
      const result = await userManagementService.getUserActivityLog(userId, startDate, endDate);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].activity).toBe('login_success');
      expect(result[1].activity).toBe('profile_updated');
      expect(userRepository.getUserActivityLog).toHaveBeenCalledWith(userId, startDate, endDate);
    });

    it('should detect suspicious activity patterns', async () => {
      // Arrange
      const userId = 'user-123';
      const suspiciousActivities = [
        {
          activity: 'login_failed',
          timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          metadata: { ip: '192.168.1.100' },
        },
        {
          activity: 'login_failed',
          timestamp: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
          metadata: { ip: '192.168.1.100' },
        },
        {
          activity: 'login_failed',
          timestamp: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
          metadata: { ip: '192.168.1.100' },
        },
      ];

      userRepository.getUserActivityLog.mockResolvedValue(suspiciousActivities);

      // Act
      const result = await userManagementService.detectSuspiciousActivity(userId);

      // Assert
      expect(result.isSuspicious).toBe(true);
      expect(result.reason).toContain('multiple failed login attempts');
      expect(result.recommendation).toContain('lock account or require additional verification');
    });
  });

  describe('User Account Lifecycle', () => {
    it('should reactivate inactive user account', async () => {
      // Arrange
      const userId = 'user-123';
      const reactivatedBy = 'admin-456';

      const inactiveUser = {
        id: userId,
        email: 'user@example.com',
        isActive: false,
        deactivatedAt: new Date('2024-01-01'),
        deactivatedReason: 'User request',
      };

      const reactivatedUser = {
        ...inactiveUser,
        isActive: true,
        deactivatedAt: null,
        deactivatedReason: null,
        reactivatedAt: new Date(),
        reactivatedBy,
      };

      userRepository.findById.mockResolvedValue(inactiveUser);
      userRepository.update.mockResolvedValue(reactivatedUser);
      emailService.sendWelcomeEmail.mockResolvedValue({ messageId: 'welcome-123' });

      // Act
      const result = await userManagementService.reactivateUser(userId, reactivatedBy);

      // Assert
      expect(result.isActive).toBe(true);
      expect(result.reactivatedAt).toBeInstanceOf(Date);
      expect(result.reactivatedBy).toBe(reactivatedBy);
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(inactiveUser.email, inactiveUser.firstName);
      expect(userRepository.logUserActivity).toHaveBeenCalledWith(userId, 'account_reactivated', {
        reactivatedBy,
      });
    });

    it('should deactivate user account', async () => {
      // Arrange
      const userId = 'user-123';
      const deactivationReason = 'Policy violation';
      const deactivatedBy = 'admin-456';

      const activeUser = {
        id: userId,
        email: 'user@example.com',
        isActive: true,
      };

      const deactivatedUser = {
        ...activeUser,
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedReason,
        deactivatedBy,
      };

      userRepository.findById.mockResolvedValue(activeUser);
      userRepository.update.mockResolvedValue(deactivatedUser);
      userRepository.invalidateAllSessions.mockResolvedValue(true);

      // Act
      const result = await userManagementService.deactivateUser(userId, deactivationReason, deactivatedBy);

      // Assert
      expect(result.isActive).toBe(false);
      expect(result.deactivatedReason).toBe(deactivationReason);
      expect(result.deactivatedBy).toBe(deactivatedBy);
      expect(userRepository.invalidateAllSessions).toHaveBeenCalledWith(userId);
      expect(userRepository.logUserActivity).toHaveBeenCalledWith(userId, 'account_deactivated', {
        reason: deactivationReason,
        deactivatedBy,
      });
    });

    it('should handle user account expiration', async () => {
      // Arrange
      const expiredUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Expired 2 days ago
        },
      ];

      userRepository.findExpiredUsers.mockResolvedValue(expiredUsers);
      userRepository.update.mockResolvedValue({});

      // Act
      const result = await userManagementService.processExpiredAccounts();

      // Assert
      expect(result.processed).toBe(2);
      expect(result.expiredUsers).toEqual(expiredUsers);
      expect(userRepository.update).toHaveBeenCalledTimes(2);
    });
  });
});
