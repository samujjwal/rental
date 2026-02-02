import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { DisputeStatus, DisputeType } from '@rental-portal/database';

describe('Disputes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  // Test user tokens
  let renterToken: string;
  let renterUserId: string;
  let ownerToken: string;
  let ownerUserId: string;
  let adminToken: string;
  let adminUserId: string;
  
  // Test entities
  let testListingId: string;
  let testBookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.dispute.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.listing.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['dispute_renter@test.com', 'dispute_owner@test.com', 'dispute_admin@test.com'],
        },
      },
    });

    // Create test users
    const renterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'dispute_renter@test.com',
        password: 'TestPass123!',
        firstName: 'Test',
        lastName: 'Renter',
        role: 'USER',
      });
    renterToken = renterRes.body.accessToken;
    renterUserId = renterRes.body.user.id;

    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'dispute_owner@test.com',
        password: 'TestPass123!',
        firstName: 'Test',
        lastName: 'Owner',
        role: 'HOST',
      });
    ownerToken = ownerRes.body.accessToken;
    ownerUserId = ownerRes.body.user.id;

    const adminRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'dispute_admin@test.com',
        password: 'TestPass123!',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'ADMIN',
      });
    adminToken = adminRes.body.accessToken;
    adminUserId = adminRes.body.user.id;

    // Create test listing
    const listing = await prisma.listing.create({
      data: {
        title: 'Test Property for Disputes',
        description: 'Test property',
        ownerId: ownerUserId,
        categoryId: (await prisma.category.findFirst())?.id || 'default-category',
        basePrice: 100,
        currency: 'USD',
        status: 'AVAILABLE',
        bookingMode: 'INSTANT_BOOK',
      },
    });
    testListingId = listing.id;

    // Create completed test booking
    const booking = await prisma.booking.create({
      data: {
        renterId: renterUserId,
        listingId: testListingId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-05'),
        status: 'COMPLETED',
        basePrice: 100,
        totalPrice: 400,
        totalAmount: 400,
        platformFee: 60,
        serviceFee: 20,
        currency: 'USD',
      },
    });
    testBookingId = booking.id;
  });

  describe('POST /disputes', () => {
    it('should create dispute as renter for property damage', async () => {
      const res = await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          type: DisputeType.PROPERTY_DAMAGE,
          description: 'Property had significant damage that was not disclosed',
          requestedAmount: 150,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.type).toBe(DisputeType.PROPERTY_DAMAGE);
      expect(res.body.initiatorId).toBe(renterUserId);
      expect(res.body.defendantId).toBe(ownerUserId);
      expect(res.body.status).toBe(DisputeStatus.OPEN);
      expect(res.body.requestedAmount).toBe(150);
    });

    it('should create dispute as owner for guest damage', async () => {
      const res = await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          bookingId: testBookingId,
          type: DisputeType.GUEST_DAMAGE,
          description: 'Guest damaged the property during stay',
          requestedAmount: 250,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.type).toBe(DisputeType.GUEST_DAMAGE);
      expect(res.body.initiatorId).toBe(ownerUserId);
      expect(res.body.defendantId).toBe(renterUserId);
      expect(res.body.status).toBe(DisputeStatus.OPEN);
    });

    it('should reject dispute from unauthorized user', async () => {
      // Create another user who has no connection to the booking
      const unauthorizedRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'unauthorized@test.com',
          password: 'TestPass123!',
          firstName: 'Unauthorized',
          lastName: 'User',
          role: 'USER',
        });

      await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${unauthorizedRes.body.accessToken}`)
        .send({
          bookingId: testBookingId,
          type: DisputeType.PROPERTY_DAMAGE,
          description: 'Test',
          requestedAmount: 100,
        })
        .expect(403);
    });

    it('should reject duplicate active dispute for same booking', async () => {
      // Create first dispute
      await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          type: DisputeType.PROPERTY_DAMAGE,
          description: 'First dispute',
          requestedAmount: 100,
        })
        .expect(201);

      // Try to create second dispute for same booking
      await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          type: DisputeType.REFUND_ISSUE,
          description: 'Second dispute',
          requestedAmount: 50,
        })
        .expect(400);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          // Missing type
          description: 'Test',
        })
        .expect(400);
    });

    it('should reject negative requested amount', async () => {
      await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          type: DisputeType.PROPERTY_DAMAGE,
          description: 'Test',
          requestedAmount: -50,
        })
        .expect(400);
    });

    it('should reject dispute for non-completed booking', async () => {
      const pendingBooking = await prisma.booking.create({
        data: {
          renterId: renterUserId,
          listingId: testListingId,
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-02-05'),
          status: 'PENDING_PAYMENT',
          basePrice: 100,
          totalPrice: 400,
          totalAmount: 400,
          platformFee: 60,
          serviceFee: 20,
          currency: 'USD',
        },
      });

      await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: pendingBooking.id,
          type: DisputeType.PROPERTY_DAMAGE,
          description: 'Test',
          requestedAmount: 100,
        })
        .expect(400);
    });
  });

  describe('POST /disputes/:id/evidence', () => {
    let disputeId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          type: DisputeType.PROPERTY_DAMAGE,
          description: 'Test dispute',
          requestedAmount: 100,
        });
      disputeId = res.body.id;
    });

    it('should add evidence to dispute by initiator', async () => {
      const res = await request(app.getHttpServer())
        .post(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          description: 'Photo of damage',
          fileUrl: 'https://example.com/damage-photo.jpg',
          fileType: 'IMAGE',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.description).toBe('Photo of damage');
      expect(res.body.fileUrl).toBe('https://example.com/damage-photo.jpg');
    });

    it('should add evidence to dispute by defendant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          description: 'Photo showing no damage',
          fileUrl: 'https://example.com/no-damage.jpg',
          fileType: 'IMAGE',
        })
        .expect(201);

      expect(res.body.description).toBe('Photo showing no damage');
    });

    it('should reject evidence from unauthorized user', async () => {
      const unauthorizedRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'unauthorized2@test.com',
          password: 'TestPass123!',
          firstName: 'Unauthorized',
          lastName: 'User',
          role: 'USER',
        });

      await request(app.getHttpServer())
        .post(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${unauthorizedRes.body.accessToken}`)
        .send({
          description: 'Test',
          fileUrl: 'https://example.com/test.jpg',
          fileType: 'IMAGE',
        })
        .expect(403);
    });

    it('should validate file type', async () => {
      await request(app.getHttpServer())
        .post(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          description: 'Test',
          fileUrl: 'https://example.com/test.jpg',
          fileType: 'INVALID_TYPE',
        })
        .expect(400);
    });
  });

  describe('POST /disputes/:id/responses', () => {
    let disputeId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          type: DisputeType.PROPERTY_DAMAGE,
          description: 'Test dispute',
          requestedAmount: 100,
        });
      disputeId = res.body.id;
    });

    it('should add response to dispute by defendant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/disputes/${disputeId}/responses`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          message: 'I disagree with this claim',
          offerAmount: 50,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.message).toBe('I disagree with this claim');
      expect(res.body.offerAmount).toBe(50);
      expect(res.body.responderId).toBe(ownerUserId);
    });

    it('should add response by initiator (counter-response)', async () => {
      // First, defendant responds
      await request(app.getHttpServer())
        .post(`/disputes/${disputeId}/responses`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          message: 'Defendant response',
          offerAmount: 50,
        });

      // Then, initiator responds
      const res = await request(app.getHttpServer())
        .post(`/disputes/${disputeId}/responses`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          message: 'Counter-offer response',
          offerAmount: 75,
        })
        .expect(201);

      expect(res.body.responderId).toBe(renterUserId);
    });

    it('should reject response from unauthorized user', async () => {
      const unauthorizedRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'unauthorized3@test.com',
          password: 'TestPass123!',
          firstName: 'Unauthorized',
          lastName: 'User',
          role: 'USER',
        });

      await request(app.getHttpServer())
        .post(`/disputes/${disputeId}/responses`)
        .set('Authorization', `Bearer ${unauthorizedRes.body.accessToken}`)
        .send({
          message: 'Test',
        })
        .expect(403);
    });

    it('should update dispute timeline on response', async () => {
      await request(app.getHttpServer())
        .post(`/disputes/${disputeId}/responses`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          message: 'Test response',
        })
        .expect(201);

      const dispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
        include: { responses: true },
      });

      expect(dispute?.responses).toHaveLength(1);
    });
  });

  describe('PATCH /disputes/:id/status (Admin)', () => {
    let disputeId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          type: DisputeType.PROPERTY_DAMAGE,
          description: 'Test dispute',
          requestedAmount: 100,
        });
      disputeId = res.body.id;
    });

    it('should update dispute status as admin', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/disputes/${disputeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: DisputeStatus.UNDER_REVIEW,
        })
        .expect(200);

      expect(res.body.status).toBe(DisputeStatus.UNDER_REVIEW);
    });

    it('should reject status update from non-admin', async () => {
      await request(app.getHttpServer())
        .patch(`/disputes/${disputeId}/status`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          status: DisputeStatus.UNDER_REVIEW,
        })
        .expect(403);
    });

    it('should resolve dispute with resolution details', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/disputes/${disputeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: DisputeStatus.RESOLVED,
          resolution: 'Partial refund approved',
          resolvedAmount: 75,
        })
        .expect(200);

      expect(res.body.status).toBe(DisputeStatus.RESOLVED);
      expect(res.body.resolution).toBe('Partial refund approved');
      expect(res.body.resolvedAmount).toBe(75);
      expect(res.body.resolvedAt).toBeDefined();
      expect(res.body.resolvedBy).toBe(adminUserId);
    });

    it('should validate status transitions', async () => {
      // Move to resolved
      await request(app.getHttpServer())
        .patch(`/disputes/${disputeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: DisputeStatus.RESOLVED,
          resolution: 'Test',
        })
        .expect(200);

      // Try to move back to open (invalid transition)
      await request(app.getHttpServer())
        .patch(`/disputes/${disputeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: DisputeStatus.OPEN,
        })
        .expect(400);
    });
  });

  describe('GET /disputes', () => {
    beforeEach(async () => {
      // Create multiple disputes
      await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          type: DisputeType.PROPERTY_DAMAGE,
          description: 'Dispute 1',
          requestedAmount: 100,
        });

      // Create another booking and dispute
      const booking2 = await prisma.booking.create({
        data: {
          renterId: renterUserId,
          listingId: testListingId,
          startDate: new Date('2026-01-10'),
          endDate: new Date('2026-01-15'),
          status: 'COMPLETED',
          basePrice: 125,
          totalPrice: 500,
          totalAmount: 500,
          platformFee: 75,
          serviceFee: 25,
          currency: 'USD',
        },
      });

      await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          bookingId: booking2.id,
          type: DisputeType.GUEST_DAMAGE,
          description: 'Dispute 2',
          requestedAmount: 200,
        });
    });

    it('should list disputes for renter', async () => {
      const res = await request(app.getHttpServer())
        .get('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should list disputes for owner', async () => {
      const res = await request(app.getHttpServer())
        .get('/disputes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should filter disputes by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/disputes?status=OPEN')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(res.body.data.every((d: any) => d.status === 'OPEN')).toBe(true);
    });

    it('should paginate results', async () => {
      const res = await request(app.getHttpServer())
        .get('/disputes?page=1&limit=1')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination.limit).toBe(1);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });

    it('should list all disputes for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/disputes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Admin should see all disputes
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /disputes/:id', () => {
    let disputeId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          bookingId: testBookingId,
          type: DisputeType.PROPERTY_DAMAGE,
          description: 'Test dispute',
          requestedAmount: 100,
        });
      disputeId = res.body.id;

      // Add evidence and response
      await request(app.getHttpServer())
        .post(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          description: 'Evidence',
          fileUrl: 'https://example.com/test.jpg',
          fileType: 'IMAGE',
        });

      await request(app.getHttpServer())
        .post(`/disputes/${disputeId}/responses`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          message: 'Response',
        });
    });

    it('should get dispute details as initiator', async () => {
      const res = await request(app.getHttpServer())
        .get(`/disputes/${disputeId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(res.body.id).toBe(disputeId);
      expect(res.body).toHaveProperty('evidence');
      expect(res.body).toHaveProperty('responses');
      expect(res.body.evidence.length).toBeGreaterThan(0);
      expect(res.body.responses.length).toBeGreaterThan(0);
    });

    it('should get dispute details as defendant', async () => {
      const res = await request(app.getHttpServer())
        .get(`/disputes/${disputeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.id).toBe(disputeId);
    });

    it('should get dispute details as admin', async () => {
      const res = await request(app.getHttpServer())
        .get(`/disputes/${disputeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(disputeId);
    });

    it('should reject unauthorized user', async () => {
      const unauthorizedRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'unauthorized4@test.com',
          password: 'TestPass123!',
          firstName: 'Unauthorized',
          lastName: 'User',
          role: 'USER',
        });

      await request(app.getHttpServer())
        .get(`/disputes/${disputeId}`)
        .set('Authorization', `Bearer ${unauthorizedRes.body.accessToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent dispute', async () => {
      await request(app.getHttpServer())
        .get('/disputes/non-existent-id')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(404);
    });
  });
});
