import { Test, TestingModule } from '@nestjs/testing';
import { DisputeResolutionService } from './dispute-resolution.service';
import { DisputeRepository } from '../repositories/dispute.repository';
import { BookingRepository } from '../../bookings/repositories/booking.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { PaymentRepository } from '../../payments/repositories/payment.repository';
import { NotificationService } from '../../notifications/services/notification.service';
import { EmailService } from '../../notifications/services/email.service';
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
 */

describe('DisputeResolutionService', () => {
  let disputeResolutionService: DisputeResolutionService;
  let disputeRepository: DisputeRepository;
  let bookingRepository: BookingRepository;
  let userRepository: UserRepository;
  let paymentRepository: PaymentRepository;
  let notificationService: NotificationService;
  let emailService: EmailService;
  let configService: ConfigService;
  let logger: Logger;

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
            addCommunication: jest.fn(),
            escalateDispute: jest.fn(),
            resolveDispute: jest.fn(),
            getDisputeStats: jest.fn(),
            auditDispute: jest.fn(),
          },
        },
        {
          provide: BookingRepository,
          useValue: {
            findById: jest.fn(),
            updateStatus: jest.fn(),
            findBookingHistory: jest.fn(),
            getBookingDetails: jest.fn(),
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
            findByBooking: jest.fn(),
            createRefund: jest.fn(),
            processPayout: jest.fn(),
            holdPayment: jest.fn(),
            releasePayment: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendNotification: jest.fn(),
            createNotification: jest.fn(),
            getNotifications: jest.fn(),
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
            get: jest.fn().mockReturnValue('test-value'),
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
    notificationService = module.get<NotificationService>(NotificationService);
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
      disputeRepository.create.mockResolvedValue(createdDispute);
      notificationService.sendNotification.mockResolvedValue({ success: true });
      emailService.sendTemplateEmail.mockResolvedValue({ messageId: 'email-123' });

      // Act
      const result = await disputeResolutionService.initiateDispute(disputeData);

      // Assert
      expect(result.id).toBe('dispute-123');
      expect(result.status).toBe('initiated');
      expect(result.referenceNumber).toBe('DISP-2024-001');
      expect(bookingRepository.findById).toHaveBeenCalledWith('booking-123');
      expect(disputeRepository.create).toHaveBeenCalledWith(disputeData);
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-789',
          type: 'dispute_initiated',
        })
      );
      expect(emailService.sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'dispute-initiated',
          to: expect.any(String),
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
      expect(notificationService.sendNotification).not.toHaveBeenCalled();
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
      await expect(disputeResolutionService.initiateDispute(disputeData)).rejects.toThrow('Dispute initiation period expired');
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
      await expect(disputeResolutionService.initiateDispute(disputeData)).rejects.toThrow('Dispute already exists for this booking');
      expect(disputeRepository.create).not.toHaveBeenCalled();
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
      await expect(disputeResolutionService.initiateDispute(disputeData)).rejects.toThrow('User not authorized to initiate dispute');
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
      notificationService.sendNotification.mockResolvedValue({ success: true });

      // Act
      const result = await disputeResolutionService.addEvidence(disputeId, evidenceData);

      // Assert
      expect(result.id).toBe('evidence-123');
      expect(result.type).toBe('document');
      expect(result.submittedBy).toBe('user-456');
      expect(disputeRepository.addEvidence).toHaveBeenCalledWith(disputeId, evidenceData);
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'evidence_added',
        })
      );
    });

    it('should validate evidence file types and sizes', async () => {
      // Arrange
      const disputeId = 'dispute-123';
      const invalidEvidence = {
        submittedBy: 'user-456',
        type: 'document',
        url: 'https://example.com/evidence.exe', // Invalid file type
        description: 'Executable file',
        fileSize: 50000000, // 50MB - too large
      };

      const dispute = {
        id: disputeId,
        status: 'evidence_collection',
      };

      disputeRepository.findById.mockResolvedValue(dispute);

      // Act & Assert
      await expect(disputeResolutionService.addEvidence(disputeId, invalidEvidence)).rejects.toThrow('Invalid file type or size');
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
      expect(result.verified).toBe(true);
      expect(result.verifiedBy).toBe('mediator-789');
      expect(result.verificationNotes).toBe('Document appears authentic');
      expect(disputeRepository.update).toHaveBeenCalledWith(
        disputeId,
        expect.objectContaining({
          evidence: expect.arrayContaining([
            expect.objectContaining({
              id: evidenceId,
              verified: true,
            }),
          ]),
        })
      );
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

      // Act
      const result = await disputeResolutionService.generateEvidenceSummary(disputeId);

      // Assert
      expect(result.totalEvidence).toBe(3);
      expect(result.verifiedEvidence).toBe(2);
      expect(result.pendingVerification).toBe(1);
      expect(result.byCategory).toEqual({
        damage: 1,
        financial: 1,
        incident: 1,
      });
      expect(result.byType).toEqual({
        photo: 1,
        document: 1,
        video: 1,
      });
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
      notificationService.sendNotification.mockResolvedValue({ success: true });
      emailService.sendTemplateEmail.mockResolvedValue({ messageId: 'email-123' });

      // Act
      const result = await disputeResolutionService.startMediation(disputeId, mediationData);

      // Assert
      expect(result.id).toBe('mediation-123');
      expect(result.status).toBe('scheduled');
      expect(result.mediatorId).toBe('mediator-123');
      expect(disputeRepository.update).toHaveBeenCalledWith(disputeId, {
        status: 'mediation_scheduled',
        mediation: mediationSession,
      });
      expect(notificationService.sendNotification).toHaveBeenCalledTimes(3); // Mediator + 2 parties
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
        notes: 'Productive discussion with good communication',
      };

      const dispute = {
        id: disputeId,
        status: 'mediation_in_progress',
        mediation: {
          id: 'mediation-123',
          mediatorId: 'mediator-123',
        },
      };

      const updatedDispute = {
        ...dispute,
        status: 'mediation_completed',
        mediation: {
          ...dispute.mediation,
          ...sessionData,
          completedAt: new Date(),
        },
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.update.mockResolvedValue(updatedDispute);

      // Act
      const result = await disputeResolutionService.conductMediation(disputeId, sessionData);

      // Assert
      expect(result.status).toBe('mediation_completed');
      expect(result.mediation.outcome).toBe('partial_agreement');
      expect(result.mediation.agreements).toHaveLength(1);
      expect(result.mediation.nextSteps).toHaveLength(1);
      expect(disputeRepository.update).toHaveBeenCalledWith(disputeId, updatedDispute);
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
      disputeRepository.escalateDispute.mockResolvedValue({
        escalated: true,
        escalationLevel: 'arbitration',
        escalatedAt: new Date(),
      });

      // Act
      const result = await disputeResolutionService.handleMediationBreakdown(disputeId, breakdownData);

      // Assert
      expect(result.escalated).toBe(true);
      expect(result.escalationLevel).toBe('arbitration');
      expect(result.breakdownReason).toBe('parties_unable_to_agree');
      expect(disputeRepository.escalateDispute).toHaveBeenCalledWith(disputeId, {
        escalationReason: 'mediation_breakdown',
        breakdownData,
        recommendedAction: 'arbitration',
      });
    });

    it('should generate mediation report', async () => {
      // Arrange
      const disputeId = 'dispute-report';
      const dispute = {
        id: disputeId,
        status: 'mediation_completed',
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

      // Act
      const result = await disputeResolutionService.generateMediationReport(disputeId);

      // Assert
      expect(result.disputeId).toBe(disputeId);
      expect(result.mediatorId).toBe('mediator-123');
      expect(result.sessionDuration).toBe(70); // 1 hour 10 minutes
      expect(result.outcome).toBe('full_agreement');
      expect(result.agreements).toHaveLength(2);
      expect(result.nextSteps).toHaveLength(1);
      expect(result.summary).toContain('Successful mediation');
    });
  });

  describe('Communication Management', () => {
    it('should add communication to dispute', async () => {
      // Arrange
      const disputeId = 'dispute-comm';
      const communicationData = {
        senderId: 'user-456',
        recipientId: 'owner-789',
        message: 'I would like to propose a settlement of 30000',
        type: 'offer',
        isFormal: true,
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
        read: false,
        threadId: 'thread-123',
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.addCommunication.mockResolvedValue(addedCommunication);
      notificationService.sendNotification.mockResolvedValue({ success: true });

      // Act
      const result = await disputeResolutionService.addCommunication(disputeId, communicationData);

      // Assert
      expect(result.id).toBe('comm-123');
      expect(result.senderId).toBe('user-456');
      expect(result.recipientId).toBe('owner-789');
      expect(result.type).toBe('offer');
      expect(disputeRepository.addCommunication).toHaveBeenCalledWith(disputeId, communicationData);
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-789',
          type: 'new_communication',
        })
      );
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
      expect(result.readAt).toBeInstanceOf(Date);
      expect(disputeRepository.update).toHaveBeenCalledWith(disputeId, {
        communications: expect.arrayContaining([
          expect.objectContaining({
            id: communicationId,
            read: true,
            readAt: expect.any(Date),
          }),
        ]),
      });
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

      // Act
      const result = await disputeResolutionService.generateCommunicationSummary(disputeId);

      // Assert
      expect(result.totalCommunications).toBe(3);
      expect(result.unreadCommunications).toBe(1);
      expect(result.byType).toEqual({
        offer: 1,
        counter_offer: 1,
        mediation_note: 1,
      });
      expect(result.bySender).toEqual({
        'user-456': 1,
        'owner-789': 1,
        'mediator-123': 1,
      });
      expect(result.averageResponseTime).toBeDefined();
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
      expect(disputeRepository.update).toHaveBeenCalledWith(disputeId, {
        status: 'negotiation_active',
        negotiation: negotiationData,
      });
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

      const resolvedDispute = {
        ...dispute,
        status: 'resolved',
        resolution: resolutionData,
        resolvedAt: new Date(),
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.resolveDispute.mockResolvedValue(resolvedDispute);
      notificationService.sendNotification.mockResolvedValue({ success: true });
      emailService.sendTemplateEmail.mockResolvedValue({ messageId: 'email-123' });

      // Act
      const result = await disputeResolutionService.resolveDispute(disputeId, resolutionData);

      // Assert
      expect(result.status).toBe('resolved');
      expect(result.resolution.resolutionType).toBe('agreement');
      expect(result.resolution.terms).toHaveLength(2);
      expect(result.resolution.terms[0].amount).toBe(35000);
      expect(disputeRepository.resolveDispute).toHaveBeenCalledWith(disputeId, resolutionData);
      expect(notificationService.sendNotification).toHaveBeenCalledTimes(2); // Both parties
    });

    it('should handle dispute dismissal', async () => {
      // Arrange
      const disputeId = 'dispute-dismiss';
      const dismissalData = {
        dismissalReason: 'insufficient_evidence',
        dismissedBy: 'mediator-123',
        dismissalCategory: 'unfounded',
        notes: 'No substantial evidence to support claim',
        allowReopening: false,
      };

      const dispute = {
        id: disputeId,
        status: 'evidence_collection_complete',
        amount: 30000,
      };

      const dismissedDispute = {
        ...dispute,
        status: 'dismissed',
        dismissal: dismissalData,
        dismissedAt: new Date(),
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.resolveDispute.mockResolvedValue(dismissedDispute);
      notificationService.sendNotification.mockResolvedValue({ success: true });

      // Act
      const result = await disputeResolutionService.dismissDispute(disputeId, dismissalData);

      // Assert
      expect(result.status).toBe('dismissed');
      expect(result.dismissal.dismissalReason).toBe('insufficient_evidence');
      expect(result.dismissal.allowReopening).toBe(false);
      expect(disputeRepository.resolveDispute).toHaveBeenCalledWith(disputeId, {
        resolutionType: 'dismissal',
        ...dismissalData,
      });
    });

    it('should implement resolution terms', async () => {
      // Arrange
      const disputeId = 'dispute-implement';
      const implementationData = {
        termId: 'term-123',
        action: 'initiate_payment',
        details: {
          amount: 35000,
          fromUser: 'user-456',
          toUser: 'owner-789',
          paymentMethod: 'escrow',
          reference: 'dispute-resolution-payment',
        },
      };

      const dispute = {
        id: disputeId,
        status: 'resolved',
        resolution: {
          terms: [
            {
              id: 'term-123',
              type: 'financial_compensation',
              amount: 35000,
              responsibleParty: 'renter',
              status: 'pending',
              deadline: new Date('2024-06-20'),
            },
          ],
        },
      };

      const paymentResult = {
        paymentId: 'payment-123',
        status: 'initiated',
        amount: 35000,
        escrowReleased: false,
        expectedCompletion: new Date('2024-06-18'),
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      paymentRepository.processPayout.mockResolvedValue(paymentResult);
      disputeRepository.update.mockResolvedValue({});

      // Act
      const result = await disputeResolutionService.implementResolutionTerm(disputeId, implementationData);

      // Assert
      expect(result.paymentId).toBe('payment-123');
      expect(result.status).toBe('initiated');
      expect(result.amount).toBe(35000);
      expect(paymentRepository.processPayout).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 35000,
          fromUser: 'user-456',
          toUser: 'owner-789',
        })
      );
      expect(disputeRepository.update).toHaveBeenCalledWith(disputeId, {
        resolution: expect.objectContaining({
          terms: expect.arrayContaining([
            expect.objectContaining({
              id: 'term-123',
              status: 'in_progress',
              implementation: expect.any(Object),
            }),
          ]),
        }),
      });
    });

    it('should track resolution compliance', async () => {
      // Arrange
      const disputeId = 'dispute-compliance';
      const dispute = {
        id: disputeId,
        status: 'resolved',
        resolvedAt: new Date('2024-06-01'),
        resolution: {
          terms: [
            {
              id: 'term-1',
              type: 'financial_compensation',
              status: 'completed',
              completedAt: new Date('2024-06-05'),
            },
            {
              id: 'term-2',
              type: 'future_restrictions',
              status: 'active',
              deadline: new Date('2024-12-01'),
            },
            {
              id: 'term-3',
              type: 'public_apology',
              status: 'overdue',
              deadline: new Date('2024-06-10'),
            },
          ],
        },
      };

      disputeRepository.findById.mockResolvedValue(dispute);

      // Act
      const result = await disputeResolutionService.checkResolutionCompliance(disputeId);

      // Assert
      expect(result.overallCompliance).toBe('partial');
      expect(result.completedTerms).toBe(1);
      expect(result.activeTerms).toBe(1);
      expect(result.overdueTerms).toBe(1);
      expect(result.complianceRate).toBe(33.33); // 1 out of 3
      expect(result.alerts).toContainEqual(
        expect.objectContaining({
          type: 'overdue_term',
          termId: 'term-3',
          severity: 'high',
        })
      );
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
        status: 'mediation_failed',
        currentLevel: 'mediation',
        amount: 75000, // High amount justifies escalation
      };

      const escalatedDispute = {
        ...dispute,
        status: 'escalated',
        currentLevel: 'arbitration',
        escalation: {
          ...escalationData,
          escalatedAt: new Date(),
          escalatedBy: 'system',
          caseNumber: 'ARB-2024-001',
        },
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.escalateDispute.mockResolvedValue(escalatedDispute);
      notificationService.sendNotification.mockResolvedValue({ success: true });

      // Act
      const result = await disputeResolutionService.escalateDispute(disputeId, escalationData);

      // Assert
      expect(result.status).toBe('escalated');
      expect(result.currentLevel).toBe('arbitration');
      expect(result.escalation.caseNumber).toBe('ARB-2024-001');
      expect(disputeRepository.escalateDispute).toHaveBeenCalledWith(disputeId, escalationData);
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dispute_escalated',
        })
      );
    });

    it('should process appeal request', async () => {
      // Arrange
      const disputeId = 'dispute-appeal';
      const appealData = {
        appealedBy: 'user-456',
        appealReason: 'procedural_error',
        appealType: 'reconsideration',
        grounds: [
          'mediator_bias_detected',
          'evidence_not_properly_considered',
        ],
        supportingDocuments: ['appeal-doc-1.pdf'],
        requestedOutcome: 'new_mediation_session',
      };

      const dispute = {
        id: disputeId,
        status: 'resolved',
        resolvedAt: new Date('2024-05-15'),
        resolution: {
          resolutionType: 'agreement',
          terms: [
            {
              type: 'financial_compensation',
              amount: 40000,
              responsibleParty: 'renter',
            },
          ],
        },
      };

      const appeal = {
        id: 'appeal-123',
        ...appealData,
        status: 'submitted',
        submittedAt: new Date(),
        referenceNumber: 'APPEAL-2024-001',
        deadline: new Date('2024-06-15'), // 30 days from resolution
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.update.mockResolvedValue({ appeal });
      notificationService.sendNotification.mockResolvedValue({ success: true });

      // Act
      const result = await disputeResolutionService.submitAppeal(disputeId, appealData);

      // Assert
      expect(result.id).toBe('appeal-123');
      expect(result.status).toBe('submitted');
      expect(result.referenceNumber).toBe('APPEAL-2024-001');
      expect(disputeRepository.update).toHaveBeenCalledWith(disputeId, {
        status: 'appeal_submitted',
        appeal,
      });
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
        status: 'appeal_submitted',
        appeal: {
          id: 'appeal-123',
          status: 'under_review',
        },
      };

      const updatedDispute = {
        ...dispute,
        status: 'appeal_granted',
        appeal: {
          ...dispute.appeal,
          ...appealDecision,
          status: 'decided',
        },
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.update.mockResolvedValue(updatedDispute);
      notificationService.sendNotification.mockResolvedValue({ success: true });

      // Act
      const result = await disputeResolutionService.reviewAppeal(disputeId, appealDecision);

      // Assert
      expect(result.status).toBe('appeal_granted');
      expect(result.appeal.decision).toBe('granted');
      expect(result.appeal.newResolution.type).toBe('new_mediation');
      expect(disputeRepository.update).toHaveBeenCalledWith(disputeId, updatedDispute);
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'appeal_decision',
        })
      );
    });

    it('should validate appeal timing and eligibility', async () => {
      // Arrange
      const disputeId = 'dispute-appeal-invalid';
      const appealData = {
        appealedBy: 'user-456',
        appealReason: 'disagree_with_outcome',
        appealType: 'reconsideration',
      };

      const oldDispute = {
        id: disputeId,
        status: 'resolved',
        resolvedAt: new Date('2024-04-01'), // More than 30 days ago
        resolution: {
          resolutionType: 'dismissal',
        },
      };

      disputeRepository.findById.mockResolvedValue(oldDispute);
      configService.get.mockReturnValue(30); // 30 days appeal window

      // Act & Assert
      await expect(disputeResolutionService.submitAppeal(disputeId, appealData)).rejects.toThrow('Appeal period expired');
      expect(disputeRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('Audit and Compliance', () => {
    it('should generate dispute audit trail', async () => {
      // Arrange
      const disputeId = 'dispute-audit';
      const auditConfig = {
        includeAllActions: true,
        includeCommunications: true,
        includeEvidence: true,
        format: 'detailed',
      };

      const dispute = {
        id: disputeId,
        createdAt: new Date('2024-05-01'),
        status: 'resolved',
        resolvedAt: new Date('2024-06-01'),
        auditLog: [
          {
            action: 'dispute_initiated',
            timestamp: new Date('2024-05-01T10:00:00Z'),
            userId: 'user-456',
            details: { disputeType: 'property_damage' },
          },
          {
            action: 'evidence_added',
            timestamp: new Date('2024-05-02T14:30:00Z'),
            userId: 'user-456',
            details: { evidenceType: 'photo', evidenceId: 'evidence-1' },
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
        ],
      };

      disputeRepository.findById.mockResolvedValue(dispute);
      disputeRepository.auditDispute.mockResolvedValue(dispute.auditLog);

      // Act
      const result = await disputeResolutionService.generateAuditTrail(disputeId, auditConfig);

      // Assert
      expect(result.disputeId).toBe(disputeId);
      expect(result.totalActions).toBe(4);
      expect(result.timeline).toHaveLength(4);
      expect(result.timeline[0].action).toBe('dispute_initiated');
      expect(result.timeline[3].action).toBe('dispute_resolved');
      expect(result.duration).toBe(31); // days from initiation to resolution
      expect(result.complianceScore).toBeDefined();
    });

    it('should check compliance with SLA requirements', async () => {
      // Arrange
      const disputeId = 'dispute-sla';
      const dispute = {
        id: disputeId,
        createdAt: new Date('2024-05-01'),
        status: 'resolved',
        resolvedAt: new Date('2024-06-01'),
        amount: 50000,
        disputeType: 'property_damage',
        severity: 'medium',
        milestones: {
          evidence_collection: {
            started: new Date('2024-05-01'),
            completed: new Date('2024-05-07'),
            sla: 7, // days
            met: true,
          },
          mediation: {
            started: new Date('2024-05-15'),
            completed: new Date('2024-05-20'),
            sla: 14, // days
            met: true,
          },
          resolution: {
            started: new Date('2024-05-01'),
            completed: new Date('2024-06-01'),
            sla: 45, // days
            met: true,
          },
        },
      };

      disputeRepository.findById.mockResolvedValue(dispute);

      // Act
      const result = await disputeResolutionService.checkSLACompliance(disputeId);

      // Assert
      expect(result.overallCompliance).toBe(true);
      expect(result.complianceScore).toBe(100);
      expect(result.milestonesEvidence).toBe(true);
      expect(result.milestonesMediation).toBe(true);
      expect(result.milestonesResolution).toBe(true);
      expect(result.totalResolutionTime).toBe(31); // days
      expect(result.slaTarget).toBe(45); // days
    });

    it('should generate compliance reports', async () => {
      // Arrange
      const reportConfig = {
        period: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-06-30'),
        },
        includeMetrics: ['resolution_time', 'compliance_rate', 'satisfaction'],
        format: 'executive_summary',
      };

      const complianceReport = {
        period: reportConfig.period,
        summary: {
          totalDisputes: 150,
          resolvedDisputes: 120,
          complianceRate: 93.3,
          averageResolutionTime: 18.5, // days
          satisfactionScore: 4.2, // out of 5
        },
        metrics: {
          resolutionTime: {
            average: 18.5,
            median: 15,
            p95: 45,
            slaCompliance: 87.3,
          },
          compliance: {
            overall: 93.3,
            byCategory: {
              'property_damage': 95.2,
              'payment_issues': 91.8,
              'service_quality': 92.5,
            },
            bySeverity: {
              low: 98.5,
              medium: 94.2,
              high: 85.3,
            },
          },
          satisfaction: {
            overall: 4.2,
            byResolutionType: {
              agreement: 4.5,
              dismissal: 3.8,
              escalation: 3.9,
            },
          },
        },
        trends: {
          resolutionTime: 'improving',
          complianceRate: 'stable',
          satisfaction: 'increasing',
        },
        recommendations: [
          {
            priority: 'high',
            area: 'high_severity_disputes',
            action: 'assign_experienced_mediators',
            expectedImpact: 'reduce_resolution_time_by_20_percent',
          },
        ],
      };

      disputeRepository.getDisputeStats.mockResolvedValue(complianceReport);

      // Act
      const result = await disputeResolutionService.generateComplianceReport(reportConfig);

      // Assert
      expect(result.summary.totalDisputes).toBe(150);
      expect(result.summary.complianceRate).toBe(93.3);
      expect(result.metrics.resolutionTime.average).toBe(18.5);
      expect(result.metrics.compliance.byCategory.property_damage).toBe(95.2);
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].priority).toBe('high');
    });
  });
});
