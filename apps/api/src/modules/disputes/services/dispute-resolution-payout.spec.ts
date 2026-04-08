import { Test, TestingModule } from '@nestjs/testing';
import { DisputeResolutionService } from './dispute-resolution.service';
import { PayoutService } from './payout.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { PolicyEngineService } from '../policies/policy-engine.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * DISPUTE RESOLUTION AND PAYOUT TESTS
 * 
 * These tests validate dispute resolution and payout processes:
 * - Dispute creation and management
 * - Evidence collection and review
 * - Resolution workflows and decisions
 * - Payout calculations and processing
 * - Financial accuracy and audit trails
 * 
 * Business Truth Validated:
 * - Disputes are resolved fairly and consistently
 * - Evidence is properly collected and reviewed
 * - Payouts are calculated accurately
 * - Financial transactions are secure
 * - Audit trails are comprehensive
 */

describe('DisputeResolutionPayout', () => {
  let disputeService: DisputeResolutionService;
  let payoutService: PayoutService;
  let prismaService: PrismaService;
  let notificationService: NotificationService;
  let policyEngine: PolicyEngineService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeResolutionService,
        PayoutService,
        {
          provide: PrismaService,
          useValue: {
            dispute: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            disputeEvidence: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            disputeResolution: {
              create: jest.fn(),
              findUnique: jest.fn(),
            },
            payout: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            booking: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            transaction: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendEmail: jest.fn(),
            sendSMS: jest.fn(),
            sendPush: jest.fn(),
          },
        },
        {
          provide: PolicyEngineService,
          useValue: {
            evaluateDisputePolicy: jest.fn(),
            calculatePayoutAmount: jest.fn(),
            getResolutionGuidelines: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'dispute.resolution.maxDuration': 14, // days
                'dispute.resolution.autoResolve': true,
                'dispute.evidence.maxFileSize': 10, // MB
                'payout.processingFee': 0.02, // 2%
                'payout.minAmount': 100, // NPR 100
                'payout.maxAmount': 100000, // NPR 100,000
              };
              return config[key];
            }),
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

    disputeService = module.get<DisputeResolutionService>(DisputeResolutionService);
    payoutService = module.get<PayoutService>(PayoutService);
    prismaService = module.get<PrismaService>(PrismaService);
    notificationService = module.get<NotificationService>(NotificationService);
    policyEngine = module.get<PolicyEngineService>(PolicyEngineService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Dispute Creation and Management', () => {
    it('should create dispute with proper validation', async () => {
      const disputeData = {
        bookingId: 'booking-123',
        complainantId: 'user-123',
        respondentId: 'owner-456',
        type: 'property_damage',
        description: 'Window was broken during stay',
        category: 'damage',
        severity: 'medium',
        requestedAmount: 5000,
      };

      // Mock booking validation
      prismaService.booking.findUnique.mockResolvedValueOnce({
        id: 'booking-123',
        userId: 'user-123',
        ownerId: 'owner-456',
        status: 'completed',
        checkOut: new Date('2024-06-07'),
        depositAmount: 10000,
      });

      // Mock dispute creation
      prismaService.dispute.create.mockResolvedValueOnce({
        id: 'dispute-123',
        ...disputeData,
        status: 'open',
        createdAt: new Date(),
        referenceNumber: 'DSP-2024-001',
      });

      const result = await disputeService.createDispute(disputeData);

      expect(result.success).toBe(true);
      expect(result.disputeId).toBe('dispute-123');
      expect(result.referenceNumber).toBe('DSP-2024-001');
      expect(result.status).toBe('open');
      expect(prismaService.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...disputeData,
          status: 'open',
          referenceNumber: expect.stringMatching(/DSP-\d{4}-\d{3}/),
        })
      );
    });

    it('should validate dispute eligibility', async () => {
      const disputeData = {
        bookingId: 'booking-123',
        complainantId: 'user-123',
        respondentId: 'owner-456',
        type: 'property_damage',
        description: 'Test dispute',
        requestedAmount: 5000,
      };

      // Mock ineligible booking (too old)
      prismaService.booking.findUnique.mockResolvedValueOnce({
        id: 'booking-123',
        checkOut: new Date('2024-01-01'), // More than 14 days ago
        status: 'completed',
      });

      const result = await disputeService.createDispute(disputeData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dispute period expired');
      expect(result.error).toContain('14 days after checkout');
    });

    it('should prevent duplicate disputes', async () => {
      const disputeData = {
        bookingId: 'booking-123',
        complainantId: 'user-123',
        respondentId: 'owner-456',
        type: 'property_damage',
        description: 'Test dispute',
        requestedAmount: 5000,
      };

      // Mock existing dispute
      prismaService.dispute.findMany.mockResolvedValueOnce([
        {
          id: 'existing-dispute',
          bookingId: 'booking-123',
          status: 'open',
          type: 'property_damage',
        },
      ]);

      const result = await disputeService.createDispute(disputeData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Active dispute already exists');
      expect(result.existingDisputeId).toBe('existing-dispute');
    });

    it('should categorize disputes automatically', async () => {
      const disputeData = {
        bookingId: 'booking-123',
        complainantId: 'user-123',
        respondentId: 'owner-456',
        description: 'Guest broke TV remote and stained carpet',
        requestedAmount: 3000,
      };

      // Mock booking
      prismaService.booking.findUnique.mockResolvedValueOnce({
        id: 'booking-123',
        userId: 'user-123',
        ownerId: 'owner-456',
        status: 'completed',
      });

      // Mock dispute creation with auto-categorization
      prismaService.dispute.create.mockResolvedValueOnce({
        id: 'dispute-123',
        ...disputeData,
        type: 'property_damage',
        category: 'damage',
        severity: 'low',
        autoCategorized: true,
      });

      const result = await disputeService.createDispute(disputeData);

      expect(result.success).toBe(true);
      expect(result.type).toBe('property_damage');
      expect(result.category).toBe('damage');
      expect(result.severity).toBe('low');
      expect(result.autoCategorized).toBe(true);
    });
  });

  describe('Evidence Collection and Management', () => {
    it('should collect and validate evidence', async () => {
      const disputeId = 'dispute-123';
      const evidence = [
        {
          type: 'photo',
          description: 'Broken window photo',
          fileUrl: 'https://example.com/broken-window.jpg',
          uploadedBy: 'user-123',
          uploadedAt: new Date(),
        },
        {
          type: 'document',
          description: 'Repair quote',
          fileUrl: 'https://example.com/repair-quote.pdf',
          uploadedBy: 'owner-456',
          uploadedAt: new Date(),
        },
        {
          type: 'video',
          description: 'Damage video evidence',
          fileUrl: 'https://example.com/damage-video.mp4',
          uploadedBy: 'user-123',
          uploadedAt: new Date(),
        },
      ];

      // Mock evidence creation
      prismaService.disputeEvidence.create
        .mockResolvedValueOnce({ id: 'evidence-1', ...evidence[0] })
        .mockResolvedValueOnce({ id: 'evidence-2', ...evidence[1] })
        .mockResolvedValueOnce({ id: 'evidence-3', ...evidence[2] });

      const result = await disputeService.addEvidence(disputeId, evidence);

      expect(result.success).toBe(true);
      expect(result.evidenceCount).toBe(3);
      expect(result.evidenceTypes).toEqual(['photo', 'document', 'video']);
      expect(prismaService.disputeEvidence.create).toHaveBeenCalledTimes(3);
    });

    it('should validate evidence file types and sizes', async () => {
      const invalidEvidence = [
        {
          type: 'photo',
          description: 'Too large photo',
          fileUrl: 'https://example.com/large-photo.jpg',
          fileSize: 15 * 1024 * 1024, // 15MB (exceeds 10MB limit)
          uploadedBy: 'user-123',
        },
        {
          type: 'document',
          description: 'Invalid file type',
          fileUrl: 'https://example.com/file.exe',
          uploadedBy: 'user-123',
        },
      ];

      const result = await disputeService.validateEvidence(invalidEvidence);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('File size too large');
      expect(result.errors[1]).toContain('Invalid file type');
    });

    it('should organize evidence by relevance', async () => {
      const disputeId = 'dispute-123';
      const evidence = [
        {
          type: 'photo',
          description: 'Damage photo taken immediately',
          timestamp: new Date('2024-06-07T10:00:00Z'),
          relevance: 'high',
        },
        {
          type: 'document',
          description: 'General property condition',
          timestamp: new Date('2024-06-01T09:00:00Z'),
          relevance: 'low',
        },
        {
          type: 'video',
          description: 'Damage video evidence',
          timestamp: new Date('2024-06-07T10:30:00Z'),
          relevance: 'high',
        },
      ];

      prismaService.disputeEvidence.findMany.mockResolvedValueOnce(evidence);

      const organizedEvidence = await disputeService.organizeEvidence(disputeId);

      expect(organizedEvidence.highRelevance).toHaveLength(2);
      expect(organizedEvidence.lowRelevance).toHaveLength(1);
      expect(organizedEvidence.highRelevance[0].description).toBe('Damage photo taken immediately');
      expect(organizedEvidence.highRelevance[1].description).toBe('Damage video evidence');
    });

    it('should track evidence chain of custody', async () => {
      const evidenceId = 'evidence-123';
      const custodyChain = [
        {
          action: 'uploaded',
          userId: 'user-123',
          timestamp: new Date('2024-06-07T10:00:00Z'),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
        },
        {
          action: 'reviewed',
          userId: 'admin-456',
          timestamp: new Date('2024-06-07T14:00:00Z'),
          notes: 'Evidence verified and authenticated',
        },
      ];

      const chainOfCustody = await disputeService.getEvidenceCustodyChain(evidenceId);

      expect(chainOfCustody).toHaveLength(2);
      expect(chainOfCustody[0].action).toBe('uploaded');
      expect(chainOfCustody[0].userId).toBe('user-123');
      expect(chainOfCustody[1].action).toBe('reviewed');
      expect(chainOfCustody[1].userId).toBe('admin-456');
      expect(chainOfCustody[1].notes).toBe('Evidence verified and authenticated');
    });
  });

  describe('Dispute Resolution Workflows', () => {
    it('should evaluate dispute using policy engine', async () => {
      const disputeId = 'dispute-123';
      const disputeData = {
        id: disputeId,
        type: 'property_damage',
        category: 'damage',
        severity: 'medium',
        requestedAmount: 5000,
        evidence: [
          { type: 'photo', relevance: 'high' },
          { type: 'document', relevance: 'medium' },
        ],
      };

      const policyEvaluation = {
        applicableRules: ['damage_policy_v2', 'deposit_deduction_policy'],
        recommendedOutcome: 'partial_favor_complainant',
        confidence: 0.85,
        reasoning: 'Evidence supports partial damage claim',
        payoutAmount: 3500,
        responsibility: '75% guest, 25% owner',
      };

      policyEngine.evaluateDisputePolicy.mockResolvedValueOnce(policyEvaluation);

      const evaluation = await disputeService.evaluateDispute(disputeId);

      expect(evaluation.success).toBe(true);
      expect(evaluation.recommendedOutcome).toBe('partial_favor_complainant');
      expect(evaluation.confidence).toBe(0.85);
      expect(evaluation.payoutAmount).toBe(3500);
      expect(evaluation.responsibility.guest).toBe(75);
      expect(evaluation.responsibility.owner).toBe(25);
    });

    it('should handle mediation workflow', async () => {
      const disputeId = 'dispute-123';
      const mediationData = {
        mediatorId: 'mediator-789',
        scheduledAt: new Date('2024-06-15T14:00:00Z'),
        duration: 60, // minutes
        platform: 'video_call',
        participants: ['user-123', 'owner-456'],
      };

      // Mock mediation session creation
      prismaService.dispute.update.mockResolvedValueOnce({
        id: disputeId,
        status: 'in_mediation',
        mediation: mediationData,
      });

      // Mock notification to participants
      notificationService.sendEmail
        .mockResolvedValueOnce({ messageId: 'email-1' })
        .mockResolvedValueOnce({ messageId: 'email-2' });

      const mediation = await disputeService.initiateMediation(disputeId, mediationData);

      expect(mediation.success).toBe(true);
      expect(mediation.status).toBe('in_mediation');
      expect(mediation.mediatorId).toBe('mediator-789');
      expect(mediation.scheduledAt).toBeInstanceOf(Date);
      expect(notificationService.sendEmail).toHaveBeenCalledTimes(2);
    });

    it('should resolve dispute with final decision', async () => {
      const disputeId = 'dispute-123';
      const resolutionData = {
        decision: 'partial_favor_complainant',
        payoutAmount: 3500,
        responsibility: { guest: 75, owner: 25 },
        reasoning: 'Evidence supports partial damage claim',
        resolvedBy: 'admin-456',
        evidenceConsidered: ['evidence-1', 'evidence-2'],
        policyReferences: ['damage_policy_v2', 'deposit_deduction_policy'],
      };

      // Mock resolution creation
      prismaService.disputeResolution.create.mockResolvedValueOnce({
        id: 'resolution-123',
        disputeId,
        ...resolutionData,
        createdAt: new Date(),
      });

      // Mock dispute status update
      prismaService.dispute.update.mockResolvedValueOnce({
        id: disputeId,
        status: 'resolved',
        resolvedAt: new Date(),
      });

      const resolution = await disputeService.resolveDispute(disputeId, resolutionData);

      expect(resolution.success).toBe(true);
      expect(resolution.resolutionId).toBe('resolution-123');
      expect(resolution.decision).toBe('partial_favor_complainant');
      expect(resolution.payoutAmount).toBe(3500);
      expect(resolution.resolvedAt).toBeInstanceOf(Date);
      expect(prismaService.disputeResolution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          disputeId,
          decision: 'partial_favor_complainant',
          payoutAmount: 3500,
        })
      );
    });

    it('should handle appeal process', async () => {
      const disputeId = 'dispute-123';
      const appealData = {
        appellantId: 'user-123',
        reason: 'Additional evidence available',
        description: 'Found additional photos showing pre-existing damage',
        newEvidence: [
          {
            type: 'photo',
            description: 'Pre-existing damage photo',
            fileUrl: 'https://example.com/pre-damage.jpg',
          },
        ],
      };

      // Mock appeal creation
      prismaService.dispute.update.mockResolvedValueOnce({
        id: disputeId,
        status: 'appealed',
        appealedAt: new Date(),
        appealReason: appealData.reason,
      });

      // Mock new evidence addition
      prismaService.disputeEvidence.create.mockResolvedValueOnce({
        id: 'evidence-4',
        ...appealData.newEvidence[0],
      });

      const appeal = await disputeService.submitAppeal(disputeId, appealData);

      expect(appeal.success).toBe(true);
      expect(appeal.status).toBe('appealed');
      expect(appeal.appealReason).toBe('Additional evidence available');
      expect(appeal.newEvidenceCount).toBe(1);
    });

    it('should auto-resolve simple disputes', async () => {
      const disputeId = 'dispute-123';
      const disputeData = {
        id: disputeId,
        type: 'minor_damage',
        severity: 'low',
        requestedAmount: 500,
        evidence: [
          { type: 'photo', relevance: 'high', description: 'Minor scratch' },
        ],
        createdAt: new Date('2024-06-07'),
      };

      // Mock auto-resolution policy
      const autoResolution = {
        autoResolve: true,
        decision: 'full_favor_complainant',
        payoutAmount: 500,
        reasoning: 'Low-value dispute with clear evidence',
      };

      policyEngine.evaluateDisputePolicy.mockResolvedValueOnce(autoResolution);

      // Mock resolution
      prismaService.disputeResolution.create.mockResolvedValueOnce({
        id: 'resolution-123',
        disputeId,
        ...autoResolution,
        autoResolved: true,
      });

      const resolution = await disputeService.attemptAutoResolution(disputeId);

      expect(resolution.success).toBe(true);
      expect(resolution.autoResolved).toBe(true);
      expect(resolution.decision).toBe('full_favor_complainant');
      expect(resolution.payoutAmount).toBe(500);
    });
  });

  describe('Payout Processing', () => {
    it('should calculate payout amounts accurately', async () => {
      const disputeId = 'dispute-123';
      const resolutionData = {
        decision: 'partial_favor_complainant',
        payoutAmount: 3500,
        responsibility: { guest: 75, owner: 25 },
        depositAmount: 10000,
        processingFee: 70, // 2% of 3500
      };

      const payoutCalculation = await payoutService.calculatePayout(disputeId, resolutionData);

      expect(payoutCalculation.grossAmount).toBe(3500);
      expect(payoutCalculation.processingFee).toBe(70);
      expect(payoutCalculation.netAmount).toBe(3430);
      expect(payoutCalculation.depositDeduction).toBe(2500); // 25% of 10000
      expect(payoutCalculation.finalAmount).toBe(930); // 3430 - 2500
    });

    it('should process payout to correct parties', async () => {
      const disputeId = 'dispute-123';
      const payoutData = {
        amount: 3500,
        recipientId: 'user-123',
        recipientType: 'guest',
        method: 'bank_transfer',
        bankDetails: {
          accountNumber: '1234567890',
          bankName: 'Nabil Bank',
          accountHolder: 'John Doe',
        },
      };

      // Mock payout creation
      prismaService.payout.create.mockResolvedValueOnce({
        id: 'payout-123',
        disputeId,
        ...payoutData,
        status: 'processing',
        referenceNumber: 'PAY-2024-001',
        createdAt: new Date(),
      });

      // Mock bank transfer
      const transferResult = {
        success: true,
        transactionId: 'txn-456',
        processedAt: new Date(),
        amount: 3500,
      };

      const payout = await payoutService.processPayout(disputeId, payoutData);

      expect(payout.success).toBe(true);
      expect(payout.payoutId).toBe('payout-123');
      expect(payout.referenceNumber).toBe('PAY-2024-001');
      expect(payout.transactionId).toBe('txn-456');
      expect(payout.status).toBe('completed');
    });

    it('should handle payout failures and retries', async () => {
      const disputeId = 'dispute-123';
      const payoutData = {
        amount: 3500,
        recipientId: 'user-123',
        method: 'bank_transfer',
        bankDetails: {
          accountNumber: '1234567890',
          bankName: 'Nabil Bank',
        },
      };

      // Mock failed payout
      const payoutError = new Error('Bank transfer failed');
      payoutError.name = 'BankTransferError';

      // Mock payout creation
      prismaService.payout.create.mockResolvedValueOnce({
        id: 'payout-123',
        disputeId,
        ...payoutData,
        status: 'processing',
      });

      // Mock retry logic
      let attemptCount = 0;
      const mockPayout = {
        create: jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            throw payoutError;
          }
          return {
            id: `payout-${attemptCount}`,
            status: 'completed',
            transactionId: `txn-${attemptCount}`,
          };
        }),
      };

      const payout = await payoutService.processPayoutWithRetry(disputeId, payoutData, 3);

      expect(payout.success).toBe(true);
      expect(payout.attemptCount).toBe(3);
      expect(payout.transactionId).toBe('txn-3');
    });

    it('should handle split payouts between parties', async () => {
      const disputeId = 'dispute-123';
      const splitPayoutData = {
        totalAmount: 5000,
        splits: [
          {
            recipientId: 'user-123',
            recipientType: 'guest',
            amount: 3500,
            percentage: 70,
            method: 'bank_transfer',
          },
          {
            recipientId: 'owner-456',
            recipientType: 'owner',
            amount: 1500,
            percentage: 30,
            method: 'bank_transfer',
          },
        ],
      };

      // Mock multiple payouts
      prismaService.payout.create
        .mockResolvedValueOnce({ id: 'payout-1', ...splitPayoutData.splits[0] })
        .mockResolvedValueOnce({ id: 'payout-2', ...splitPayoutData.splits[1] });

      const splitPayout = await payoutService.processSplitPayout(disputeId, splitPayoutData);

      expect(splitPayout.success).toBe(true);
      expect(splitPayout.payouts).toHaveLength(2);
      expect(splitPayout.totalProcessed).toBe(5000);
      expect(splitPayout.payouts[0].amount).toBe(3500);
      expect(splitPayout.payouts[1].amount).toBe(1500);
    });

    it('should validate payout amounts against limits', async () => {
      const invalidPayouts = [
        { amount: 50, error: 'Below minimum amount (100)' },
        { amount: 150000, error: 'Above maximum amount (100000)' },
        { amount: -1000, error: 'Negative amount not allowed' },
      ];

      for (const payout of invalidPayouts) {
        const validation = await payoutService.validatePayoutAmount(payout.amount);
        expect(validation.isValid).toBe(false);
        expect(validation.error).toContain(payout.error);
      }

      const validPayout = { amount: 5000 };
      const validation = await payoutService.validatePayoutAmount(validPayout.amount);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Financial Accuracy and Audit Trails', () => {
    it('should maintain comprehensive audit trail', async () => {
      const disputeId = 'dispute-123';
      const auditTrail = {
        dispute: {
          createdAt: new Date('2024-06-07'),
          createdBy: 'user-123',
          type: 'property_damage',
          requestedAmount: 5000,
        },
        evidence: [
          { addedAt: new Date('2024-06-07T10:00:00Z'), addedBy: 'user-123', type: 'photo' },
          { addedAt: new Date('2024-06-07T11:00:00Z'), addedBy: 'owner-456', type: 'document' },
        ],
        resolution: {
          decidedAt: new Date('2024-06-10'),
          decidedBy: 'admin-456',
          decision: 'partial_favor_complainant',
          payoutAmount: 3500,
        },
        payouts: [
          { processedAt: new Date('2024-06-10T14:00:00Z'), amount: 3500, recipient: 'user-123' },
        ],
      };

      const completeAuditTrail = await disputeService.getCompleteAuditTrail(disputeId);

      expect(completeAuditTrail.dispute).toBeDefined();
      expect(completeAuditTrail.evidence).toHaveLength(2);
      expect(completeAuditTrail.resolution).toBeDefined();
      expect(completeAuditTrail.payouts).toHaveLength(1);
      expect(completeAuditTrail.totalAmount).toBe(5000);
      expect(completeAuditTrail.payoutAmount).toBe(3500);
    });

    it('should detect financial discrepancies', async () => {
      const disputeId = 'dispute-123';
      const financialData = {
        requestedAmount: 5000,
        awardedAmount: 3500,
        processingFees: 70,
        depositDeductions: 2500,
        actualPayout: 930,
      };

      const discrepancyAnalysis = await payoutService.analyzeFinancialDiscrepancy(disputeId, financialData);

      expect(discrepancyAnalysis.isBalanced).toBe(true);
      expect(discrepancyAnalysis.formula).toBe('3500 - 70 - 2500 = 930');
      expect(discrepancyAnalysis.breakdown).toEqual({
        awardedAmount: 3500,
        subtractions: 2570, // 70 + 2500
        finalPayout: 930,
      });
    });

    it('should generate financial reports', async () => {
      const reportPeriod = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-30'),
      };

      const reportData = {
        totalDisputes: 25,
        totalRequested: 125000,
        totalAwarded: 87500,
        totalPayouts: 82300,
        processingFees: 1750,
        depositDeductions: 3450,
        averageResolutionTime: 5.2, // days
        resolutionTypes: {
          full_favor_complainant: 10,
          partial_favor_complainant: 8,
          full_favor_respondent: 3,
          dismissed: 4,
        },
      };

      const financialReport = await payoutService.generateFinancialReport(reportPeriod);

      expect(financialReport.summary.totalDisputes).toBe(25);
      expect(financialReport.summary.totalRequested).toBe(125000);
      expect(financialReport.summary.totalAwarded).toBe(87500);
      expect(financialReport.summary.totalPayouts).toBe(82300);
      expect(financialReport.summary.averageAwardPerDispute).toBe(3500); // 87500 / 25
      expect(financialReport.summary.payoutPercentage).toBe(94.1); // 82300 / 87500 * 100
    });

    it('should ensure transaction integrity', async () => {
      const transactionId = 'txn-123';
      const transaction = {
        id: transactionId,
        disputeId: 'dispute-123',
        amount: 3500,
        type: 'payout',
        status: 'completed',
        createdAt: new Date('2024-06-10'),
        processedAt: new Date('2024-06-10T14:00:00Z'),
        recipientId: 'user-123',
        method: 'bank_transfer',
        referenceNumber: 'PAY-2024-001',
      };

      const integrityCheck = await payoutService.verifyTransactionIntegrity(transaction);

      expect(integrityCheck.isValid).toBe(true);
      expect(integrityCheck.checks).toEqual({
        amountValid: true,
        recipientValid: true,
        methodValid: true,
        statusValid: true,
        timestampValid: true,
      });
      expect(integrityCheck.blockchainHash).toBeDefined();
    });
  });

  describe('Notification and Communication', () => {
    it('should notify parties of dispute status changes', async () => {
      const disputeId = 'dispute-123';
      const statusChange = {
        from: 'open',
        to: 'in_mediation',
        changedBy: 'admin-456',
        timestamp: new Date(),
      };

      // Mock user data
      prismaService.user.findMany.mockResolvedValueOnce([
        { id: 'user-123', email: 'user@example.com', phone: '+9771234567890' },
        { id: 'owner-456', email: 'owner@example.com', phone: '+9779876543210' },
      ]);

      // Mock notifications
      notificationService.sendEmail
        .mockResolvedValueOnce({ messageId: 'email-1' })
        .mockResolvedValueOnce({ messageId: 'email-2' });

      const notification = await disputeService.notifyStatusChange(disputeId, statusChange);

      expect(notification.success).toBe(true);
      expect(notification.notifiedParties).toHaveLength(2);
      expect(notification.channels).toEqual(['email']);
      expect(notification.emailsSent).toBe(2);
    });

    it('should send resolution notifications with details', async () => {
      const disputeId = 'dispute-123';
      const resolutionData = {
        decision: 'partial_favor_complainant',
        payoutAmount: 3500,
        reasoning: 'Evidence supports partial claim',
        resolvedBy: 'admin-456',
      };

      const resolutionNotification = await disputeService.sendResolutionNotification(disputeId, resolutionData);

      expect(resolutionNotification.success).toBe(true);
      expect(resolutionNotification.content).toContain('partial_favor_complainant');
      expect(resolutionNotification.content).toContain('3,500');
      expect(resolutionNotification.content).toContain('admin-456');
    });

    it('should handle payout notifications', async () => {
      const payoutId = 'payout-123';
      const payoutData = {
        amount: 3500,
        recipientId: 'user-123',
        status: 'completed',
        referenceNumber: 'PAY-2024-001',
        processedAt: new Date(),
      };

      // Mock user data
      prismaService.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        email: 'user@example.com',
        phone: '+9771234567890',
        notificationPreferences: {
          email: true,
          sms: true,
          push: false,
        },
      });

      // Mock notifications
      notificationService.sendEmail.mockResolvedValueOnce({ messageId: 'email-1' });
      notificationService.sendSMS.mockResolvedValueOnce({ messageId: 'sms-1' });

      const payoutNotification = await payoutService.sendPayoutNotification(payoutId, payoutData);

      expect(payoutNotification.success).toBe(true);
      expect(payoutNotification.channels).toEqual(['email', 'sms']);
      expect(payoutNotification.emailSent).toBe(true);
      expect(payoutNotification.smsSent).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high volume of disputes efficiently', async () => {
      const disputes = Array.from({ length: 100 }, (_, i) => ({
        bookingId: `booking-${i}`,
        complainantId: `user-${i}`,
        respondentId: `owner-${i}`,
        type: 'property_damage',
        description: `Dispute ${i}`,
        requestedAmount: 1000 + (i * 100),
      }));

      const startTime = Date.now();
      
      // Mock bulk creation
      prismaService.dispute.create.mockResolvedValue({
        id: 'dispute-bulk',
        status: 'open',
        createdAt: new Date(),
      });

      const results = await Promise.all(
        disputes.map(dispute => disputeService.createDispute(dispute))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(results.length).toBe(100);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should process payouts in batches', async () => {
      const payouts = Array.from({ length: 50 }, (_, i) => ({
        disputeId: `dispute-${i}`,
        amount: 1000 + (i * 50),
        recipientId: `user-${i}`,
        method: 'bank_transfer',
      }));

      const batchResult = await payoutService.processBatchPayouts(payouts, 10); // Batch size 10

      expect(batchResult.success).toBe(true);
      expect(batchResult.processedCount).toBe(50);
      expect(batchResult.batchCount).toBe(5); // 50 / 10
      expect(batchResult.totalAmount).toBeGreaterThan(50000);
      expect(batchResult.averageProcessingTime).toBeGreaterThan(0);
    });
  });
});
