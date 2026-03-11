/**
 * Comprehensive Dispute Resolution E2E Tests
 * 
 * These tests verify the complete dispute resolution workflow:
 * 1. Dispute initiation
 * 2. Evidence submission
 * 3. Admin review
 * 4. Resolution and payout
 * 5. Communication throughout
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BookingStatus, DisputeStatus } from '@rental-portal/database';

describe('🚨 Dispute Resolution E2E Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let renterAccessToken: string;
  let ownerAccessToken: string;
  let adminAccessToken: string;
  let testBooking: any;
  let testDispute: any;

  // Test data
  const testUsers = {
    renter: {
      email: `dispute-renter-${Date.now()}@test.com`,
      password: 'Test123!',
      firstName: 'Test',
      lastName: 'Renter',
    },
    owner: {
      email: `dispute-owner-${Date.now()}@test.com`,
      password: 'Test123!',
      firstName: 'Test',
      lastName: 'Owner',
    },
    admin: {
      email: `dispute-admin-${Date.now()}@test.com`,
      password: 'Test123!',
      firstName: 'Test',
      lastName: 'Admin',
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Setup test users and authenticate
    await setupTestUsers();
    
    // Create a test booking in COMPLETED status (eligible for dispute)
    testBooking = await createTestBooking();
  });

  afterEach(async () => {
    // Cleanup disputes after each test
    if (testDispute) {
      await prisma.dispute.deleteMany({
        where: { bookingId: testBooking.id },
      });
      testDispute = null;
    }
  });

  describe('Dispute Initiation Flow', () => {
    it('POST /disputes → 201 (Renter initiates dispute)', async () => {
      const disputeData = {
        bookingId: testBooking.id,
        reason: 'PROPERTY_DAMAGE',
        description: 'The property was damaged during the rental period',
        requestedAmount: 50000, // $500.00 in cents
        evidence: [
          {
            type: 'PHOTO',
            url: 'https://example.com/damage-photo.jpg',
            description: 'Photo of damaged wall',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send(disputeData)
        .expect(201);

      testDispute = response.body;

      expect(testDispute).toMatchObject({
        bookingId: testBooking.id,
        reason: 'PROPERTY_DAMAGE',
        status: DisputeStatus.PENDING_REVIEW,
        requestedAmount: 50000,
      });

      // Verify booking status is updated
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: testBooking.id },
      });
      expect(updatedBooking.status).toBe(BookingStatus.DISPUTED);
    });

    it('POST /disputes → 400 (Invalid dispute window)', async () => {
      // Create a booking that's too old for dispute
      const oldBooking = await createOldBooking();

      const disputeData = {
        bookingId: oldBooking.id,
        reason: 'PROPERTY_DAMAGE',
        description: 'Test dispute',
        requestedAmount: 50000,
      };

      await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send(disputeData)
        .expect(400);
    });

    it('POST /disputes → 403 (Unauthorized user)', async () => {
      const disputeData = {
        bookingId: testBooking.id,
        reason: 'PROPERTY_DAMAGE',
        description: 'Test dispute',
        requestedAmount: 50000,
      };

      // Owner tries to initiate dispute (should fail)
      await request(app.getHttpServer())
        .post('/disputes')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send(disputeData)
        .expect(403);
    });
  });

  describe('Evidence Management', () => {
    beforeEach(async () => {
      // Create a dispute for evidence tests
      testDispute = await createTestDispute();
    });

    it('POST /disputes/:id/evidence → 201 (Add evidence)', async () => {
      const evidenceData = {
        type: 'VIDEO',
        url: 'https://example.com/evidence-video.mp4',
        description: 'Video evidence of damage',
      };

      const response = await request(app.getHttpServer())
        .post(`/disputes/${testDispute.id}/evidence`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send(evidenceData)
        .expect(201);

      expect(response.body).toMatchObject({
        disputeId: testDispute.id,
        type: 'VIDEO',
        url: 'https://example.com/evidence-video.mp4',
      });
    });

    it('GET /disputes/:id/evidence → 200 (List evidence)', async () => {
      await request(app.getHttpServer())
        .get(`/disputes/${testDispute.id}/evidence`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);
    });
  });

  describe('Admin Review Process', () => {
    beforeEach(async () => {
      testDispute = await createTestDispute();
    });

    it('PATCH /admin/disputes/:id/assign → 200 (Assign to admin)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/admin/disputes/${testDispute.id}/assign`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ adminId: testUsers.admin.id })
        .expect(200);

      expect(response.body.assignedToId).toBe(testUsers.admin.id);
    });

    it('PATCH /admin/disputes/:id/resolve → 200 (Resolve dispute)', async () => {
      // First assign the dispute
      await request(app.getHttpServer())
        .patch(`/admin/disputes/${testDispute.id}/assign`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ adminId: testUsers.admin.id });

      // Then resolve it
      const resolutionData = {
        decision: 'PARTIAL_REFUND',
        refundAmount: 25000, // $250.00
        reason: 'Partial responsibility - evidence supports some damage',
        notes: 'Photos show wall damage but some pre-existing wear noted',
      };

      const response = await request(app.getHttpServer())
        .patch(`/admin/disputes/${testDispute.id}/resolve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(resolutionData)
        .expect(200);

      expect(response.body.status).toBe(DisputeStatus.RESOLVED);
      expect(response.body.decision).toBe('PARTIAL_REFUND');
      expect(response.body.refundAmount).toBe(25000);
    });

    it('PATCH /admin/disputes/:id/reject → 200 (Reject dispute)', async () => {
      const rejectionData = {
        reason: 'INSUFFICIENT_EVIDENCE',
        notes: 'No clear evidence of property damage',
      };

      const response = await request(app.getHttpServer())
        .patch(`/admin/disputes/${testDispute.id}/reject`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(rejectionData)
        .expect(200);

      expect(response.body.status).toBe(DisputeStatus.REJECTED);
    });
  });

  describe('Communication Flow', () => {
    beforeEach(async () => {
      testDispute = await createTestDispute();
    });

    it('POST /disputes/:id/messages → 201 (Send message)', async () => {
      const messageData = {
        content: 'I would like to provide additional evidence',
        type: 'TEXT',
      };

      const response = await request(app.getHttpServer())
        .post(`/disputes/${testDispute.id}/messages`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send(messageData)
        .expect(201);

      expect(response.body).toMatchObject({
        disputeId: testDispute.id,
        content: 'I would like to provide additional evidence',
        senderId: testUsers.renter.id,
      });
    });

    it('GET /disputes/:id/messages → 200 (Get message history)', async () => {
      // Send a test message first
      await request(app.getHttpServer())
        .post(`/disputes/${testDispute.id}/messages`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .send({
          content: 'Test message',
          type: 'TEXT',
        });

      const response = await request(app.getHttpServer())
        .get(`/disputes/${testDispute.id}/messages`)
        .set('Authorization', `Bearer ${renterAccessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Payout Processing', () => {
    beforeEach(async () => {
      testDispute = await createTestDispute();
    });

    it('POST /disputes/:id/payout → 200 (Process refund)', async () => {
      // Resolve the dispute first
      await request(app.getHttpServer())
        .patch(`/admin/disputes/${testDispute.id}/resolve`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          decision: 'FULL_REFUND',
          refundAmount: 50000,
          reason: 'Evidence supports full refund',
        });

      const payoutData = {
        amount: 50000,
        currency: 'USD',
        method: 'STRIPE_TRANSFER',
      };

      const response = await request(app.getHttpServer())
        .post(`/disputes/${testDispute.id}/payout`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payoutData)
        .expect(200);

      expect(response.body).toMatchObject({
        disputeId: testDispute.id,
        amount: 50000,
        currency: 'USD',
        status: 'PROCESSING',
      });
    });
  });

  // Helper functions
  async function setupTestUsers() {
    // Create and authenticate renter
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUsers.renter);

    const renterLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUsers.renter.email,
        password: testUsers.renter.password,
      });

    renterAccessToken = renterLogin.body.accessToken;

    // Create and authenticate owner
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUsers.owner);

    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUsers.owner.email,
        password: testUsers.owner.password,
      });

    ownerAccessToken = ownerLogin.body.accessToken;

    // Create and authenticate admin
    await prisma.user.update({
      where: { email: testUsers.admin.email },
      data: { role: 'ADMIN' },
    });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUsers.admin);

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUsers.admin.email,
        password: testUsers.admin.password,
      });

    adminAccessToken = adminLogin.body.accessToken;
  }

  async function createTestBooking() {
    // Create a test listing
    const listing = await prisma.listing.create({
      data: {
        title: 'Test Listing for Dispute',
        slug: `test-listing-${Date.now()}`,
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US',
        ownerId: testUsers.owner.id,
        status: 'AVAILABLE',
        pricePerNight: 10000, // $100.00 in cents
      },
    });

    // Create a completed booking
    const booking = await prisma.booking.create({
      data: {
        listingId: listing.id,
        renterId: testUsers.renter.id,
        ownerId: testUsers.owner.id,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        endDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        totalPrice: 30000, // $300.00
        status: BookingStatus.COMPLETED,
        completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      },
    });

    return booking;
  }

  async function createOldBooking() {
    // Create a booking that's too old for dispute (more than 30 days)
    const listing = await prisma.listing.findFirst();
    
    return await prisma.booking.create({
      data: {
        listingId: listing!.id,
        renterId: testUsers.renter.id,
        ownerId: testUsers.owner.id,
        startDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000),
        totalPrice: 30000,
        status: BookingStatus.COMPLETED,
        completedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async function createTestDispute() {
    const dispute = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${renterAccessToken}`)
      .send({
        bookingId: testBooking.id,
        reason: 'PROPERTY_DAMAGE',
        description: 'Test dispute for E2E testing',
        requestedAmount: 50000,
      });

    return dispute.body;
  }

  async function cleanupTestData() {
    const emails = Object.values(testUsers).map(user => user.email);
    
    await prisma.dispute.deleteMany({
      where: {
        booking: {
          renter: { email: { in: emails } },
        },
      },
    });

    await prisma.booking.deleteMany({
      where: {
        renter: { email: { in: emails } },
      },
    });

    await prisma.listing.deleteMany({
      where: {
        owner: { email: { in: emails } },
      },
    });

    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
  }
});
