import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@/modules/users/services/users.service';
import { AuditService } from '@/common/audit/audit.service';
import { FieldEncryptionService } from '@/common/encryption/field-encryption.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { UserStatus, UserRole, VerificationStatus } from '@rental-portal/database';

/**
 * Compliance Testing
 * 
 * These tests validate compliance requirements including GDPR, financial regulations,
 * data protection, and audit trail requirements.
 */
describe('Compliance Testing', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usersService: UsersService;
  let auditService: AuditService;
  let encryptionService: FieldEncryptionService;
  let notificationsService: NotificationsService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: new Date('1990-01-01'),
    phone: '+1234567890',
    bio: 'Test user bio',
    profilePhotoUrl: 'https://example.com/photo.jpg',
    addressLine1: '123 Main St',
    addressLine2: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'USA',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isActive: true,
    averageRating: 4.5,
    totalReviews: 10,
    responseRate: 95,
    responseTime: '1 hour',
    stripeCustomerId: 'cus_test',
    stripeConnectId: 'acct_test',
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    verificationStatus: VerificationStatus.VERIFIED,
    verificationDocuments: [],
    loginAttempts: 0,
    lockedUntil: null,
    googleId: null,
    appleId: null,
    subscriptionStatus: null,
    subscriptionId: null,
    subscriptionPlan: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue(mockUser),
        findMany: jest.fn().mockResolvedValue([mockUser]),
        delete: jest.fn().mockResolvedValue(mockUser),
      },
      userDataExport: {
        create: jest.fn().mockResolvedValue({ id: 'export-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
      },
      dataDeletionRequest: {
        create: jest.fn().mockResolvedValue({ id: 'deletion-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
      },
      consentRecord: {
        create: jest.fn().mockResolvedValue({ id: 'consent-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      financialAudit: {
        create: jest.fn().mockResolvedValue({ id: 'financial-audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      complianceReport: {
        create: jest.fn().mockResolvedValue({ id: 'compliance-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback()),
    } as any;

    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(null),
    };

    const mockEncryption = {
      encrypt: jest.fn().mockResolvedValue('encrypted_data'),
      decrypt: jest.fn().mockResolvedValue('decrypted_data'),
      hash: jest.fn().mockResolvedValue('hashed_data'),
    };

    const mockNotifications = {
      sendEmail: jest.fn().mockResolvedValue(true),
      sendSMS: jest.fn().mockResolvedValue(true),
      createNotification: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: AuditService, useValue: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) } },
        { provide: FieldEncryptionService, useValue: mockEncryption },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);
    encryptionService = module.get<FieldEncryptionService>(FieldEncryptionService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  describe('GDPR Compliance', () => {
    it('should handle data deletion requests', async () => {
      const deletionRequest = {
        userId: 'user-1',
        reason: 'right_to_be_forgotten',
        verificationMethod: 'email',
        verifiedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        bookings: [{ id: 'booking-1', status: 'COMPLETED' }],
        payments: [{ id: 'payment-1', status: 'COMPLETED' }],
        reviews: [{ id: 'review-1', rating: 5 }],
      });

      const deletionResult = await usersService.processDataDeletionRequest(deletionRequest);

      expect(deletionResult.status).toBe('processed');
      expect(deletionResult.deletedDataTypes).toContain('user_profile');
      expect(deletionResult.deletedDataTypes).toContain('user_preferences');
      expect(deletionResult.deletedDataTypes).toContain('audit_logs');

      // Verify audit logging
      expect(auditService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'data_deletion_processed',
          userId: 'user-1',
          metadata: expect.objectContaining({
            reason: 'right_to_be_forgotten',
            deletedDataTypes: expect.any(Array),
          }),
        }),
      });

      // Verify user data is anonymized
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          email: expect.stringMatching(/deleted/),
          firstName: 'Deleted',
          lastName: 'User',
          phone: null,
          addressLine1: null,
          addressLine2: null,
        }),
      });
    });

    it('should provide data export functionality', async () => {
      const exportRequest = {
        userId: 'user-1',
        format: 'json',
        includeSensitiveData: false,
      };

      const userData = {
        profile: mockUser,
        bookings: [
          { id: 'booking-1', totalAmount: 1000, status: 'COMPLETED' },
          { id: 'booking-2', totalAmount: 750, status: 'CANCELLED' },
        ],
        payments: [
          { id: 'payment-1', amount: 1000, status: 'COMPLETED' },
          { id: 'payment-2', amount: 250, status: 'REFUNDED' },
        ],
        reviews: [
          { id: 'review-1', rating: 5, comment: 'Great stay!' },
        ],
        preferences: {
          notifications: true,
          marketing: false,
          language: 'en',
        },
      };

      (prisma.userDataExport.create as jest.Mock).mockResolvedValue({
        id: 'export-1',
        userId: 'user-1',
        status: 'completed',
        format: 'json',
        downloadUrl: 'https://example.com/export-1.json',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      const exportResult = await usersService.generateDataExport(exportRequest);

      expect(exportResult.status).toBe('completed');
      expect(exportResult.format).toBe('json');
      expect(exportResult.downloadUrl).toBeDefined();
      expect(exportResult.expiresAt).toBeDefined();

      // Verify export contains all required data categories
      expect(exportResult.data).toHaveProperty('profile');
      expect(exportResult.data).toHaveProperty('bookings');
      expect(exportResult.data).toHaveProperty('payments');
      expect(exportResult.data).toHaveProperty('reviews');
      expect(exportResult.data).toHaveProperty('preferences');

      // Verify sensitive data is excluded
      expect(exportResult.data.profile).not.toHaveProperty('passwordHash');
      expect(exportResult.data.profile).not.toHaveProperty('stripeCustomerId');

      // Verify audit logging
      expect(auditService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'data_export_generated',
          userId: 'user-1',
          metadata: expect.objectContaining({
            format: 'json',
            includeSensitiveData: false,
          }),
        }),
      });
    });

    it('should manage consent records properly', async () => {
      const consentScenarios = [
        {
          type: 'marketing_emails',
          granted: true,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          timestamp: new Date('2026-01-01'),
        },
        {
          type: 'data_processing',
          granted: true,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          timestamp: new Date('2026-01-01'),
        },
        {
          type: 'cookies',
          granted: false,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          timestamp: new Date('2026-01-02'),
        },
      ];

      for (const consent of consentScenarios) {
        const consentResult = await usersService.recordConsent(
          'user-1',
          consent.type,
          consent.granted,
          {
            ipAddress: consent.ipAddress,
            userAgent: consent.userAgent,
          }
        );

        expect(consentResult.userId).toBe('user-1');
        expect(consentResult.type).toBe(consent.type);
        expect(consentResult.granted).toBe(consent.granted);
        expect(consentResult.ipAddress).toBe(consent.ipAddress);

        // Verify audit logging
        expect(auditService.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'consent_recorded',
            userId: 'user-1',
            metadata: expect.objectContaining({
              consentType: consent.type,
              granted: consent.granted,
            }),
          }),
        });
      }

      // Test consent retrieval
      (prisma.consentRecord.findMany as jest.Mock).mockResolvedValue(
        consentScenarios.map(c => ({
          ...c,
          userId: 'user-1',
          id: `consent-${c.type}`,
        }))
      );

      const consentHistory = await usersService.getConsentHistory('user-1');

      expect(consentHistory).toHaveLength(3);
      expect(consentHistory[0].type).toBe('marketing_emails');
      expect(consentHistory[0].granted).toBe(true);
      expect(consentHistory[2].type).toBe('cookies');
      expect(consentHistory[2].granted).toBe(false);
    });

    it('should handle data retention policies', async () => {
      const retentionPolicies = [
        { dataType: 'user_activity_logs', retentionDays: 365 },
        { dataType: 'payment_records', retentionDays: 2555 }, // 7 years
        { dataType: 'audit_logs', retentionDays: 2555 }, // 7 years
        { dataType: 'user_sessions', retentionDays: 30 },
        { dataType: 'temporary_data', retentionDays: 7 },
      ];

      const expiredData = [
        { type: 'user_activity_logs', records: 150, age: 400 },
        { type: 'user_sessions', records: 50, age: 45 },
        { type: 'temporary_data', records: 25, age: 10 },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(
        expiredData.map(d => ({
          id: `log-${d.type}`,
          type: d.type,
          createdAt: new Date(Date.now() - d.age * 24 * 60 * 60 * 1000),
        }))
      );

      const cleanupResult = await usersService.enforceDataRetention(retentionPolicies);

      expect(cleanupResult.processedTypes).toHaveLength(3);
      expect(cleanupResult.totalRecordsDeleted).toBe(225); // 150 + 50 + 25
      expect(cleanupResult.deletedByType['user_activity_logs']).toBe(150);
      expect(cleanupResult.deletedByType['user_sessions']).toBe(50);
      expect(cleanupResult.deletedByType['temporary_data']).toBe(25);

      // Verify audit logging
      expect(auditService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'data_retention_enforced',
          metadata: expect.objectContaining({
            totalRecordsDeleted: 225,
            processedTypes: 3,
          }),
        }),
      });
    });
  });

  describe('Financial Compliance', () => {
    it('should maintain financial audit trail', async () => {
      const financialTransactions = [
        {
          id: 'tx-1',
          type: 'PAYMENT',
          amount: 100000,
          currency: 'USD',
          userId: 'user-1',
          bookingId: 'booking-1',
          timestamp: new Date('2026-01-01'),
          paymentMethod: 'card',
          stripeId: 'pi_123',
        },
        {
          id: 'tx-2',
          type: 'REFUND',
          amount: -25000,
          currency: 'USD',
          userId: 'user-1',
          bookingId: 'booking-1',
          timestamp: new Date('2026-01-02'),
          paymentMethod: 'card',
          stripeId: 're_123',
        },
        {
          id: 'tx-3',
          type: 'PAYOUT',
          amount: 85000,
          currency: 'USD',
          hostId: 'host-1',
          timestamp: new Date('2026-01-03'),
          paymentMethod: 'bank_transfer',
          stripeId: 'po_123',
        },
      ];

      for (const transaction of financialTransactions) {
        const auditRecord = await auditService.logFinancialTransaction(transaction);

        expect(auditRecord.action).toBe('financial_transaction');
        expect(auditRecord.metadata).toEqual({
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          paymentMethod: transaction.paymentMethod,
          stripeId: transaction.stripeId,
          bookingId: transaction.bookingId,
        });

        expect(prisma.financialAudit.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            transactionId: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            userId: transaction.userId,
            hostId: transaction.hostId,
            bookingId: transaction.bookingId,
            paymentMethod: transaction.paymentMethod,
            stripeId: transaction.stripeId,
            timestamp: transaction.timestamp,
          }),
        });
      }

      // Test audit trail retrieval
      (prisma.financialAudit.findMany as jest.Mock).mockResolvedValue(
        financialTransactions.map(tx => ({
          ...tx,
          id: `audit-${tx.id}`,
        }))
      );

      const auditTrail = await auditService.getFinancialAuditTrail('user-1');

      expect(auditTrail).toHaveLength(2); // tx-1 and tx-2 for user-1
      expect(auditTrail[0].type).toBe('PAYMENT');
      expect(auditTrail[1].type).toBe('REFUND');
    });

    it('should enforce AML/KYC requirements', async () => {
      const amlChecks = [
        {
          userId: 'user-1',
          checkType: 'identity_verification',
          status: 'PASSED',
          timestamp: new Date('2026-01-01'),
          details: { documentType: 'passport', verified: true },
        },
        {
          userId: 'user-1',
          checkType: 'sanctions_screening',
          status: 'PASSED',
          timestamp: new Date('2026-01-01'),
          details: { watchlistMatch: false, pepMatch: false },
        },
        {
          userId: 'user-1',
          checkType: 'address_verification',
          status: 'PASSED',
          timestamp: new Date('2026-01-02'),
          details: { addressMatch: true, utilityBill: true },
        },
      ];

      for (const check of amlChecks) {
        const amlResult = await usersService.performAMLCheck(
          check.userId,
          check.checkType,
          check.details
        );

        expect(amlResult.status).toBe(check.status);
        expect(amlResult.checkType).toBe(check.checkType);
        expect(amlResult.timestamp).toBeDefined();

        // Verify audit logging
        expect(auditService.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'aml_check_performed',
            userId: check.userId,
            metadata: expect.objectContaining({
              checkType: check.checkType,
              status: check.status,
            }),
          }),
        });
      }

      // Test AML compliance status
      const complianceStatus = await usersService.getAMLComplianceStatus('user-1');

      expect(complianceStatus.isCompliant).toBe(true);
      expect(complianceStatus.completedChecks).toHaveLength(3);
      expect(complianceStatus.requiredChecks).toHaveLength(3);
      expect(complianceStatus.lastUpdated).toBeDefined();
    });

    it('should handle suspicious activity reporting', async () => {
      const suspiciousActivities = [
        {
          userId: 'user-1',
          activityType: 'rapid_multiple_bookings',
          details: {
            bookingCount: 5,
            timeWindow: '1 hour',
            totalAmount: 5000,
          },
          riskScore: 0.8,
        },
        {
          userId: 'user-2',
          activityType: 'unusual_payment_pattern',
          details: {
            paymentMethod: 'multiple_cards',
            amount: 10000,
            frequency: 'high',
          },
          riskScore: 0.9,
        },
        {
          userId: 'user-3',
          activityType: 'account_takeover_attempt',
          details: {
            failedLogins: 10,
            ipAddresses: ['192.168.1.1', '10.0.0.1'],
            locations: ['US', 'CN'],
          },
          riskScore: 0.95,
        },
      ];

      for (const activity of suspiciousActivities) {
        const reportResult = await usersService.reportSuspiciousActivity(activity);

        expect(reportResult.reportId).toBeDefined();
        expect(reportResult.riskScore).toBe(activity.riskScore);
        expect(reportResult.status).toBe('reported');

        // Verify audit logging
        expect(auditService.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'suspicious_activity_reported',
            userId: activity.userId,
            metadata: expect.objectContaining({
              activityType: activity.activityType,
              riskScore: activity.riskScore,
            }),
            severity: activity.riskScore > 0.8 ? 'HIGH' : 'MEDIUM',
          }),
        });

        // Verify notification to compliance team
        expect(notificationsService.sendEmail).toHaveBeenCalledWith(
          expect.stringContaining('compliance'),
          'suspicious_activity_alert',
          expect.objectContaining({
            activityType: activity.activityType,
            riskScore: activity.riskScore,
          })
        );
      }
    });

    it('should generate compliance reports', async () => {
      const reportPeriod = {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        reportType: 'monthly_compliance',
      };

      const reportData = {
        period: reportPeriod,
        totalTransactions: 1500,
        totalVolume: 150000, // $1,500,000
        suspiciousReports: 5,
        amlChecks: 300,
        dataDeletionRequests: 2,
        dataExports: 10,
        consentRecords: 150,
        complianceScore: 0.95,
      };

      (prisma.complianceReport.create as jest.Mock).mockResolvedValue({
        id: 'compliance-1',
        ...reportData,
        generatedAt: new Date(),
      });

      const complianceReport = await usersService.generateComplianceReport(reportPeriod);

      expect(complianceReport.id).toBeDefined();
      expect(complianceReport.totalTransactions).toBe(1500);
      expect(complianceReport.complianceScore).toBe(0.95);
      expect(complianceReport.generatedAt).toBeDefined();

      // Verify report contains all required sections
      expect(complianceReport).toHaveProperty('financialSummary');
      expect(complianceReport).toHaveProperty('amlCompliance');
      expect(complianceReport).toHaveProperty('dataProtection');
      expect(complianceReport).toHaveProperty('riskAssessment');

      // Verify audit logging
      expect(auditService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'compliance_report_generated',
          metadata: expect.objectContaining({
            reportType: 'monthly_compliance',
            period: reportPeriod,
            complianceScore: 0.95,
          }),
        }),
      });
    });
  });

  describe('Data Protection & Security', () => {
    it('should encrypt sensitive personal data', async () => {
      const sensitiveData = [
        {
          userId: 'user-1',
          dataType: 'phone_number',
          value: '+1234567890',
        },
        {
          userId: 'user-1',
          dataType: 'address',
          value: '123 Main St, New York, NY 10001',
        },
        {
          userId: 'user-1',
          dataType: 'payment_method',
          value: 'card_4242424242424242',
        },
      ];

      for (const data of sensitiveData) {
        (encryptionService.encrypt as jest.Mock).mockResolvedValue(`encrypted_${data.dataType}`);

        const encryptedResult = await usersService.encryptSensitiveData(
          data.userId,
          data.dataType,
          data.value
        );

        expect(encryptedResult.encrypted).toBe(`encrypted_${data.dataType}`);
        expect(encryptedResult.dataType).toBe(data.dataType);
        expect(encryptedResult.userId).toBe(data.userId);

        // Verify encryption service was called
        expect(encryptionService.encrypt).toHaveBeenCalledWith(data.value);
      }
    });

    it('should handle data breach notifications', async () => {
      const breachScenarios = [
        {
          type: 'unauthorized_access',
          severity: 'HIGH',
          affectedUsers: 100,
          dataTypes: ['email', 'phone', 'address'],
          discoveredAt: new Date('2026-01-01'),
        },
        {
          type: 'data_exfiltration',
          severity: 'CRITICAL',
          affectedUsers: 500,
          dataTypes: ['payment_method', 'ssn', 'bank_account'],
          discoveredAt: new Date('2026-01-02'),
        },
      ];

      for (const breach of breachScenarios) {
        const breachResponse = await usersService.handleDataBreach(breach);

        expect(breachResponse.breachId).toBeDefined();
        expect(breachResponse.status).toBe('mitigation_in_progress');
        expect(breachResponse.notificationSent).toBe(true);

        // Verify audit logging
        expect(auditService.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'data_breach_detected',
            metadata: expect.objectContaining({
              breachType: breach.type,
              severity: breach.severity,
              affectedUsers: breach.affectedUsers,
            }),
            severity: breach.severity,
          }),
        });

        // Verify user notifications
        expect(notificationsService.sendEmail).toHaveBeenCalledTimes(
          breach.affectedUsers
        );

        // Verify regulatory notifications (for high severity)
        if (breach.severity === 'CRITICAL') {
          expect(notificationsService.sendEmail).toHaveBeenCalledWith(
            expect.stringContaining('regulatory'),
            'data_breach_notification',
            expect.any(Object)
          );
        }
      }
    });

    it('should enforce access controls for sensitive data', async () => {
      const accessRequests = [
        {
          userId: 'admin-1',
          role: 'COMPLIANCE_OFFICER',
          requestedData: ['user_profile', 'financial_records'],
          justification: 'compliance_audit',
        },
        {
          userId: 'support-1',
          role: 'CUSTOMER_SUPPORT',
          requestedData: ['user_profile'],
          justification: 'customer_inquiry',
        },
        {
          userId: 'marketing-1',
          role: 'MARKETING_MANAGER',
          requestedData: ['user_profile', 'email_marketing'],
          justification: 'campaign_analysis',
        },
      ];

      const accessPolicies = {
        COMPLIANCE_OFFICER: ['user_profile', 'financial_records', 'audit_logs', 'aml_data'],
        CUSTOMER_SUPPORT: ['user_profile', 'booking_history'],
        MARKETING_MANAGER: ['user_profile', 'email_marketing', 'analytics'],
      };

      for (const request of accessRequests) {
        const accessResult = await usersService.validateDataAccess(
          request.userId,
          request.role,
          request.requestedData,
          request.justification
        );

        const allowedData = accessPolicies[request.role];
        const hasAccess = request.requestedData.every(data => 
          allowedData.includes(data)
        );

        expect(accessResult.granted).toBe(hasAccess);
        expect(accessResult.allowedData).toEqual(
          request.requestedData.filter(data => allowedData.includes(data))
        );
        expect(accessResult.deniedData).toEqual(
          request.requestedData.filter(data => !allowedData.includes(data))
        );

        // Verify audit logging
        expect(auditService.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'data_access_request',
            userId: request.userId,
            metadata: expect.objectContaining({
              role: request.role,
              requestedData: request.requestedData,
              granted: hasAccess,
            }),
          }),
        });
      }
    });

    it('should maintain data integrity checksums', async () => {
      const dataRecords = [
        {
          id: 'record-1',
          type: 'user_profile',
          data: { name: 'John Doe', email: 'john@example.com' },
        },
        {
          id: 'record-2',
          type: 'financial_record',
          data: { amount: 1000, currency: 'USD' },
        },
      ];

      for (const record of dataRecords) {
        (encryptionService.hash as jest.Mock).mockResolvedValue(`hash_${record.id}`);

        const integrityCheck = await usersService.verifyDataIntegrity(record);

        expect(integrityCheck.isValid).toBe(true);
        expect(integrityCheck.checksum).toBe(`hash_${record.id}`);
        expect(integrityCheck.timestamp).toBeDefined();

        // Verify hash calculation
        expect(encryptionService.hash).toHaveBeenCalledWith(
          JSON.stringify(record.data)
        );
      }

      // Test tampering detection
      const tamperedRecord = {
        ...dataRecords[0],
        data: { name: 'Jane Doe', email: 'jane@example.com' }, // Tampered data
      };

      (encryptionService.hash as jest.Mock).mockResolvedValue('different_hash');

      const tamperingCheck = await usersService.verifyDataIntegrity(tamperedRecord);

      expect(tamperingCheck.isValid).toBe(false);
      expect(tamperingCheck.expectedChecksum).toBe('hash_record-1');
      expect(tamperingCheck.actualChecksum).toBe('different_hash');

      // Verify security alert
      expect(auditService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'data_integrity_violation',
          metadata: expect.objectContaining({
            recordId: tamperedRecord.id,
            recordType: tamperedRecord.type,
          }),
          severity: 'HIGH',
        }),
      });
    });
  });

  describe('Regulatory Reporting', () => {
    it('should generate SAR (Suspicious Activity Reports)', async () => {
      const sarData = {
        reportId: 'SAR-2026-001',
        filingDate: new Date('2026-01-15'),
        suspiciousActivity: {
          userId: 'user-1',
          activityType: 'structuring',
          details: {
            multipleSmallTransactions: true,
            totalAmount: 10000,
            timePeriod: '24 hours',
          },
        },
        filingInstitution: 'GharBatai Rentals',
        regulator: 'FinCEN',
      };

      const sarReport = await usersService.generateSAR(sarData);

      expect(sarReport.reportId).toBe('SAR-2026-001');
      expect(sarReport.filingDate).toBeDefined();
      expect(sarReport.suspiciousActivity.userId).toBe('user-1');
      expect(sarReport.suspiciousActivity.activityType).toBe('structuring');

      // Verify SAR contains required fields
      expect(sarReport).toHaveProperty('suspiciousActivity');
      expect(sarReport).toHaveProperty('subjectInformation');
      expect(sarReport).toHaveProperty('transactionDetails');
      expect(sarReport).toHaveProperty('narrative');

      // Verify audit logging
      expect(auditService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'sar_generated',
          metadata: expect.objectContaining({
            reportId: 'SAR-2026-001',
            regulator: 'FinCEN',
          }),
          severity: 'HIGH',
        }),
      });
    });

    it('should handle CTR (Currency Transaction Reports)', async () => {
      const ctrScenarios = [
        {
          transactionId: 'tx-1',
          amount: 12000, // Above $10,000 threshold
          currency: 'USD',
          userId: 'user-1',
          transactionType: 'PAYMENT',
          date: new Date('2026-01-01'),
        },
        {
          transactionId: 'tx-2',
          amount: 15000, // Above $10,000 threshold
          currency: 'USD',
          userId: 'user-2',
          transactionType: 'PAYOUT',
          date: new Date('2026-01-02'),
        },
      ];

      for (const transaction of ctrScenarios) {
        const ctrReport = await usersService.generateCTR(transaction);

        expect(ctrReport.reportId).toBeDefined();
        expect(ctrReport.amount).toBe(transaction.amount);
        expect(ctrReport.currency).toBe(transaction.currency);
        expect(ctrReport.transactionType).toBe(transaction.transactionType);

        // Verify CTR contains required fields
        expect(ctrReport).toHaveProperty('subjectInformation');
        expect(ctrReport).toHaveProperty('transactionDetails');
        expect(ctrReport).toHaveProperty('financialInstitution');

        // Verify audit logging
        expect(auditService.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'ctr_generated',
            metadata: expect.objectContaining({
              transactionId: transaction.transactionId,
              amount: transaction.amount,
            }),
          }),
        });
      }
    });

    it('should maintain regulatory filing logs', async () => {
      const filingLogs = [
        {
          filingType: 'SAR',
          filingId: 'SAR-2026-001',
          regulator: 'FinCEN',
          filingDate: new Date('2026-01-15'),
          status: 'SUBMITTED',
        },
        {
          filingType: 'CTR',
          filingId: 'CTR-2026-001',
          regulator: 'IRS',
          filingDate: new Date('2026-01-16'),
          status: 'SUBMITTED',
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(
        filingLogs.map(log => ({
          id: `audit-${log.filingId}`,
          action: 'regulatory_filing',
          metadata: {
            filingType: log.filingType,
            filingId: log.filingId,
            regulator: log.regulator,
            status: log.status,
          },
          timestamp: log.filingDate,
        }))
      );

      const filingHistory = await usersService.getRegulatoryFilingHistory();

      expect(filingHistory).toHaveLength(2);
      expect(filingHistory[0].filingType).toBe('SAR');
      expect(filingHistory[0].regulator).toBe('FinCEN');
      expect(filingHistory[1].filingType).toBe('CTR');
      expect(filingHistory[1].regulator).toBe('IRS');
    });
  });
});
