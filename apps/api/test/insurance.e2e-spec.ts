import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Insurance E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let listingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    // Create test user and get auth token
    const authResponse = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'insurance-test@example.com',
      password: 'Test123!',
      name: 'Insurance Test User',
    });

    authToken = authResponse.body.accessToken;
    userId = authResponse.body.user.id;

    // Create test listing
    const listingResponse = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'High-value Camera Equipment',
        description: 'Professional camera for rent',
        pricePerDay: 600,
        categoryId: 'electronics-category-id',
        location: {
          address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
        },
      });

    listingId = listingResponse.body.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.insurancePolicy.deleteMany({ where: { userId } });
    await prisma.listing.deleteMany({ where: { ownerId: userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  describe('GET /insurance/listings/:id/requirement', () => {
    it('should return insurance requirement for high-value listing', () => {
      return request(app.getHttpServer())
        .get(`/insurance/listings/${listingId}/requirement`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.required).toBe(true);
          expect(res.body.minimumCoverage).toBeGreaterThan(0);
          expect(res.body.type).toBeDefined();
          expect(res.body.reason).toBeDefined();
        });
    });

    it('should return 404 for non-existent listing', () => {
      return request(app.getHttpServer())
        .get('/insurance/listings/nonexistent-id/requirement')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get(`/insurance/listings/${listingId}/requirement`)
        .expect(401);
    });
  });

  describe('POST /insurance/policies', () => {
    it('should submit insurance policy', () => {
      return request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          listingId,
          policyNumber: 'POL-TEST-123456',
          provider: 'Test Insurance Co',
          type: 'LIABILITY',
          coverageAmount: 100000,
          effectiveDate: new Date('2026-01-01').toISOString(),
          expirationDate: new Date('2026-12-31').toISOString(),
          documentUrl: 'https://example.com/policy.pdf',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.status).toBe('PENDING');
          expect(res.body.policyNumber).toBe('POL-TEST-123456');
        });
    });

    it('should reject policy with insufficient coverage', () => {
      return request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          listingId,
          policyNumber: 'POL-TEST-LOW',
          provider: 'Test Insurance Co',
          type: 'LIABILITY',
          coverageAmount: 100, // Too low
          effectiveDate: new Date('2026-01-01').toISOString(),
          expirationDate: new Date('2026-12-31').toISOString(),
          documentUrl: 'https://example.com/policy.pdf',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('coverage');
        });
    });

    it('should reject expired policy', () => {
      return request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          listingId,
          policyNumber: 'POL-TEST-EXPIRED',
          provider: 'Test Insurance Co',
          type: 'LIABILITY',
          coverageAmount: 100000,
          effectiveDate: new Date('2025-01-01').toISOString(),
          expirationDate: new Date('2025-12-31').toISOString(),
          documentUrl: 'https://example.com/policy.pdf',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('expired');
        });
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          listingId,
          // Missing required fields
        })
        .expect(400);
    });
  });

  describe('GET /insurance/policies', () => {
    it('should return user policies', async () => {
      // Create a policy first
      await request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          listingId,
          policyNumber: 'POL-GET-TEST',
          provider: 'Test Insurance Co',
          type: 'LIABILITY',
          coverageAmount: 100000,
          effectiveDate: new Date('2026-01-01').toISOString(),
          expirationDate: new Date('2026-12-31').toISOString(),
          documentUrl: 'https://example.com/policy.pdf',
        });

      return request(app.getHttpServer())
        .get('/insurance/policies')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('policyNumber');
        });
    });

    it('should filter policies by status', () => {
      return request(app.getHttpServer())
        .get('/insurance/policies?status=PENDING')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          if (res.body.length > 0) {
            expect(res.body[0].status).toBe('PENDING');
          }
        });
    });
  });

  describe('GET /insurance/policies/:id', () => {
    let policyId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          listingId,
          policyNumber: 'POL-DETAIL-TEST',
          provider: 'Test Insurance Co',
          type: 'LIABILITY',
          coverageAmount: 100000,
          effectiveDate: new Date('2026-01-01').toISOString(),
          expirationDate: new Date('2026-12-31').toISOString(),
          documentUrl: 'https://example.com/policy.pdf',
        });

      policyId = response.body.id;
    });

    it('should return policy details', () => {
      return request(app.getHttpServer())
        .get(`/insurance/policies/${policyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(policyId);
          expect(res.body.policyNumber).toBe('POL-DETAIL-TEST');
        });
    });

    it('should return 404 for non-existent policy', () => {
      return request(app.getHttpServer())
        .get('/insurance/policies/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should not allow access to other user policies', async () => {
      // Create another user
      const otherUserRes = await request(app.getHttpServer()).post('/auth/register').send({
        email: 'other-insurance-test@example.com',
        password: 'Test123!',
        name: 'Other Test User',
      });

      const otherUserToken = otherUserRes.body.accessToken;

      return request(app.getHttpServer())
        .get(`/insurance/policies/${policyId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });
  });

  describe('POST /insurance/policies/:id/verify (Admin)', () => {
    let policyId: string;
    let adminToken: string;

    beforeAll(async () => {
      // Create admin user
      const adminRes = await request(app.getHttpServer()).post('/auth/register').send({
        email: 'admin-insurance@example.com',
        password: 'Admin123!',
        name: 'Admin User',
      });

      adminToken = adminRes.body.accessToken;

      // Create policy to verify
      const policyRes = await request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          listingId,
          policyNumber: 'POL-VERIFY-TEST',
          provider: 'Test Insurance Co',
          type: 'LIABILITY',
          coverageAmount: 100000,
          effectiveDate: new Date('2026-01-01').toISOString(),
          expirationDate: new Date('2026-12-31').toISOString(),
          documentUrl: 'https://example.com/policy.pdf',
        });

      policyId = policyRes.body.id;
    });

    it('should verify policy with admin role', () => {
      return request(app.getHttpServer())
        .post(`/insurance/policies/${policyId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Verified successfully',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('VERIFIED');
          expect(res.body.verifiedBy).toBeDefined();
        });
    });

    it('should not allow non-admin to verify', () => {
      return request(app.getHttpServer())
        .post(`/insurance/policies/${policyId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Attempting to verify',
        })
        .expect(403);
    });
  });

  describe('POST /insurance/policies/:id/reject (Admin)', () => {
    let policyId: string;
    let adminToken: string;

    beforeAll(async () => {
      // Get admin token from previous test or create new admin
      const adminRes = await request(app.getHttpServer()).post('/auth/login').send({
        email: 'admin-insurance@example.com',
        password: 'Admin123!',
      });

      adminToken = adminRes.body.accessToken;

      // Create policy to reject
      const policyRes = await request(app.getHttpServer())
        .post('/insurance/policies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          listingId,
          policyNumber: 'POL-REJECT-TEST',
          provider: 'Test Insurance Co',
          type: 'LIABILITY',
          coverageAmount: 100000,
          effectiveDate: new Date('2026-01-01').toISOString(),
          expirationDate: new Date('2026-12-31').toISOString(),
          documentUrl: 'https://example.com/policy.pdf',
        });

      policyId = policyRes.body.id;
    });

    it('should reject policy with reason', () => {
      return request(app.getHttpServer())
        .post(`/insurance/policies/${policyId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Invalid coverage documentation',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('REJECTED');
          expect(res.body.notes).toContain('Invalid coverage documentation');
        });
    });

    it('should require reason for rejection', () => {
      return request(app.getHttpServer())
        .post(`/insurance/policies/${policyId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });
  });
});
