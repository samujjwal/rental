import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';

describe('Admin Entities E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminUserId: string;
  let testInsurancePolicyId: string;
  let testInsuranceClaimId: string;
  let testEmailTemplateId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin-entities-test@example.com',
        username: 'admin-entities-test',
        password: '$2b$10$hashedpassword', // Mock hash
        firstName: 'Admin',
        lastName: 'Tester',
        role: UserRole.ADMIN,
      },
    });

    adminUserId = adminUser.id;

    // Get admin auth token
    const authResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'admin-entities-test@example.com',
      password: 'Test123!',
    });

    adminToken = authResponse.body.accessToken || 'mock-admin-token';
  });

  afterAll(async () => {
    // Cleanup test data
    if (testInsuranceClaimId) {
      await prisma.insuranceClaim.deleteMany({ where: { id: testInsuranceClaimId } });
    }
    if (testEmailTemplateId) {
      await prisma.emailTemplate.deleteMany({ where: { id: testEmailTemplateId } });
    }
    if (testInsurancePolicyId) {
      await prisma.insurancePolicy.deleteMany({ where: { id: testInsurancePolicyId } });
    }
    await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {
      /* ignore if already deleted */
    });
    await app.close();
  });

  describe('Insurance Claims Entity', () => {
    describe('GET /admin/schema/claims', () => {
      it('should return claims entity schema', () => {
        return request(app.getHttpServer())
          .get('/admin/schema/claims')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.name).toBe('Claim');
            expect(res.body.pluralName).toBe('Claims');
            expect(res.body.slug).toBe('claims');
            expect(res.body.fields).toBeDefined();
            expect(res.body.columns).toBeDefined();
            expect(res.body.filters).toBeDefined();
            expect(Array.isArray(res.body.fields)).toBe(true);
            expect(res.body.fields.length).toBeGreaterThan(0);
          });
      });
    });

    describe('GET /admin/entities/claims', () => {
      it('should return empty claims list initially', () => {
        return request(app.getHttpServer())
          .get('/admin/entities/claims')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toBeDefined();
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.pagination).toBeDefined();
            expect(res.body.pagination.page).toBe(1);
            expect(res.body.pagination.limit).toBe(10);
          });
      });

      it('should support pagination parameters', () => {
        return request(app.getHttpServer())
          .get('/admin/entities/claims?page=2&limit=20')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.pagination.page).toBe(2);
            expect(res.body.pagination.limit).toBe(20);
          });
      });

      it('should support search parameter', () => {
        return request(app.getHttpServer())
          .get('/admin/entities/claims?search=test')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should support sorting', () => {
        return request(app.getHttpServer())
          .get('/admin/entities/claims?sortBy=createdAt&sortOrder=desc')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });

    describe('Claims CRUD Operations', () => {
      let testPolicyId: string;
      let testBookingId: string;
      let testPropertyId: string;
      let testUserId: string;

      beforeAll(async () => {
        // Create test data for insurance claim
        const testUser = await prisma.user.create({
          data: {
            email: 'claim-test-user@example.com',
            username: 'claim-test-user',
            password: '$2b$10$hashedpassword',
            firstName: 'Claim',
            lastName: 'User',
          },
        });
        testUserId = testUser.id;

        const testProperty = await prisma.property.create({
          data: {
            title: 'Test Property for Claims',
            slug: 'test-property-claims',
            address: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US',
            type: 'APARTMENT',
            basePrice: 100,
            ownerId: testUserId,
          },
        });
        testPropertyId = testProperty.id;

        const testBooking = await prisma.booking.create({
          data: {
            listingId: testPropertyId,
            renterId: testUserId,
            startDate: new Date(),
            endDate: new Date(Date.now() + 86400000),
            basePrice: 100,
            totalPrice: 100,
            status: 'CONFIRMED',
          },
        });
        testBookingId = testBooking.id;

        const testPolicy = await prisma.insurancePolicy.create({
          data: {
            policyNumber: 'TEST-POLICY-001',
            bookingId: testBookingId,
            propertyId: testPropertyId,
            userId: testUserId,
            type: 'PROPERTY_DAMAGE',
            provider: 'Test Insurance Co',
            coverage: 5000,
            premium: 50,
            startDate: new Date(),
            endDate: new Date(Date.now() + 86400000),
          },
        });
        testPolicyId = testPolicy.id;
        testInsurancePolicyId = testPolicy.id;
      });

      it('should create a new insurance claim', async () => {
        const claim = await prisma.insuranceClaim.create({
          data: {
            policyId: testPolicyId,
            bookingId: testBookingId,
            propertyId: testPropertyId,
            claimNumber: 'CLM-TEST-001',
            claimAmount: 1000,
            description: 'Test damage claim',
            incidentDate: new Date(),
            status: 'PENDING',
            documents: [],
          },
        });

        testInsuranceClaimId = claim.id;

        expect(claim).toBeDefined();
        expect(claim.claimNumber).toBe('CLM-TEST-001');
        expect(claim.status).toBe('PENDING');
      });

      it('should fetch created claim via admin API', async () => {
        if (!testInsuranceClaimId) {
          console.log('Skipping: No claim created');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/admin/entities/claims')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.data).toBeDefined();
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      afterAll(async () => {
        // Cleanup in reverse order
        if (testInsuranceClaimId) {
          await prisma.insuranceClaim.delete({ where: { id: testInsuranceClaimId } }).catch(() => {
            /* ignore */
          });
        }
        if (testPolicyId) {
          await prisma.insurancePolicy.delete({ where: { id: testPolicyId } }).catch(() => {
            /* ignore */
          });
        }
        if (testBookingId) {
          await prisma.booking.delete({ where: { id: testBookingId } }).catch(() => {
            /* ignore */
          });
        }
        if (testPropertyId) {
          await prisma.property.delete({ where: { id: testPropertyId } }).catch(() => {
            /* ignore */
          });
        }
        if (testUserId) {
          await prisma.user.delete({ where: { id: testUserId } }).catch(() => {
            /* ignore */
          });
        }
      });
    });
  });

  describe('Email Templates Entity', () => {
    describe('GET /admin/schema/email-templates', () => {
      it('should return email templates entity schema', () => {
        return request(app.getHttpServer())
          .get('/admin/schema/email-templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.name).toBe('Email Template');
            expect(res.body.pluralName).toBe('Email Templates');
            expect(res.body.slug).toBe('email-templates');
            expect(res.body.fields).toBeDefined();
            expect(res.body.columns).toBeDefined();
            expect(res.body.filters).toBeDefined();
            expect(Array.isArray(res.body.fields)).toBe(true);
            expect(res.body.fields.length).toBeGreaterThan(0);
          });
      });
    });

    describe('GET /admin/entities/email-templates', () => {
      it('should return email templates list', () => {
        return request(app.getHttpServer())
          .get('/admin/entities/email-templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toBeDefined();
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.pagination).toBeDefined();
          });
      });

      it('should support pagination and filters', () => {
        return request(app.getHttpServer())
          .get('/admin/entities/email-templates?page=1&limit=5')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.pagination.limit).toBe(5);
          });
      });
    });

    describe('Email Template CRUD Operations', () => {
      it('should create a new email template', async () => {
        const template = await prisma.emailTemplate.create({
          data: {
            name: 'Test Welcome Email',
            subject: 'Welcome to Our Platform',
            body: '<h1>Welcome!</h1><p>Thank you for joining us.</p>',
            type: 'WELCOME',
            description: 'Welcome email for new users',
            variables: ['firstName', 'lastName', 'email'],
            isActive: true,
            category: 'transactional',
          },
        });

        testEmailTemplateId = template.id;

        expect(template).toBeDefined();
        expect(template.name).toBe('Test Welcome Email');
        expect(template.type).toBe('WELCOME');
        expect(template.isActive).toBe(true);
      });

      it('should fetch created template via admin API', async () => {
        if (!testEmailTemplateId) {
          console.log('Skipping: No template created');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/admin/entities/email-templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.data).toBeDefined();
        const templates = response.body.data;
        const foundTemplate = templates.find((t: any) => t.id === testEmailTemplateId);
        expect(foundTemplate).toBeDefined();
        if (foundTemplate) {
          expect(foundTemplate.name).toBe('Test Welcome Email');
        }
      });

      it('should update email template status', async () => {
        if (!testEmailTemplateId) {
          console.log('Skipping: No template created');
          return;
        }

        const updated = await prisma.emailTemplate.update({
          where: { id: testEmailTemplateId },
          data: { isActive: false },
        });

        expect(updated.isActive).toBe(false);
      });

      it('should search email templates by name', () => {
        return request(app.getHttpServer())
          .get('/admin/entities/email-templates?search=Welcome')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });
    });
  });

  describe('Admin Authorization', () => {
    it('should deny access without admin token', () => {
      return request(app.getHttpServer()).get('/admin/schema/claims').expect(401);
    });

    it('should deny access with invalid token', () => {
      return request(app.getHttpServer())
        .get('/admin/schema/claims')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Admin Entity Schema Consistency', () => {
    it('should have consistent schema structure for claims', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/schema/claims')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const schema = response.body;

      // Verify required schema properties
      expect(schema.name).toBeDefined();
      expect(schema.pluralName).toBeDefined();
      expect(schema.slug).toBeDefined();
      expect(schema.fields).toBeDefined();
      expect(schema.columns).toBeDefined();
      expect(schema.filters).toBeDefined();
      expect(schema.actions).toBeDefined();

      // Verify fields structure
      schema.fields.forEach((field: any) => {
        expect(field.name).toBeDefined();
        expect(field.type).toBeDefined();
        expect(field.label).toBeDefined();
      });

      // Verify columns structure
      schema.columns.forEach((column: any) => {
        expect(column.key).toBeDefined();
        expect(column.label).toBeDefined();
      });

      // Verify filters structure
      schema.filters.forEach((filter: any) => {
        expect(filter.field).toBeDefined();
        expect(filter.label).toBeDefined();
        expect(filter.type).toBeDefined();
      });
    });

    it('should have consistent schema structure for email-templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/schema/email-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const schema = response.body;

      // Verify required schema properties
      expect(schema.name).toBeDefined();
      expect(schema.pluralName).toBeDefined();
      expect(schema.slug).toBeDefined();
      expect(schema.fields).toBeDefined();
      expect(schema.columns).toBeDefined();
      expect(schema.filters).toBeDefined();
      expect(schema.actions).toBeDefined();

      // Verify at least one field has type 'select' with options
      const selectField = schema.fields.find((f: any) => f.type === 'select');
      expect(selectField).toBeDefined();
      if (selectField) {
        expect(selectField.options).toBeDefined();
        expect(Array.isArray(selectField.options)).toBe(true);
      }
    });
  });
});
