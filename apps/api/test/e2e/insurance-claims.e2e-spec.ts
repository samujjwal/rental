/**
 * P1: Insurance Claims E2E Workflow Tests
 *
 * Comprehensive E2E coverage for insurance claims workflow:
 * - File a claim
 * - Upload supporting documents
 * - Review and approval process
 * - Payout processing
 * - Claim status tracking
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { randomUUID } from 'crypto';

describe('Insurance Claims E2E Workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data
  let renterToken: string;
  let adminToken: string;
  let testBookingId: string;
  let testListingId: string;
  let testPolicyId: string;
  let testClaimId: string;
  let renterId: string;
  let ownerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();

    // Clean up any existing test data
    await cleanupTestData();

    // Create test users
    const renter = await createTestUser('renter');
    renterId = renter.id;
    renterToken = renter.token;

    const owner = await createTestUser('owner');
    ownerId = owner.id;

    // Create admin user
    const admin = await createTestUser('admin');
    adminToken = admin.token;

    // Create test listing
    testListingId = await createTestListing(ownerId);

    // Create test booking with insurance
    testBookingId = await createTestBooking(renterId, ownerId, testListingId);

    // Create insurance policy
    testPolicyId = await createTestPolicy(renterId, testBookingId);
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  describe('Claim Filing Workflow', () => {
    it('should allow renter to file a damage claim', async () => {
      const claimData = {
        policyId: testPolicyId,
        bookingId: testBookingId,
        type: 'DAMAGE',
        description: 'Broken window during rental period',
        amount: 15000, // NPR
        incidentDate: new Date().toISOString(),
        items: [
          {
            item: 'Window glass',
            description: 'Main bedroom window shattered',
            estimatedValue: 15000,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/insurance/claims')
        .set('Authorization', `Bearer ${renterToken}`)
        .send(claimData)
        .expect(201);

      // Validate response structure
      expect(response.body).toMatchObject({
        id: expect.any(String),
        policyId: testPolicyId,
        bookingId: testBookingId,
        type: 'DAMAGE',
        description: claimData.description,
        amount: claimData.amount,
        status: 'PENDING_REVIEW',
        submittedAt: expect.any(String),
      });

      testClaimId = response.body.id;

      // Verify claim in database
      const claimInDb = await prisma.insuranceClaim.findUnique({
        where: { id: testClaimId },
      });

      expect(claimInDb).not.toBeNull();
      expect(claimInDb?.status).toBe('PENDING_REVIEW');
      expect(claimInDb?.amount).toBe(15000);
    });

    it('should reject claim filing without valid policy', async () => {
      const invalidClaim = {
        policyId: 'invalid-policy-id',
        bookingId: testBookingId,
        type: 'DAMAGE',
        description: 'Test claim',
        amount: 5000,
      };

      await request(app.getHttpServer())
        .post('/insurance/claims')
        .set('Authorization', `Bearer ${renterToken}`)
        .send(invalidClaim)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('Policy not found');
        });
    });

    it('should reject claim with amount exceeding policy coverage', async () => {
      const excessiveClaim = {
        policyId: testPolicyId,
        bookingId: testBookingId,
        type: 'DAMAGE',
        description: 'Excessive damage claim',
        amount: 1000000, // Exceeds coverage
      };

      await request(app.getHttpServer())
        .post('/insurance/claims')
        .set('Authorization', `Bearer ${renterToken}`)
        .send(excessiveClaim)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('exceeds coverage');
        });
    });
  });

  describe('Document Upload Workflow', () => {
    it('should allow uploading supporting documents', async () => {
      // Create a claim first if not exists
      if (!testClaimId) {
        throw new Error('Test claim must be created before document upload test');
      }

      const documentData = {
        claimId: testClaimId,
        type: 'PHOTO',
        description: 'Photo of broken window',
        fileName: 'broken-window.jpg',
        fileSize: 1024000,
        mimeType: 'image/jpeg',
      };

      const response = await request(app.getHttpServer())
        .post(`/insurance/claims/${testClaimId}/documents`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send(documentData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        claimId: testClaimId,
        type: 'PHOTO',
        description: documentData.description,
        fileName: documentData.fileName,
        status: 'PENDING_UPLOAD',
      });
    });

    it('should allow multiple document uploads', async () => {
      const documents = [
        { type: 'POLICE_REPORT', description: 'Police report', fileName: 'police-report.pdf' },
        { type: 'RECEIPT', description: 'Repair estimate', fileName: 'estimate.pdf' },
        { type: 'PHOTO', description: 'Additional photo', fileName: 'photo2.jpg' },
      ];

      for (const doc of documents) {
        await request(app.getHttpServer())
          .post(`/insurance/claims/${testClaimId}/documents`)
          .set('Authorization', `Bearer ${renterToken}`)
          .send({
            claimId: testClaimId,
            ...doc,
            fileSize: 500000,
            mimeType: doc.fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          })
          .expect(201);
      }

      // Verify all documents are associated with claim
      const claimWithDocs = await prisma.insuranceClaim.findUnique({
        where: { id: testClaimId },
        include: { documents: true },
      });

      expect(claimWithDocs?.documents).toHaveLength(4); // 1 from previous test + 3 new
    });
  });

  describe('Claim Review and Approval Workflow', () => {
    it('should allow admin to review a pending claim', async () => {
      const reviewData = {
        status: 'UNDER_REVIEW',
        reviewerNotes: 'Reviewing claim details and uploaded documents',
      };

      const response = await request(app.getHttpServer())
        .patch(`/insurance/claims/${testClaimId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reviewData)
        .expect(200);

      expect(response.body.status).toBe('UNDER_REVIEW');
      expect(response.body.reviewerNotes).toBe(reviewData.reviewerNotes);
      expect(response.body.reviewedAt).toBeDefined();

      // Verify in database
      const claimInDb = await prisma.insuranceClaim.findUnique({
        where: { id: testClaimId },
      });

      expect(claimInDb?.status).toBe('UNDER_REVIEW');
    });

    it('should allow admin to approve claim with adjusted amount', async () => {
      const approvalData = {
        status: 'APPROVED',
        approvedAmount: 12000, // Adjusted down from 15000
        reviewerNotes: 'Approved with adjustment based on repair estimates',
      };

      const response = await request(app.getHttpServer())
        .patch(`/insurance/claims/${testClaimId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(approvalData)
        .expect(200);

      expect(response.body.status).toBe('APPROVED');
      expect(response.body.approvedAmount).toBe(12000);
      expect(response.body.amount).toBe(15000); // Original amount preserved
    });

    it('should allow admin to reject a claim', async () => {
      // Create a new claim for rejection test
      const newClaimResponse = await request(app.getHttpServer())
        .post('/insurance/claims')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          policyId: testPolicyId,
          bookingId: testBookingId,
          type: 'THEFT',
          description: 'Test rejection claim',
          amount: 5000,
          incidentDate: new Date().toISOString(),
        });

      const newClaimId = newClaimResponse.body.id;

      const rejectionData = {
        status: 'REJECTED',
        reviewerNotes: 'Insufficient evidence provided',
        rejectionReason: 'INSUFFICIENT_EVIDENCE',
      };

      const response = await request(app.getHttpServer())
        .patch(`/insurance/claims/${newClaimId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(rejectionData)
        .expect(200);

      expect(response.body.status).toBe('REJECTED');
      expect(response.body.rejectionReason).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('should prevent renter from reviewing their own claim', async () => {
      await request(app.getHttpServer())
        .patch(`/insurance/claims/${testClaimId}/review`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ status: 'APPROVED' })
        .expect(403);
    });
  });

  describe('Claim Status Tracking', () => {
    it('should return claim status history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/insurance/claims/${testClaimId}/history`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(3); // Created, Under Review, Approved

      // Verify status progression
      const statuses = response.body.map((h: { status: string }) => h.status);
      expect(statuses).toContain('PENDING_REVIEW');
      expect(statuses).toContain('UNDER_REVIEW');
      expect(statuses).toContain('APPROVED');
    });

    it('should list all claims for renter', async () => {
      const response = await request(app.getHttpServer())
        .get('/insurance/claims/my-claims')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(2); // At least our test claims

      // Verify claim structure
      const claim = response.body[0];
      expect(claim).toHaveProperty('id');
      expect(claim).toHaveProperty('status');
      expect(claim).toHaveProperty('amount');
      expect(claim).toHaveProperty('bookingId');
    });

    it('should filter claims by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/insurance/claims/my-claims?status=APPROVED')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.every((c: { status: string }) => c.status === 'APPROVED')).toBe(true);
    });
  });

  describe('Claim Payout Workflow', () => {
    it('should create payout for approved claim', async () => {
      const payoutResponse = await request(app.getHttpServer())
        .post(`/insurance/claims/${testClaimId}/payout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          payoutMethod: 'BANK_TRANSFER',
          accountDetails: {
            bankName: 'Test Bank',
            accountNumber: '1234567890',
            accountName: 'Test User',
          },
        })
        .expect(201);

      expect(payoutResponse.body).toMatchObject({
        id: expect.any(String),
        claimId: testClaimId,
        amount: 12000,
        status: 'PENDING',
        payoutMethod: 'BANK_TRANSFER',
      });

      // Verify claim status updated to PAYOUT_PENDING
      const claimInDb = await prisma.insuranceClaim.findUnique({
        where: { id: testClaimId },
      });

      expect(claimInDb?.status).toBe('PAYOUT_PENDING');
    });

    it('should track payout status changes', async () => {
      const payout = await prisma.insurancePayout.findFirst({
        where: { claimId: testClaimId },
      });

      expect(payout).not.toBeNull();

      // Simulate payout processing
      await prisma.insurancePayout.update({
        where: { id: payout!.id },
        data: { status: 'PROCESSING' },
      });

      const statusResponse = await request(app.getHttpServer())
        .get(`/insurance/claims/${testClaimId}/payout/status`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(statusResponse.body.status).toBe('PROCESSING');
    });
  });

  // Helper functions
  async function createTestUser(role: string) {
    const email = `test-${role}-${randomUUID()}@test.com`;
    const password = 'TestPassword123!';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        firstName: 'Test',
        lastName: role.charAt(0).toUpperCase() + role.slice(1),
        role: role.toUpperCase(),
      });

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });

    return {
      id: registerResponse.body.user?.id || loginResponse.body.user?.id,
      token: loginResponse.body.accessToken,
    };
  }

  async function createTestListing(ownerId: string) {
    const listing = await prisma.listing.create({
      data: {
        ownerId,
        title: 'Test Apartment for Insurance',
        description: 'A test listing for insurance claims testing',
        basePrice: 2000,
        dailyPrice: 2000,
        currency: 'NPR',
        category: 'apartment',
        maxGuests: 4,
        bedrooms: 2,
        bathrooms: 1,
        status: 'AVAILABLE',
        address: {
          create: {
            city: 'Kathmandu',
            country: 'NP',
            latitude: 27.7172,
            longitude: 85.324,
          },
        },
      },
    });

    return listing.id;
  }

  async function createTestBooking(renterId: string, ownerId: string, listingId: string) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 3);

    const booking = await prisma.booking.create({
      data: {
        renterId,
        ownerId,
        listingId,
        startDate,
        endDate,
        guestCount: 2,
        status: 'CONFIRMED',
        totalAmount: 6000,
        currency: 'NPR',
      },
    });

    return booking.id;
  }

  async function createTestPolicy(renterId: string, bookingId: string) {
    const policy = await prisma.insurancePolicy.create({
      data: {
        userId: renterId,
        bookingId,
        type: 'DAMAGE_PROTECTION',
        coverageAmount: 50000,
        premium: 500,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return policy.id;
  }

  async function cleanupTestData() {
    // Delete in correct order to avoid FK constraints
    await prisma.insurancePayout.deleteMany({
      where: {
        claim: {
          policy: {
            user: { email: { contains: 'test-' } },
          },
        },
      },
    });

    await prisma.insuranceClaimDocument.deleteMany({
      where: {
        claim: {
          policy: {
            user: { email: { contains: 'test-' } },
          },
        },
      },
    });

    await prisma.insuranceClaim.deleteMany({
      where: {
        policy: {
          user: { email: { contains: 'test-' } },
        },
      },
    });

    await prisma.insurancePolicy.deleteMany({
      where: {
        user: { email: { contains: 'test-' } },
      },
    });

    await prisma.booking.deleteMany({
      where: {
        OR: [
          { renter: { email: { contains: 'test-' } } },
          { listing: { owner: { email: { contains: 'test-' } } } },
        ],
      },
    });

    await prisma.listing.deleteMany({
      where: {
        owner: { email: { contains: 'test-' } },
      },
    });

    await prisma.user.deleteMany({
      where: { email: { contains: 'test-' } },
    });
  }
});
