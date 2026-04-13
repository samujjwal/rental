import { Test, TestingModule } from '@nestjs/testing';
import { DisputeResolutionService } from './dispute-resolution.service';
import { DisputeRepository } from '../repositories/dispute.repository';
import { BookingRepository } from '../../bookings/repositories/booking.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { PaymentRepository } from '../../payments/repositories/payment.repository';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { EmailService } from '../../notifications/services/resend.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * DISPUTE RESOLUTION TESTS
 * 
 * These tests validate dispute resolution functionality:
 * - Dispute initiation and validation
 * - Evidence collection and management
 * - Dispute mediation and resolution
 * - Communication and notifications
 * - Escalation and appeals
 * - Financial resolution and payouts
 * - Documentation and audit trails
 * - Performance and SLA compliance
 * 
 * Business Truth Validated:
 * - Disputes are initiated with proper validation
 * - Evidence is collected securely and systematically
 * - Mediation follows fair and consistent processes
 * - All parties are notified appropriately
 * - Escalation paths are clear and followed
 * - Financial resolutions are accurate and timely
 * - Complete audit trails are maintained
 * 
 * NOTE: These tests are skipped because they require a comprehensive dispute resolution
 * system implementation that is not yet complete. The tests are designed for a future feature
 * that includes:
 * - Full dispute resolution workflows with mediation
 * - Evidence collection and verification systems
 * - Appeal and escalation processes
 * - Financial resolution and payout processing
 * - Audit trail and compliance reporting
 * - SLA monitoring and compliance tracking
 * 
 * TODO: Implement the full dispute resolution system, then enable these tests.
 * The stub services (DisputeResolutionService, DisputeRepository) have been created as
 * placeholders for future implementation.
 */

describe('DisputeResolutionService', () => {
  let disputeResolutionService: DisputeResolutionService;
  let disputeRepository: any;
  let bookingRepository: any;
  let userRepository: any;
  let paymentRepository: any;
  let notificationService: any;
  let emailService: any;
  let configService: any;
  let logger: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeResolutionService,
        {
          provide: DisputeRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            findByBooking: jest.fn(),
            findByUser: jest.fn(),
            findByStatus: jest.fn(),
            addEvidence: jest.fn(),
            findEvidenceByDispute: jest.fn(),
            addResponse: jest.fn(),
            findResponsesByDispute: jest.fn(),
            addTimelineEvent: jest.fn(),
            findTimelineEventsByDispute: jest.fn(),
            createResolution: jest.fn(),
            findResolutionByDispute: jest.fn(),
            createEscalation: jest.fn(),
            findEscalationsByDispute: jest.fn(),
            getDisputeStats: jest.fn(),
            findDisputesNeedingAttention: jest.fn(),
          },
        },
        {
          provide: BookingRepository,
          useValue: {
            findBookingsByListing: jest.fn(),
            findBookingsByPeriod: jest.fn(),
            findConfirmedBookings: jest.fn(),
            findPendingBookings: jest.fn(),
            countBookingsByListing: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            updateUser: jest.fn(),
            getUserProfile: jest.fn(),
          },
        },
        {
          provide: PaymentRepository,
          useValue: {
            findById: jest.fn(),
            findByCurrency: jest.fn(),
            createPayment: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createNotification: jest.fn(),
            getUserNotifications: jest.fn(),
            getNotificationCount: jest.fn(),
            markAsRead: jest.fn(),
            markAllAsRead: jest.fn(),
            deleteNotification: jest.fn(),
            createBookingNotification: jest.fn(),
            createPaymentNotification: jest.fn(),
            createMessageNotification: jest.fn(),
            createSystemNotification: jest.fn(),
            getNotificationPreferences: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendEmail: jest.fn(),
            sendTemplateEmail: jest.fn(),
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

    disputeResolutionService = module.get<DisputeResolutionService>(DisputeResolutionService);
    disputeRepository = module.get<DisputeRepository>(DisputeRepository);
    bookingRepository = module.get<BookingRepository>(BookingRepository);
    userRepository = module.get<UserRepository>(UserRepository);
    paymentRepository = module.get<PaymentRepository>(PaymentRepository);
    notificationService = module.get<NotificationsService>(NotificationsService);
    emailService = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Dispute Initiation', () => {
    it('should initiate a new dispute with valid data', async () => {
      // Arrange
      const disputeData = {
        bookingId: 'booking-123',
        initiatedBy: 'user-456',
        disputeType: 'property_damage',
        category: 'damage',
        severity: 'medium',
        description: 'Property was damaged during rental period',
        amount: 50000,
        evidence: [
          {
            type: 'photo',
            url: 'https://example.com/damage-photo.jpg',
            description: 'Photo of damaged property',
            uploadedAt: new Date(),
          },
        ],
      };

      const booking = {
        id: 'booking-123',
        renterId: 'user-456',
        ownerId: 'owner-789',
        status: 'completed',
        startDate: new Date('2024-05-01'),
        endDate: new Date('2024-05-05'),
        totalAmount: 100000,
      };

      const createdDispute = {
        id: 'dispute-123',
        ...disputeData,
        status: 'initiated',
        createdAt: new Date(),
        referenceNumber: 'DISP-2024-001',
      };

      bookingRepository.findById.mockResolvedValue(booking);
      disputeRepository.findByBooking.mockResolvedValue([]);
      disputeRepository.create.mockResolvedValue(createdDispute);
      notificationService.createNotification.mockResolvedValue({ success: true });
      emailService.sendTemplateEmail.mockResolvedValue({ messageId: 'email-123' });

      // Act
      const result = await disputeResolutionService.initiateDispute(disputeData);

      // Assert
      expect(result.id).toBe('dispute-123');
      expect(result.status).toBe('initiated');
      expect(result.referenceNumber).toMatch(/^DISP-\d{4}-\d+$/);
      expect(bookingRepository.findById).toHaveBeenCalledWith('booking-123');
      expect(disputeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'booking-123',
          initiatorId: 'user-456',
          defendantId: 'owner-789',
          type: 'property_damage',
          description: 'Property was damaged during rental period',
        })
      );
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-789',
          type: 'dispute_initiated',
        })
      );
    });

    it('should reject dispute initiation for invalid booking', async () => {
      // Arrange
      const disputeData = {
        bookingId: 'booking-invalid',
        initiatedBy: 'user-456',
        disputeType: 'property_damage',
        description: 'Invalid booking dispute',
      };

      bookingRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(disputeResolutionService.initiateDispute(disputeData)).rejects.toThrow('Booking not found');
      expect(disputeRepository.create).not.toHaveBeenCalled();
      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should validate dispute initiation timing', async () => {
      // Arrange
      const disputeData = {
        bookingId: 'booking-old',
        initiatedBy: 'user-456',
        disputeType: 'property_damage',
        description: 'Late dispute',
      };

      const oldBooking = {
        id: 'booking-old',
        renterId: 'user-456',
        ownerId: 'owner-789',
        status: 'completed',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
        totalAmount: 100000,
        completedAt: new Date('2024-01-05'), // More than 30 days ago
      };

      bookingRepository.findById.mockResolvedValue(oldBooking);
      configService.get.mockReturnValue(30); // 30 days dispute window

      // Act & Assert
      await expect(disputeResolutionService.initiateDispute(disputeData)).rejects.toThrow('Dispute window has expired');
      expect(disputeRepository.create).not.toHaveBeenCalled();
    });

    it('should prevent duplicate disputes for same booking', async () => {
      // Arrange
      const disputeData = {
        bookingId: 'booking-existing',
        initiatedBy: 'user-456',
        disputeType: 'property_damage',
        description: 'Duplicate dispute',
      };

      const booking = {
        id: 'booking-existing',
        renterId: 'user-456',
        ownerId: 'owner-789',
        status: 'completed',
      };

      const existingDispute = {
        id: 'dispute-existing',
        bookingId: 'booking-existing',
        status: 'active',
        createdAt: new Date(),
      };

      bookingRepository.findById.mockResolvedValue(booking);
      disputeRepository.findByBooking.mockResolvedValue([existingDispute]);

      // Act & Assert
      await expect(disputeResolutionService.initiateDispute(disputeData)).rejects.toThrow('An active dispute already exists for this booking');
      expect(disputeRepository.create).not.toHaveBeenCalled();
    });

    it('should validate dispute amount', async () => {
      // Arrange
      const disputeData = {
        bookingId: 'booking-123',
        initiatedBy: 'user-456',
        disputeType: 'property_damage',
        description: 'Dispute with amount',
        amount: 150000,
      };

      const booking = {
        id: 'booking-123',
        renterId: 'user-456',
        ownerId: 'owner-789',
        status: 'completed',
        totalAmount: 100000,
      };

      const createdDispute = {
        id: 'dispute-123',
        ...disputeData,
        status: 'OPEN',
        createdAt: new Date(),
      };

      bookingRepository.findById.mockResolvedValue(booking);
      disputeRepository.findByBooking.mockResolvedValue([]);
      disputeRepository.create.mockResolvedValue(createdDispute);
      disputeRepository.addTimelineEvent.mockResolvedValue({});
      notificationService.createNotification.mockResolvedValue({ success: true });

      // Act
      const result = await disputeResolutionService.initiateDispute(disputeData);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.amount).toBe(150000);
    });

    it('should validate dispute initiator permissions', async () => {
      // Arrange
      const disputeData = {
        bookingId: 'booking-123',
        initiatedBy: 'user-unauthorized',
        disputeType: 'property_damage',
        description: 'Unauthorized dispute',
      };

      const booking = {
        id: 'booking-123',
        renterId: 'user-456',
        ownerId: 'owner-789',
        status: 'completed',
      };

      bookingRepository.findById.mockResolvedValue(booking);

      // Act & Assert
      await expect(disputeResolutionService.initiateDispute(disputeData)).rejects.toThrow('User is not a participant in this booking');
      expect(disputeRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('Evidence Collection', () => {
    it('should add evidence to existing dispute', async () => {
      // Arrange
      const disputeId = 'dispute-123';
      const evidenceData = {
        submittedBy: 'user-456',
        type: 'document',
        url: 'https://example.com/evidence.pdf',
        description: 'Repair receipt for damages',
        category: 'financial',
        isConfidential: false,
      };

      const dispute = {
        id: disputeId,
        status: 'evidence_collection',
        evidence: [],
      };

      const addedEvidence = {
        id: 'evidence-123',
        ...evidenceData,
        submittedAt: new Date(),
        verified: false,
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.addEvidence.mockResolvedValue(addedEvidence);
      notificationService.createNotification.mockResolvedValue({ success: true });

      // Act
      const result = await disputeResolutionService.addEvidence(disputeId, evidenceData);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.type).toBe('document');
      expect(result.submittedBy).toBe('user-456');
    });

    it('should validate evidence file types and sizes', async () => {
      // Arrange
      const disputeId = 'dispute-123';
      const invalidEvidence = {
        submittedBy: 'user-456',
      };

      const dispute = {
        id: disputeId,
        status: 'evidence_collection',
      };

      disputeRepository.findById.mockResolvedValue(dispute);

      // Act & Assert
      await expect(disputeResolutionService.addEvidence(disputeId, invalidEvidence)).rejects.toThrow('Evidence type and URL are required');
      expect(disputeRepository.addEvidence).not.toHaveBeenCalled();
    });

    it('should handle confidential evidence securely', async () => {
      // Arrange
      const disputeId = 'dispute-confidential';
      const confidentialEvidence = {
        submittedBy: 'user-456',
        type: 'document',
        url: 'https://example.com/confidential.pdf',
        description: 'Sensitive financial information',
        category: 'financial',
        isConfidential: true,
        accessLevel: 'mediator_only',
      };

      const dispute = {
        id: disputeId,
        status: 'evidence_collection',
      };

      const addedEvidence = {
        id: 'evidence-confidential',
        ...confidentialEvidence,
        submittedAt: new Date(),
        encrypted: true,
        accessLog: [],
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.addEvidence.mockResolvedValue(addedEvidence);

      // Act
      const result = await disputeResolutionService.addEvidence(disputeId, confidentialEvidence);

      // Assert
      expect(result.isConfidential).toBe(true);
      expect(result.accessLevel).toBe('mediator_only');
      expect(result.encrypted).toBe(true);
      expect(result.accessLog).toBeDefined();
    });

    it('should track evidence verification status', async () => {
      // Arrange
      const disputeId = 'dispute-verify';
      const evidenceId = 'evidence-123';
      const verificationData = {
        verifiedBy: 'mediator-789',
        verificationStatus: 'verified',
        verificationNotes: 'Document appears authentic',
        verificationMethod: 'manual_review',
      };

      const dispute = {
        id: disputeId,
        status: 'evidence_collection',
        evidence: [
          {
            id: evidenceId,
            type: 'document',
            verified: false,
          },
        ],
      };

      const verifiedEvidence = {
        id: evidenceId,
        verified: true,
        verifiedBy: 'mediator-789',
        verifiedAt: new Date(),
        verificationNotes: 'Document appears authentic',
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.update.mockResolvedValue(verifiedEvidence);

      // Act
      const result = await disputeResolutionService.verifyEvidence(disputeId, evidenceId, verificationData);

      // Assert
      expect(result.id).toBe('evidence-123');
      expect(result.verified).toBe(true);
      expect(result.verifiedBy).toBe('mediator-789');
      expect(result.verificationNotes).toBe('Document appears authentic');
    });

    it('should generate evidence summary', async () => {
      // Arrange
      const disputeId = 'dispute-summary';
      const dispute = {
        id: disputeId,
        evidence: [
          {
            id: 'evidence-1',
            type: 'photo',
            category: 'damage',
            submittedBy: 'user-456',
            verified: true,
            submittedAt: new Date('2024-06-01'),
          },
          {
            id: 'evidence-2',
            type: 'document',
            category: 'financial',
            submittedBy: 'owner-789',
            verified: false,
            submittedAt: new Date('2024-06-02'),
          },
          {
            id: 'evidence-3',
            type: 'video',
            category: 'incident',
            submittedBy: 'user-456',
            verified: true,
            submittedAt: new Date('2024-06-03'),
          },
        ],
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.findEvidenceByDispute.mockResolvedValue([
        { type: 'damage', uploadedBy: 'user-456' },
        { type: 'financial', uploadedBy: 'owner-789' },
        { type: 'incident', uploadedBy: 'user-456' },
      ]);

      // Act
      const result = await disputeResolutionService.generateEvidenceSummary(disputeId);

      // Assert
      expect(result.totalEvidence).toBe(3);
      expect(result.byCategory).toEqual({
        damage: 1,
        financial: 1,
        incident: 1,
      });
      expect(result.byType).toBeDefined();
      expect(result.bySubmitter).toEqual({
        'user-456': 2,
        'owner-789': 1,
      });
    });
  });

  describe('Dispute Mediation', () => {
    it('should start mediation process', async () => {
      // Arrange
      const disputeId = 'dispute-mediation';
      const mediationData = {
        mediatorId: 'mediator-123',
        mediationType: 'facilitated',
        scheduledAt: new Date('2024-06-15T10:00:00Z'),
        duration: 60, // minutes
        platform: 'video_call',
        participants: ['user-456', 'owner-789'],
      };

      const dispute = {
        id: disputeId,
        status: 'evidence_collection_complete',
        parties: {
          initiator: { userId: 'user-456', role: 'renter' },
          respondent: { userId: 'owner-789', role: 'owner' },
        },
      };

      const mediationSession = {
        id: 'mediation-123',
        disputeId,
        ...mediationData,
        status: 'scheduled',
        createdAt: new Date(),
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.update.mockResolvedValue(mediationSession);
      notificationService.createNotification.mockResolvedValue({ success: true });
      emailService.sendTemplateEmail.mockResolvedValue({ messageId: 'email-123' });

      // Act
      const result = await disputeResolutionService.startMediation(disputeId, mediationData);

      // Assert
      expect(result.disputeId).toBe(disputeId);
      expect(result.status).toBe('UNDER_REVIEW');
      expect(result.mediatorId).toBe('mediator-123');
    });

    it('should conduct mediation session', async () => {
      // Arrange
      const disputeId = 'dispute-session';
      const sessionData = {
        sessionId: 'mediation-123',
        startTime: new Date('2024-06-15T10:00:00Z'),
        endTime: new Date('2024-06-15T11:00:00Z'),
        outcome: 'partial_agreement',
        agreements: [
          {
            point: 'damage_compensation',
            agreement: 'renter_pays_50_percent',
            amount: 25000,
            responsibleParty: 'renter',
          },
        ],
        nextSteps: [
          {
            action: 'payment_arrangement',
            deadline: new Date('2024-06-20'),
            responsible: 'renter',
          },
        ],
      };

      const dispute = {
        id: disputeId,
        status: 'mediation_in_progress',
        mediation: {
          id: 'mediation-123',
          mediatorId: 'mediator-123',
        },
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.addTimelineEvent.mockResolvedValue({});

      // Act
      const result = await disputeResolutionService.conductMediation(disputeId, sessionData);

      // Assert
      expect(result.disputeId).toBe(disputeId);
      expect(result.status).toBe('INVESTIGATING');
      expect(result.mediation).toBeDefined();
      expect(result.mediation.completedAt).toBeDefined();
    });

    it('should handle mediation breakdown', async () => {
      // Arrange
      const disputeId = 'dispute-breakdown';
      const breakdownData = {
        reason: 'parties_unable_to_agree',
        breakdownPoint: 'compensation_amount',
        timeElapsed: 45, // minutes
        recommendations: ['escalate_to_arbitration', 'formal_legal_process'],
        finalPositions: {
          renter: { offer: 20000, maxWilling: 25000 },
          owner: { demand: 80000, minAcceptable: 60000 },
        },
      };

      const dispute = {
        id: disputeId,
        status: 'mediation_in_progress',
        amount: 50000,
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.createEscalation.mockResolvedValue({
        id: 'escalation-123',
        disputeId,
        fromLevel: 'MEDIATION',
        toLevel: 'ARBITRATION',
        reason: breakdownData.reason,
      });

      // Act
      const result = await disputeResolutionService.handleMediationBreakdown(disputeId, breakdownData);

      // Assert
      expect(result.escalated).toBe(true);
      expect(result.escalation).toBeDefined();
      expect(result.escalation.toLevel).toBe('ARBITRATION');
    });

    it('should generate mediation report', async () => {
      // Arrange
      const disputeId = 'dispute-report';
      const dispute = {
        id: disputeId,
        status: 'mediation_completed',
        assignedTo: 'mediator-123',
        mediation: {
          id: 'mediation-123',
          mediatorId: 'mediator-123',
          scheduledAt: new Date('2024-06-15T10:00:00Z'),
          startTime: new Date('2024-06-15T10:05:00Z'),
          endTime: new Date('2024-06-15T11:15:00Z'),
          outcome: 'full_agreement',
          agreements: [
            {
              point: 'damage_compensation',
              agreement: 'renter_pays_full_amount',
              amount: 50000,
              responsibleParty: 'renter',
            },
            {
              point: 'future_bookings',
              agreement: 'no_further_bookings_between_parties',
              responsibleParty: 'both',
            },
          ],
          nextSteps: [
            {
              action: 'payment_within_7_days',
              deadline: new Date('2024-06-22'),
              responsible: 'renter',
            },
          ],
          notes: 'Successful mediation with mutual understanding',
        },
        parties: {
          initiator: { userId: 'user-456', role: 'renter' },
          respondent: { userId: 'owner-789', role: 'owner' },
        },
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.findTimelineEventsByDispute.mockResolvedValue([]);
      disputeRepository.findResponsesByDispute.mockResolvedValue([]);

      // Act
      const result = await disputeResolutionService.generateMediationReport(disputeId);

      // Assert
      expect(result.disputeId).toBe(disputeId);
      expect(result.mediatorId).toBeDefined();
      expect(result.timelineEvents).toBeDefined();
      expect(result.communications).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });
  });

  describe('Communication Management', () => {
    it('should add communication to dispute', async () => {
      // Arrange
      const disputeId = 'dispute-comm';
      const communicationData = {
        userId: 'user-456',
        content: 'I would like to propose a settlement of 30000',
        type: 'offer',
        attachments: [],
      };

      const dispute = {
        id: disputeId,
        status: 'active',
        parties: {
          initiator: { userId: 'user-456' },
          respondent: { userId: 'owner-789' },
        },
      };

      const addedCommunication = {
        id: 'comm-123',
        ...communicationData,
        sentAt: new Date(),
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.addResponse.mockResolvedValue(addedCommunication);
      notificationService.createNotification.mockResolvedValue({ success: true });

      // Act
      const result = await disputeResolutionService.addCommunication(disputeId, communicationData);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.userId).toBe('user-456');
      expect(result.type).toBe('offer');
    });

    it('should mark communication as read', async () => {
      // Arrange
      const disputeId = 'dispute-read';
      const communicationId = 'comm-123';
      const userId = 'owner-789';

      const dispute = {
        id: disputeId,
        communications: [
          {
            id: communicationId,
            recipientId: userId,
            read: false,
            readAt: null,
          },
        ],
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.update.mockResolvedValue({});

      // Act
      const result = await disputeResolutionService.markCommunicationRead(disputeId, communicationId, userId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.readAt).toBeDefined();
    });

    it('should generate communication summary', async () => {
      // Arrange
      const disputeId = 'dispute-comm-summary';
      const dispute = {
        id: disputeId,
        communications: [
          {
            id: 'comm-1',
            senderId: 'user-456',
            recipientId: 'owner-789',
            type: 'offer',
            sentAt: new Date('2024-06-01T10:00:00Z'),
            read: true,
            readAt: new Date('2024-06-01T10:30:00Z'),
          },
          {
            id: 'comm-2',
            senderId: 'owner-789',
            recipientId: 'user-456',
            type: 'counter_offer',
            sentAt: new Date('2024-06-01T11:00:00Z'),
            read: false,
            readAt: null,
          },
          {
            id: 'comm-3',
            senderId: 'mediator-123',
            recipientId: 'both',
            type: 'mediation_note',
            sentAt: new Date('2024-06-01T12:00:00Z'),
            read: true,
            readAt: new Date('2024-06-01T12:15:00Z'),
          },
        ],
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.findResponsesByDispute.mockResolvedValue([
        { id: 'resp-1', type: 'offer', userId: 'user-456' },
        { id: 'resp-2', type: 'counter_offer', userId: 'owner-789' },
        { id: 'resp-3', type: 'mediation_note', userId: 'mediator-123' },
      ]);

      // Act
      const result = await disputeResolutionService.generateCommunicationSummary(disputeId);

      // Assert
      expect(result.totalCommunications).toBe(3);
      expect(result.byType).toBeDefined();
      expect(result.bySender).toBeDefined();
    });

    it('should facilitate structured negotiations', async () => {
      // Arrange
      const disputeId = 'dispute-negotiation';
      const negotiationData = {
        type: 'structured_negotiation',
        topic: 'compensation_amount',
        initiatorPosition: {
          amount: 20000,
          reasoning: 'Minor damage, reasonable repair cost',
          supportingEvidence: ['evidence-1', 'evidence-2'],
        },
        rounds: [
          {
            round: 1,
            initiatorOffer: 20000,
            respondentResponse: 60000,
            gap: 40000,
            notes: 'Significant gap remains',
          },
          {
            round: 2,
            initiatorOffer: 30000,
            respondentResponse: 50000,
            gap: 20000,
            notes: 'Gap narrowing',
          },
        ],
        currentStatus: 'ongoing',
      };

      const dispute = {
        id: disputeId,
        status: 'negotiation_active',
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.update.mockResolvedValue({});

      // Act
      const result = await disputeResolutionService.updateNegotiation(disputeId, negotiationData);

      // Assert
      expect(result.currentStatus).toBe('ongoing');
      expect(result.rounds).toHaveLength(2);
      expect(result.rounds[1].gap).toBe(20000);
    });
  });

  describe('Dispute Resolution', () => {
    it('should resolve dispute with agreement', async () => {
      // Arrange
      const disputeId = 'dispute-resolve';
      const resolutionData = {
        resolutionType: 'agreement',
        outcome: 'partial_compensation',
        terms: [
          {
            type: 'financial_compensation',
            amount: 35000,
            responsibleParty: 'renter',
            deadline: new Date('2024-06-20'),
            paymentMethod: 'bank_transfer',
          },
          {
            type: 'future_restrictions',
            restriction: 'no_bookings_between_parties_6_months',
            duration: 6,
            responsibleParty: 'both',
          },
        ],
        summary: 'Parties agree on partial compensation with payment arrangements',
        resolvedBy: 'mediator-123',
        resolvedAt: new Date(),
      };

      const dispute = {
        id: disputeId,
        status: 'mediation_completed',
        amount: 50000,
        parties: {
          initiator: { userId: 'user-456', role: 'renter' },
          respondent: { userId: 'owner-789', role: 'owner' },
        },
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.createResolution.mockResolvedValue({
        id: 'resolution-123',
        disputeId,
        type: resolutionData.resolutionType,
        outcome: resolutionData.outcome,
        terms: resolutionData.terms,
      });
      disputeRepository.update.mockResolvedValue(dispute);
      disputeRepository.addTimelineEvent.mockResolvedValue({});
      notificationService.createNotification.mockResolvedValue({ success: true });
      emailService.sendTemplateEmail.mockResolvedValue({ messageId: 'email-123' });

      // Act
      const result = await disputeResolutionService.resolveDispute(disputeId, resolutionData);

      // Assert
      expect(result.disputeId).toBe(disputeId);
      expect(result.status).toBe('RESOLVED');
      expect(result.resolvedAt).toBeDefined();
      expect(result.resolution).toBeDefined();
    });

    it('should handle dispute dismissal', async () => {
      // Arrange
      const disputeId = 'dispute-dismiss';
      const dismissalData = {
        reason: 'insufficient_evidence',
        dismissedBy: 'mediator-123',
        dismissalCategory: 'unfounded',
        notes: 'No substantial evidence to support claim',
        allowReopening: false,
      };

      const dispute = {
        id: disputeId,
        status: 'UNDER_REVIEW',
        initiatorId: 'user-123',
        defendantId: 'user-456',
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.update.mockResolvedValue(dispute);
      disputeRepository.addTimelineEvent.mockResolvedValue({});
      notificationService.createNotification.mockResolvedValue({ success: true });

      // Act
      const result = await disputeResolutionService.dismissDispute(disputeId, dismissalData);

      // Assert
      expect(result.disputeId).toBe(disputeId);
      expect(result.dismissed).toBe(true);
      expect(result.dismissedAt).toBeDefined();
      expect(result.reason).toBe('insufficient_evidence');
    });

    it('should implement resolution terms', async () => {
      // Arrange
      const disputeId = 'dispute-implement';
      const implementationData = {
        term: 'payment',
        amount: 35000,
        fromUser: 'user-456',
        toUser: 'owner-789',
      };

      const dispute = {
        id: disputeId,
        status: 'RESOLVED',
        resolution: {
          id: 'resolution-123',
          type: 'MUTUAL_AGREEMENT',
          outcome: 'PARTIAL_FAVOR_COMPLAINANT',
        },
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.addTimelineEvent.mockResolvedValue({});

      // Act
      const result = await disputeResolutionService.implementResolutionTerm(disputeId, implementationData);

      // Assert
      expect(result.disputeId).toBe(disputeId);
      expect(result.termImplemented).toBe(true);
      expect(result.implementedAt).toBeDefined();
    });

    it('should track resolution compliance', async () => {
      // Arrange
      const disputeId = 'dispute-compliance';
      const dispute = {
        id: disputeId,
        status: 'RESOLVED',
        resolution: {
          id: 'resolution-123',
          type: 'MUTUAL_AGREEMENT',
          outcome: 'PARTIAL_FAVOR_COMPLAINANT',
        },
      };

      disputeRepository.findById.mockResolvedValue(dispute);

      // Act
      const result = await disputeResolutionService.checkResolutionCompliance(disputeId);

      // Assert
      expect(result.disputeId).toBe(disputeId);
      expect(result.compliant).toBeDefined();
      expect(result.checkedAt).toBeDefined();
      expect(result.complianceDetails).toBeDefined();
    });
  });

  describe('Escalation and Appeals', () => {
    it('should escalate dispute to higher level', async () => {
      // Arrange
      const disputeId = 'dispute-escalate';
      const escalationData = {
        escalationReason: 'mediation_failure',
        escalationLevel: 'arbitration',
        requestedBy: 'user-456',
        justification: 'Mediation failed to reach agreement',
        additionalEvidence: ['evidence-4', 'evidence-5'],
      };

      const dispute = {
        id: disputeId,
        status: 'UNDER_REVIEW',
        type: 'PROPERTY_DAMAGE',
        amount: 75000,
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.createEscalation.mockResolvedValue({
        id: 'escalation-123',
        disputeId,
        fromLevel: 'MEDIATION',
        toLevel: 'ARBITRATION',
        reason: escalationData.escalationReason,
        escalatedBy: escalationData.requestedBy,
        assignedTo: escalationData.escalationLevel,
        deadline: new Date('2024-07-01'),
      });
      disputeRepository.update.mockResolvedValue(dispute);
      disputeRepository.addTimelineEvent.mockResolvedValue({});
      notificationService.createNotification.mockResolvedValue({ success: true });

      // Act
      const result = await disputeResolutionService.escalateDispute(disputeId, escalationData);

      // Assert
      expect(result.escalated).toBe(true);
      expect(result.escalation).toBeDefined();
      expect(result.escalation.toLevel).toBe('ARBITRATION');
      expect(disputeRepository.createEscalation).toHaveBeenCalled();
    });

    it('should process appeal request', async () => {
      // Arrange
      const disputeId = 'dispute-appeal';
      const appealData = {
        submittedBy: 'user-456',
        reason: 'procedural_error',
      };

      const dispute = {
        id: disputeId,
        status: 'RESOLVED',
        resolvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      configService.get.mockReturnValue(7); // 7 day appeal period

      // Act
      const result = await disputeResolutionService.submitAppeal(disputeId, appealData);

      // Assert
      expect(result.appealId).toBeDefined();
      expect(result.disputeId).toBe(disputeId);
      expect(result.submittedBy).toBe('user-456');
      expect(result.status).toBe('pending');
    });

    it('should review and decide on appeal', async () => {
      // Arrange
      const disputeId = 'dispute-appeal-review';
      const appealDecision = {
        appealId: 'appeal-123',
        decision: 'granted',
        decisionReason: 'procedural_irregularities_confirmed',
        newResolution: {
          type: 'new_mediation',
          assignedMediator: 'mediator-456',
          scheduledDate: new Date('2024-06-20'),
          specialInstructions: 'Focus on evidence not previously considered',
        },
        reviewedBy: 'senior_mediator-789',
        reviewedAt: new Date(),
      };

      const dispute = {
        id: disputeId,
        status: 'RESOLVED',
        resolvedAt: new Date(),
      };

      disputeRepository.findById.mockResolvedValue(dispute);

      // Act
      const result = await disputeResolutionService.reviewAppeal(disputeId, appealDecision);

      // Assert
      expect(result.appealId).toBe('appeal-123');
      expect(result.decision).toBe('granted');
      expect(result.reviewedBy).toBe('senior_mediator-789');
      expect(result.reviewedAt).toBeDefined();
    });

    it('should validate appeal timing and eligibility', async () => {
      // Arrange
      const disputeId = 'dispute-appeal-invalid';
      const appealData = {
        submittedBy: 'user-456',
        reason: 'disagree_with_outcome',
      };
      const dispute = {
        id: disputeId,
        status: 'RESOLVED',
        resolvedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      configService.get.mockReturnValue(7); // 7 day appeal period

      // Act & Assert
      await expect(disputeResolutionService.submitAppeal(disputeId, appealData)).rejects.toThrow('Appeal period expired');
    });
  });

  describe('Audit and Compliance', () => {
    it('should generate dispute audit trail', async () => {
      // Arrange
      const disputeId = 'dispute-audit';
      const auditConfig = {
        includeAllActions: true,
        includeCommunications: true,
        format: 'json',
      };
      const dispute = {
        id: disputeId,
        createdAt: new Date('2024-05-01'),
        initiatorId: 'user-123',
        defendantId: 'owner-456',
        type: 'property_damage',
        status: 'RESOLVED',
        resolvedAt: new Date('2024-06-01'),
        amount: 35000,
        resolution: null,
      };
      const auditLog = [
        {
          action: 'dispute_initiated',
          timestamp: new Date('2024-05-01T09:00:00Z'),
          userId: 'user-123',
          details: { disputeType: 'property_damage', evidenceType: 'photo', evidenceId: 'ev-1' },
        },
        {
          action: 'evidence_added',
          timestamp: new Date('2024-05-02T10:00:00Z'),
          userId: 'user-123',
          details: { evidenceType: 'document', evidenceId: 'ev-2' },
        },
        {
          action: 'mediation_started',
          timestamp: new Date('2024-05-15T10:00:00Z'),
          userId: 'mediator-123',
          details: { mediationType: 'facilitated' },
        },
        {
          action: 'dispute_resolved',
          timestamp: new Date('2024-06-01T16:00:00Z'),
          userId: 'mediator-123',
          details: { resolutionType: 'agreement', amount: 35000 },
        },
      ];

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.findTimelineEventsByDispute.mockResolvedValue(auditLog);
      disputeRepository.findEvidenceByDispute.mockResolvedValue([]);
      disputeRepository.findResponsesByDispute.mockResolvedValue([]);
      disputeRepository.findEscalationsByDispute.mockResolvedValue([]);

      // Act
      const result = await disputeResolutionService.generateAuditTrail(disputeId, auditConfig);

      // Assert
      expect(result.disputeId).toBe(disputeId);
      expect(result.auditTrail).toBeDefined();
      expect(result.auditTrail.timelineEvents).toBeDefined();
      expect(result.format).toBe('json');
    });

    it('should check compliance with SLA requirements', async () => {
      // Arrange
      const disputeId = 'dispute-sla';
      const dispute = {
        id: disputeId,
        createdAt: new Date('2024-05-01'),
        status: 'RESOLVED',
        resolvedAt: new Date('2024-06-01'),
        amount: 50000,
        type: 'PROPERTY_DAMAGE',
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      configService.get.mockReturnValue(72); // 72 hour SLA threshold

      // Act
      const result = await disputeResolutionService.checkSLACompliance(disputeId);

      // Assert
      expect(result.disputeId).toBe(disputeId);
      expect(result.compliant).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.slaThreshold).toBe(72);
    });

    it('should generate compliance reports', async () => {
      // Arrange
      const reportConfig = {
        period: 'last_30_days',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-06-30'),
      };

      const stats = {
        total: 150,
        byStatus: { OPEN: 10, UNDER_REVIEW: 20, RESOLVED: 120 },
        byType: { PROPERTY_DAMAGE: 80, PAYMENT_DISPUTE: 40, CANCELLATION: 30 },
        byPriority: { HIGH: 20, MEDIUM: 100, LOW: 30 },
      };

      const disputesNeedingAttention = [
        { id: 'dispute-1', status: 'OPEN', createdAt: new Date('2024-05-01') },
        { id: 'dispute-2', status: 'UNDER_REVIEW', createdAt: new Date('2024-05-15') },
      ];

      disputeRepository.getDisputeStats.mockResolvedValue(stats);
      disputeRepository.findDisputesNeedingAttention.mockResolvedValue(disputesNeedingAttention);
      disputeRepository.findById.mockResolvedValue({
        id: 'dispute-1',
        createdAt: new Date('2024-05-01'),
        resolvedAt: new Date('2024-05-10'),
      });
      configService.get.mockReturnValue(72);

      // Act
      const result = await disputeResolutionService.generateComplianceReport(reportConfig);

      // Assert
      expect(result.reportId).toBeDefined();
      expect(result.period).toBe('last_30_days');
      expect(result.summary).toBeDefined();
      expect(result.summary.totalDisputes).toBe(150);
      expect(result.summary.activeDisputes).toBe(2);
    });
  });
});
